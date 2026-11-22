# AttendPro M1 — Attendance Lifecycle

- **Date:** 2026-10-15
- **Baseline commit:** `f87ce1d`
- **Milestone:** M1
- **Owner:** Security Agent
- **Companions:** `docs/attendpro/M1-ARCHITECTURE.md`, `docs/attendpro/M1-DATA-MODEL.md`, `docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/M1-KIOSK-SECURITY.md`
- **Status:** design only. No production code, no schema, no migration.

This document defines the authoritative state machine for an `Attendance` row: how a
clock-in or clock-out action is chosen on the server, how the record is written without
duplicates or races, how its status is computed from the shift and the grace policy, and
how an authorized correction changes it without erasing the original. PRD §10.2, §12,
§13 and §14 are the requirements it answers.

Value names come from `docs/attendpro/M1-DATA-MODEL.md`. Any value marked **Provisional**
is a working default taken from `docs/attendpro/DECISION-REGISTER.md` or introduced here
where the PRD leaves the choice to DevOS. A provisional value is a proposal for the owner
to accept or change, and nothing should be built before the owner signs off on the rows
named.

---

## 0. Provisional assumptions carried in

| Ref | Decision adopted (owner-confirmed 2026-10-16) | Register state |
|-----|-----------------------------------------------|----------------|
| O2 | QR badge plus a PIN. SMS codes are not used for kiosk clock-in; email codes are for account recovery only. The PIN is stored hashed with attempt limits, rate limits, temporary lockouts and an audited HR reset | Confirmed |
| O4 | Every attempt records a location assessment; outside the geo-fence is flagged for review, not blocked; poor accuracy gives location unknown, never outside | Confirmed |
| O8 | The job runs every 15 minutes; it closes at scheduled shift end plus a buffer (default 120 minutes) and flags; with no shift it closes after a maximum (default 840 minutes); overnight shifts belong to the day they start; the job is idempotent and never overwrites a genuine clock-out | Confirmed |
| O10 | Retention is configurable per business; no automatic deletion by default | Confirmed |
| O14 | Tests refuse to run unless the database name ends in `_test`, and host and database are verified before any destructive reset | Confirmed |
| O15 | One business-wide late grace; timing changes take effect from the next midnight in the business time zone and are effective-dated; historical classifications are never recalculated | Confirmed |
| O16 | Calendars, working-day and off-day configuration and absence calculation stay in v1; leave requests are deferred to v2, so no leave source affects absence in v1 | Confirmed |
| O17 | Corrections are requested within 7 days with a reason; HR approves same-day fixes and applies the stricter review beyond same day; nobody approves their own record; revisions stay append-only with one open correction per attendance row | Confirmed |
| O21 | Append-only database constraints: `audit_logs`, `attendance_correction_revisions` and `attendance_attempts` have no UPDATE or DELETE, and a trigger raises on attempt | Confirmed |

Two provisional values are introduced by this document and are not in the register:

- **Provisional (new): the punch action is recomputed at punch time and compared with
  the action shown at identification.** If the two differ, the punch is refused. This is
  the rule that stops a clock-out becoming a clock-in when a session is auto-closed mid
  verification (see §9).
- **Provisional (new): the early and on-time boundaries**, described in §5.2. The PRD
  fixes only that grace is configurable and that no universal grace period exists. The
  exact split between early and on time is a DevOS proposal.

---

## 1. The two writers of an attendance row

An `Attendance` row is created and closed by exactly two paths, and both are recorded:

| Writer | Reaches the row through | `ClosureReason` it writes |
|--------|-------------------------|----------------------------|
| A verified kiosk punch | `POST /api/attendance/clock-in` or `/clock-out` with a `VERIFIED` `VerificationSession` | `VERIFIED_CLOCK_OUT` on the out punch |
| The automatic clock-out job | `backend/jobs/autoClockOut.ts` (`M1-ARCHITECTURE.md` §4) | `AUTO_CLOCK_OUT` |
| An HR-assisted override | `POST /api/attendance/assisted` (O7) | `HR_ASSISTED` |
| An approved correction | `PATCH /api/hr/corrections/:id/decision` | `CORRECTION` |

A staff web session cannot reach any of these. The current repository allows any
authenticated role to call `POST /api/attendance/clock-in` and `/clock-out` (M0 finding
N5). PRD §7 and §10.2 move both to kiosk authentication, and
`M1-API-CONTRACTS.md` §8 records the move. This document assumes the kiosk path.

---

## 2. Deriving the permitted action on the server

The client never names the action. The kiosk may display a proposed action, but the
backend determines and enforces the real one at the moment of the punch. PRD §10.2 step 5
states the rule directly: the backend must not blindly trust an action supplied by the
frontend.

The action is a function of the employee's open session, computed inside the tenant
transaction:

| Employee state at punch time | Permitted action | Model transition |
|------------------------------|------------------|------------------|
| No row with `session_status = OPEN` | `CLOCK_IN` | `INSERT Attendance` with `session_status = OPEN`, `status = OPEN_SESSION` |
| Exactly one row with `session_status = OPEN` | `CLOCK_OUT` | `UPDATE` that row: `clock_out`, `session_status = CLOSED`, `closure_reason = VERIFIED_CLOCK_OUT` |

The open-session lookup runs against the `Attendance` table scoped by `businessId` and
`userId`, the pair the partial unique index protects (§3.2). `AttendanceAction` in the
data model has the two values `CLOCK_IN` and `CLOCK_OUT`; no third value exists, so the
client cannot widen the set.

The kiosk identifies an employee by QR before the PIN is verified, and
`POST /api/kiosk/identify` returns a `permittedAction` for display. That display value is advisory. The punch
recomputes the action from the database, because the state can change in the three
minutes between identification and verification (see §9, "clock-out after auto close").

### 2.1 The location assessment rides both calls

`POST /api/kiosk/identify` carries the reading the device took: `latitude`, `longitude`,
`accuracyMeters` and `capturedAt`. The punch carries the same fields again, because the
employee may have moved between the two calls. The server never accepts a verdict —
`locationResult` is computed by comparing the coordinates against the centre and radius of
the `Site` that kiosk belongs to, and it is written on the attempt (`AttendanceAttempt`)
rather than on the attendance row.

The comparison runs in this order, and stops at the first hit:

1. a capture older than `gpsFreshnessSeconds` gives `UNKNOWN`;
2. accuracy worse than `locationAccuracyThresholdMeters` gives `UNKNOWN`;
3. otherwise the distance is measured, and the reading is `INSIDE` or `OUTSIDE`.

`INSIDE`, `OUTSIDE` and `UNKNOWN` are recorded, never enforced. None of them refuses the
punch: `OUTSIDE` marks the attempt for review, and `UNKNOWN` is reported as location
unknown rather than as outside, so an inaccurate reading never accuses anyone. The
employee sees the ordinary success message and is not told where the fence sits; §9 gives
the kiosk-side behaviour. The thresholds come from `PolicyVersion`
(`geoFenceRadiusMeters`, `locationAccuracyThresholdMeters`, `gpsFreshnessSeconds`) and from
the `Site` row. The accuracy and freshness defaults are R1 and are still open.

---

## 3. The clock-in and clock-out transactions

Both punches run inside one interactive transaction that also sets the tenant
(`M1-ARCHITECTURE.md` §3.3). Nothing is written outside it.

### 3.1 Clock-in

1. The kiosk middleware (`M1-KIOSK-SECURITY.md` §2.3) verifies the device token,
   reloads the `KioskTerminal` row, and attaches `{ kioskId, businessId }`.
2. The service loads the `VerificationSession` by its hashed session id with a row lock
   (`SELECT ... FOR UPDATE`). It confirms `state = VERIFIED`, `expiresAt` is in the
   future, `consumedAt` is null, and `kioskId` matches the calling kiosk. Any failure
   leaves the session untouched and returns the safe message from
   `M1-KIOSK-SECURITY.md` §10.
3. The service resolves the effective `ShiftAssignment` at the punch instant
   (`effectiveFrom <= now < effectiveTo or effectiveTo is null`) and the effective
   `PolicyVersion` for that shift or the business default. It copies the shift window,
   the business timezone, and the grace values onto the new row as the snapshot columns
   the data model defines (`shiftStartMinuteSnapshot`, `shiftCrossesMidnightSnapshot`,
   `timezoneSnapshot`, `graceEarlyMinutesSnapshot`, `graceLateMinutesSnapshot`,
   `policyVersionId`).
4. The service computes the business-local `date` from the punch instant in the business
   timezone (`M1-ARCHITECTURE.md` §5.1).
5. The service inserts the row with `session_status = OPEN`,
   `status = OPEN_SESSION`, `clock_in = now`, and
   `source_verification_session_id = session.id`.
6. The service sets the session to `CONSUMED` with `consumedAt`, records an
   `AttendanceAttempt` with `outcome = SUCCESS` and `action = CLOCK_IN`, and writes an
   `AuditLog` row inside the same transaction.
7. The transaction commits. A unique violation on either constraint in §3.2 aborts the
   whole transaction, so no half-written state survives.

### 3.2 Idempotency and the two uniqueness guarantees

Two database constraints carry the correctness of the punch. Both are partial unique
indexes on `attendances`, created in raw SQL by the migration because the Prisma schema
cannot express them.

| Constraint | SQL | What it forbids |
|-----------|-----|-----------------|
| One open session per employee | `CREATE UNIQUE INDEX attendances_open_per_user_uq ON attendances(user_id) WHERE session_status = 'OPEN';` | Two rows with `session_status = OPEN` for one user. PRD §17. M0 finding F3. |
| One punch per verification session | `attendances.source_verification_session_id` is `@unique` | The same `VerificationSession` creating two attendance rows. PRD §10.3, §17. |

The first closes the race M0 finding F3 reproduced: `findFirst` then `create` in separate
statements lets two concurrent requests both observe no open session and both insert one.
The transaction in §3.1 plus the index makes that impossible. Whichever insert loses the
race gets a PostgreSQL `23505` unique violation, which the error contract maps to a
`409 CONFLICT` (`M1-ARCHITECTURE.md` §6.2).

The session is single-use as well. `M1-KIOSK-SECURITY.md` §4.2 moves a `VERIFIED` session
to `CONSUMED` in the same transaction as the punch, so a replayed request finds
`CONSUMED` and is refused. A retry that arrives after the first transaction committed but
before the client saw the response is resolved by looking up
`Attendance WHERE source_verification_session_id = session.id` first: if a row exists, the
service returns it instead of inserting a second one. The unique index is the backstop if
that lookup is ever bypassed.

### 3.3 Clock-out

The same shape, with one different guard:

1. Steps 1 and 2 of §3.1.
2. The service locks the employee's open row. If none exists, the caller gets a `400`
   with the no-open-session message (PRD §7 catalogue), and an `AttendanceAttempt` with
   `outcome = REJECTED` is written.
3. The service updates that row: `clock_out = now`,
   `session_status = CLOSED`, `closure_reason = VERIFIED_CLOCK_OUT`, and
   `hours_worked` recomputed from the stored `clock_in`.
4. The session moves to `CONSUMED`; the attempt and audit rows are written; the
   transaction commits.

### 3.4 Concurrency cases the transaction covers

| Race | Outcome |
|------|---------|
| Two clock-in requests for the same employee, same instant | One insert wins; the other gets `23505` mapped to `409`. One open row exists. |
| A clock-in and a clock-out for the same employee, same instant | The clock-in commits first; the clock-out locks the resulting open row and closes it. Ordering is serialized by the row lock. |
| Two clock-out requests for the same open row | One update wins; the other finds no open row and returns `400`. |
| A clock-in request and the automatic job for the same employee | The job closes only rows still `OPEN`. If the process has not run, no row exists; if it has, there is no open row to clock into. |

---

## 4. Attendance status vocabulary

PRD §12 lists the statuses. The data model standardises them as the `AttendanceStatus`
enum, and every value below is one of its eight members.

| `AttendanceStatus` | Meaning |
|--------------------|---------|
| `EARLY` | Closed with a verified clock-out, arrived before the shift start beyond the early boundary |
| `ON_TIME` | Closed with a verified clock-out, within the on-time window |
| `LATE` | Closed with a verified clock-out, after the shift start plus the late grace |
| `OPEN_SESSION` | A row whose `session_status = OPEN` and whose window has not yet ended |
| `CLOCK_OUT_MISSING` | An open row past its shift end that the automatic job left for HR, or an open row past its window with automatic clock-out disabled |
| `AUTO_CLOSED` | Closed by the automatic job, `closure_reason = AUTO_CLOCK_OUT` |
| `ABSENT_NO_SHOW` | Scheduled working day with no clock-in by shift end plus grace; written by the day-close job |
| `ABSENT` | Legacy/alternate absent classification (may be used in reporting); prefer `ABSENT_NO_SHOW` for no-show |
| `REQUIRES_REVIEW` | The evaluation could not resolve a definite status, so HR decides |

The old enum (`PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `ON_LEAVE`) is converted in
migration 3. There is no `PRESENT` value in the new set: a present record with no lateness
computed becomes `ON_TIME`, and `HALF_DAY` and `ON_LEAVE` become `REQUIRES_REVIEW`. The
mapping and the `legacy_status` column that preserves the original are in
`M1-DATA-MODEL.md` §3.

---

## 5. Computing the status

Status is computed on the backend from the row and its snapshots. The PRD is explicit
that attended status is a backend calculation (PRD §12) and that a later change to a shift
must not rewrite an earlier record (PRD §9, §12). The snapshots on the row make the
computation reproducible: the status is a function of `clock_in`, `clock_out`, and the
frozen shift and grace values, never of the shift's current definition.

### 5.1 The evaluation terms

Let `TZ` be `timezoneSnapshot`, `businessDate` be `Attendance.date`, `startMinute` and
`endMinute` be the shift snapshots, and `crossesMidnight` the shift snapshot flag.

- `shiftStartInstant` is `businessDate` at `startMinute` in `TZ`.
- `shiftEndInstant` is `businessDate` at `endMinute` in `TZ`, plus one day when
  `crossesMidnight` is true.
- `graceLateMinutes` and `graceEarlyMinutes` come from the row's grace snapshots.
- `lateBoundary = shiftStartInstant + graceLateMinutes`.
- `onTimeStart = shiftStartInstant - earlyThresholdMinutes` (see §5.2).

### 5.2 The classification order

Closed rows and open rows take different branches. Within a branch the first matching rule
wins.

**Open rows (`session_status = OPEN`):**

| Condition | `AttendanceStatus` |
|-----------|--------------------|
| Shift snapshot is missing, or the window cannot be resolved | `REQUIRES_REVIEW` |
| `now` is past `shiftEndInstant` and the row is still open | `CLOCK_OUT_MISSING` |
| Otherwise | `OPEN_SESSION` |

**Closed rows (`session_status = CLOSED`):**

| `closure_reason` | Condition | `AttendanceStatus` |
|------------------|-----------|--------------------|
| `VERIFIED_CLOCK_OUT` | `clock_in <= shiftStartInstant` and before `onTimeStart`... | `EARLY` |
| `VERIFIED_CLOCK_OUT` | `onTimeStart <= clock_in <= lateBoundary` | `ON_TIME` |
| `VERIFIED_CLOCK_OUT` | `clock_in > lateBoundary` | `LATE` |
| `VERIFIED_CLOCK_OUT` | Snapshots missing | `REQUIRES_REVIEW` |
| `AUTO_CLOCK_OUT` | Always | `AUTO_CLOSED` |
| `HR_ASSISTED` or `CORRECTION` | Effective `clock_in` present | `EARLY` / `ON_TIME` / `LATE` by the rows above |
| `HR_ASSISTED` or `CORRECTION` | No effective `clock_in` | `REQUIRES_REVIEW` |

The early and on-time boundaries are the **Provisional (new)** detail. The rule proposed
here: `EARLY` when the clock-in is at least `earlyThresholdMinutes` before the shift
start; `ON_TIME` from `shiftStartInstant - earlyThresholdMinutes` up to
`shiftStartInstant + graceLateMinutes`; `LATE` after that. With the data-model defaults
(`earlyThresholdMinutes = 0`, `graceLateMinutes = 0`) this reads: arrive at or before the
start is `ON_TIME` only at the exact start, before it is `EARLY`, after it is `LATE`. The
PRD's own illustration (5:55 early, 6:00 on time, 6:18 late, shift 6:00) is consistent
with a small positive `graceLateMinutes` and `earlyThresholdMinutes = 0`. The owner should
set the intended defaults before the policy editor ships.

### 5.3 Absence computation and when ABSENT_NO_SHOW is written

Absence is computed using the work calendar, not just the presence or absence of a punch. The day-close job evaluates each employee scheduled for a business day at the business timezone.

Definitions:
- A day is a **working day** for the employee if the `WorkCalendar` for the business (and assigned to the context) marks the weekday as working, and there is no `CalendarException` of kind `HOLIDAY` for that calendar on that date. A `CalendarException` of kind `WORKING_OVERRIDE` makes a normally non-working day a working day.
- **Leave**: not part of version one. Leave requests and leave allocation are deferred to version two (O16), so no leave source removes a day from absence in v1. The line is written out anyway so the shape of the rule is visible: when leave arrives, an approved leave covering the day is what will remove it.
- **No clock-in** means the employee never created an `Attendance` row with `clock_in` on or before shift end plus grace for that day.
- **Scheduled** means the employee has an effective `ShiftAssignment` covering that day (or is otherwise scheduled per policy). For overnight shifts, the day is the business date associated with the shift window (§6).

The day-close job (`backend/jobs/closeDay.ts`) runs in the business timezone after shift end plus grace. For each scheduled employee with no clock-in on a working day, the job writes an `Attendance` row with:
- `date` = business date
- `session_status = CLOSED`
- `status = ABSENT_NO_SHOW`
- `closure_reason = ABSENT_NO_SHOW`
- `clock_in = null`, `clock_out = null`
- `hours_worked = 0`
- Snapshots (shift, timezone, policy version) populated from the effective assignment/policy at evaluation time (frozen to that version)

If the day is not a working day (holiday or non-working weekday with no override), no `ABSENT_NO_SHOW` row is written. If the employee already has an `Attendance` row (open or closed) for that day, the job does not create a duplicate row (it respects the one-row-per-session/open and existing rows).

Distinguish:
- **Clock-out missing**: the employee clocked in but never clocked out by shift end; the row remains `session_status = OPEN` and is classified `CLOCK_OUT_MISSING`. The automatic clock-out job may close it as `AUTO_CLOSED` (§7), or HR may close it as `HR_ASSISTED`. This is different from "absent" (no clock-in at all).
- **Absent (no-show)**: no clock-in ever occurred on a scheduled working day; the day-close job creates a closed row with `closure_reason = ABSENT_NO_SHOW` and `status = ABSENT_NO_SHOW`.

Add `ABSENT_NO_SHOW` to `ClosureReason` enum. The punch path never writes absence.

---

## 6. Overnight shifts

PRD §11 requires that a shift starting on one day and ending on the next is not treated as
an ordinary same-day shift. The data model carries `crossesMidnight`, and `startMinute`
and `endMinute` are minute-of-day values, so an overnight shift is expressible without a
special time format.

Example: a Night shift, `startMinute = 1320` (22:00), `endMinute = 360` (06:00),
`crossesMidnight = true`, business timezone `Africa/Accra`.

- An employee clocks in at 22:05 on 1 October. `businessDate` is 1 October, the business's
  local date at the punch instant. The record belongs to 1 October.
- `shiftStartInstant` is 1 October 22:00 in `Africa/Accra`.
  `shiftEndInstant` is 2 October 06:00 in `Africa/Accra`, because
  `crossesMidnight` adds a day.
- The clock-out at 06:03 on 2 October closes the row that belongs to 1 October. The open
  session lookup does not filter by calendar date, so the crossing does not split the
  record.
- Punctuality reads against `shiftStartInstant`, which is 1 October 22:00, not 2 October.

A same-day shift (`crossesMidnight = false`) keeps `shiftEndInstant` on the same business
date. The single flag decides which formula applies, and the snapshot on each row records
which one was used.

---

## 7. Automatic clock-out

PRD §13 requires a business-level switch, a shift-aware and timezone-aware trigger, a
record that the closure was automatic, and no universal 23:59 rule. PRD §13 also says
ambiguous cases go to HR review instead of a guessed time. The job in
`M1-ARCHITECTURE.md` §4 implements exactly this; this section states the attendance-side
rules it must hold.

### 7.1 When it runs and what makes a row eligible

A row is eligible when all of these hold:

1. `session_status = OPEN`.
2. The effective policy for the row's shift has `auto_clock_out_enabled = true` (O8). If
   the business has automatic clock-out off, the job skips the row and the branch in §5.2
   leaves it `CLOCK_OUT_MISSING`.
3. `now >= shiftEndInstant + autoClockOutOffsetMinutes`, computed from the row's snapshot
   in the row's `timezoneSnapshot`.
4. The shift snapshot can be resolved. A row with no resolvable window is not closed; it
   moves to `REQUIRES_REVIEW` (PRD §13, last bullet).

Offsets are per business and per policy version, ranging 0 to 720 minutes in the proposed
policy editor (`M1-API-CONTRACTS.md` §5). There is no fixed wall-clock trigger. An
overnight shift's `shiftEndInstant` is already the next-day instant from §6, so a 60-minute
offset closes a 06:00 end at 07:00 the next morning rather than at any 23:59.

### 7.2 What the job writes

For each eligible row, in the tenant transaction:

- `clock_out = shiftEndInstant + autoClockOutOffsetMinutes`
- `session_status = CLOSED`
- `status = AUTO_CLOSED`
- `closure_reason = AUTO_CLOCK_OUT`
- `hours_worked` recomputed from the stored `clock_in`

The job filters on `session_status = 'OPEN'` in the `UPDATE`, so a verified clock-out that
already closed the row is never overwritten (PRD §13). A second run that races the first
matches nothing. The advisory lock in `M1-ARCHITECTURE.md` §4.1 keeps two workers from
running the sweep at once, and the per-user partial unique index means at most one row per
employee is even in scope.

The job writes an `AuditLog` row with `actor_type = SYSTEM` and a per-business summary
count. The preserved original clock-in stays on the row; automatic closure only fills the
out side and flips the close fields.

---

## 8. The correction workflow

PRD §14 requires a correction workflow separate from help requests, a record of the
original values, and a rule that a requester cannot approve their own correction. The
`AttendanceCorrection` model and `CorrectionStatus` enum carry this.

### 8.1 Correction state machine

```
SUBMITTED --(reviewer approves)----> APPROVED
    |     --(reviewer rejects)-----> REJECTED
    |     --(requester withdraws)---> WITHDRAWN
```

A correction starts `SUBMITTED`. Only an HR or SUPERADMIN reviewer moves it to
`APPROVED` or `REJECTED`; only the requester may move it to `WITHDRAWN`. There is no path
back into `SUBMITTED`.

### 8.2 What a submission captures

`POST /api/staff/corrections` writes a row with:

- `attendanceId`, the row under correction
- `requestedById`, forced to the authenticated staff member
- `reason`, the stated cause
- `proposedClockIn` and `proposedClockOut`, the requested values
- `originalValues`, a JSON copy of the attendance values at submission time, taken in the
  same transaction that reads the row
- `status = SUBMITTED`

The service bounds the row to the caller's own `businessId` and `userId`, and refuses a
second open correction for the same attendance row with `409`
(`M1-API-CONTRACTS.md` §3). Only one open correction per attendance row remains.

### 8.3 What an approval does (and revision history)

`PATCH /api/hr/corrections/:id/decision` runs one transaction:

1. Load the correction and its attendance row, both scoped to the reviewer's business.
2. Confirm the reviewer is not the requester. `reviewedById != requestedById` is a service
   check, and the actor role must be `HR` or `SUPERADMIN`. This is the PRD §4.2 and §14
   no-self-approval rule.
3. For each proposal, decision and applied change, create an `AttendanceCorrectionRevision` row (append-only). Each revision captures `revisionNo`, `valuesBefore`, `valuesAfter`, `actorId`, `createdAt` and `reason`.
4. On `APPROVED`: copy `proposedClockIn` and `proposedClockOut` into the attendance row, set `closure_reason = CORRECTION` (or keep as appropriate), recompute `hours_worked` and `status` by §5, and store the accepted values in `approvedValues`. Create a revision row recording the applied change.
5. On `REJECTED`: store the decision and note; leave the attendance row untouched. Create a revision row recording the decision.
6. Write an `AuditLog` row with the before and after values, the reviewer, and the correction id. The audit table is append-only; no UPDATE/DELETE permitted.

The original values are never overwritten. They remain on the correction row (`originalValues`) and in the audit and revision rows. The full correction history is the set of `AttendanceCorrectionRevision` rows (append-only), not overwriting the attendance row's history. `AttendanceCorrectionRevision`, `audit_logs` and `attendance_attempts` are append-only. The application DB role may SELECT and INSERT only; a BEFORE UPDATE OR DELETE trigger raises an exception on these tables. RLS permits only SELECT/INSERT. Only one open correction per attendance row remains.

### 8.4 Corrections on automatically closed rows

An `AUTO_CLOSED` row can be corrected. Approval recomputes the status from the accepted
values and sets `closure_reason = CORRECTION`. The fact that the row was originally closed
automatically is retained in `originalValues` and in the audit entry, so a corrected row
still shows its automatic origin. An employee cannot approve a correction to their own
auto-closed row; no non-reviewer can approve any correction.

---

## 9. Edge cases

| Case | What happens | Invariant preserved |
|------|--------------|---------------------|
| Double tap on the punch button | Two requests reach the same handler. The first commits the punch; the second finds the `VerificationSession` `CONSUMED` or the retry lookup finds the existing row and returns it. If both slip through, the partial unique index rejects the loser with `409`. | At most one punch per session, and at most one open session per employee. |
| Verification session expired before the PIN was entered | The session reached its lifetime, or the kiosk sat idle after identification. Verification returns the expired message and the kiosk returns to Ready; the employee identifies again. | A dead session verifies nothing. A session already consumed by a punch cannot be replayed, because it is tied to one session row. |
| Clock-out after auto-close | The employee had an open session at identification, the PIN was verified, and the automatic job closed the row before the punch. At punch time the recomputed action is now `CLOCK_IN`, which differs from the action shown at identify. The punch is refused (§0), an `AttendanceAttempt` with `outcome = REJECTED` is written, and the kiosk shows a safe "your attendance changed, see HR" message. | A clock-out is never silently turned into a second clock-in, and a real auto-closed value is not overwritten by a guess. |
| Employee is outside the site | The location assessment records `OUTSIDE` with the measured distance. The punch still lands, the row is flagged for review, and the kiosk shows the normal success message. | Bad geography is a review signal, never a denial; the employee is not told where the fence is. |
| Deactivated employee punches | Before a punch, if the employee is deactivated between identification and verification, the `User.isActive` check fails and the punch is refused with `403`. Existing history stays readable. | A deactivated account cannot clock in (PRD §15). History is preserved. |
| Deactivated employee with an open session | The open row remains. The automatic job and day-close still evaluate sessions/schedules; eligibility for auto-close reads the session state and policy, not `isActive`. With automatic clock-out off, the row becomes `CLOCK_OUT_MISSING` for HR. | Deactivation does not leave a session open forever and does not delete history. |
| Overnight shift crossing midnight | The `businessDate` stays on the start day; `shiftEndInstant` is the next day (§6). The clock-out closes the same row. | One attendance record spans the midnight boundary; nothing is split. |
| Timezone change mid-shift | A SUPERADMIN changes `Business.timezone` while a session is open. The open row keeps its `timezoneSnapshot`, and the automatic job uses that snapshot. New sessions use the new timezone and the new business date. The setting change is audited. | A setting change does not reinterpret an attendance record already recorded (PRD §9, §12). |
| Two kiosks, same employee, same instant | The partial unique index serialises the two clock-ins. One row is created; the other request gets `409`. | One open session per employee. |
| No shift assigned | `ShiftAssignment` resolves to nothing. The punch still records (PRD does not forbid punching without a shift), but the row has no window, so its status is `REQUIRES_REVIEW`. Absence evaluation treats unscheduled cases per policy. | A missing shift is surfaced for HR rather than guessed. |
| Correction submitted for an already-corrected row | A second `SUBMITTED` correction for the same attendance row is refused with `409`. | One open correction at a time, so approvals cannot interleave. |
| Working day with no leave system in v1 | Version one has no leave source, so every scheduled working day with no clock-in by shift end plus grace is evaluated as `ABSENT_NO_SHOW`. When leave arrives in version two, an approved leave covering the day will remove it. | Absence in v1 depends only on the calendar and the schedule, so nothing undocumented can silence a no-show. |
| Holiday | CalendarException of kind `HOLIDAY` exists; day is not treated as working. Day-close does not write `ABSENT_NO_SHOW`. | Holidays not counted as no-show. |
| Working-weekend override | CalendarException of kind `WORKING_OVERRIDE` makes a normally non-working day working. If scheduled and no clock-in, day-close may write `ABSENT_NO_SHOW` (if conditions met). | Overrides are respected. |

---

## 10. Attendance record state machine

```
[*] --> OPEN_SESSION : clock-in committed
OPEN_SESSION --> CLOCK_OUT_MISSING : past shift end, still open
OPEN_SESSION --> REQUIRES_REVIEW : no resolvable shift window
CLOCK_OUT_MISSING --> AUTO_CLOSED : automatic job runs (enabled)
CLOCK_OUT_MISSING --> CLOSED_HR : HR-assisted close
OPEN_SESSION --> CLOSED_VERIFIED : verified clock-out
OPEN_SESSION --> AUTO_CLOSED : automatic job runs (enabled)
CLOSED_VERIFIED --> EARLY / ON_TIME / LATE : §5.2 classification
CLOSED_VERIFIED --> CLOSED_CORRECTED : correction approved
CLOSED_AUTO --> CLOSED_CORRECTED : correction approved
CLOSED_CORRECTED --> EARLY / ON_TIME / LATE : §5.2 reclassification
```

`CLOSED_VERIFIED`, `CLOSED_AUTO`, `CLOSED_HR` and `CLOSED_CORRECTED` are all
`session_status = CLOSED` rows distinguished by `closure_reason`, which is
`VERIFIED_CLOCK_OUT`, `AUTO_CLOCK_OUT`, `HR_ASSISTED` and `CORRECTION` respectively. The
`status` column carries the punctuality result on a closed row and the open branch of §5.2
on an open row.

---

## 11. Requirement-to-mechanism map

| PRD requirement | Mechanism in this document | Also in |
|-----------------|----------------------------|---------|
| Backend derives the action (§10.2 step 5) | §2, action recomputed at punch time | `M1-API-CONTRACTS.md` §8 |
| Duplicate requests cannot double-punch (§10.3) | §3.2 unique constraint on `source_verification_session_id`; single-use session | `M1-KIOSK-SECURITY.md` §4.2 |
| One open session per employee (§17) | §3.2 partial unique index | `M1-DATA-MODEL.md` §2, §6 |
| Status from configured rules (§12) | §5 snapshot-driven classification | `M1-DATA-MODEL.md` §3 |
| Grace is configurable, not universal (§12) | §5.1, §5.2 read `graceLateMinutesSnapshot` | `WorkplacePolicy`/`PolicyVersion` |
| Overnight shifts handled (§11) | §6 `crossesMidnight` and business date | `M1-ARCHITECTURE.md` §5.2 |
| Auto clock-out is shift-aware and flagged (§13) | §7, `closure_reason = AUTO_CLOCK_OUT` | `M1-ARCHITECTURE.md` §4 |
| No universal 23:59 closure (§13) | §7.1 offset from the shift end instant | decision register O8 |
| Ambiguous cases go to review (§13) | §5.2, §7.1 `REQUIRES_REVIEW` | data model §3 |
| Correction preserves the original (§14) | §8.2 `originalValues`, §8.3 append-only audit | `AttendanceCorrection` |
| No self-approval (§4.2, §14) | §8.3 reviewer identity check | `M1-API-CONTRACTS.md` §4 |

---

## 12. Open items for the owner

The decisions this document depends on are confirmed and sit in `DECISION-REGISTER.md`
(O2, O4, O8, O14, O15, O16, O17, O21). What is still open lives in section C of that
register, and only the rows that change something in this document are repeated here:

1. **R1** — the accuracy threshold below which a reading becomes `UNKNOWN`, and what counts as a stale location. It fixes the `locationAccuracyThresholdMeters` and `gpsFreshnessSeconds` defaults used in §5 and in the data model.
2. **R2** — what an employee does when the location comes back unknown. The recommendation is to allow the punch, flag it and review later. Nothing in §5.2 blocks on location, so this row only decides how the flag is raised.
3. **R4** — whether a shift already open is evaluated against the policy it started under. §6 and §7 assume it is.
4. **R5** — PIN length, attempt limit and lockout duration. §2 and §3 only require that verification fails until the PIN matches.
5. **R6** — how a failed clock-in becomes a correction without ever looking like a success (§8.2).
6. **R7** — who approves an HR officer's own correction, since §8.3 forbids self-approval (§8.3).
5. O16, O17, O19 are resolved; O20, O21, O22 defined in Decision Register. No open item for absence source in M1; day-close job and calendar models are defined here.
