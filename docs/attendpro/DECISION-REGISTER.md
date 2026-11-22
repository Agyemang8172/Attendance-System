# AttendPro — Decision Register and M1 Design-Review Record

> Current authority update, 2026-10-31: section G records the owner's final product and information-architecture approvals. It supersedes earlier pending/open statements for those decisions, including E.4, E.6 and F.2. Earlier sections remain dated evidence. Implementation is not authorized by this documentation session.

- **Owner review:** 2026-10-16
- **Baseline commit:** `f87ce1d`
- **Historical repository snapshot (2026-10-16):** M0 was committed as `c4ee602`; the M1 documents were uncommitted. These are historical facts, not a current Git-status report.
- **Current status (2026-10-27):** M1 approval and later owner rulings supersede the original pending-review status. REC-01 through REC-05 are accepted and CLOSED. Section F distinguishes current requirements, implemented behavior, gaps and unresolved decisions. REC-06 documentation reconciliation is authorized; acceptance is pending.
- **2026-10-21 design reconciliation:** D-01 to D-05 in §E.3 settle design authority and landing scope. They do not authorise a landing restyle, application code change, commit, or push.

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
| M8-R3 | Plan defaults | **All four confirmed as-is:** the landing page ships fictional static constants with no backend endpoint; employee management moves to the `/api/hr/employees` lane; no "forgot access" link appears (email recovery, O6, remains unbuilt and deferred); the Super Admin admin screens (shifts, policies, calendars, sites, devices) ship as clearly labelled stubs in M8. **Supersession:** the admin-stub default was amended by M8-R11; retain the other recorded scope decisions. |
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

## E.3 Design reconciliation decisions (owner, 2026-10-21)

The owner approved the design-reconciliation direction with conditions. These decisions settle
the design-authority and landing-scope conflict without authorising a landing restyle.

| Ref | Decision | Consequence |
|---|---|---|
| D-01 | Root `DESIGN.md` is the single authoritative design contract. | Superseded proposals and historical plans cannot override it. `docs/DESIGN_PROPOSAL.md` remains the approved source and rationale. |
| D-02 | Paper & Brass remains the governing design system. The Linear dark/indigo system is archived reference. | The landing page is paper. The old dark landing tokens are not a target. No palette change is authorised before the status proposal is reviewed. |
| D-03 | AttendPro is a general-purpose attendance management system. The landing page uses `Example Organisation` and industry-neutral sample data. | `Finest Supermarket`, `Accra`, and single-industry landing copy are superseded. Static sample data remains per M8-R3. |
| D-04 | The landing page has explicit required, removed, and deferred elements plus measurable acceptance criteria. | `docs/attendpro/LANDING-PAGE-SPEC.md` governs the landing page. Visual verification must cover 375, 390, 768, 1280, and 1440 widths. |
| D-05 | Documentation reconciliation happens before implementation. Status colours are proposed for review before any token change. | `docs/attendpro/STATUS-PALETTE-PROPOSAL.md` is the review artefact. No application code, database configuration, production setting, or colour token changes until the owner reviews the result. |

The documentation reconciliation is not a landing restyle. The restyle begins only after the owner
reviews the final design contract, landing specification, change list, and verification plan.

## E.4 Proposed screen-plan decisions (pending owner approval, 2026-10-21)

These rows preserve the screen-level proposals from 2026-10-21. D-07 below is
HISTORICAL/SUPERSEDED by its approved decision in E.5. D-06/D-08/D-09/D-10/D-11
remain UNRESOLVED DECISION unless a separate explicit approval is recorded. U-06
approves the walkthrough medium; it does not approve every detail of D-09.

| Ref | Proposal | Consequence if approved |
|---|---|---|
| D-06 | `docs/attendpro/DESIGN-PLAN.md` is the single screen-level design plan. Root `DESIGN.md` remains the visual contract; `LANDING-PAGE-SPEC.md` remains the landing annex. | Historical M1 routes, PIN copy, and navigation are evidence, not target authority. A screen without a contract in the plan is not ready to implement. |
| D-07 | The kiosk verification conflict must be resolved before either the kiosk UI or the SMS OTP walkthrough is built. The implemented v1 flow is QR + PIN (O2). PRD §10/§22 and the 2026-10-21 brief ask for QR + SMS OTP. | Recommended: keep QR + PIN for v1 and correct the PRD and walkthrough to PIN. If SMS OTP is required, add a separate phase for provider, consent, phone verification, OTP storage, send/resend, expiry, attempts, rate limits, audit, cost, and tests. No SMS OTP depiction ships before that. |
| D-08 | HR PIN reset visibility is unresolved. The backend returns the generated PIN, the route comment says it does not, and the M1 screen says HR never sees it. | Recommended: one-time display to the authorized operator, audited, with a warning that it cannot be retrieved again. The alternative is a one-time employee set-PIN flow. The API response, route comment, and screen copy must agree. |
| D-09 | The landing hero includes a silent, captioned, 24-second product walkthrough with a static fallback and a transcript. It is not a second CTA and uses only fictional data. | The walkthrough is a required landing element, gated by D-07, the status palette, and the owner's medium choice. |
| D-10 | v1 corrections change proposed clock-in and clock-out only. The backend recalculates status after approval. | The staff correction form drops its status field. The detail shows status as an outcome, not a proposal. |
| D-11 | The current exception dismiss control is removed in v1. | Exceptions clear when the underlying record is corrected, auto-closed, or reviewed. Reintroducing dismiss requires an audited review action and a clear business rule. |

## E.5 Approved implementation decisions (owner, 2026-10-21)

| Ref | Decision | Consequence |
|---|---|---|
| D-07 | The v1 kiosk verification workflow is QR badge plus 4-digit PIN. SMS one-time codes are not used for routine kiosk clock-in. | The landing walkthrough uses the PIN variant only. No SMS OTP scene, provider, or backend flow is implemented. The PRD wording that says QR + SMS OTP must be corrected before release. |
| U-06 | The landing walkthrough is built as a lightweight DOM/SVG scene player using existing design tokens. | No animation library is added. The player keeps pause, replay, transcript, static fallback, and reduced-motion behaviour. |
| U-07 | Privacy, Terms, and Contact links remain deferred until real pages exist. | No placeholder legal links are added to the landing page. |

## E.6 Open implementation decisions (recorded 2026-10-21)

| Ref | Status | Decision or next step |
|---|---|---|
| U-02 | Open | Review and approve, amend, or reject the proposed status palette before any colour token changes. |
| U-03 | Open | Define kiosk actions from the approved QR + PIN and clock-in/clock-out workflow before implementing kiosk UI. |
| U-05 | Proposed | `/manage-staff/:id` is proposed as the canonical employee-detail route; awaiting approval. |
| U-06 | Approved | The landing walkthrough is implemented as a lightweight DOM/SVG scene player. |
| U-07 | Deferred | Legal links remain absent until real pages exist. |


## F. Current reconciliation record (2026-10-27)

The owner accepted the REC-06 audit and authorized documentation reconciliation only.
This section applies later approved decisions without changing their requirements.
Earlier dated findings and superseded proposals remain evidence of their own period.

### F.1 Authority and classification

Owner-confirmed rows and later explicit approvals govern. The approved M10 plan
(`docs/superpowers/plans/2026-10-21-attendpro-m10-release-hardening.md`)
selects the standard PostgreSQL 16 private-pilot path. Root DESIGN.md remains the
visual contract (D-01); unapproved screen or palette proposals remain unresolved.
Current procedures are in README.md, TESTING_GUIDE.md and DEPLOYMENT-RUNBOOK.md.
CURRENT_STATE.md holds the dated recovery evidence; TASK_BOARD.md tracks execution.
DevOS architecture/setup documents describe tooling, not AttendPro product architecture.

| Classification | Meaning |
|---|---|
| APPROVED CURRENT REQUIREMENT | An explicitly approved obligation, whether or not all implementation is complete. |
| IMPLEMENTED CURRENT BEHAVIOR | Observed code or accepted verification evidence; it does not override an approved obligation. |
| APPROVED BUT NOT YET IMPLEMENTED | An approved obligation with identified missing implementation. |
| PLANNED/FUTURE | Deferred delivery or proposed future work; approval is stated separately where known. |
| HISTORICAL/SUPERSEDED | A dated record or earlier direction replaced by an identified later decision. |
| UNRESOLVED DECISION | Required approval or evidence is absent; no option is chosen by this reconciliation. |

### F.2 Current product and engineering truth

| Subject | Classification | Governing decision or evidence |
|---|---|---|
| Purpose and roles | APPROVED CURRENT REQUIREMENT | General-purpose attendance for businesses; STAFF, HR and business-scoped SUPERADMIN; no v1 platform-operator login or public self-registration (O1/O11/D-03). |
| Routine kiosk verification | APPROVED CURRENT REQUIREMENT | QR badge plus 4-digit PIN, 10 wrong attempts, 5-minute lockout; kiosk-only routine punches (O2/O20/R5/approved D-07). Routine SMS OTP and six-digit kiosk defaults are HISTORICAL/SUPERSEDED. |
| Persistence and tenancy | APPROVED CURRENT REQUIREMENT | PostgreSQL/Prisma; restricted application connection and existing RLS policies under approved M10. The old hosted role/grant exception does not replace this pilot requirement. |
| Tenant execution | IMPLEMENTED CURRENT BEHAVIOR | Authenticated request tenant context, Prisma query/interactive transaction with transaction-local app.business_id, restricted app connection when configured; narrowly explicit privileged workflows remain. Production requires DATABASE_URL_APP and a different URL username from the owner. That startup check alone does not prove role attributes or deployed enforcement. |
| Lookup and passwords | IMPLEMENTED CURRENT BEHAVIOR | REC-04A reuses authoritative bcrypt cost for unknown accounts; REC-04B removes owner-client lookup fallback. A successful empty lookup remains unknown-account handling; unexpected errors reach generic authentication failure. No constant-time claim. |
| Local restricted-path verification | IMPLEMENTED CURRENT BEHAVIOR | REC-04C accepted local request/tenant/Prisma/restricted-role/RLS and cleanup evidence on localhost:5432/attendpro_test. Temporary attendpro_test_app login/membership/credential removed. Local proof does not establish production deployment validation. |
| Swagger | IMPLEMENTED CURRENT BEHAVIOR | REC-05 defers the entire Swagger import/generation until an enabled documentation request; existing UI/JSON URLs remain. Production documentation is disabled. |
| Business-timezone calculations | APPROVED BUT NOT YET IMPLEMENTED | O15 remains required. Current status/window arithmetic uses UTC; stored timezoneSnapshot does not implement the business-local calculations or settle all effective-date/cross-midnight behavior. |
| Schedule/calendar-aware no-shows | APPROVED BUT NOT YET IMPLEMENTED | O16 remains required. The documented closeDay job is absent; current report no-row approximation is not schedule/calendar-aware enforcement. |
| Email account recovery | APPROVED BUT NOT YET IMPLEMENTED | O6 approved the recovery requirements; request/verify endpoints are absent and delivery was deferred in M8. Administrator password reset is implemented separately. |
| Later delivery | PLANNED/FUTURE | Kiosk frontend with U-03 actions unresolved; leave/allocation/timetable in v2; real legal pages/links when available (O16/U-07). |
| PIN reset visibility | UNRESOLVED DECISION | D-08 approval remains UNKNOWN. Current reset response returns the new PIN once; historical matrix/screen/route comments disagree. Neither visibility option is approved by this documentation edit. |
| Other proposals | UNRESOLVED DECISION | D-06/D-09/D-10/D-11, U-02/U-03/U-05 and other proposals lacking explicit approval remain pending. In particular, correction-status field removal and exception-dismiss removal are not authorized here. |
| Node support | UNRESOLVED DECISION | CI config selects Node 20; accepted local recovery used Node 26. Historical Node 23 requirements do not settle a current supported-version policy. |

### F.3 Accepted recovery status and evidence limits

REC-01 preservation, REC-02 frontend storage correction, REC-03 backend baseline,
REC-04A/B/C and REC-05 are owner-accepted and CLOSED. See CURRENT_STATE.md for the
ledger and recorded test/startup samples. REC-06 is documentation-only and awaits
owner acceptance; REC-07 is not authorized by this record.

The REC-04 non-blocking backlog retains the owner credential in the API process for
explicit privileged workflows, reproducible restricted-role verification beyond the
ordinary owner-mode suite, and deployment-specific role/provisioning validation.
These limitations do not reopen accepted REC-04 local verification or prove a reachable
unauthorized outcome. No persistent restricted test login was retained.

The historical roughly 38-second startup was not reproduced. Its historical cause
remains UNKNOWN. The measured REC-05 improvement is a local observation, not proof
of that historical cause. GitHub CI execution, production deployment validation and
historical MongoDB credential-rotation completion remain UNKNOWN without evidence.


### F.4 Reading retained keyword matches

These classifications apply when searching older documents. They do not rewrite
historical evidence or authorize the proposals those documents contain.

| Retained occurrence | Verification classification | Current reading |
|---|---|---|
| Routine SMS OTP in M0 reports, dated forensic inputs, earlier plans and E.4 D-07 | HISTORICAL | Superseded by O2 and approved E.5 D-07. Current statements excluding routine SMS OTP are CURRENT. |
| M8-GAP-REGISTER L12 and the older DESIGN-PLAN SMS-conflict discussion | HISTORICAL | The conflict existed in the dated review; E.5 D-07 settled it. These passages do not reopen the PIN/SMS choice. Other genuinely pending design decisions remain UNRESOLVED. |
| Six-digit kiosk defaults in retained M1 API/security text and old M5 plans | HISTORICAL | R5 governs four-digit kiosk PINs. Six-digit O6 email recovery codes are PLANNED delivery of an approved unimplemented requirement, not kiosk PINs. |
| MongoDB/Mongoose in the original audit, requirements snapshot and old board | HISTORICAL | PostgreSQL/Prisma is CURRENT persistence. Historical credential-rotation completion is UNRESOLVED/UNKNOWN; migration does not prove credentials were rotated. |
| Owner-only production runtime, unread app URL, pending local RLS and public production Swagger in prior snapshots | HISTORICAL | Current operating docs and accepted REC-04/REC-05 supersede those descriptions. Development/test owner fallback is CURRENT behavior with stated proof limits. |
| Old incomplete task/status records now under historical notices | HISTORICAL | REC-01 through REC-05 are accepted and closed. REC-06 acceptance and production deployment evidence remain separate. |
| D-08, D-10, D-11 and other proposals lacking explicit approval | UNRESOLVED | Preserve pending decisions; an implemented response or control does not approve a design option. |

The current operating documents must not instruct routine SMS OTP, six-digit kiosk
PINs, owner-only production runtime or production Swagger exposure. Any newly found
active instruction of that kind is ERROR and requires correction, not reclassification
as an approved requirement.

## G. Final delivery and information-architecture approvals - 2026-10-31

Authority: Godfred's explicit approvals in the current planning chat, including the final corrections and phased implementation-plan request. These decisions are recorded now; they do not imply source implementation, current tests passing, or deployment verification.

### G.1 Product decisions now locked

| Ref | Approved decision | Delivery consequence |
|---|---|---|
| D-06 | The reviewed Master Gap and Requirements Plan is the current delivery baseline, subordinate to approved decisions and root DESIGN.md. | Persisted as [MASTER-GAP-REQUIREMENTS.md](MASTER-GAP-REQUIREMENTS.md); [the phased plan](PHASED-IMPLEMENTATION-PLAN.md) schedules delivery without reducing scope. |
| R4 / O15 | A running attendance session retains its starting policy across midnight. | Preserve historical/session snapshots; complete business-timezone, global grace and next-business-midnight behavior without reclassifying history. |
| D-08 / U-04 | An authorized resetting operator sees the replacement four-digit PIN once. | Reconcile response, UI and comments; preserve target-role restrictions; no later PIN retrieval or secret logging. |
| D-10 | Staff propose corrected punch times; AttendPro derives classification. | Repair proposal payloads and remove status-as-proposal UI; retain independent review and original/proposed/approved evidence. |
| D-11 | Exceptions remain factual. No fake Dismiss workflow. | Remove misleading dismissal from the operational experience; do not introduce an acknowledgement lifecycle. |
| R3 | V1 uses a paired workplace terminal camera for QR scanning. | Standalone terminal capture; no personal-phone routine punching. |
| U-03 | QR, four-digit PIN and successful verification automatically execute the latest backend-permitted Clock In/Clock Out action. | No post-verification confirmation button; no employee JWT punch lane; clear sensitive state before the next employee. |
| U-05 | Use dedicated Employee Detail, conceptually /manage-staff/:id. | Overview, Attendance, Schedule, Account & Credentials; contextual actions remain role restricted. |
| U-02 | Preserve current root DESIGN.md status tokens until later refinement. | Existing alternate palette proposal is not authorization for a token change. |
| D-09 / U-06 | Preserve the DOM/SVG landing walkthrough direction; refine later. | Do not reopen medium or QR/PIN; preserve working player and fictional sample boundaries. |
| Runtime policy | Initially support one compatibility-verified Node runtime. | Numeric version requires bounded compatibility evidence and recorded selection; CI20 and recovery26 are observations, not that selection. |

O6 recovery, all three O9 CSV reports, O15 timing, O16 schedule/calendar-aware absence and M8-R5 withdrawal remain required. PostgreSQL/Prisma, tenant isolation/RLS, no self-approval, kiosk-only routine punches and accepted REC-01 through REC-05 remain binding. This approval does not create leave/timetable, maps, automatic retention deletion, routine SMS, biometrics or public registration scope.

### G.2 Final navigation and placement

| Area | Approved hierarchy |
|---|---|
| STAFF primary | Dashboard; Attendance; Schedule (Work Schedule, Off-days); Requests (Help Requests, Corrections). Visible label is Attendance, not My Attendance. |
| HR primary | Dashboard; Attendance (Register, Exceptions); Manage Staff; Requests (Help Requests, Corrections); Reports. |
| HR secondary | Persistent Audit History. Correction Trail is contextual. |
| SUPERADMIN | One shared operational navigation set, own readiness Dashboard, secondary Audit History and expandable/local Configuration. No duplicated HR/SA operational entries. |
| Configuration | Workforce: Shifts, Assignments, Calendars. Attendance Rules: Policies. Workplace: Sites, Devices. Business: Business Settings. No automatic /configuration or category overview pages. |
| Account | Profile; Security (Change Password, Change kiosk PIN for STAFF only); Sign Out. Business Settings belongs to Configuration, not Account. This final IA supersedes O23's earlier generic Settings placement for business administration. |
| Employee Detail | Overview, Attendance, Schedule, Account & Credentials. Identity/account/attendance/assignment context and authorized reset/QR actions do not become separate sidebar pages. HR gains no SA-only QR/configuration privileges. |
| Attendance evidence | Register to Attendance Detail; factual Exceptions to either the same Attendance Detail or distinct Attempt Detail. No fabricated successful punch or direct attendance-attempt relationship. |
| Location | Sites configures centre/radius; Devices manages terminals; Attendance/Attempt Detail inspects available evidence; Dashboard shows important awareness only. No Geofencing sidebar or external map provider. |
| Kiosk | Standalone /kiosk outside portal shell/navigation; paired-camera QR to PIN to automatic permitted punch to result and private reset. |

Requests keeps distinct workflows; no combined request inbox or extra landing page is approved. Dashboards provide awareness, concise metrics, alerts and links rather than duplicate complete registers/queues.

### G.3 Shared route strategy and authority

Prefer /hr-attendance, /hr-reports and /hr-audit as shared canonical destinations. /admin-attendance, /reports and /audit-log may remain temporarily as compatibility aliases. Preserve authorized record/filter context and role guards. Avoid cosmetic URL migrations.

Read in this order: owner-approved decisions / this register; root DESIGN.md for visuals; the approved Master Plan; [the final IA](INFORMATION-ARCHITECTURE.md); current source/tests for implementation evidence; older plans as historical context. Dated plans cannot reopen these choices.

The remaining work is engineering specification, repair, completion and verification. The documentation-only task records approvals and proposes bounded execution phases. No phase is started, no code/database change is authorized here, and no commit or deployment is performed.

### G.4 Landing refinement and attendance feedback - 2026-11-01

The owner requested inclusion of the UI Designer's Landing Page proposal and a current-versus-target screen review in the implementation plan. The landing direction is accepted for planning; the execution plan and unreviewed screen-level visual details still await owner review.

| Ref | Approved direction | Plan acceptance |
|---|---|---|
| LP-01 | Refine the existing landing: Paper & Brass, headline, asymmetric hero, DOM/SVG player, fictional preview, two Sign in actions and brief footer. | No replacement design system, new conversion sections, maps, signup, pricing or fabricated portal screenshots. |
| LP-02 | Show paired workplace camera reading a badge, four-digit PIN, automatic permitted punch, accepted result and private reset. | No phone scanning a portal QR, post-verification confirmation, routine SMS or deployment-readiness claim. |
| LP-03 | Coherent illustrated times/session state; an open sample session has clock-in and blank clock-out. | Separate immediate management result from full-day examples; terminal uses first name. |
| LP-04 | Preview figures: Recorded sessions, Completed sessions, Open sessions, Late arrivals; no Expected tile. | Illustrative 42 recorded, 39 completed, 3 open, 5 late; lateness overlaps session counts; five rows are a subset. |
| LP-05 | Current tokens, plain captions, viewport-aware motion and meaningful reduced-motion behavior. | Preserve player direction near its current 24-second duration; reconcile stale SMS/medium wording without reopening choices. |
| UI-RESULTS-01 | Remove all attendance result overlays, including auto-clock-out alerts; keep inline feedback. | Explicit owner clarification. Success/failure/load errors and auto-close warnings stay visible within the owning page or kiosk result region, not floating toasts or automatic modals. |

UI-RESULTS-01 changes presentation, not attendance writes, jobs, validation or audit. Do not hide failures, claim an unconfirmed punch succeeded, automatically dismiss factual exceptions, or remove unrelated password/PIN/QR reveal and deliberate confirmation dialogs. Keep the global toast host for unrelated features. Deliberate record-detail drill-down is not an attendance result overlay.

Source trace: legacy `src/pages/Dashboard.tsx` contains punch toasts and an auto-clock-out toast/dismiss request, but App mounts StaffDashboard instead. Mounted attendance pages also use load-error toasts. The actual deployed popup origin was not observed; verify the mounted origin before changing it and never restore legacy portal punching. No popup was disabled in this planning session.

## H. Scheduling authority and the legacy shift pointer - 2026-11-10

Authority: the owner's approval of the P11 and P11a scheduling decisions on 2026-11-10. These rows record approved product and technical direction. They authorise no code, schema, migration, RLS policy, commit or deployment on their own.

| Ref | Decision | Confirmed outcome |
|---|---|---|
| O25 | Scheduling authority and the legacy shift pointer | **HR may create and manage employee-specific weekly schedules only; Superadmin has full scheduling authority.** HR cannot change business-wide shift definitions, calendar policies or general shift assignments. An employee-specific schedule may cover days outside the business's default working calendar. Official business holidays follow the holiday policy unless Superadmin authorizes an exception. An all-days-off schedule is allowed with a required reason and audit evidence. The database must support multiple working periods per day; split-shift attendance behaviour is deferred to P16 and split-shift scheduling must not be enabled for production until its calculations are verified. `users.shift_id` is deprecated from now: it leaves the employee create and update schemas, the controller writes and the public projection in phase 1, it stays a compatibility cache afterwards, it stops being written once the retirement signal shows it unused, and the database column is not removed without a separate owner-approved destructive migration. Assignment and schedule history become authoritative, and attendance snapshots preserve the resolved working-time values together with their source. |
| O26 | P11.2 assignment lifecycle rules | **An assignment may begin on any future business-local date, at that date's midnight in the business's configured zone. An overnight shift belongs to the business date it starts on. Historical backdating is refused, and a same-day change begins at one `clock_timestamp()` captured after the employee advisory lock is acquired so that realized attendance and a completed period are never rewritten. An active assignment is replaced by closing it and inserting an audited successor; its historical start is never rewritten. Cancelling a future assignment restores the predecessor's coverage through the next non-empty successor's start, or reopens it when there is no later successor, and keeps durable cancellation evidence. Stored instants survive a business timezone change, and new assignments use the currently configured zone.** Replacements append successors, no assignment row is ever deleted, cancellation may alter only the predecessor's future end, and the append-only audit row is written inside the same transaction as the write it describes. |

**O26 PATCH clarification — owner approved 2026-11-15.** A forward reschedule must not leave the in-force shift uncovered until the amended future start. Where the future target follows a contiguous predecessor, PATCH may move only that predecessor's future end to the amended start; an earlier amended start likewise shortens only that future end to prevent overlap. The predecessor's start and realized span never change. Record its actual before/after state in the same `assignment.rescheduled` audit row. This supersedes the earlier PATCH instruction to leave all preceding rows untouched; it does not authorize other history rewrites or UI work.

## Execution checkpoint — latest owner authorization

The owner approved the remaining screen compositions, kiosk brass-on-dark action emphasis with ink labels, existing semantic colors and frozen attendance status tokens, with contrast verification during implementation. Business-specific timezone, shifts, schedules, calendars, policies, sites and terminals come from authorized business configuration.

Phased execution is now authorized with a stop for review after each bounded slice. QA, Tester, Security and secret-scanning evidence precede the human commit checkpoint; commits use `.agents/scripts/commit.sh`. No automatic commit or push, database/schema/migration change, installation or deployment is implied.

P01 has existing compatibility evidence ready for review. Concrete Node 26.12.1 selection remains at HUMAN_CHECKPOINT under the plan's explicit numeric-runtime gate. P02 remains BACKLOG until that prerequisite is accepted. No production source was changed during this checkpoint.

Owner runtime selection: Node 26.12.1 is approved as the single initial runtime. Existing compatibility limitations remain; no clean-install, Linux CI or production verification is implied.
