# P11 — Shift Assignments technical design

2026-11-10. Architecture checkpoint for the owner. Produced by the Orchestrator with the Architect, DBA and Security reviewers. Read-only review: no schema, migration, RLS policy, application code or git index was modified.

The owner has approved the product direction: future-dated assignments are supported, the current shift stays effective until the future assignment begins, effective-dated assignments are the source of truth, history is preserved, assignment periods never overlap for one employee, normal backdating is refused, inactive shifts cannot receive new assignments, Superadmin writes and HR reads, assignment changes are audited, business dates respect the configured business timezone, and `users.shiftId` is a legacy compatibility field rather than an authoritative schedule.

On 2026-11-13 the owner approved the remaining P11.2 rules, which settle the open questions in this document:

1. An assignment may begin on any future business-local date, at that date's midnight.
2. An overnight shift belongs to the business date it starts on.
3. Historical backdating is refused, and a same-day change must not rewrite realized attendance or a completed period.
4. An active assignment is replaced by an audited effective-dated change, never by rewriting its historical start.
5. Cancelling a future assignment restores the predecessor's coverage and keeps durable cancellation evidence.
6. Stored instants survive a business timezone change, and new assignments use the currently configured zone.

## 1. Representation

An assignment occupies the half-open interval `[effective_from, effective_to)`. A null `effective_to` means the row is the tail of the chain, not that it is in force now.

| State | Derived rule |
|---|---|
| Historical | `effective_to IS NOT NULL AND effective_to <= now`; this rule is evaluated first, so an empty cancelled interval is historical rather than future |
| Current | `effective_from <= now AND (effective_to IS NULL OR now < effective_to)` |
| Future | `effective_from > now AND (effective_to IS NULL OR effective_from < effective_to)` |

State is derived from the instant at read time and returned as a `status` field plus `isEffectiveNow`. Nothing is stored as `isActive`, in line with the plan's refusal to invent that field (`docs/attendpro/PHASED-IMPLEMENTATION-PLAN.md:134`).

When a future assignment starts at F, the chain link covering F is closed at F and the new row becomes the tail. The current row therefore carries a non-null `effective_to` once a future row exists, which is why `effective_to IS NULL` can no longer stand for "current". The comment at `backend/prisma/schema.prisma:258` describes the old convention and needs updating with the schema.

**The effective instant has two forms.** A future assignment begins at the midnight that starts its business date in the business's zone (rule 1). A same-day replacement begins at the current instant instead, because the day's earlier period may already be realized and rule 3 forbids rewriting it. Both are absolute instants; the difference is only which one is chosen. A request that names a date before the current business date is refused.

One helper resolves the assignment in force at an instant, shared by the punch resolver, the staff schedule and the write path. The pattern already exists and is correct in `backend/controllers/attendanceController.ts:59-106`: the dated row wins, latest `effective_from` first, with `users.shift_id` used only as a fallback for employees who have no assignment rows at all.

## 2. Operations

Every replacement appends a successor: the predecessor is closed and its start is never edited. Cancellation may move the predecessor's end — to the next non-empty successor's start, or to null when there is no later successor — to restore future coverage, but no operation deletes an assignment row or edits a realized span (rules 4 and 5).

| Operation | Contract | Rows written in one transaction | Audit event |
|---|---|---|---|
| Create | `POST /business/shifts/:id/assignments` with `{ employeeId, effectiveFrom: "YYYY-MM-DD" }` | close the predecessor at the new start when the new start is later than the predecessor's start; insert the new tail row | `assignment.created` |
| Replace | `POST /business/shifts/:id/assignments` again | close the predecessor at the new start; insert the successor; the predecessor's start is never touched | `assignment.replaced` |
| Reschedule | `PATCH /business/assignments/:id`, future rows only | close the future row onto itself as amendment evidence; move only its contiguous predecessor's future end to the amended start when needed to preserve coverage; insert the amended successor; leave the predecessor's start, realized span and legacy pointer untouched | `assignment.rescheduled` |
| Cancel a future row | `DELETE /business/assignments/:id` where `effective_from > now` | set the future row's `effective_to` to its own `effective_from`, producing an empty interval; restore the predecessor through the next non-empty successor's start, or to null when there is no later successor | `assignment.cancelled` |
| End the current row | `DELETE /business/assignments/:id` where `effective_from <= now` | close at now; cancel any future row; clear the legacy pointer | `assignment.deactivated` |

A row already in force is not editable. A change to a live schedule is a new row that starts at the current instant or at a future business midnight, and the predecessor is closed rather than edited (rule 4). No operation rewrites a realized period.

Guards on every write: the shift must be active, the employee must be active, both records must belong to the caller's tenant, the business date must not be in the past (rule 3), and the new interval must not overlap any existing interval for that employee.

Existing assignments to a shift that is later deactivated stay visible and stay in force; only new assignments to an inactive shift are refused.

**Same-day replacement.** A request naming the current business date does not begin at that date's midnight, because the day's earlier period may already be realized. The transaction first acquires the employee advisory lock, then captures one `clock_timestamp()` value and reuses that value for the predecessor close, successor start, compatibility pointer decision and audit payload. Capturing the value after lock acquisition prevents time spent waiting for a concurrent writer from moving the effective boundary backwards. The predecessor's realized span is never re-interpreted, and no attendance row is recalculated.

**Cancellation evidence.** A cancelled future row is not deleted and not emptied silently: its interval is closed onto itself, leaving a durable record that the row existed and was withdrawn, and the audit row names the cancelled row, the restored predecessor and the reason (rule 5). The predecessor resumes coverage only until the next non-empty successor begins; its end becomes null only when no later successor exists. This handles cancellation in the middle of a future chain without creating an overlap. Only the predecessor's future tail moves; its realized span and its start are untouched. This is the selected representation. Inserting another successor that repeats the predecessor's shift was rejected because it would leave two rows for the same shift and require a resolver tie-break without improving the evidence.

**Owner-approved PATCH amendment (2026-11-15).** Leaving every preceding row unchanged can leave a gap when a future replacement moves later. Under the employee lock, if the target directly follows a non-empty predecessor whose end equals the target's old start, move only that predecessor's future end to the amended start (extend it for a later start or shorten it for an earlier one). Refuse a start at or before the predecessor's start, or one that overlaps another non-empty row. Never edit the predecessor's start or completed span. The `assignment.rescheduled` audit records the predecessor before and after alongside the cancelled target and successor. If there is no contiguous predecessor, do not invent one; the gap stays unscheduled and the dated resolver must not fall back to `users.shiftId` when assignment history exists.

**The audit row is durable and part of the same transaction.** Each operation writes one `audit_logs` row carrying the actor, the business, the entity, the superseded row before and the new row after, the effective dates and a reason. The row is written through the transaction client with `tx.auditLog.create`, the pattern used by `persistAudit` in `backend/controllers/userController.ts:89-94`, so it commits or rolls back with the write it describes. The shared `writeAudit` helper accepts a transaction client but swallows insert failures (`backend/utils/auditWriter.ts:100-111`), so it cannot be the only guarantee for a schedule write. The stdout logging that the assignment path uses today (`backend/controllers/assignmentController.ts:99,214`) stays as a log line and does not satisfy this requirement.

**History is preserved.** No operation deletes an assignment row, and no operation edits a realized period. Closing a row sets its end, cancelling a future row closes it onto itself and reopens its predecessor, and both leave the rows in place for evidence. The deactivation of a shift leaves its assignments visible and in force.

## 3. Overlap prevention and concurrency

Two mechanisms, one authoritative:

- The exclusion constraint rejects any overlapping interval for the same employee, in every path, including a direct SQL insert that bypasses the application.
- After the tenant proxy establishes `app.business_id`, the first lifecycle statement takes a transaction-scoped 64-bit advisory lock with the parameterized expression `pg_advisory_xact_lock(hashtextextended('attendpro:assignment:' || $businessId || ':' || $employeeId, 0))`. The namespace and both identifiers are part of the key; values are bound parameters rather than interpolated SQL. The existing 15-second tenant transaction timeout bounds lock waiting.
- After acquiring the lock, the write re-reads the employee's chain. If a non-empty row already has the requested effective start, the request returns `409` without changing the chain. This makes two identical concurrent creates settle as one success and one conflict rather than two successive replacements.

The transaction stays at the default read-committed level. `backend/config/prismaClient.ts:96-99` sets no isolation level, and raising it to serialisable would convert races into retry loops. The advisory lock plus the constraint is deterministic and cheap.

PostgreSQL raises `23P01` for an exclusion violation and `23514` for a check violation. The controller maps `23P01` to `409`; today only `P2002` is handled (`backend/controllers/assignmentController.ts:104-110`), so an overlap currently surfaces as `500`. The `P2002` message also misstates the conflict: the partial unique index limits open rows per employee, not duplicate employee and shift pairs.

The existing partial unique index `shift_assignments_current_uq` (`backend/prisma/migrations/20261015140000_shift_scheduling_and_policies/migration.sql:176`) stays. Under the chain model exactly one row per employee is open-ended, so the index remains true and the new constraint is a strict addition.

An empty cancellation interval does not overlap any range under PostgreSQL range semantics. This is intentional: cancellation evidence may coexist with the restored effective chain and is ignored by the effective-assignment resolver. Only the cancellation path may create an empty interval, it may never be reopened, and its audit insert must commit in the same transaction.

## 4. Migration and constraints required

Yes, one new migration is required. No schema, migration or policy was written during this review; the following is a proposal for approval.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "shift_assignments"
  ADD CONSTRAINT "shift_assignments_period_ck"
  CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "shift_assignments"
  ADD CONSTRAINT "shift_assignments_no_overlap"
  EXCLUDE USING gist (
    "business_id" WITH =,
    "user_id" WITH =,
    (tstzrange("effective_from", "effective_to", '[)')) WITH &&
  );
```

`btree_gist` is required because GiST equality over the text identifiers needs it, and it exists nowhere in `backend/prisma/migrations/` today. The exclusion key includes `business_id` as defence in depth even though `user_id` is globally unique.

Row level security is unchanged. The enable statement and the tenant isolation policy already exist (`migration.sql:198-201`), and the write path already runs inside the tenant-scoped transaction that sets `app.business_id` (`backend/config/prismaClient.ts:134-158`), so the policy's `WITH CHECK` binds the write. The owner authorized composite foreign keys for this checkpoint: `(business_id, user_id)` references `users(business_id, id)` and `(business_id, shift_id)` references `shifts(business_id, id)`, both with `ON DELETE RESTRICT ON UPDATE CASCADE`. The existing single-column foreign keys remain; the composite keys are additive raw-SQL safeguards, while matching Prisma `@@unique` declarations represent the referenced unique pairs.

**Application and availability.** The migration runs as one transaction: Prisma Migrate wraps each PostgreSQL migration in a transaction, and every statement here — `CREATE EXTENSION`, `CREATE UNIQUE INDEX`, `ADD CONSTRAINT` including the GiST exclusion — is transactional in PostgreSQL, so a failure leaves no partial object. No `CONCURRENTLY` build is used, which preserves that atomicity at the cost of blocking writes on `users`, `shifts` and `shift_assignments` while each object is built and validated; measure the duration on a restored production-like copy and schedule the window accordingly. If `btree_gist` cannot be created by the migration role, the statement fails closed and nothing is applied.

**Expected schema drift.** The check and exclusion constraints and the composite foreign keys are raw SQL that Prisma does not model, and the relations on `shift_assignments` now name the composite pairs, so `prisma migrate diff` against the database also reports the retained single-column foreign keys (`shift_assignments_user_id_fkey`, `shift_assignments_shift_id_fkey`) as droppable, and would generate Prisma's default names (`shift_assignments_business_id_user_id_fkey`, `shift_assignments_business_id_shift_id_fkey`) instead of the handwritten ones. Migrations in this repository are handwritten and applied through the guarded script; `prisma:migrate` (`prisma migrate dev`) must never run against a live database, and any generated diff that drops the retained single-column keys must be filtered out.

## 5. The legacy `users.shift_id` field

`users.shift_id` becomes a cache of the shift in force now, never a second source of truth.

- Only the assignment write path writes it.
- It moves only when a new assignment starts at or before now. A future assignment never moves it, so it lags by design.
- It is cleared when the last in-force assignment ends.
- The dated resolver ignores it whenever an assignment row exists, which already holds in `backend/controllers/attendanceController.ts:87-103`.

The requirement that a new shift becomes effective automatically is met by the resolver evaluating the dated rows at the instant of the read. No scheduled job mutates the pointer, and no pointer write is needed for activation.

One gap must close: the pointer is currently also writable by HR through `PATCH /api/hr/employees/:id` and `PATCH /api/users/:id` (`backend/controllers/userController.ts:154,177`), which writes scheduling state with no assignment row, no effective dating and no audit. The Security reviewer rates this critical. The owner has approved removing those writes as a security change: the field leaves the create and update schemas, the controller writes and the public projection (`backend/controllers/userController.ts:15`), leaving the assignment path as the only writer.

The pointer is then deprecated in stages. It stops being an hours source once an employee has a schedule version in force, it stops being written once the fallback signal shows it is unused, and the column is dropped only by a later owner-approved destructive migration. The stages and the retirement signal are set out in `P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md` section 5.

## 6. Business dates to effective instants

The client sends a business calendar date, `YYYY-MM-DD`, and the server converts it. The client's current `+ "T00:00:00.000Z"` (`src/pages/Scheduling.tsx:124,130`) sends UTC midnight, which lands on the previous day for any business east of UTC.

The conversion uses the business's own IANA zone, `businesses.timezone` (`backend/prisma/schema.prisma:123`, default `UTC`, already exposed by `backend/controllers/businessController.ts:57`). The rule: the effective instant is the earliest instant whose local date in that zone is the requested business date. In a daylight-saving gap the first representable instant of that local day is used; in an overlap the first occurrence is used.

Stored instants are absolute and never move when the business timezone later changes (rule 6). Only new assignments and business-date arithmetic use the new zone. The staff schedule must move to the same day boundaries: it currently resolves them at UTC midnight (`backend/controllers/staffScheduleController.ts:32-33`) and the staff screen omits the required `startDate` and `endDate`, so that request is refused and the schedule renders empty.

A same-day request is the one case that does not use a business midnight. It uses the instant the transaction runs, so that a period already realized that day is not re-interpreted (rule 3).

## 7. Migration of existing data

No migration or seed inserts assignment rows; the only seed inserts are a business and its users. Existing rows come from the live API, so the rollout must be rehearsed on a restored copy.

1. Dry run on a restore: count overlapping intervals per employee, count employees whose `users.shift_id` is set with no assignment row, and compare the pointer with the row in force.
2. Owner approves the repair set.
3. Backfill: for each employee with a pointer and no assignment, insert one row with `effective_from` set to the employee's creation time and `effective_to` null.
4. Confirm the overlap query returns zero rows.
5. Apply the constraint migration with `migrate deploy`, after checking a scratch database for drift.
6. Verify `pg_constraint` shows both new constraints and `pg_indexes` still shows `shift_assignments_current_uq`.
7. Deploy the application change.

The constraint can only be added once the data is clean, because adding it to overlapping data fails the migration outright.

## 8. Listing, pagination and the Scheduling screen

`GET /business/assignments` returns the same envelope shape as the P10 shift list (`backend/controllers/shiftController.ts:73-77`):

```
{ success, data: [ { id, employee, shift, effectiveFrom, effectiveFromBusinessDate,
                     effectiveTo, effectiveToBusinessDate, status, isEffectiveNow, createdAt } ],
  pagination: { currentPage, totalPages, totalRecords },
  meta: { businessTimezone } }
```

Query parameters: `page`, `limit` up to 100, `employeeId`, `shiftId`, `status`, `search`, `from`, `to`. `totalRecords` is used because the scheduling screen already reads that name.

Corrections required in `src/pages/Scheduling.tsx`:

1. The employee and shift lookups request `limit: 1000` (`:81-82`) while both routes cap at 100, so both fail and the page never loads. They become searchable, paginated pickers.
2. The screen reads a `pagination` envelope (`:88-93`) that the controller does not send.
3. Create and edit send identical requests (`:120-133`); the comment claims the old row is deactivated, but no such call is made. Edit becomes `PATCH` on a future row, and an in-force row becomes read-only with a "schedule change from date" action.
4. The default date comes from the device's UTC date (`:69,136,161`); it becomes the current business date.
5. The `isActive` pill (`:238-239`) becomes the derived `status`, and rows pointing at a deactivated shift remain visible.

The staff schedule consumer is corrected in the same slice: it must use business-day boundaries and send the required date range.

## 9. PostgreSQL tests required before acceptance

These tests need a real database. The isolated instance described in `P11A-TEST-DATABASE-ENVIRONMENT-PROPOSAL.md` satisfies the gate: it is PostgreSQL 16.10 with the extension the exclusion constraint needs, the existing migrations applied through the project's own guarded script, and the tenant policy proved against the instance.

1. Overlapping intervals for one employee are rejected; adjacent intervals where one ends exactly where the next begins are accepted; different employees never conflict.
2. Two open-ended rows for one employee are rejected.
3. Two concurrent inserts of overlapping intervals: one commits, the other reports a conflict; no orphan rows.
4. Two concurrent creates through the API for one employee and the same effective start: after acquiring the same namespaced 64-bit advisory lock, one succeeds with 201 and the second re-reads the chain and returns 409; the chain stays consistent.
5. Future flow: a current row plus a future row leaves the current shift in force now and the new shift in force after the future start.
6. A backdated business date is refused and writes no rows; the current business date is accepted and begins at the instant the transaction ran, so the day's realized span is untouched.
7. A new assignment to a deactivated shift is refused; an existing assignment to that shift is still listed and still in force.
8. Tenant isolation: a write carrying another tenant's employee or shift is refused; the row-level policy rejects a write with no tenant set.
9. Migration rehearsal on a restored copy: the overlap query returns zero rows, the constraint applies, the backfill leaves one open row per employee.
10. Atomicity: a failure between closing the predecessor and inserting the new row leaves no closed-without-successor row and leaves the pointer unchanged.
11. Cancel a future row closes it onto itself, restores the predecessor's coverage and leaves durable evidence; ending the current row closes it at now and cancels the future row.
12. The exact `hashtextextended('attendpro:assignment:' || businessId || ':' || employeeId, 0)` transaction lock serialises concurrent creates for one employee without blocking a different employee.
13. Post-migration inspection of `pg_constraint` and `pg_indexes`.
14. The effective-shift resolver returns the old shift now and the new shift after the future start, with the pointer unchanged in between.

### The tenant-policy tests must not run as a superuser

The database-backed suites connect as the owner role of the isolated cluster, exactly as the pipeline does, so row level security is bypassed during a suite run. The tenant policy is therefore proved separately, by connecting as the non-superuser application role:

15. With no tenant set, the application role reads no rows from a tenant table and a write is refused.
16. With the tenant set to one business, a write naming another business is refused by the policy.
17. With the tenant set to the same business, the write is accepted, so the refusal in 16 is about the tenant rather than about the operation.
18. A join across the assignment and its tenant returns only the calling tenant's rows.
19. A deterministic failure injected after the predecessor closes — a disposable test-only trigger on `audit_logs`, created and dropped inside the test — rolls back the whole write: no successor, unchanged pointer, no audit row. The trigger exists only in the disposable database and is never part of a migration.

## 10. Employee weekly schedules

The owner added a requirement on 2026-11-10: flexible employee-specific weekly schedules, where each employee's working days and exact start and end times are entered for Monday through Sunday, templates are optional rather than mandatory, future changes preserve history, and calculations use the business timezone. The full design is in `P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md`.

The relationship to this document is narrow and settled:

- A shift assignment links an employee to a shared tenant-wide template. The new requirement gives the employee their own times, which a template cannot hold without turning the tenant catalogue into a per-employee roster.
- The weekly schedule version in force is the single source of truth for hours. A shift assignment stops supplying hours from the first schedule version's start date and stays meaningful as the policy anchor, the report label and the legacy pointer.
- The resolution chain is: personal day off, authorised holiday exception, business holiday, the schedule version in force, then this slice's assignment fallback, then no window. The assignment fallback is transitional and is retired on a measurable signal.
- Overnight belongs to the starting business date, so a resolver given an instant examines the business date of the instant and the business date before it, and keeps the window whose start is at or before the instant.
- Both features share the effective-dating discipline, the exclusion-constraint approach and the business-date conversion rule, and they need the same `btree_gist` extension in one migration.

Two items from this document change as a result. The legacy pointer becomes a cache that a schedule write never moves, and the attendance snapshot records which rule produced the window, so the minutes this slice writes can be attributed to a schedule version, an assignment or the pointer.

The requirement does not fit the plan's P12, which is calendar administration over the business work calendar, holidays and working-day overrides (`docs/attendpro/PHASED-IMPLEMENTATION-PLAN.md:138-145`). P11a is a separate unit after this slice and before P16, and it reads the P12 calendar rows, so it also depends on P12.

## Decisions

The owner approved on 2026-11-10: the legacy pointer is deprecated from now while its column stays, the attendance snapshot keeps the resolved working-time values and gains their source, the two migrations are coordinated but separately reviewable, and the composite tenant foreign keys and exclusion constraints need a DBA review against a real PostgreSQL.

The owner approved the product rules on 2026-11-13, which close the five product questions:

1. An assignment begins at the midnight that starts its business date, in the business's zone, for any future date.
2. An overnight shift belongs to the business date it starts on.
3. A date before the current business date is refused, and a same-day change begins at the current instant so that realized attendance and completed periods are untouched.
4. An active assignment is replaced by closing it and inserting an audited successor; its historical start is never rewritten.
5. Cancelling a future assignment restores the predecessor's coverage and keeps durable cancellation evidence.
6. Stored instants survive a business timezone change; new assignments use the currently configured zone.

Settled at the 2026-11-14 database-integrity checkpoint, effective with migration approval:

- The composite foreign keys binding `business_id` to the referenced user and shift rows are authorized for preparation; the migration retains the existing single-column foreign keys as additive guards.
- `PATCH /business/assignments/:id` amends a future row only: it closes that row onto itself and inserts an audited successor, so no `effective_from` is ever edited, and the event is `assignment.rescheduled`. A POST that closes a row in force emits `assignment.replaced`.
- A client-supplied `reason` becomes a required body field on every assignment mutation and is recorded in the same-transaction audit row.

Still open, as technical choices:

1. Whether the inactive-shift rule is enforced in the application only, or also by a database trigger.
2. Permission to install `btree_gist` on the pilot host, verified against the exact migration role before deployment; the migration fails closed if it is unavailable. The earlier advisory-lock and serialisable-isolation fallback is not equivalent protection and needs separate approval if it is ever proposed.
3. Whether the assignment write route gets a rate limiter and an idempotency key.

### Proposals pending the owner's confirmation

These are the review recommendations. They are written into the design so the shape is reviewable, and none of them is an approved decision until the owner confirms it.

| Proposal | Recommendation | Consequence if it changes |
|---|---|---|
| The legacy pointer keeps a permanent lag while a schedule version exists | Keep the four stages in `P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md` section 5, and require a separate approval for each stage | An earlier retirement needs the fallback to be removed sooner, with the attendance fallback signal re-tested |
| The attendance provenance foreign keys use `RESTRICT` | `RESTRICT`, because a cascading null erases the source the decision requires | `SET NULL` would let a deleted version silently drop the provenance, so the reader rule would need a null case |
| The assignment write takes an idempotency key and an actor-keyed rate limit | Add both, with the schedule write using the same policy | Without them, a retry can create a second assignment and one account can rewrite a whole tenant's schedule |
| The deprecation retirement signal is thirty days with no assignment or pointer resolution | Keep it, measured from the new `window_source` column | A shorter window retires the fallback sooner and needs the fallback to be unused already |
| The staff schedule range is bounded at 190 days | Keep the bound already used by the staff routes | A larger bound widens the per-request resolution work |

Two decisions are shared with the weekly schedule design in `P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md`: the fate of the legacy pointer, which the owner has now framed as a compatibility field rather than an authoritative schedule, and the shape of the staff schedule contract, which the new requirement changes. The permission question raised by the new requirement, where HR enters working times, is answered in that document's section 5 and was approved on 2026-11-10.
