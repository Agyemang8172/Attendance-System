# AttendPro — Decision Register and M1 Design-Review Record

- **Owner review:** 2026-10-16
- **Baseline commit:** `f87ce1d`
- **Repository state:** M0 is committed as `c4ee602`. The M1 documents are written but uncommitted, nothing is pushed, and no history has been merged.
- **Status:** M1 pending review. M2 implementation is not authorized.

This register carries the owner's decisions from the M1 design review of 2026-10-16. A
confirmed row replaces the earlier recommendation and is the input the design documents
must match. A row that is still open needs an answer before the milestone named.

The 2026-10-15 direction that added leave request and leave type models is **superseded**
by O16 below: leave requests, leave allocation and timetable upload are deferred to
version two. Only calendars, working-day and off-day configuration, and absence stay in
version one.

---

## A. Confirmed decisions (owner, 2026-10-16)

| Ref | Decision | Confirmed outcome |
|-----|----------|-------------------|
| O1 | Business onboarding | The product owner or operator creates business accounts. No public self-registration and no separate platform-wide operator login in version one. `SUPERADMIN` manages its own business only. |
| O2 | Attendance verification | QR badge plus a PIN. SMS one-time codes are not used for routine kiosk clock-in. Email codes are reserved for account recovery only. The PIN is stored as a secure hash with attempt limits, rate limits, temporary lockouts, and an audited HR reset. |
| O3 | Kiosk credentials | An administrator generates a one-time pairing code in the dashboard; it expires after 10 minutes and pairs the device, which issues a kiosk token. Token lifetime 30 days, renewed on use, maximum age 90 days then re-pair. An administrator can revoke a device from the devices page. The server checks device and token status on every request. |
| O4 | QR, GPS and geo-fencing | QR identifies the badge; the attempt records its timestamp and a location assessment. Each site has a geo-fence (centre plus radius; 150 m is an example, not mandatory). Every attempt records its location assessment. Outside the fence is flagged for review, not blocked. Poor accuracy gives "location unknown", never "outside". Location is one control among several and is not proof of identity. |
| O5 | Employee QR issuance | The server generates a long random credential and stores only a hash, shown once for printing. The original is not recoverable. Reissue revokes the previous credential. Deactivated employees hold no usable credential. A QR alone never authorizes a punch. |
| O6 | Email recovery code | Six digits, ten-minute expiry, single use, lock after five incorrect attempts, resends no more often than once every 60 seconds, stored hashed, rate limited, no account enumeration. Account recovery only. |
| O7 | Failed verification and recovery | Order: HR resets a forgotten PIN through an audited process; a lost or broken badge is reissued and the old credential revoked; other failures go to a correction request. A failed attempt is never a successful punch, and evidence of the failure is preserved without fabricating a record. |
| O8 | Automatic clock-out | A job runs every 15 minutes. An open session past scheduled shift end plus a buffer (default two hours) is closed at the scheduled shift end and flagged. With no shift assigned it closes after a maximum duration (default 14 hours). Overnight shifts belong to the day they start and are evaluated on the actual shift interval. The job is idempotent, never overwrites a genuine clock-out, and leaves an audit trail and review flag. |
| O9 | CSV reports | Three reports: daily attendance (staff id, name, date, shift, clock-in, clock-out, total hours, status, source, flags); period summary per employee (days present, late count, absence count, total hours); flags and corrections (exceptions, flags, requests, decisions, outcomes, role-limited). Times shown in the business time zone. Cells beginning `=`, `+`, `-` or `@` are prefixed with an apostrophe and CSV quoting is escaped. |
| O10 | Data retention | Configurable per business. No automatic deletion by default until legal and business requirements are confirmed. Attendance records, correction history, append-only audit logs, security events and other employee records are distinct categories that may keep different periods. Ghana-specific legal advice required before enabling deletion. |
| O11 | Platform operator | No platform-wide operator login in version one. The product owner creates business accounts through a controlled seed or admin process. A dedicated operator role is revisited only on a concrete need. |
| O12 | Session revocation | A `tokenVersion` or equivalent. Every authenticated request verifies the user is active, the token version is current, the action is authorized, and the request is scoped to the correct business. Deactivation increments the version, revokes the QR credential, disables or resets the PIN, blocks further attendance actions, and preserves history. |
| O13 | Existing Git repositories | Do not merge yet. Back up both histories; inspect remotes and uncommitted changes; compare `git log --oneline`; compare merge bases; identify the source of truth; reconcile on a new branch; avoid force-push; delete nothing without explicit approval. The owner will supply `git log --oneline -20` from each repository. |
| O14 | Test database | A separate test database and connection string. Fake data only; never copy real employee data. Tests refuse to run unless the database name ends in `_test`. Verify the configured database and host before any destructive reset. Test every migration against the isolated database first. The suffix check alone is not sufficient; the connection must also be verified. **Owner amendment, 2026-10-17:** the designated Prisma Postgres test instance (host `pooled.db.prisma.io`, database `postgres`, verified empty — 10 of 10 migrations unapplied) is accepted as the test database **without** the `_test` suffix, because that provider cannot rename its single database. The guard (backend/scripts/db-guard.sh) now identifies the designated database by its HOST matching `TEST_DB_HOST`; the destructive-reset host check is unchanged and still applies. The `_test` suffix remains the normal rule for any other database.
**Hosted-host delta (rehearsal, 2026-10-17):** the same instance's restricted connection forbids `CREATE ROLE` and `GRANT`/`REVOKE` entirely ("restricted superuser cannot create roles / grant or revoke privileges"). Migration 10's role layer is therefore written to tolerate such hosts: role creation and the attendpro_app grants are skipped with a `RAISE NOTICE` there, the `authenticate_lookup` PUBLIC-revoke is skipped too, and the two-role + RFC split applies unchanged on a standard PostgreSQL host later. Tenant enforcement on the hosted instance rests on the RLS policies (applied) plus the API-level businessId filters. |
| O15 | Timing policy | `SUPERADMIN` controls business-wide timing rules in the dashboard. One late grace period applies across shifts and employees unless the owner changes it later (example: five minutes; 6:05 is on time, 6:06 is late). Timing changes take effect from the next midnight in the business time zone, save with effective dates, and never recalculate historical classifications. The overnight and cross-midnight behaviour of the effective-date rule must be specified. |
| O16 | Calendars and absence | Version one includes shift assignment, working-day and off-day configuration, absence calculation, business working-calendar settings, and a per-business rule for observing public holidays. Leave requests, leave allocation and timetable upload are deferred to version two. `SUPERADMIN` configures schedules manually in the v1 dashboard. Absence must distinguish a scheduled employee from one on an off-day, and must never mark someone absent on a day they were not scheduled. |
| O17 | Attendance corrections | An employee may request a change to their own record within seven days, with a reason. HR approves same-day fixes; older fixes follow a stricter review. Nobody approves their own record. No attachments in v1. Keep a dedicated correction history and an append-only audit log covering original, proposed and approved values, reason, requester, reviewer, request and decision timestamps, and the final outcome. An independent review path for HR's own corrections must be defined. |
| O18 | Historical status migration | Map only where a clear one-to-one mapping exists. Preserve the original in `legacyStatus`; send ambiguous records to a "needs review" queue; never guess. Run a dry run that prints per-mapping counts, test against the isolated database first, and keep evidence for each mapping. An old `PRESENT` must not become `ON_TIME` when the data does not establish arrival time. |
| O19 | Governing design system (2026-10-16, second review) | Root `DESIGN.md`, the Operations Console, is the baseline for the Stage 3 comparison. `docs/DESIGN_PROPOSAL.md` (Paper and Brass) is evaluated against it. Final colour values are not settled until the owner reviews that comparison. |
| O20 | Kiosk-only punching | Routine punches happen at the kiosk only, without exception. The clock-in and clock-out buttons come out of the staff portal. QR, PIN and the location checks must not be bypassable from a browser. |
| O21 | Correction backstop | `SUPERADMIN` may decide a correction when HR is unavailable or has a conflict of interest. The no-self-approval rule applies to `SUPERADMIN` without exception. Every decision is written to the audit log. The escalation conditions are proposed in `M1-VISUAL-DESIGN-SYSTEM.md` §7 and need approval. |
| O22 | SUPERADMIN home | A dedicated business overview covering setup health, configuration and operational readiness. It is not the HR dashboard, and `SUPERADMIN` no longer inherits HR navigation as its home. |
| O23 | Profile and Settings placement | Both leave the sidebar for the account popover in all three roles, removing the duplication where each appeared twice. |
| O24 | No achievements or gamification | Achievements, badges, streaks and recognition elements are removed from the SUPERADMIN and HR dashboards. Audit note: neither dashboard contained one. The owner then confirmed on 2026-10-16 that the two remaining gamification elements are also removed: the staff attendance streak (`src/pages/Dashboard.tsx` line 152) and the Profile Achievements section (`src/pages/Profile.tsx` line 253, with the `BADGES` array at line 29 and `BadgeCard`). The badges were computed client-side from attendance records with no backing entity in the 19-model target. No gamification remains anywhere in v1. |

---

## B. Rows carried from the earlier register

These were open in the 2026-10-15 register and are now settled or deferred by the review.

| Ref | Decision | State after review |
|-----|----------|--------------------|
| — | Leave workflow (was O19) | **Deferred to version two** by O16. The `LeaveType` and `LeaveRequest` models come back out of version one. |
| — | Migration safety (was O20) | Still required. The review (§5, O14, O18) expects migration dry runs against the isolated database before production. Formal backup and restore rehearsal stays in the plan. |
| — | Append-only protection (was O21) | **Confirmed** by O17 ("dedicated correction history and append-only audit log") and §5. Enforcement is in the design. |
| — | Calendars per business (was O22) | **Confirmed**: one default working calendar per business in v1, schema allows more later. |
| O19 | Kiosk scan surface | **Open (see R3).** |
| O20 | PIN policy specifics | **Ruled by R5** (owner, 2026-10-17): four digits, 10 wrong attempts, 5-minute lockout. |
| O21 | Correction window policy | **Settled by O17**: seven days; separate strict rule beyond same day. |
| O22 | Site and geo-fence model | **Implicitly required by O4.** A `Site` (or `WorkSite`) entity with centre and radius is added to the data model. |

---

## C. Details to surface, not decide silently (from §7)

Each row is an open item the owner asked DevOS not to settle alone. Options and a
recommendation are given; the owner decides.

| Ref | Open detail | Options | Recommendation |
|-----|-------------|---------|----------------|
| R1 | Acceptable GPS accuracy threshold and the definition of stale location | (a) fixed default (for example accuracy ≤ 50 m, captured within 60 s), (b) per-business configurable | **Ruled by the owner on 2026-10-17.** The documented defaults are final: a reading must report accuracy within 1..500 m (outside that range the location is UNKNOWN, never OUTSIDE), a capture older than 60 seconds is stale, and the near-miss band sits within 25 m past the site's radius. Location stays a review flag, never a block. The values live as named constants in `backend/utils/location.ts`. |
| R2 | How staff retry or request review when location is unknown | (a) allow the punch, flag it, correct later, (b) block and route to HR, (c) prompt a retry then allow | (a): never block a genuine worker; flag and review, per O4 |
| R3 | Scan surface: personal phone, kiosk phone, or both | (a) kiosk phone only, (b) employee personal phone only, (c) both | Determine with the owner. This choice changes the whole security model and cannot be assumed |
| R4 | Effective-date behaviour for timing changes when a shift crosses midnight | (a) apply at the next midnight of the shift's start day, (b) apply at the next midnight of the shift's end day, (c) freeze running shifts until they close | (c): a shift already open is evaluated against the policy it started under |
| R5 | PIN policy specifics: length, attempt limit, lockout duration, reset evidence | (a) 6 digits, 5 attempts, 15-minute lockout, audited HR reset, (b) owner-specified | **Ruled (b) by the owner on 2026-10-17** with these final values: the badge PIN is **4 digits**, an account locks after **10** wrong attempts, and the lock lasts **5 minutes**. The audited HR reset is unchanged. Set in the verify-pin validator, the reset-pin generator, and the `PIN_MAX_ATTEMPTS` / `PIN_LOCK_MINUTES` constants. |
| R6 | How a failed clock-in enters the correction workflow without becoming a false success | (a) the employee raises a correction referencing the failed attempt, (b) HR creates it from the failed-attempt log | **Ruled by the owner on 2026-10-17.** Corrections are text-only: a reason plus the proposed times. No attachments, and the optional `attemptId` field is dropped from the correction API entirely. A failed punch stays findable in `attendance_attempts`; the correction never references it. |
| R7 | Independent approval for HR's own corrections | (a) a second HR user, (b) SUPERADMIN, (c) an owner-designated approver list | (b) where only one HR exists; otherwise (a). Needs the owner |
| R8 | Can attendance records and audit/security logs keep different retention periods | (a) yes, separate policies, (b) one period for all | (a): the categories differ and O10 already separates them |
| R9 | Whether the current database and migration history can safely support the tenant and audit design | (a) forward-only migrations on the existing database, (b) rebuild on a fresh database | Confirm after the M0 evidence: forward-only is viable, with the bootstrap business row and RLS |
| R10 | What happens to an open clock-in with no resolvable shift window. O8 says a session "with no shift it closes after a maximum (default 840 minutes)", but `M1-ATTENDANCE-LIFECYCLE.md` §7.1, §5.2, §9 and §10 consistently say such a row is flagged `REQUIRES_REVIEW`, not closed. M6 was built flag-only per the owner-approved M6 plan. | (a) keep the flag-only behavior, (b) close the session after the maximum duration | **Ruled (b) by the owner on 2026-10-17.** An OPEN row whose effective policy has automatic clock-out enabled and whose shift window is unresolvable closes once `now >= clock_in + autoClockOutMaxOpenMinutes` (column default 840, i.e. 14 hours), writing the same close set as the scheduled branch — `clockOut = clock_in + maxOpen`, `status AUTO_CLOSED`, `closureReason AUTO_CLOCK_OUT` — under the OPEN-status guard. Rows with no resolvable policy still flag `REQUIRES_REVIEW`. The O8 wording is now consistent with M1-ARCHITECTURE.md §4.2; wherever the lifecycle docs' §7.1/§5.2/§9/§10 say an enabled-policy no-window row is flagged rather than closed (flag-only wording), this ruling supersedes them. Implemented in `backend/jobs/autoClockOut.ts`. |

---

## D. Meta-decisions already settled

- Execution stays interactive; the Orchestrator lock remains on.
- Do not push to `origin` until the owner approves.
- Biometrics stay out of scope.
- No universal grace period and no universal 23:59 auto-clock-out rule.
- No repository merges, destructive migrations, production resets or force-pushes without explicit authorization.
- Gate scripts stay on the maintained Windows-safe versions.

---

## E. M8 rulings (owner, 2026-10-17)

The M8 design-reconciliation audit (read-only, delivered before any M8 implementation)
found four business decisions without which the approved screen list could not be wired
truthfully. The owner ruled all four on 2026-10-17:

| Ref | Ruling | Outcome |
|-----|--------|---------|
| M8-R1 | Staff self-service change-PIN | **Build.** Add `POST /api/staff/profile/change-pin` (additive, no schema change): requires the current PIN, sets a new 4-digit PIN (R5), audited like the HR reset. Brings the approved `/profile/change-pin` screen alive. |
| M8-R2 | Staff schedule and off-days data | **Build staff read endpoints.** Additive staff-scoped reads for the caller's own shift assignments and off-day configuration, tenant-scoped like every other lane. No schema change. |
| M8-R3 | Plan defaults | **All four confirmed as-is:** the landing page ships fictional static constants with no backend endpoint; employee management moves to the `/api/hr/employees` lane; no "forgot access" link appears (email recovery, O6, remains unbuilt and deferred); the Super Admin admin screens (shifts, policies, calendars, sites, devices) ship as clearly labelled stubs in M8. |
| M8-R4 | Generic audit listing | **Build the listing endpoint.** Additive tenant-scoped audit listing per the already-designed contract rows, unlocking the HR audit-history screen and the Super Admin audit-log screen. No schema change. |

All three endpoint additions stay inside the zero-migration footprint; M8 remains audit-approved
otherwise. Carried, non-blocking items the audit recorded for later milestones: O12 tokenVersion
hygiene for user sessions and close-out revocation, O15 timezone application in the status engine,
the RLS app-role split on a standard PostgreSQL host, and the `error.message` hardening in
`userController.ts` (folded into M8 Phase 0).

---

## E.2 M8 walkthrough rulings (owner, 2026-10-17)

The screen-by-screen walkthrough (three read-only agents, delivered before M8 implementation) and
the owner's UI design-system directive settled the remaining open items:

| Ref | Ruling | Outcome |
|-----|--------|---------|
| M8-R5 | Correction withdrawal | **Build** `PATCH /api/staff/corrections/:id/withdraw` — requester-only, SUBMITTED corrections only, audited, zero migration. The lifecycle §8.1 `WITHDRAWN` state becomes reachable. |
| M8-R6 | Staff profile editing | **Read-only this milestone.** The PATCH profile endpoint rides a later milestone; profile fields route corrections-of-identity through help requests meanwhile. |
| M8-R7 | "Attendance Rate" card | **Dropped** in the staff overview rework (its 22-working-days denominator contradicted configurable calendars). |
| M8-R8 | Employee deactivation lane | **Stays on the audited legacy endpoint** (`DELETE /api/users/:id` with the self-guard and last-superadmin rule) while list/create/edit move to `/api/hr/employees`. Documented dual-lane, matching the alias pattern. |
| M8-R9 | HR "expected today" tile | **Dropped** — no endpoint knows today's shift assignments; the HR overview composes from punctuality-summary + exceptions only. |
| M8-R10 | HR-assisted override | **Never in v1** — the contract's "Provisional O7" row settles as not built; all fixes flow staff corrections and the auto clock-out job. |
| M8-R11 | SA admin screens | **Real screens in M8** (amends the stub default in M8-R3): shifts/assignments, working calendars, grace/auto-clock-out policies, sites, kiosk devices (pairing/revoke) — all endpoints already verified, zero migration. QR issue/revoke rides the employee detail/work. |
| M8-R12 | Browser evidence | **`@playwright/test` approved** as M8's only new devDependency; viewport screenshots + interaction checks at 375/768/1440 are enforced evidence for every in-scope screen. |
| M8-R13 | Unused webfonts | **Removed.** Fraunces/General Sans/IBM Plex Mono requests are deleted (loaded but never referenced); typography stays Georgia serif/system-ui exactly as rendered today. |

Also settled by the design directive itself (no further decision): minimum keyboard-accessibility
criteria fold into review, permission-denied screens must remain usable (the 403/404 panels are
built), and fixtures/exports never substitute for backend authorization. The setup-health card on
the SA home keeps the walkthrough default: a read-only checklist from existing GETs.
