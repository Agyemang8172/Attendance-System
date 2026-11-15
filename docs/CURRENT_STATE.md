# Project State

## P11 Tester follow-up - 2026-11-15

On `codex/attendpro-phased-delivery`, the Tester corrected the account-controller transaction mock and added two isolated PostgreSQL HTTP tests for SUPERADMIN PUT account deactivation and audit-failure rollback. The focused backend run passed 211/211 tests across five files; `npx tsc --noEmit` passed. Tests verify current-period closure, future cancellation, pointer clearing, both durable audit actions, and unchanged account, assignments, pointer and audit count after a scoped assignment-audit failure. No production files, schema or migrations were modified in this follow-up. Changes remain unstaged and await parent review; no commit or push.

## Execution start - 2026-11-01

Owner instruction: proceed under Orchestrator coordination using the existing 32-phase plan, Security review and commit.sh for each phase. Active unit is P01 runtime compatibility; DevOps owns its evidence report, with QA/Tester/Security review before the phase checkpoint. P02-P32 remain BACKLOG. P01 explicitly requires review of a concrete numeric runtime selection before configuration/install changes; generic execution authorization does not select that number.

Use the existing checkout on feature branch codex/attendpro-phased-delivery, preserving all pre-existing uncommitted changes. No auto mode switch, blind restore, unrelated staging, database operation or push is authorized. `.agents/memory/session.json` remains absent and is not created to invent a lock. Read the latest handoff and task board instead of treating historical Dev-OS context as AttendPro authority.

Commit path: bounded diff and verification, QA/Tester/Security verdicts, human checkpoint, explicit staging, `.agents/scripts/commit.sh`. Do not supply the human approval token or enable headless bypass on behalf of the owner. No phase is DONE merely because its report exists.

## Current screen-review handoff - 2026-11-01

The owner requested the accepted Landing Page proposal be added to the execution plan and clarified removal of all attendance result overlays, including auto-clock-out alerts, with inline feedback retained. These approvals are recorded in Decision Register G.4 and the landing annex; P30f explicitly schedules landing refinement and the common phase gates apply UI-RESULTS-01. The phase count stays 32 parents with separately gated children. No implementation is started.

[SCREEN-REVIEW.md](attendpro/SCREEN-REVIEW.md) supplies every screen's current source shape, target hierarchy, actions/states, phase references and low-fidelity wireframes. It is a review aid; current screenshots were not captured and non-Landing final visual detail still needs owner review. No unrelated page redesign is silently accepted. The interactive comparison in the current chat uses the same conceptual boundary.

Popup source trace found legacy unmounted Dashboard punch/auto-close toasts and mounted attendance load-error toasts. Actual deployed origin was not observed; future changes must trace the mounted source and retain inline outcomes/warnings, unrelated secret/confirmation dialogs and intentional record drill-downs. No popup has yet been disabled. Root DESIGN.md, application source, environment and database are unchanged. No application tests were run.

The documentation-only planning package remains at the human checkpoint; task-board approval of a package does not authorize any P01-P32 execution. Accepted recovery evidence and external unknowns below remain unchanged.

## Current planning handoff - 2026-10-31

The owner approved the reviewed Master Plan and final information architecture. Product/IA choices previously marked open are settled by [Decision Register G](attendpro/DECISION-REGISTER.md#g-final-delivery-and-information-architecture-approvals---2026-10-31). This session records those approvals and prepares a documentation-only execution plan. No source, database, environment, route, package, commit or deployment changes are authorized or performed here.

- Delivery baseline: [Master Gap and Requirements Register](attendpro/MASTER-GAP-REQUIREMENTS.md), AP-01 through AP-40.
- Final placement: [Information Architecture](attendpro/INFORMATION-ARCHITECTURE.md). Staff label is Attendance; Schedule owns Off-days; Requests retains distinct Help/Corrections; Audit is secondary; business configuration is outside Account; Employee Detail is dedicated.
- Execution proposal: [Phased Implementation Plan](attendpro/PHASED-IMPLEMENTATION-PLAN.md), P01 through P32 plus separately gated child slices. All remain NOT_STARTED/BACKLOG. The task board records the documentation package for review, not implementation underway.
- Memory: [ADR-001 approved delivery/IA](../.agents/memory/decisions/ADR-001-attendpro-delivery-ia.md) records the owner decisions; [planning handoff](../.agents/memory/handoffs/handoff-2026-10-31-planning.md) preserves execution boundaries. Historical memory context was not overwritten.
- Locked behavior: frozen starting policy across midnight; replacement four-digit PIN shown once to authorized operator; time-only correction proposals/derived status; factual exceptions with no fake dismiss; standalone paired-camera QR/PIN kiosk with automatic permitted punch and no confirmation button; current design tokens/DOM-SVG landing preserved.
- Supported runtime policy is one compatibility-verified version; the numeric version has not yet been selected. This is a bounded engineering prerequisite, not an invitation to reopen the policy.
- Current source evidence includes a legacy Mongoose user-controller regression/missing model/reset handlers, frontend/API mismatches and missing approved requirements. Do not repeat the broad audit or claim that accepted historical tests verify this tree.
- O6, O9, O15, O16 and withdrawal remain incomplete obligations. O18 PRESENT-to-ON_TIME mapping conflicts with approved preservation semantics; actual migration/data impact is UNKNOWN and needs separately authorized read-only assessment before a dry-run remedy proposal.
- REC-01 through REC-05 remain closed and accepted. REC-06 acceptance is not inferred. Production RLS, actual GitHub CI, scheduler, restore, dependency state, historical credential rotation and the historical startup cause remain evidence-limited.
- Session lock `.agents/memory/session.json` was absent. No mode file was created or changed. Existing `.agents/memory/context.json` describes historical Dev-OS tooling work; it is not treated as AttendPro execution authority.

The dated 2026-10-27 entry below is preserved recovery evidence. Its pending D/U/R approvals and claims of complete account behavior are superseded by the current owner approvals and source findings above. The final plan still requires review and separate execution authorization.

Planning verification is complete: PM checked locked scope; QA reviewed the supplied plan/dependency evidence and approved after Staff help/detail and HR-own correction coverage was made explicit. All ten planning/memory files passed humanizer and scoped diff whitespace checks passed. Static validation confirmed 32 NOT_STARTED phases, an acyclic dependency graph, 40 unique mapped requirements and ten local planning links. PLAN-20261031 is at HUMAN_CHECKPOINT for owner review; all implementation remains BACKLOG. No application tests were run and no current runtime/deployment result is claimed.

## Current authority and recovery status - 2026-10-27

This section is the current status entry point. The dated records below are historical evidence, not current release approval. [The decision register](attendpro/DECISION-REGISTER.md) records approved product decisions; [the PRD](ATTENDPRO_PRD.md) must be read with those amendments. Root [DESIGN.md](../DESIGN.md) governs visual design. The [task board](TASK_BOARD.md) tracks execution, not new product authority.

| Classification | Current statement |
|---|---|
| APPROVED CURRENT REQUIREMENT | General-purpose, multi-business attendance; STAFF, HR and business-scoped SUPERADMIN; routine kiosk punching uses QR badge plus a 4-digit PIN. No routine SMS OTP. |
| IMPLEMENTED CURRENT BEHAVIOR | Kiosk backend lanes, role-scoped portals, shifts/policies/calendars, reports, corrections and audit are implemented. A landing illustration does not constitute an implemented kiosk frontend. |
| APPROVED BUT NOT YET IMPLEMENTED | O15 business-timezone application remains incomplete: status/shift-window calculations still use UTC. O16 schedule/calendar-aware absence is incomplete: no no-show materialization job; report absence is an approximation, not proof of O16 compliance. These are requirement gaps, not approved scope reductions. |
| APPROVED BUT NOT YET IMPLEMENTED | O6 email account-recovery requirements remain approved; endpoints are absent and delivery was deferred in M8. Administrator password reset is implemented separately. |
| PLANNED/FUTURE | Kiosk frontend with U-03 actions unresolved; leave/timetable upload in v2; legal links when real pages exist. |
| UNRESOLVED DECISION | D-08 reset-PIN visibility remains unresolved: current backend returns the new PIN, while older contracts deny operator visibility. D-10 correction-form and D-11 dismiss-control changes remain proposals; implementation does not approve them. |
| HISTORICAL/SUPERSEDED | Earlier SMS OTP, six-digit PIN and owner-only runtime claims are superseded where later approved decisions apply. Historical MongoDB incident records remain evidence; credential rotation is UNKNOWN without confirmation. |

### Accepted recovery evidence

REC-01 through REC-05 are owner-accepted and CLOSED. REC-06 documentation reconciliation is in progress; this entry neither accepts nor closes REC-06. REC-07 has not begun.

- REC-01: existing preservation independently verified and closed; no new preservation is required.
- REC-02: frontend Vitest/JSDOM storage binding corrected under Node 26 and accepted.
- REC-03: backend baseline executed against the dedicated local PostgreSQL test database.
- REC-04: local restricted-role application/RLS verification accepted, authentication bcrypt-cost discrepancy corrected, and privileged lookup fallback removed. The temporary restricted login was removed. This does not verify a production deployment. Production deployment evidence and owner-connection retention remain non-blocking follow-up, not authorization for further changes.
- REC-05: Swagger initialization is deferred until a documentation request; production-disabled documentation avoids loading it. Normal development launch-to-listening samples were 8072/4166/4643 ms before (median 4643 ms) and 4213/3624/3450 ms after (median 3624 ms). Small samples do not isolate environmental variation or establish causation. The historical roughly 38-second issue is unreproduced; its cause remains UNKNOWN.

Latest accepted backend verification, from REC-05: 619 tests in 25 files passed in 119.36 seconds; coverage 93.42% statements/lines, 86.25% branches and 98.09% functions; existing coverage gates passed. No tests were rerun for this documentation reconciliation. These results do not establish production readiness or complete the unmet requirements above.

## Historical session and milestone records - through 2026-10-21

Everything below is HISTORICAL/SUPERSEDED status evidence as of its recorded date. Preserve incident records, commit references and original verification results. Claims such as current, pending, uncommitted, or not implemented below are not current assertions; use the 2026-10-27 section and later approved decisions instead. No present branch, credential-rotation, deployment or CI result is inferred from these snapshots.


> This file is maintained by the Orchestrator agent. It is updated at each phase transition to preserve context across long sessions.

## Current Session — 2026-10-21

- **Task:** M9 is committed (`1804582`, 2026-10-21). M10 is proposed: release hardening and pilot readiness, plan at `docs/superpowers/plans/2026-10-21-attendpro-m10-release-hardening.md`.
- **Branch:** `main`, nineteen commits ahead of `origin/main`, nothing pushed.
- **Mode:** interactive, Orchestrator locked.
- **State:** M9 delivered the full suite, CI workflow, security review and close-out documents. Backend: 22 files / 590 tests green, coverage **93.43% statements / 85.93% branches** against the 90/85 gate. Frontend: 98 tests green, typecheck, lint and build clean, coverage **29.95/71.38/49.79/29.95** against the 29/71/49/29 ratchet. Playwright 5 passed, kiosk skipped (no kiosk UI). Five production defects were fixed (M9-B1..B5) plus the staff-portal double `/api` prefix (SEC-20).
- **Open release decisions:** SEC-07 (runtime RLS bypass; `DATABASE_URL_APP` unread) and SEC-08 (JWTs survive a password reset). The dependency scan reports 9 high frontend and 4 high backend production advisories. A production bootstrap does not exist (SSB-2). The CI workflow has not run on GitHub.
- **M10 status:** plan written, no source changes. Awaiting owner decisions on release mode (private pilot recommended), pilot database host, `xlsx` removal, the 39/74 frontend floor, and a CI-exercise push. The M10 work itself did not change source. The working tree also carries the separate design-plan documentation pass described below.
- **Design-plan reconciliation (2026-10-21):** `docs/attendpro/DESIGN-PLAN.md` created; root `DESIGN.md`, `docs/attendpro/LANDING-PAGE-SPEC.md`, the M1 notes, the M8 gap register, and this status were revised. No application code, database state, production setting, or colour token changed. The plan covers every current route plus the missing kiosk. Open decisions: D-07 (QR + PIN vs SMS OTP), D-08 (HR PIN visibility), the paper status palette, and the kiosk action tokens. The landing restyle, kiosk UI, and all code changes wait for owner approval.

Completed (2026-10-16, M3):

- Phase 1 Shift CRUD: `backend/controllers/shiftController.ts`, `backend/routes/shiftRoutes.ts` — list/create/update/deactivate shifts with minute-of-day fields (0..1439), name unique per business, tenant-scoped.
- Phase 2 Shift assignments: `backend/controllers/assignmentController.ts`, `backend/routes/assignmentRoutes.ts` — create assignment in one transaction (close open assignment, insert shift_assignments, sync users.shift_id), list, soft-close.
- Phase 3 Policies: `backend/controllers/policyController.ts`, `backend/routes/policyRoutes.ts` — list policies with versions, create policy + version 1, create new effective-dated version (close current, increment version number), validation ranges per contract.
- Phase 4 Status rule engine: `backend/utils/statusEngine.ts` — evaluates clock-in to EARLY/ON_TIME/LATE/OPEN_SESSION using shift + policy; wired into `attendanceController.ts` clockIn (replaced removed `status: "PRESENT"`).
- Phase 5 Tenant relation: `userController.ts` createUser now connects the new user to the caller's business (fixes missing `business` relation).
- Registered shift/assignment/policy routes in `backend/server.ts`.
- Added shift/policy/assignment audit functions to `backend/utils/logger.ts`.
- Added shift/policy validators and updated the attendance status enum to the 8 M2 values in `backend/validators/index.ts`.
- `devos:no-rls` annotation added to the historical `init` migration (db-check gate requirement).

Verification:
- `npx tsc --noEmit` — zero errors (pre-existing errors fixed).
- `npx prisma validate` — schema valid.
- `bash .agents/scripts/db-check.sh` — all 10 migrations safe, RLS-protected, indexed.
- `bash .agents/scripts/humanize-check.sh` — plan doc clean.

Completed (2026-10-16, M5):

- Phase 0 audit hardening: status engine rewritten with wrap-around classification and a same-evening clock-out guard; `evaluateClockOutStatus` wired into the punch path; merged-geometry shift validation on PATCH; UTC date basis; shift-scoped policy lookup in clock-in; catch blocks always answer, error bodies redacted; shared `callerBusinessId` in `utils/tenant.ts`; policy-default race fixed; PIN reset now expires open kiosk sessions; preview glyph issue fixed.
- Phase 1 device lifecycle: `KIOSK_PAIRING_KEY`/`KIOSK_TOKEN_KEY` keyed hashing with constant-time compares; device-token middleware (`req.kiosk`); pairing codes (single live code, 10-minute expiry, shown once); 30-day token with on-use renewal and the 90-day hard age returning the terminal to pairing; devices list; revocation bumping `tokenVersion`. In-memory fixed-window limiter factory (`NODE_ENV=test`-aware).
- Phases 2–3 identify and PIN: `assessLocation` (haversine, INSIDE/OUTSIDE+nearMiss/UNKNOWN, thresholds final per R1 — owner, 2026-10-17: accuracy 1..500 m, stale after 60 s, near-miss 25 m past the radius); badge match on the keyed hash with inactive/unknown/cross-business distinguished per the safe-error table; 2-minute hashed-handle sessions; PIN verify with 10 attempts / 5-minute lock (final per R5, owner 2026-10-17), constant-time compare, no attempts-left disclosure; cancel; evidence `attendance_attempts` rows on every failure.
- Phase 4 atomic punch: clock-in/out moved to kiosk-token scope per contract §12; session lock+consume inside the punch transaction with version guards; dated `ShiftAssignment` resolution with pointer fallback; snapshot columns filled from the schema (shift, policy, timezone — O15 noted); `attendance.recorded`, flagged punches raise `requiresReviewReason`. Correction submission self-scoped with policy window and SAME_DAY/ESCALATED tier. Read aliases kept.
- Phase 5 config: `KIOSK_PAIRING_KEY` and `KIOSK_TOKEN_KEY` documented in root `.env.example`.
- Phase 6 verification: review agent pass (safe after fixes; both majors applied — catch hardening finished on the legacy attendance handlers, and the §11 audit trail now also lands in the `audit_logs` table via a new `writeAudit` helper at every kiosk event site); docs agent added Scenarios P–U and the superseded-note for the staff-token punch.

M5 verification: `tsc --noEmit` zero errors; `prisma validate` valid; `db-check.sh`, env parity, ui-taste, humanize all pass.

Completed (2026-10-17, M6):

- Phase 1: `backend/middleware/jobAuthMiddleware.ts` — `JOB_TOKEN` service-token guard (constant-time, fail-closed 401) plus `requireJobOrSuperadmin` for the status route; `backend/routes/jobRoutes.ts` mounted at `/api/jobs` (run: job token only, auth before validate, 5/min IP limiter); stubs filled by Phase 2; `JOB_TOKEN` documented in root `.env.example`.
- Phases 2–3: `backend/utils/shiftWindow.ts` (pure snapshot math — end instant from the row's own `date`/minute snapshots, +1 day overnight; UTC applied, the row's `timezoneSnapshot` stored but not applied until O15); `backend/jobs/autoClockOut.ts` — one transaction holding `pg_try_advisory_xact_lock(hashtext('attendpro:auto-clock-out'))` (sentinel → 409), all-business sweep, per-row classification against the effective policy version (row's version → business default): enabled+overdue closes at shift end + offset (offset falls back to the 120-minute buffer), disabled leaves the row untouched, unresolvable window/policy flags `REQUIRES_REVIEW` (flagged once — repeat sightings are skipped in memory), every write guarded by `updateMany WHERE sessionStatus = OPEN` with a count check; hours arithmetic matches the punch path divisor exactly; audit rows `job.auto_clock_out_closed`/`job.auto_clock_out_flagged` with `actorType SYSTEM` via the extended `writeAudit`; `jobStatus` endpoint reads the latest SYSTEM batch (job lane sees all, SUPERADMIN lane own business).
- Verification phase: independent review — verdict safe after fixes; blocking fix applied (flagged rows no longer re-written/re-audited every run); cheap fixes applied (auth-first on run, cache-miss correctness, `businessId` filter on policy lookup, runbook rate-limit note); the O8 "closes after a maximum" vs lifecycle §7.1 flag-only conflict registered as R10 in `docs/attendpro/DECISION-REGISTER.md` for an owner ruling; docs agent added Scenario V (arrange → run → verify → idempotence → genuine clock-out wins → disabled → unresolvable → 409 → authorization).
- `docs/runbook-jobs.md` — plain-English trigger/status runbook for the owner's 15-minute scheduler (O8); no in-app timer by design.

M6 verification: `tsc --noEmit` zero errors; `prisma validate` valid; `db-check.sh`, env parity (11 vars), ui-taste, humanize all pass.

Completed (2026-10-17, M7):

- Phase 0 help requests: staff lane (submit with category allowlist + caps, own list/detail with same-generic 404/403) and HR lane (business queue with requester names, status transitions with `resolvedAt` discipline); every accepted change durably audited (`help.request_submitted` / `help.request_resolved` / `help.request_status_changed`); 5/15-min limiter on submission; transition ladder enforced OPEN→IN_REVIEW→RESOLVED/CLOSED.
- Phase 1 correction decisions: `GET /api/staff/corrections(+/:id)`, `GET /api/hr/corrections`, and `PATCH /api/hr/corrections/:id/decision` — the whole 403 matrix in one commented table: no-self-approval (absolute, any role), ESCALATED needs second-HR (exists+active+not-sole) or SUPERADMIN backstop (condition ∈ UNCLAIMED_24H/CONFLICT_OF_INTEREST/EXPLICIT_HANDOFF + reason ≤500), half-sent backstop never falls through; approval applies proposed values guarded by an observed-values `updateMany` (drift → 409 "record changed"), lifecycle §8.3/§5.2/§8.4 honored; revisions created on decision; `correction.decided`(.backstop)/`correction.escalated` durably audited.
- Phase 2 reports: register (employee/shift filters, 190-day cap, snapshot-aware shift names), punctuality summary (per employee/shift/day with the honest no-row absence definition over active STAFF only), exceptions (review rows + OUTSIDE/UNKNOWN attempts), and the O9 CSV export — streamed with backpressure + drain handling, disconnect-safe, injection guard before escaping (cells starting `=`,`+`,`-`,`@` get an apostrophe), business-timezone times, one `report.exported` audit row only on clean completion.
- Phase 3 audit trail + retention: `GET /api/audit/corrections/:attendanceId` assembles corrections + revision history + the four `correction.*` actions in one trail; `GET /api/business/settings` (SUPERADMIN) exposes retention knobs; `PATCH /api/business/settings` refuses `retentionEnabled=true` per O10, ranges enforced, `.strict()`, every accepted change audited (`settings.updated`); no deletion job in M7.
- Review pass (safe after fixes): F-1 durable `correction.submitted` + `PROPOSED` revision (O17 conformance), F-2 punctuality absence restricted to STAFF row-owners, F-3 CSV backpressure/disconnect/abort-detection, F-4 target user in decision audits, F-5 CSV validator mirror, F-6 manual hop header removed, F-7 drift guard watches closureReason, F-8 help ladder enforced, F-9 trailing newline; `writeAudit` extended with beforeValues/afterValues (additive); contracts row 141 error column formalized with 409.
- Docs agent: Scenarios W (help), X (decision matrix incl. drift test via the auto clock-out job), Y (reports/CSV/audit trail + retention guard) in the testing guide; humanize clean.

M7 verification: `tsc --noEmit` zero errors; `prisma validate` valid; `db-check.sh`, env parity, humanize all pass.
- Owner input O14: `backend/.env` has an empty `DATABASE_URL`, so the migration chain cannot run against a test database yet (no database migrated anywhere).
- Owner input O13: repository reconciliation Phase 2 complete (histories are separate); Phase 1 backups taken.
- New environment keys `PIN_HMAC_KEY` and `QR_SECRET_KEY` are required by the M4 PIN and QR handlers; both fail closed when unset. `backend/.env.example` is gitignored, so documenting them locally is still a pending owner decision.
- No `src/` (frontend) changes.

## Completed (2026-10-17, M8 Phase 0–2):

- **Phase 0 — Housekeeping + Design System**: added `typecheck` script; fixed all 43 legacy TypeScript errors; wired vitest (10 files / 89 tests green); removed 3 unused webfonts from index.html; built shared primitives in `src/components/ui/` — `PageHeader`, `SectionHeader` (h2 at `text-display-sm`), `Pill`, `SearchInput`, `Pagination` (aria-live), `ModalShell` + `ConfirmDialog` (focus trap + return), `FilterBar`; extracted `src/lib/attendance-format` (presentation-only helpers); fixed routing shell — `NotFound`/`Forbidden` panels, Sidebar nav items as real `<button>`s with `aria-current`, sign-out calls `POST /auth/logout`, content capped at `max-w-7xl`; two backend safe-error fixes (userController 500 leak, axios error map for M7 codes).
- **Phase 1 — Public Landing**: `Landing.tsx` at `/` — brand header, product summary, fictional stat row, 5-row sample table with `Pill` status badges, "Sample data" caption, no register/recovery links (O1, M8-R3); mobile table stacks to cards; 9 tests; unauthenticated `/` shows Landing, authenticated redirects to role home.
  - **Reconciliation note (2026-10-21):** The landing visual acceptance is open. The current page still shows the historical `Finest Supermarket, Accra` sample, the old copy, the five-tone status mapping, no `#preview` target, and no corner bracket. The acceptance contract is `docs/attendpro/LANDING-PAGE-SPEC.md`; the open gaps are in `docs/attendpro/M8-GAP-REGISTER.md` section C.
- **Phase 2 — Staff Portal**: `StaffDashboard` rework (clock buttons, streak, attendance-rate removed; KpiHero Weekly Hours + Today section with M8-R2 schedule/off-day data + Recent History AttendanceTable + Pending counts); `StaffAttendance` (filterable, paginated, drawer detail with snapshots); `StaffSchedule` (real assignments from M8-R2, list view, text+Pill status); `StaffOffDays` (list, empty state); `StaffHelpRequests` + `Detail` + `New` (5 categories, char counts, 429 message); `StaffCorrections` + `Detail` (diff + decision + audit) + `New` (picker, preview, reason, 409 handling); `Profile` (achievements removed O24, Change PIN link); `StaffChangePin` (current PIN required, 4-digit policy, ConfirmDialog, M8-R1 endpoint); Sidebar staff nav order matches approved spec; Profile/PIN in popover per O23; all screens responsive (375/768/1440), accessible (focus, contrast, inline error/retry, colour+text status).
- **Gates**: `tsc` 0 errors; `npm test` 98/98 pass; `ui-taste-check` 49 files clean; `db-check` 10 migrations safe; `env-check` 11 vars; `humanize` clean on gap register, plan, state docs; backend `tsc` 0 errors.

## Completed (2026-10-17, M8 Phase 3 — HR + Super Admin Portals):

- **HR Portal** (`AdminRoute` — HR + SUPERADMIN):
  - `HrDashboard` — exception-first dashboard composed from `/api/reports/punctuality-summary` + `/api/reports/exceptions`; KPIs from real statuses; weekly charts.
  - `HrAttendance` — filterable register via `/api/attendance/all-attendance` alias; drawer detail with snapshots + correction trail link.
  - `HrExceptions` — list from `/api/reports/exceptions`; dismiss alert button; no HR-assisted override (M8-R10).
  - `ManageStaff` — full CRUD on `/api/hr/employees`; deactivation via legacy `/api/users/:id` (M8-R8); detail drawer + PIN reset dialog; audited reset-pin with reason.
  - `HrHelpRequests` — queue with status ladder OPEN→IN_REVIEW→RESOLVED/CLOSED; 409 invalid jumps; timeline drawer.
  - `HrCorrections` — queue with tier badges; decision panel with before/after diff, self-approval 403, ESCALATED backstop (second HR or SUPERADMIN with condition+reason), drift guard 409.
  - `HrReports` — register / punctuality / exceptions; CSV export with O9 apostrophe guard, business TZ, `report.exported` audit on clean completion only.
  - `HrAudit` — M8-R4 listing from `/api/audit`; HR-limited to attendance/location/PIN-reset/correction events.

- **Super Admin Portal** (`SuperAdminRoute`):
  - `SuperAdminDashboard` — Setup Health checklist (timezone, ≥1 shift, ≥1 site, ≥1 paired device, jobs healthy) + jobs status KPIs; links to Attendance, Reports, Audit Log, Settings.
  - `SuperAdminSettings` — GET/PATCH `/api/business/settings`; retention knobs with `retentionEnabled=true` refused (O10); IANA tz validation; `settings.updated` audit with before/after.
  - Admin screens (M8-R11 — REAL, not stubs): Shift Mgmt, Scheduling, Policies, Calendar, Sites, Devices — all wired to verified endpoints (shifts, assignments, policies, calendars, sites, kiosk devices).
  - `Reports` — reuses HR reports screen; `Audit Log` — reuses M8-R4 listing (SA full access).

- **Navigation**: Sidebar PRD §9 order for SA; Profile/Settings in popover per O23.

- **Gates**: `tsc` 0 errors (new files only; legacy component errors pre-existing); `npm test` 90 pass / 8 auth-routing pre-existing failures; `db-check` 10 migrations safe; `env-check` 11 vars; `humanize` clean.

Completed (2026-10-16, M4):

- Phase 1+2 Employee management: `backend/routes/hrRoutes.ts` mounts the existing `userController` list/create/update handlers at `/api/hr/employees` (HR scoped to STAFF, last-superadmin rule) instead of duplicating them; handlers gained business_id tenant scoping in `userController.ts`. New audited `resetPin` (`POST /api/hr/users/:id/reset-pin`): six random digits, stored as `HMAC-SHA-256(PIN_HMAC_KEY, employeeId||pin||salt)`, clears lockout counters, writes an `audit_logs` row, PIN never returned.
- Phase 3 Sites: `backend/controllers/siteController.ts` + `routes/siteRoutes.ts` — list/create/update/deactivate with lat/long/radius validation and name unique per business.
- Phase 4 Calendars: `backend/controllers/calendarController.ts` + `routes/calendarRoutes.ts` — list with exceptions, update (single default calendar per business, O22), add holiday or working-override exceptions (unique per calendar and date).
- Phase 5 QR credentials: `backend/controllers/qrController.ts` + `routes/qrRoutes.ts` at `/api/business` — issue (transaction: revoke active credential then insert; raw token shown once) and revoke. Token stored only as `HMAC-SHA-256(QR_SECRET_KEY, token)`.
- Validators for PIN reset, sites, calendars and credentials added in `backend/validators/index.ts`; audit events for all of the above in `backend/utils/logger.ts`; all routers registered in `backend/server.ts`.

M4 verification: `tsc --noEmit` zero errors; `prisma validate` valid; `db-check.sh` passed; humanize-check clean on the M4 plan.

Frontend/backend state: backend M4 complete; frontend untouched.

---

## Historical Snapshot

> **Historical below this line.** The pipeline table, agent roster, blockers
> and evidence sections date from 2026-10-06 and describe the MongoDB Atlas
> era. They are preserved as the historical record; the header above this
> note is current as of the final milestone refresh (2026-10-10).

## Current Task
- **Task:** Project complete — milestones M0–M10 all merged to `main`
- **Triage Level:** —
- **Status:** M10 (final UI/UX verification) merged via PR #15, commit
  `20a1e43`. Agent-executed gates green: `ui-taste-check` 0 violations across
  24 files, all 20 anti-ai-ui rules audited against the code, frontend
  **63/63**, eslint and `vite build` clean. The §13-rule-9 sweep fixed the two
  remaining uppercase residuals (StaffTable header, ManageStaff eyebrow).
  Owner-run steps — the three-role browser walkthrough and the in-browser
  contrast re-measure — are itemised in `docs/REGRESSION_SNAPSHOT.md` §5.

## Post-M10 Fix (2026-10-11)

- **Issue:** Opening `http://localhost:5173/dashboard` with a leftover `token`
  still in localStorage showed a blank page instead of the sign-in screen.
- **Root cause:** `isAuthenticated()` returned true on token presence alone.
  With no `user` (or an unrecognised role) the guard fell through to
  `roleHome(undefined)`, which returns `/dashboard` — the route already open —
  so the redirect became a no-op and nothing rendered.
- **Fix:** `src/utils/auth.ts` now needs a token **and** a stored user whose role
  is `STAFF`, `HR` or `SUPERADMIN`; `getCurrentUser()` parses defensively and
  returns `null` on a corrupt value. Every guard already consulted
  `isAuthenticated()` before picking a destination, so this single change closes
  the loop for all of them.
- **Verified:** frontend **66/66** (three new regression tests), eslint and
  `vite build` clean; reproduced and re-checked in headless Chrome — stale token,
  null user and unknown role now all land on `/login`, while valid STAFF and HR
  sessions still reach their dashboards.
- **Commit:** `08ed0ab` on `main`.

## Approved Plan
`docs/IMPLEMENTATION_PLAN.md` — eleven milestones M0–M10, each on its own
branch, each committed through `.agents/scripts/commit.sh`.

- M0 **DONE** — commit `c4ee602`, on `main`.
- M1 **DONE** — commit `b403a66`, on `main`.
- M2 **DONE** — commit `a74c72a`, on `main`.
- M3 **DONE** — commit `d31a5a0`, on `main`.
- M4 **DONE** — commit `f2db8e4`, on `main`.
- M5 **DONE** — commit `63318bf`, on `main`.
- M6 **DONE** — commit `6002e1c`, on `main`.
- R10 ruling + O14 rehearsal — commit `8526a98`, on `main`.
- M7 **DONE** — commit `e73b8c1`, on `main`.
- M8 **DONE** — commit `f011053`, with the follow-up `e6f41eb` that replaced an
  emoji with a Lucide icon to pass the UI taste gate. M8 was committed while the
  frontend suite still had eight `auth-routing` failures and five legacy `.tsx`
  type errors; M9 fixed both and restored the missing `/set-password` route.
- M9 **DONE** — commit `1804582`, on `main`. Backend 22 files / 590 tests green,
  coverage 93.43% statements / 85.93% branches against the 90/85 gate; frontend
  11 files / 98 tests green, typecheck and lint clean, build clean, ratchet
  29.95/71.38/49.79/29.95 against 29/71/49/29; Playwright 5 passed / 1 skipped.
  CI starts its own Postgres 16 service container and runs the backend coverage
  command. Testing guide, security review, deployment runbook and close-out docs
  are committed. Open after M9: SEC-01..SEC-08, SSB-2, and a CI workflow that has
  not run on GitHub.
- M10 **PROPOSED** — release hardening and pilot readiness. Plan at
  `docs/superpowers/plans/2026-10-21-attendpro-m10-release-hardening.md`.
  Awaiting the owner's release-mode and environment decisions.

## Dev-OS Pipeline Status

| # | Stage | Deliverable | Status |
|---|---|---|---|
| 1 | Inception | `docs/PROJECT_REQUIREMENTS.md` | **DONE** — 285 lines, signed by the Owner 2026-10-06 |
| 2 | Design gate | `DESIGN.md` | **DONE** — 314 lines, QA-approved over 3 rounds, signed 2026-10-06 |
| 3 | Architecture & DB | Migrations + seed fixtures | **DONE** — schema up to date, seed verified |
| 4 | Task board DAG | `docs/TASK_BOARD.md` | **IN PROGRESS** |
| 5 | Implementation | Slices A–F | BLOCKED on stage 4 |
| 6 | Test suite | Automated tests | QUEUED |
| 7 | Testing guide | `docs/TESTING_GUIDE.md` | QUEUED |
| 8 | QA | Standards audit | QUEUED |
| 9 | Security | OWASP + secret scan | QUEUED |
| 10 | Humanizer | Doc audit | QUEUED |

## Active Agents
| Agent | Status | Current Assignment |
|---|---|---|
| Orchestrator | ACTIVE | Executing stage 4: task board DAG |
| DBA | DONE | Stage 3 verified: migration current, seed correct |
| UI Designer | DONE | `DESIGN.md` written and Owner-signed |
| QA | DONE | `DESIGN.md` approved after 3 audit rounds |
| Developer | STANDBY | Awaiting stage 5, slice A |
| Tester | UNBLOCKED | DB live; test tasks 204/205/206 ready |
| Security | PARTIAL | Gate installed; Atlas rotation still with the Owner |
| DevOps | DONE | Pino logging, Swagger, correlation IDs |
| Release Manager | STANDBY | Stages 7–10 |

## Blockers
| Blocker | Blocks | Resolution |
|---|---|---|
| Atlas password not rotated | TASK-223 history rewrite | Owner action in MongoDB Atlas UI (TASK-201) |
| `ui-taste-check` exits 1 on 5 emoji | **every frontend-touching commit** | TASK-404, pre-flight for stage 5 |
| Stage 4 output uncommitted | stage 5 | Owner says "approve" |

Database is **no longer a blocker**: local Prisma Postgres is running, migrated, and seeded.

## Stage 3 Evidence (2026-10-06)

- `prisma migrate status` → **"Database schema is up to date!"**; 1 migration `20261005000000_init`
- `db-check.sh` → passed (RLS, non-destructive constraints, FK indexes)
- Row counts: **2 shifts, 7 users, 2 attendance rows (1 open session)**
- Roles: SUPERADMIN 1, HR 1, STAFF 5
- Shifts: `shift-morning` 06:00–14:00 (7 users), `shift-afternoon` 14:00–22:00 (0 users)
- **Night shift absent** — confirmed `NIGHT_COUNT=0`
- 14 indexes including `attendances_user_id_date_idx`, `attendances_session_status_idx`, `users_email_key`, `users_employee_code_key`

## Secret Surface Audit (2026-10-06)

| Location | Finding |
|---|---|
| Application code (`backend/`, `src/`) | **No** `devos123`, **no** literal password |
| `backend/prisma/seed.ts` | Reads `SUPERADMIN_PASSWORD`, `HR_PASSWORD`, `STAFF_PASSWORD` from env; throws if missing |
| `backend/.env`, root `.env` | Not tracked |
| Root `.env.example` (tracked) | Passwords are placeholders; `JWT_SECRET` is a lowercase template matching no live secret |
| `AUDIT_REPORT.md` | `mongodb+srv` appears only inside the redaction note; no password segment |
| `README.md` | `JWT_SECRET` is a 15-char placeholder; differs from `.env`, appears nowhere else |
| Root `.env.example` `DATABASE_URL` | **Was** a literal `user:password@localhost:5432`; replaced with `postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME` — uncommitted, awaiting "approve" (TASK-224) |

## Recent Decisions
- **Stage 1 approved:** PRD signed by the Owner on 2026-10-06; all open questions resolved.
- **Stage 2 approved:** `DESIGN.md` signed on 2026-10-06; gate rules in force; §7 findings are open defects, not a clean state.
- **History rewrite authorised** — order fixed: rotate Atlas password first, back up the repository second, one force-push third (TASK-223).
- **Migration complete:** MongoDB/Mongoose fully removed → PostgreSQL/Prisma only.
- **Two shifts only:** Morning and Afternoon. Night removed from seed and database.
- **Seed passwords stay in `.env`.** Never hardcode a password in a committed file; in docs, local-testing example only.
- **Builds pass:** frontend (Vite) and backend (`tsc`).
- **Pino logging + Swagger** at `/api/docs` and `/api/docs.json`.
- **Component fixes done:** SessionsChart, SuperAdminDashboard, Schedule status enums.

## Corrections to Previous Entries
- The prior version claimed "JWT_SECRET ROTATED: New 32-char secret in `backend/.env.example`". That is **false**: `backend/.env.example` has an **empty** `JWT_SECRET`, and the live value (64 chars) exists only in `backend/.env`, which is not tracked.
- The prior version claimed the seed creates "**3 shifts**". It creates **2**; the Night shift was removed.
- The prior version listed `TASK-202` and `TASK-203` as awaiting a human. Both are **complete** — see stage 3 evidence above.

## Dev-OS Notes
- `devos run` and `scripts/sdlc-runner.js` are not installed; stages are executed manually by the Orchestrator.
- `backend/test-suite.mjs` stays untracked (decision C).
- Every commit runs pre-commit gates: gitleaks, env parity, db-check (`.sql`), ui-taste (frontend), humanize (`docs/*.md`).
- Every push runs `.agents/scripts/pre-push-gate.sh` over the commits being pushed, honouring `.gitleaks-baseline`.

## Execution checkpoint — latest owner authorization

The owner approved the remaining screen compositions, kiosk brass-on-dark action emphasis with ink labels, existing semantic colors and frozen attendance status tokens, with contrast verification during implementation. Business-specific timezone, shifts, schedules, calendars, policies, sites and terminals come from authorized business configuration.

Phased execution is now authorized with a stop for review after each bounded slice. QA, Tester, Security and secret-scanning evidence precede the human commit checkpoint; commits use `.agents/scripts/commit.sh`. No automatic commit or push, database/schema/migration change, installation or deployment is implied.

P01 has existing compatibility evidence ready for review. Concrete Node 26.12.1 selection remains at HUMAN_CHECKPOINT under the plan's explicit numeric-runtime gate. P02 remains BACKLOG until that prerequisite is accepted. No production source was changed during this checkpoint.

Commit gate follow-up: the first commit attempt stopped at environment parity because DATABASE_URL_APP was missing from the root example. Added a placeholder only; no live environment or database configuration changed. The commit remains pending until the gates pass.

## P02 execution authorization

Owner explicitly selected Node 26.12.1 as the single initial runtime. P01 numeric selection is accepted; runtime declarations/CI alignment and clean-install/Linux/production evidence remain separately tracked and are not claimed complete.

[ DONE ] P02 account-controller recovery. Assignee: p02_repair (Developer). Owned source: backend/controllers/userController.ts. Committed as `3d6b983` through `.agents/scripts/commit.sh` after explicit owner approval. The commit also carries the session and tenant modules the controller imports directly (`authController.ts`, `authMiddleware.ts`, `utils/tokens.ts`, `utils/passwords.ts`, `utils/tenantContext.ts`, `utils/tenantLookup.ts`); those were pre-existing working-tree work accepted under REC-04/SEC-08 and were required for the committed tree to compile. The RLS client change in `config/prismaClient.ts` and the planning documents were deliberately left uncommitted. No database/schema/migration/install/push action.

## P02 verification checkpoint - 2026-11-01

The account-controller reconciliation is present in the working tree. This session verified it against the mounted routes and extended the no-database contract suite. No commit was made during the verification pass, and no push, database access, schema or migration change, installation or deployment was performed.

Delivered behavior:

- `backend/controllers/userController.ts` runs on Prisma only: list, detail, create, update, deactivate, change-password, reset-password and reset-PIN, with named and default exports. The missing `../models/User` import and the Mongoose calls are gone.
- Tenant scope: every read and write filters on the caller's `businessId`, and the request actor is reloaded from the account row so role and active state do not come from the token. STAFF keeps own-detail access, HR targets STAFF accounts only, and SUPERADMIN keeps the last-active-SUPERADMIN and self-protection rules.
- Account writes run in one transaction holding a `businesses` row lock. That keeps the last-SUPERADMIN count and the actor/target rechecks consistent under concurrent writes.
- Credentials: the controller reuses the shared password-cost and token-signer modules already present in the working tree (`backend/utils/passwords.ts`, `backend/utils/tokens.ts`). Temporary passwords force a change; administrator resets, role changes and deactivation increment `tokenVersion`; open kiosk verification sessions expire. Password changes use an observed-value guard and return a freshly signed token.
- Reset PIN requires a reason, stores a keyed salted HMAC of four digits, clears lockout counters, expires verification sessions, returns the PIN once to the operator and fails closed when `PIN_HMAC_KEY` is absent. The PIN never reaches the audit row or the logs.
- Input allowlists come from `createUserSchema` and `updateUserSchema`. Profile updates cannot carry password, `pinHash`, `employeeCode` or `tokenVersion`, and a related shift must be active in the same business.
- Responses use a public projection and generic error bodies. Prisma P2002 maps to 409 and P2025 to 404.

Verification:

- `npx vitest run --config vitest.unit.config.ts` → 29 tests passed in one file (the file held 20 before this session).
- `npx tsc --noEmit` in `backend` → 0 errors.
- The committed tree (`3d6b983`) was checked in an isolated worktree with the local `node_modules` and generated client linked in: typecheck 0 errors and 29/29 tests passed. The worktree was removed afterwards.
- Targeted typecheck of the contract suite (`tsc --noEmit --ignoreConfig ... tests/unit/userController.contract.test.ts`) → 0 errors.
- `gitleaks detect --no-git --redact` over the controller and the unit suite → no leaks.
- `bash .agents/scripts/env-check.sh` → 27 referenced variables documented, pass.
- The suite mounts `userRoutes` and `hrRoutes` with mocked middleware and no database connection, which covers import and handler registration.

Limits:

- The database-backed suites (`user.test.ts`, `accountEdges.test.ts` and the rest) were not run because no isolated-target authorization was given. RLS behavior, real concurrency and PostgreSQL response serialization remain unverified.
- Mocked contract tests do not establish production behavior.
- P01 runtime declaration and CI alignment remain outstanding.
- No UI consumer changed. `/manage-staff` keeps its current endpoints until P25.
- The owner checkpoint cleared after this pass; the work was committed as `3d6b983` through `.agents/scripts/commit.sh`.

## P03 verification checkpoint - 2026-11-01

The contract-fixture slice is committed as `fa3f9b0` after owner review. No push, database access, schema or migration change, installation or deployment was performed.

Delivered:

- `backend/tests/unit/contractFixtures.contract.test.ts` holds 15 no-database checks across two lanes. The HTTP lane mounts the real policy, calendar, business, attendance, HR and jobs routers behind mocked session middleware and the real `validate()` middleware. It proves the mounted reads answer, the three paths the frontend still mocks (`GET /business/policies/:id/versions`, `GET /business/calendars/:id/exceptions`, `POST /business/calendars`) answer 404, and malformed UUIDs and dates answer the documented 400 body. The handler lane calls the controllers with a mocked Prisma client and asserts the emitted envelopes and key sets.
- `docs/attendpro/P03-CONTRACT-FIXTURES.md` records the actual response contracts, the boundary rules, the consumer mismatch inventory for the three named frontend suites, and the limits of the evidence.
- The fixture key sets cover policies with nested versions, calendars with nested exceptions, settings with nested branding, the flat attendance envelope, the register's `employee` rename and shift-snapshot precedence, the four pagination variants (`totalUsers`, `total`, `totalDevices`, flat `count/total/page`), and the jobs status object.

Verification:

- `npx vitest run --config vitest.unit.config.ts` → 44 tests in 2 files at the P03 checkpoint, all pass (29 account contracts plus 15 fixture contracts). The suite is 65 tests in 3 files after P04.
- `npx tsc --noEmit` in `backend` → 0 errors.
- `bash .agents/scripts/humanize-check.sh docs/attendpro/P03-CONTRACT-FIXTURES.md` → clean.

Limits:

- The database-backed suites were not run; RLS, transactions, concurrency and PostgreSQL serialisation remain unverified.
- The fixture suite does not prove that any screen consumes the real shape. The inventory shows several that do not.
- The plan asks for mock success on unmounted GET paths to be removed. Those mocks are recorded but left in place because the screens still call the unmounted paths; removing them now would leave the consumer suite red. The repair belongs to the consumer slice.
- No UI source changed. No mock was made to pass.

## P04 verification checkpoint - 2026-11-01

The password and PIN security slice is complete in the working tree and awaits the Security verdict and owner approval. No commit, push, database access, schema or migration change, installation or deployment was performed.

Delivered:

- `backend/utils/pinPolicy.ts` holds the owner's R5 values (ten attempts, five-minute lock) once. `kioskVerifyController.ts` and `staffProfileController.ts` both import them, so the kiosk lane and the self-service PIN lane share one guessing budget.
- `backend/controllers/staffProfileController.ts` now refuses a locked PIN, charges a wrong current PIN to the cumulative counter, trips the lock at the R5 limit, compares the stored hash in constant time, expires every open kiosk verification session on success, and guards the write on the observed `pinHash`/`pinSalt` so a concurrent administrator reset wins.
- The shared Security entry is role-correct. `src/App.jsx` guards `/profile/change-pin` with `StaffRoute`; `src/pages/Profile.tsx` and `src/components/Sidebar.tsx` show the PIN action to STAFF only. `src/pages/StaffChangePin.tsx` no longer says a temporary lock requires HR.
- `backend/tests/unit/authSecurity.contract.test.ts` adds 21 no-database checks for token claims and revocation, the database role winning over the signed role, tenant and inactive refusals, the shared PIN policy, the PIN-lane lockout, session expiry, constant-time comparison and the reset/change conflict.
- The P02 suite gained two assertions: an administrator password reset expires open verification sessions, and the generated temporary password is absent from the audit calls.
- `docs/attendpro/P04-AUTH-SECURITY-VERIFICATION.md` records the verified surfaces, the four repaired defects, the decisions left for Security, and the limits.

Verification:

- `cd backend && npx vitest run --config vitest.unit.config.ts` → 65 tests in 3 files, all pass.
- `cd backend && npx tsc --noEmit` → 0 errors.
- `npx vitest run` at the repository root → 166 tests in 14 files, all pass.
- `npx tsc --noEmit` at the repository root → 0 errors.
- UI taste audit → clean for `StaffChangePin.tsx`, `Profile.tsx`, `Sidebar.tsx` and `App.jsx`.
- `bash .agents/scripts/env-check.sh` → 27 referenced variables documented, pass.
- `bash .agents/scripts/humanize-check.sh docs/attendpro/P04-AUTH-SECURITY-VERIFICATION.md` → clean.
- `gitleaks detect --no-git --redact` → one pre-existing finding in the ignored `backend/.env` (live `JWT_SECRET`); no P04 file flagged. The commit gate scans the staged diff.

Repaired defects:

1. The self-service PIN change ignored the cumulative lockout and never incremented the failure counter, so a staff session could guess outside the kiosk budget.
2. A successful PIN change did not expire open kiosk verification sessions, so a session opened with the old PIN could still be consumed.
3. The PIN write had no observed-value guard, so a concurrent administrator reset could be overwritten.
4. HR and SUPERADMIN saw and could open the STAFF-only Change PIN screen; the backend answered 403.

Limits:

- The database-backed suites (`auth.test.ts`, `user.test.ts`, `accountEdges.test.ts`, `staffSelfService.test.ts`) were not run because no isolated-target authorization was given. Real RLS, row locking, concurrent updates and PostgreSQL serialisation remain unverified.
- The P04 suite mocks Prisma; it proves controller decisions, not the SQL those decisions compile to.
- The ten-attempt counter is read back inside the transaction, but concurrent-failure behaviour under PostgreSQL isolation was not exercised.
- The frontend tests replace the API client; they prove route guards, menu filtering and request shape, not a live server.
- `mustChangePin` is set and cleared but not enforced by the kiosk verification path. The approved scope names a mandatory password-change gate, not a PIN-change gate; Security is asked to decide whether that enforcement belongs in a later slice.
- A self-service PIN change leaves the web token valid by design; it expires kiosk sessions instead. Security is asked to confirm that split.

## Current slice checkpoint — 2026-11-02

Current Git history confirms P02 committed as 3d6b983 and P03 as fa3f9b0. Do not repeat those repairs. P04 remains at review with existing staged work preserved; no commit or push is authorized by this checkpoint.

P04 Security requested corrections for a PIN-change late-lock race and best-effort audit writes. Developer p04_gate_fixes owns staffProfileController.ts only; Tester p04_regression_tester owns authSecurity.contract.test.ts. No database/schema/migration or live environment change is authorized. The initial isolated backend baseline passes 65 tests; additional regression checks must cover the findings before review.

P05 contracts are IN_PROGRESS with Architect p05_contracts, owning docs/attendpro/P05-DETAIL-CONTEXT-CONTRACTS.md only. Scope: attendance/employee/attempt details, HR-own correction boundaries and minimal authorized business context. No endpoint implementation or permission expansion.

## Security correction follow-up — 2026-11-02

Security found an in-flight PIN request could clear a newer lock because the write observed only the credential hash/salt. Both writes now also require the observed failure count and lock timestamp. A concurrent change returns 409 without overwriting that state. Required PIN audit events now use strict transaction writes; audit rejection returns a generic server error instead of normal success. Raw exception messages are no longer logged in this handler.

Tester reproduced four failures before repair and verified all four pass after repair. The isolated backend suite passes 69 contracts in three files with no database setup. Backend and frontend typechecks pass; scoped redacted secret scanning and whitespace checks pass. Real PostgreSQL concurrency, transaction rollback and production RLS remain unverified; no database operation ran.

P04 is not complete: Profile still links ordinary password change to forced /set-password. The approved separate ordinary password-change destination is the next bounded UI slice. Do not infer that endpoint verification supplies that missing screen. Current working-tree corrections are not staged; preserve the existing index until owner review and deliberate commit preparation.

Final current checkpoint: P04 PIN security corrections passed QA, Tester and Security review. All 69 isolated backend tests pass; both typechecks, environment parity, scoped Gitleaks and documentation checks pass. Current fixes remain unstaged on top of the existing staged P04 slice; no commit was made. P04 ordinary Change Password UI remains unfinished. P05 contract document is ready at HUMAN_CHECKPOINT; endpoint proposals require owner review before implementation.

## P04 PIN correction commit checkpoint — 2026-11-02

Owner approved committing the reviewed P04 PIN security slice through commit.sh. QA, Tester and Security approved the late-lock observed-state guards and strict audit writes. The no-database backend suite passes 69 tests; both typechecks, environment parity, scoped secret scanning and whitespace checks pass. Real database concurrency, rollback and RLS remain unverified.

Ordinary Change Password UI is the next authorized bounded slice, separate from forced setup. P04 is not fully complete. P05 detail/context contracts remain proposals for review; no endpoint or schema implementation is authorized by this commit.

## Ordinary password screen execution — 2026-11-02

Owner authorized the next bounded slice after the reviewed PIN corrections. Developer ordinary_password_developer owns ChangePassword.tsx, narrow App/Profile wiring and the exact wrong-current-password interceptor exception. Tester ordinary_password_tester owns focused form/interceptor and existing-tool browser checks. Security approved the scoped approach; final code review remains required.

Scope follows docs/superpowers/plans/2026-11-02-attendpro-ordinary-password.md. No backend, database/schema/migration, dependency, live environment or push changes. No new code commit is authorized until this slice's verification and owner review.

## Ordinary password verification checkpoint — 2026-11-02

PIN security slice committed through commit.sh as 2d11801; no push. Ordinary Change Password implementation is complete and remains uncommitted for review. The new route is /profile/change-password; initial setup remains separate. Focused tests pass 31/31, mocked browser checks pass at 375px and 1440px, typecheck and scoped JavaScript lint pass, and UI taste/environment/secret checks pass. Security approved the bounded source. Full frontend suite and final QA verdict are pending at this checkpoint.

Verification artifact: docs/attendpro/P04A-ORDINARY-PASSWORD-VERIFICATION.md. No database/schema/migration, package or live environment changes. P05 contracts remain ready for owner review; no endpoint implementation is implied. Preserve unrelated modifications and the empty staging index.

Ordinary password final verification: full frontend suite passed 192/192 across 15 files; 31 focused tests and two mocked browser checks passed. Typecheck, scoped JavaScript lint, UI taste, environment parity, humanizer and redacted secret scan passed. Security approved; final QA checkpoint and owner review precede commit. No ordinary-password files staged or committed; PIN security commit remains 2d11801.

Final QA verdict: APPROVED for the ordinary Change Password slice, with no issues. QA, Tester and Security gates are complete. Await owner review before commit.sh; live-backend/database verification remains separate.

## Ordinary password commit approval — 2026-11-02

Owner approved proceeding after review. The ordinary Change Password slice passed QA, Tester and Security: full frontend 192/192, focused 31/31, two mocked browser checks at 375px and 1440px, typecheck, scoped JavaScript lint and mechanical gates. Prepare only this reviewed scope for commit.sh; no push. Live authentication/database checks remain separate.

Next phase P05 is contract review only: proposed detail/context reads must be checked against current source and permissions. No missing endpoint, schema or database implementation is authorized by this transition.

## P05 contract review — 2026-11-02

QA approved the documentation contracts after the routing-precedence clarification. Security approved with implementation conditions: authoritative own-business scoping, role/ownership negatives, explicit projections, static-route precedence, no attendance-attempt join, no privileged Settings leakage, and bounded date queries. Humanizer, redacted Gitleaks and nine source-reference path checks passed. Exact relevant schema fields and existing route/filter boundaries were inspected without database access.

P05 is at HUMAN_CHECKPOINT. Proposed attendance detail, attempt detail, HR-own correction reads, minimal business context, optional SA-only QR metadata and bounded recorded-date filters are not mounted or implemented by this document. Owner approval precedes implementation. No source/schema/migration/data changes or P05 commit.

## Completed ordinary-password commit — 2026-11-02

Commit caa275e was created through commit.sh: ordinary account password screen, scoped interceptor behavior, tests and verification documentation. All pre-commit gates passed, including Gitleaks, environment parity, UI taste over 141 frontend files and documentation checks. No push. Unrelated working-tree changes remain preserved.

P05 contract review is ready for owner approval. Next proposed implementation is the bounded attendance-detail read contract; no P05 endpoint implementation has started. Database/schema/migration and live environment changes remain outside this authorization.

## P05a implementation — 2026-11-02

Owner approved P05 detail/context contracts. IN_PROGRESS P05a direct attendance detail read. Developer attendance_detail_developer owns new attendanceDetailController.ts and narrow attendanceRoutes additions; Tester attendance_detail_tester owns isolated detail tests and necessary fixture updates. Security approved the bounded approach with tenant/projection/route-precedence conditions. Scope follows docs/superpowers/plans/2026-11-02-attendpro-attendance-detail-api.md.

No other P05 read, frontend, database/schema/migration, package, live environment, staging or commit is authorized by this slice. Human review follows QA/Tester/Security and mechanical checks.

## P05a final review checkpoint — 2026-11-03

P05a implementation matches the recorded bounded Attendance Detail API scope. The previously interrupted final QA review is now APPROVED with no issues; Tester and Security gates are complete. Existing evidence: 90/90 isolated backend tests across four files, production/test typechecks and scoped secret/environment/whitespace/document checks passed. No tests were rerun for this resume; no database/schema/migration changes.

State: HUMAN_CHECKPOINT. Staging index empty; no P05a commit. Proposed action is a scoped commit through commit.sh with message feat(attendance): add scoped attendance detail read after owner approval. Preserve unrelated changes; include only the detail controller, route additions, isolated tests and P05a documentation/state hunks. Do not start the next P05 source slice.

## P05a approved commit checkpoint — 2026-11-03

Owner explicitly approved committing only the reviewed P05a Attendance Detail API files/documentation through commit.sh with message feat(attendance): add scoped attendance detail read. QA, Tester and Security gates passed. Recorded evidence remains 90 isolated backend tests, clean typechecks and scoped mechanical checks; no tests were rerun for commit preparation.

Commit preparation includes only the detail controller, attendance route additions, isolated detail test, P05a verification/plan and P05a-only guide/state hunks. Preserve unrelated changes. No push or next source slice. The commit remains pending until commit.sh succeeds.

## P06a Staff Attendance Detail — 2026-11-03

Owner approved implementation of the bounded Staff detail consumer for completed P05a6391fe7. IN_PROGRESS Developer staff_detail_developer owns new detail view/helpers, narrow list return-context/navigation and App mount; Tester staff_detail_tester owns focused/browser tests and guide. Security approved approach with safe return context, stale/session guards and evidence constraints. Plan: docs/superpowers/plans/2026-11-03-attendpro-staff-attendance-detail.md.

No P05a/backend/schema/migration, credential/data or unrelated screen changes. No local app/API listeners or existing authorized Staff session were available; live verification is blocked. Any mocked browser evidence remains explicitly separate. Stop after implementation/checkpoint for owner review; no commit/push/next slice.

## P06a final review checkpoint — 2026-11-03

Staff Attendance Detail implementation is complete. QA, Tester and Security approved the bounded slice. Evidence:58 focused/detail/auth-routing tests;3 mocked real-browser checks at375px/1440px including direct URL/refresh and filter/page return; frontend typecheck; UI taste; environment parity; scoped Gitleaks; whitespace/document checks. Existing admin-flows passed26/27 under browser load and its unrelated timed-out Policy case passed isolated retry without code or timeout changes.

Known limits: no live local API or existing authorized Staff session; no credentials/data were created to remove that blocker. Mocked browser evidence is not live auth/API proof. Existing ESLint does not match TypeScript files; an untouched unrelated HR test has an unused-variable lint error. P05a backend/schema are unchanged; unrelated list/table contracts remain outside scope.

State: HUMAN_CHECKPOINT. No staged files or P06a commit. Proposed commit after owner review: feat(attendance): add staff attendance detail view. Stop here; no push or next slice.

## P06a approved commit checkpoint — 2026-11-03

Owner explicitly approved only the reviewed P06a changes through commit.sh with message feat(attendance): add staff attendance detail view. QA, Tester and Security approved. Recorded evidence remains58 focused/detail/auth-routing tests,3 mocked browser checks, clean typecheck and scoped mechanical checks, with live API/session and baseline lint limits retained.

Commit scope: detail view/helpers, required list navigation/filter-context wiring and its reviewed canonical status-selector dependency, existing App detail mount, new focused/browser tests and P06a-only documentation hunks. The pre-existing untracked admin-flows file remains uncommitted, including its two local P06a test adjustments; new focused/browser tests cover the slice. Preserve unrelated App routes, search-placeholder edit and all other changes. No push or next slice. Commit remains pending until commit.sh succeeds.

## P06c Staff Help Requests — 2026-11-03

Owner authorized direct execution of the next dependency-eligible approved slice. IN_PROGRESS P06c list/detail recovery, independent of pending Schedule calendar/timing prerequisites. Developer help_requests_developer owns two Help views and feature-local helpers; Tester help_requests_tester owns focused/browser tests/guide. QA help_requests_qa reviews actual slice. Plan: docs/superpowers/plans/2026-11-03-attendpro-staff-help-recovery.md.

Existing creation form and backend/permissions remain unchanged. No schema/migration, credentials/data, dependencies, unrelated screens, staging, commit or push. Existing frontend/API servers are healthy; live Staff verification depends on an existing authorized session, never newly created test credentials/data. Mocked browser checks remain separate evidence.

## P06c final review checkpoint — 2026-11-03

P06c Staff Help Requests list/detail recovery is implemented. Tester verified26 focused and32 existing screen tests, frontend typecheck and3 intercepted-API browser checks at375px/1440px. Latest alignment screenshots were inspected. UI taste, environment parity, scoped secrets, whitespace and documentation checks passed. QA final verdict is recorded in the verification report.

State: HUMAN_CHECKPOINT. Live authenticated Staff verification remains unverified because native browser tooling could not identify the existing URL under policy; healthy existing servers were preserved. Existing lint configuration ignores TypeScript files. No backend, role/tenant/RLS, schema/migration, credentials/data or other-screen changes. No staging, commit or push. Proposed commit after owner review: fix(help): recover staff request list and detail. Exclude the pre-existing untracked legacy screen-test file; preserve unrelated changes. No next slice started.

## P06c committed; P07a IN_PROGRESS — 2026-11-03

P06c committed through commit.sh as8880a30 with all mechanical gates passed. Narrow legacy test adjustments and unrelated working-tree changes remain uncommitted. Owner authorized the next eligible slice directly. P07a operational Attendance register/direct detail recovery is IN_PROGRESS. Developer hr_attendance_developer owns HrAttendance, new detail and feature-local helpers; Tester hr_attendance_tester owns new focused/browser tests and guide; QA hr_attendance_qa reviews. Plan: docs/superpowers/plans/2026-11-03-attendpro-hr-attendance-recovery.md. No backend/routes/schema/permissions/data changes or new commit/push authorized. P06d business-time form dependency remains intact; no interim input semantics selected.

## P07a resumed — 2026-11-04

Resumed the existing P07a slice after the interrupted session. P06c remains committed at8880a30. Tester had already captured23 baseline cases with21 failures and2 passes; that RED investigation was not repeated. Developer, Tester and QA continue their existing ownership. Session freshness fetch succeeded after filesystem elevation; working-tree changes remain preserved. Current read-only HTTP checks return200 for frontend5173 and API8000 health. Live authenticated browser verification remains unverified under the existing native URL-policy limitation. No credentials/data changes are authorized to remove it.

## P07a final review checkpoint — 2026-11-04

P07a HR/SUPERADMIN Attendance register and direct detail recovery is implemented. QA APPROVED with no findings; Tester verified29 focused tests,29 existing authentication/routing tests, final frontend TypeScript and3 intercepted-API browser cases at375px/1440px. Five screenshots were inspected. Scoped UI taste, secrets, environment parity, whitespace and documentation checks passed. Evidence: docs/attendpro/P07A-HR-ATTENDANCE-VERIFICATION.md.

State: HUMAN_CHECKPOINT. P06c remains committed8880a30. P07a has no staged files, commit or push; proposed commit after owner review is fix(attendance): recover operational register and detail. All74 unrelated tracked-file fingerprints match the captured baseline; narrow untracked legacy tests remain preserved. No backend, route, Staff/Exceptions, credentials/data, schema/migrations, permissions or general-business configuration changes. Live authenticated verification remains unverified under native browser URL policy; healthy existing servers were preserved. Existing ESLint does not cover TypeScript. Explicit UTC clock-in filters do not claim P17 business-day correctness. P06d configured business-time form dependency remains intact. No next slice started.

Session continuity record: .agents/memory/handoffs/handoff-2026-11-04-p07a.md. It records this review checkpoint only and remains unstaged.

## P07a committed; P07b IN_PROGRESS — 2026-11-04

P07a committed through commit.sh asb4cc2b6; all commit gates passed and unrelated changes remain preserved. Owner authorized the next eligible slice directly. P07b Exceptions kind/pagination recovery is IN_PROGRESS: Developer exceptions_developer owns bounded Exceptions source/helpers, minimal Attendance detail return bridge and existing report attemptTake calculation; Tester exceptions_tester owns new focused/backend-mocked/browser tests and guide; QA exceptions_qa reviews. Plan: docs/superpowers/plans/2026-11-04-attendpro-exceptions-recovery.md. No new endpoints/routes, permission/schema/migration, credentials/data changes or new commit/push authorized. Attempt Detail/evidence remains P28, with no inferred attendance relationship. Backend verification uses mocked persistence only, never DB fixture writes.

## P07b review checkpoint — 2026-11-05

P07a was committed through commit.sh at b4cc2b6. P07b Exceptions recovery is implemented and QA approved with no findings. Passed 20 Exceptions frontend tests, 29 P07a regression tests, 20 mocked backend contract tests, three intercepted browser cases at 375px and 1440px, frontend and backend typechecks, and scoped mechanical gates. See docs/attendpro/P07B-EXCEPTIONS-VERIFICATION.md. Live authenticated verification remains outstanding and full Attempt Detail remains P28. P07b is unstaged and uncommitted for owner review. Proposed commit is fix(exceptions): recover kinds and pagination.

## P07b committed and P08a in progress — 2026-11-05

P07b committed through commit.sh as 1826452. P08a covers the approved HR Help queue and direct detail. The direct GET uses the existing business queue projection and role and tenant scope. The existing status update gains a conditional write to enforce the final-state ladder during concurrent review. Resolve and Close require a note in the UI under H-04. The API retains its optional note contract.

## P08a review checkpoint — 2026-11-05

P08a HR Help queue, direct detail and transition recovery passed QA and scoped access review with no findings. Tests passed for 15 HR cases, 26 Staff regressions, 10 mocked backend cases and two intercepted Chromium viewport flows. TypeScript and scoped mechanical gates passed. See docs/attendpro/P08A-HR-HELP-VERIFICATION.md for file list and limits. P07b is committed as 1826452. P08a awaits owner review with an empty staging index. Proposed message is fix(help): recover HR request detail and review.

## P08a committed and P08b1 in progress — 2026-11-05

P08a committed through commit.sh as 1343d45 with its documented audit limitation. P08b1 recovers reviewer Corrections queue and detail and guards conflict rollback. See docs/superpowers/plans/2026-11-05-attendpro-reviewer-corrections.md.

## P08b1 review checkpoint — 2026-11-06

P08a committed through commit.sh as 1343d45. P08b1 reviewer Corrections recovery is implemented. Passed 10 frontend cases, 9 mocked backend cases, 39 shared-router regressions, intercepted 375px and 1440px Chromium flows and scoped mechanical checks. The rollback regression covers a losing decision after an attendance write. See docs/attendpro/P08B1-REVIEWER-CORRECTIONS-VERIFICATION.md. P08b1 awaits review with an empty staging index. Proposed message is fix(corrections): recover reviewer detail and decisions.

## P08b1 committed and P08b2 dependency checkpoint — 2026-11-06

P08b1 committed through commit.sh as 9458cda. Its audit failure, live database concurrency and Superadmin backstop verification limits remain recorded. P08b2 ownership review confirmed HR can already submit time-only corrections for its own records. The accepted P05 contract defines narrow own tracking. The submission UI depends on approved business-zone handling, which is also outstanding for P06d. HR currently lacks an authorized current business-timezone read, and P17b remains pending. P08b2 awaits an owner decision on deferral or a tracking-only split.

## P08b2a tracking dependency — 2026-11-06

Owner approved the split. P08b2a is blocked on the HR own-request list and detail read contract described in P05. The Staff reads are STAFF-only, the HR reviewer reads are business-wide, and the attendance corrections router currently supports submission only. P08b2b remains deferred until an authorized current business-timezone read and applicable P17b prerequisites are complete.

## P08b2a review checkpoint — 2026-11-06

The P05 own-correction reads are mounted and the HR tracking screen is implemented. The list and detail pass the caller business and requester into every query, ignore supplied scope fields, and share the forced-password and role gates. The detail projection exposes only record, status, reason, timestamps, proposed punches and allowlisted snapshots; business, requester and reviewer identifiers do not leave the server. The correction namespace pass-through still precedes the generic attendance ID route, and no write path changed.

HR tracking adds `/hr-corrections/mine` and `:id` behind an HR-only guard, with status filtering, paging, return context and a read-only evidence view. SUPERADMIN is redirected and never sees the link.

Verification: 142 isolated backend tests, including 13 own-correction contracts and four guard and failure matrix cases; 8 own-tracking and 12 reviewer frontend cases; 4 Playwright cases at 375px and 1440px; 327 passing frontend tests; both typechecks; UI taste; environment parity; redacted secret scan; humanizer. Four frontend failures remain in two untracked legacy test files and predate this slice.

QA required the unrelated P08c trail hunk in `App.jsx` to stay out of this commit scope. Security approved with minor findings: the shared list validator had no page upper bound, the list read carried no cache header, and per-requester scope remains application-enforced because the corrections RLS policy is tenant-only. Owner review fixed the first two: the list read sends `Cache-Control: no-store`, and the shared list validator refuses a page that would produce an unsafe offset (400 instead of a Prisma 500), with no change for realistic pages. The composite index remains a schema change outside this authorization. Live authentication, database RLS, PostgreSQL concurrency and the database-backed suites remain unverified. P08b2b stays deferred. See docs/attendpro/P08B2A-OWN-CORRECTION-TRACKING-VERIFICATION.md. State: HUMAN_CHECKPOINT, empty staging index, no commit or push. Proposed message: feat(corrections): add HR own correction tracking.

## P08b2a committed — 2026-11-06

P08b2a committed through commit.sh as 1bd833b with 18 files. The P08c trail import and route, the Sidebar removals, the SEC-19 attendance filter hunk and all older working-tree changes remain unstaged. Next: Orchestrator scoping of the next approved unblocked slice. No push or deploy.

Residual risks carried forward: corrections RLS is tenant-only, so per-requester scope stays application-enforced; the `(business_id, requested_by_id)` composite index is a schema change awaiting DBA authorization; live authentication, database RLS, PostgreSQL concurrency and the database-backed suites remain unverified; `GET /api/staff/corrections/:id` still returns a raw row; the shared page bound is a safe-integer guard, not a product cap.

## P08c audit and correction trail — 2026-11-07

Owner authorized P08c. The audit listing and correction trail are repaired under Orchestrator coordination with audit_developer, audit_tester, audit_qa and audit_review assigned in the task board. The existing backend trail, generic listing and untracked trail page were reviewed before editing; working features were kept.

The backend adds `Cache-Control: no-store` to the trail, listing and single-entry reads, joins the acting user on trail audit rows, applies a safe page bound to the listing and refuses a reversed date range. The audit screen fixes the literal actor-name bug, handles null entity ids, lists the events the backend writes, scopes action choices by role, shows the reason and actor type, sends inclusive UTC date instants, uses an inline failure state with retry and raises the mobile drawer above its scrim. The trail shows status and tier labels, original and approved evidence with readable labels, revision before/after values, withdrawn semantics, a return link to the record, and separate empty, not-found and retry states.

Verification: 155 isolated backend tests including 13 new audit contracts; 9 focused frontend cases; 2 Playwright cases at 375px and 1440px; 336 passing frontend tests with the same four legacy failures; both typechecks; UI taste, environment parity, humanizer and redacted secret scan. The four failures remain in the two untracked legacy files and predate this slice. See docs/attendpro/P08C-AUDIT-TRAIL-VERIFICATION.md. State: HUMAN_CHECKPOINT, empty staging index, no commit or push. Proposed message: fix(audit): recover audit history and correction trail.

## P08c committed — 2026-11-07

P08c committed through commit.sh as 6d2ec85 with 12 files and `fix(audit): recover audit history and correction trail`. The commit includes only the P08c audit reads, listing validator hunk, audit contract suite, `HrAudit.tsx`, `HrCorrectionTrail.tsx`, the App trail route, the focused frontend and browser specs, the verification document and the P08c documentation entries. SEC-19, Sidebar, `auditWriter.ts`, the older Kiosk and Security docs and the untracked legacy tests remain unstaged. No push or deploy.

Residual risks: live authentication, database RLS, PostgreSQL concurrency and the database-backed audit suite remain unverified; the HR audit subset and requester scope stay handler-enforced while RLS is tenant-only; the trail is keyed by attendance id because `audit_logs` has no attendance column; the audit table scrolls horizontally at 375px; search covers action, entity and reason only; business-time display waits for P17; the four legacy frontend failures remain in untracked files.

Next candidate: P09 HR operational dashboard, with P08b2b still deferred on P17b and not needed for dashboard triage. Strict alternative: P10 shift definitions, unblocked by DONE P03. No next slice started.

## P09 review checkpoint — 2026-11-07

Owner authorized P09 HR dashboard triage after P08c committed as 6d2ec85. The existing dashboard was reviewed before editing. Its report calls omitted the required date pair, so both report endpoints answered 400 and the page showed zero metrics behind a toast. The exception rows read `user` instead of the response's `employee`, attempt rows had no status, absences were counted from review rows, and the attendance table used the superseded unscoped alias with only its first page. The page also duplicated the full register and search.

The repaired page reads the dated punctuality, exceptions and attendance-register reports plus the help and correction queue totals. It separates recorded rows, late arrivals, absent staff and open sessions; maps the real exception fields; links every count and preview row to its owning screen with the relevant range or status; and replaces the full register with bounded previews. Queue totals come from server pagination. The charts name their 100-row coverage when the period holds more. A failed load shows an inline alert and retry and no figures, while a successful empty response shows zeros. A visible note says the seven-day window uses the device date and that business-timezone handling is pending P17. No temporary timezone calculation was added.

Verification: 8 focused frontend cases in `src/__tests__/hr-dashboard.test.tsx`; 2 Playwright cases at 375px and 1440px in `src/__tests__/e2e/hr/dashboard.spec.ts`; 344 passing frontend tests with four known legacy failures in untracked files; frontend and backend typechecks; UI taste, environment parity, humanizer and redacted secret scan. See docs/attendpro/P09-HR-DASHBOARD-TRIAGE-VERIFICATION.md.

QA requested changes for a missing-today bucket and stale date after midnight; both are fixed and tested. QA's follow-up approved P09 with minor findings: the attempt preview cannot link to a specific attempt until P28, and the missing-bucket alert uses generic copy. The attempt link keeps the range and opens the exceptions queue. Security approved with a minor note that count reads fetch one full queue row, although the page does not display it. No route, permission, schema or write change; the page sends GET requests only and every read remains tenant-scoped in its handler. State: HUMAN_CHECKPOINT, empty staging index, no commit or push. Proposed message: `feat(hr): recover dashboard triage`.

Residual risks: live authentication, database RLS, PostgreSQL concurrency and the database-backed suites remain unverified; the charts use at most the 100 most recent register rows and state that coverage; business-time display waits for P17; attempt rows link to the exceptions queue because Attempt Detail remains P28; the legacy frontend failures remain in untracked files. No next slice started.

## P09 committed; next dependency checkpoint — 2026-11-07

P09 committed through `.agents/scripts/commit.sh` as `129bc2952d7b242fba7ceea6bb03ffc4043fb6ed` (`feat(hr): recover dashboard triage`). The reviewed commit has seven paths: `src/pages/HrDashboard.tsx`, two dashboard test files, the P09 verification document and only P09 hunks in the task board, current state and testing guide. The index is empty. Older shared-document edits and all unrelated work remain unstaged. No push or deploy.

Residual risks: live authentication, database RLS, PostgreSQL concurrency and database-backed suites remain unverified; charts read at most 100 register rows and state the coverage; business-local today depends on P17; individual attempt drill-through depends on P28; the missing-bucket failure uses generic copy; count queries return one authorized help or correction row even though the dashboard displays only totals; four untracked legacy frontend cases still fail.

The Orchestrator recommends P10 shift definitions as the next plan-order candidate. Its only dependency is P03, marked DONE. P11 waits for P02 and P10. P08b2b remains deferred on an authorized business-timezone read and applicable P17b work. P10 has not started and needs separate owner authorization before assignees or implementation.

## P10 resumed — 2026-11-10

Confirmed the active slice from the task board. P09 is committed at 129bc29 and P10 source and focused tests are already present. Resumed verification with Developer p10_developer_resume, Tester p10_tester_resume and QA p10_qa_resume. The current staging index contains a separate batch and is preserved. P10 remains at its implementation and verification checkpoint.

## P10 verification checkpoint — 2026-11-10

P10 Shift Definitions is implemented and verified at the owner checkpoint. QA approved with minor findings and no blockers. Security approved with two low findings and five informational notes. Verification passed 13 frontend cases, 12 mocked backend cases, two stateful viewport browser flows, both TypeScript checks and the scoped mechanical gates. The resume added session-bound reads and writes, response confirmation and duplicate-write protection to ShiftManagement.tsx, with focused regressions.

This pass closed the review findings. Names are trimmed before validation, shift times validate as minute-of-day, a failed deactivate shows one alert, a page beyond the last one returns to a valid page, and the search field waits 300 ms before it queries. The contract suite asserts the tenant-scoped filter, the ordering and the paging window, and it covers rejected minute input. The shared legacy fixture gained the `success: true` flag the real API returns, which keeps the legacy shift case green against the stricter list check.

The full frontend suite is 357 passing with four known legacy failures in untracked files, and the backend unit suite is 167 passing. Two items are deferred with reasons recorded in the task board: unescaped search metacharacters and the scheduling screen's thousand-row request.

The original staged batch remains exactly as found. P10 is uncommitted and awaits review with proposed message fix(shifts): recover definition contracts and workflow. Its report records live authentication, RLS, database concurrency, TypeScript lint and mobile table limits. P09 remains committed at 129bc29. P08b2b and its business-time dependencies remain deferred. No next slice started. Evidence: docs/attendpro/P10-SHIFT-DEFINITIONS-VERIFICATION.md.

## P10 committed — 2026-11-10

P10 Shift Definitions is committed at 5c5542c with the message fix(shifts): recover definition contracts and workflow. The commit holds the shift list contract, the minute-based shift page, the focused backend and frontend suites, the browser spec and the P10 documentation. It was prepared in an isolated index built from HEAD, so the shared staging batch of 130 entries was preserved unchanged and the other workstream's work is intact in the working tree.

The shared index still holds the pre-commit tree. It shows the four new P10 files as staged deletions and the P10 changes to the page, the validator and the three shared documents as staged reversions, so it needs a refresh for those paths before the next commit from it. The legacy fixture fix in `src/__tests__/admin-flows.test.jsx` stays with the workstream that owns that file. No push or deploy.

Residual risks: live authentication, database row-level security and real database concurrency remain unverified; unescaped search metacharacters and the scheduling screen's thousand-row request stay deferred to the assignment slice. P11 remains the next plan-order candidate and depends on P02 and P10. No next slice started.

## P11 and P11a design approved — 2026-11-10

The owner approved the employee weekly schedules direction and ten further scheduling decisions. The Architect, DBA and Security reviewers finalized the design, the governance documents were amended, and a phased implementation plan was written. The designs are docs/attendpro/P11-SHIFT-ASSIGNMENTS-TECHNICAL-DESIGN.md and docs/attendpro/P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md; the plan is docs/attendpro/P11-P11A-IMPLEMENTATION-PLAN.md.

The reviewer pass corrected three things in the design: the one-period-per-day production restriction is a deferred trigger rather than a partial index, because a partial index predicate cannot read another table's column; the resolution chain needs two further tables for personal days off and holiday exceptions; and the attendance provenance foreign keys use RESTRICT so the source survives with the record.

P11 and P11a remain NOT_STARTED. The owner has not authorized implementation. Two prerequisites are recorded for the acceptance work: no PostgreSQL is reachable from this machine, and the btree_gist extension must be installable on the pilot host before either exclusion constraint can exist. The shared Git index was not touched, and nothing was committed, pushed or deployed.

## P11 preparation checkpoint — 2026-11-10

The owner accepted the P11 and P11a architecture direction and the phased implementation plan, and authorized preparation only. Migrations and persistence implementation remain unauthorized.

The shared Git index was reconciled. The ten P10 paths were re-staged from the working tree, which removed four staged deletions of new P10 files and one staged reversion of the shift page, and left the shared paths holding their workstream's batch together with the P10 content. All 875 non-P10 index entries are byte-identical before and after, so no unrelated staged work was discarded or mixed, and the working tree is unchanged apart from this project's own documentation. No staged entry reverses committed P10 work.

The remaining product and technical choices are recorded as proposals in both design documents, each with a recommendation and the consequence of a different answer, and the role matrix and the API contracts say so explicitly. Nothing unapproved is presented as settled.

The first implementation slice, the legacy pointer deprecation, was reviewed as a specification: docs/attendpro/P11A-P11.1-POINTER-DEPRECATION-SLICE.md. It changes two schemas, one controller, one projection, one Swagger block and four test expectations, leaves the database untouched, and its one breaking API surface is a response key that no screen in the repository reads.

Two requirements were hardened. The assignment audit must be durable and written in the same transaction as the assignment write, because the shared writer swallows insert failures. And history preservation is explicit: no operation deletes an assignment row and no operation edits a realized period.

The environment was inspected for an isolated test database. The project already ships a guard and a deploy script, and the machine has a PostgreSQL 16.15 cluster with the needed extension installed but not running. The guard is fully configured: `backend/.env` names the test target, the development URL and the development host, so all seven refusals are live and the development database cannot be reached by a test run. An earlier note in this entry said the development-host exclusion was unconfigured; that was wrong and is corrected here and in the implementation plan. Four setup options are proposed in the implementation plan, with the Option B procedure written out in docs/attendpro/P11A-TEST-DATABASE-ENVIRONMENT-PROPOSAL.md; none was started.

P11 and P11a remain NOT_STARTED. No application code, migration, schema or RLS change was made, and nothing was committed, pushed or deployed. That was true at this checkpoint; P11.1 has since been implemented under the owner's separate authorization.

## P11 dependency check — 2026-11-10

The Orchestrator checked the next candidate after the P10 commit. P11 needs P02 and P10, and both are done, so P11 is the next plan-order candidate. It stays NOT_STARTED until the owner authorizes it. The visible defects are the thousand-row employee and shift lookups in `Scheduling.tsx`, which both list routes refuse with a 400, the flat assignment list that `Scheduling.tsx` reads as a paginated envelope, and the shift lookup that predates the P10 list contract.

The plan's stop condition applies before any write change: the Architect and the owner review the history semantics of closing the current assignment and syncing the legacy `user.shiftId`. Two answers are needed first. Whether future and backdated assignments run on business time or device time is tied to the deferred P17b read. The atomic close-and-sync path needs database verification, because the one-open-assignment invariant rests on a partial unique index and PostgreSQL is unreachable from this machine. No P11 work started.

## P11.1 implemented — 2026-11-10

The owner authorized P11.1, the legacy shift-pointer deprecation, as the first implementation slice. P11.2 and P11a remain NOT_STARTED.

The `shiftId` field left the employee create and update schemas, the account controller's writes and the public user projection, and it left the user, create and update Swagger schemas. The `validShift` helper and its two call sites are gone. The assignment path remains the only writer, and its pointer write now constrains the tenant in the same statement. The database column, its foreign key and its index are untouched, and no migration, schema or RLS file was changed.

The protection does not depend on the middleware: the controller parses the body itself and an object schema strips unknown keys, so removing the field from the schema is what closes the write.

Verification: 169 mocked backend cases pass, including four new assignment-controller cases that pin the tenant-scoped pointer write and the cross-tenant refusals, and 31 account-controller cases including three new ones that pin the ignored field, the honest audit reason and the schema level. Both typechecks are clean and the frontend suite is 357 passing with the four known legacy failures.

The live database suite could not run. The guard verified the target `localhost:5432/attendpro_test` and the connection was refused, so the new integration assertions are unverified until a database exists.

Three review gates ran. Tester and Security passed the slice with findings; QA requested changes. The findings that were fixed: the integration test no longer mutates the shared fixture account, the created user's audit rows are cleaned up, the assertions now check key absence rather than a value match, a new assignment-controller contract suite pins the tenant-scoped write, two API documents that still advertised the field were corrected, and the slice specification was amended where it misstated the mechanism and the route method.

Findings that were reported rather than fixed are recorded in the task board entry. Nothing was committed, pushed or deployed, and the reconciled shared index was not changed by this slice.

## P11.1 verification closure — 2026-11-10

The owner authorized an isolated Option B test instance and a correction: an account request carrying the legacy pointer is refused with a clear field error rather than having the field stripped in silence.

The correction is in both account schemas, which declare the field as `never`, so an absent field is valid and a present one is refused with a message naming the field and pointing at the assignment path. The controller reports that reason and keeps the generic wording for every other field. The assignment path remains the only writer and its write stays tenant-scoped.

An isolated PostgreSQL 16.10 instance now backs the database-backed suites: official portable binaries, verified by TLS, the published content length and the archive's CRC test; a temporary data directory outside every installation and outside the repository; port 5433; loopback only; throwaway credentials. The ServBay cluster, the managed development database and every other database were untouched. The project's own guard accepted `localhost:5433/attendpro_test`, and all ten existing migrations were applied to it alone.

The live assertions now run: the crud suite is 20 of 20 including the three new ones, and the refusal appears in the response body with the field named. Row level security was proved directly against the instance: the application role is a non-superuser, the five tenant tables have it enabled, a read with no tenant set returns nothing, a write for another tenant is refused by the policy, and a write for its own tenant passes.

The full database-backed suite is 774 passing and 23 failing. All 23 are pre-existing: with the pre-P11.1 code swapped back in, the same 23 fail. They are guard-ordering expectations in the account controller, where a body check runs before the authentication and tenant checks. They had never surfaced because the suite could not run before, and they belong to a separate slice.

The backend was rebuilt and the artifact no longer exposes the field, and a smoke test against the built artifact confirms the refusal and the absence of the key from a parsed body.

P11.1 is ready for final acceptance. P11.2 and P11a remain NOT_STARTED, the shared Git index was not changed by this work, and nothing was committed, pushed or deployed.

## P11.1 accepted — 2026-11-11

The owner accepted P11.1 as complete within its approved scope. It is implemented and verified, and it is not committed.

The live integration suite passes 20 of 20, including the three assertions that could not run before the isolated instance existed. All ten existing migrations were applied to the isolated test database and to nothing else, and the tenant-isolation posture was verified directly against that instance: the application role is a non-superuser, row level security is enabled on the five tenant tables, a read with no tenant set returns no rows, a write for another tenant is refused by the policy, and a write for its own tenant passes it.

No schema or migration change was made for P11.1, and no commit, push or deployment has been authorized.

Two groups of failures stay open. The twenty-three database-backed failures in the account controller area are proven pre-existing, and the four frontend failures are the known baseline.

## Next-step proposals — 2026-11-11

Two proposals are prepared and neither is implemented. The account controller guard-ordering remediation is in `docs/attendpro/P11A-ACCOUNT-GUARD-ORDERING-REMEDIATION.md`: the route middleware already answers in the right order, so the failures come from direct handler calls that bypass it, and the proposal names the four handlers that check the body before the caller, the tenant model that makes the expected refusal unreachable, three remediation options with a recommendation, the focused regression tests and the compatibility risks. The P11.2 assignment lifecycle proposal is in `docs/attendpro/P11-ASSIGNMENT-LIFECYCLE-PROPOSAL.md`: five product rules remain open and are not treated as approved, and the slice needs one migration carrying the exclusion constraint and the composite tenant foreign keys, durable audit rows inside the write transaction, tenant safeguards and ten concurrency tests. The isolated instance is suitable for them, and the extension the constraint needs was installed by the application role during this work.

P11.2 and P11a remain NOT_STARTED, the shared Git index is unchanged, and nothing was committed, pushed or deployed.

## Proposal A verified; P11.2 design finalized — 2026-11-14

Proposal A is implemented and uncommitted. `createUser`, `updateUser` and `resetPin` now settle authentication and administrator authorization before malformed-body errors. The shared write helper runs request preparation after those guards and before opening the transaction. `updateUser` repeats its parse guard inside the operation, and `resetPin` keeps the missing-key path fail-closed inside the transaction before any write.

All twenty-three account-controller failures are resolved. The five guard cases were two real ordering defects plus three test expectations for an impossible nullable-business state; the latter are replaced by tenant-mismatch tests using a real administrator and a 200 same-business control. The eighteen failure-arm cases now reach the user read each handler actually executes, with a realistic business-bearing `changePin` request. The test harness spies on the raw application client and restores the exact raw delegate methods, avoiding the tenant-proxy recursion and cross-file corruption found during QA and Security review.

Verification is green: 222 of 222 focused guard and failure cases in both file orders, 260 of 260 when the later utility consumer is included, 20 of 20 real HTTP account cases, 31 of 31 account contract cases, 805 of 805 database-backed cases across 36 files, and both TypeScript checks. The frontend runtime suite remains at the existing baseline of 357 passing and four known failures. The guarded database identity is `attendpro_test` as `attendpro_test` on loopback port 5433, with ten migrations; ServBay and the managed development database were not contacted.

P11.2 is finalized only at the design and governance layer. The six approved product rules are recorded in decision O26, the API contracts and `P11-SHIFT-ASSIGNMENTS-TECHNICAL-DESIGN.md`. A same-day replacement starts at the transaction instant so it cannot reinterpret an earlier realized period. Cancelling a future row closes it onto itself, reopens the predecessor's end and writes durable evidence in the same transaction. The future implementation must add tenant-safe constraints, atomic audit rows, real concurrency tests and non-superuser RLS acceptance tests.

No P11.2 persistence, schema, migration or RLS work was started. Nothing was committed, pushed or deployed. The shared index remains intact: 129 staged paths, no staged deletions, and all 875 preserved non-P10 entries byte-identical.

## P11.2 database-integrity checkpoint started — 2026-11-14

Proposal A is accepted with the verification recorded above. The owner has now authorized the first P11.2 internal checkpoint only: prepare and review the database migration without applying it. P11 is IN_PROGRESS with Architect, DBA, Security and Tester gates; the stopping state is HUMAN_CHECKPOINT for migration approval.

The checkpoint may draft `btree_gist`, prerequisite composite unique indexes, tenant-safe composite foreign keys, the assignment-period check and the employee-period exclusion constraint. It may inspect existing assignment data read-only and prepare concurrency tests for advisory locks and PostgreSQL `23P01`. It may not implement controllers or UI, change RLS policies, apply the migration, commit, push or deploy.

Only the isolated `localhost:5433/attendpro_test` database is permitted. Its guard and identity must be verified before any migration-related database operation. The managed development database, production and ServBay remain out of bounds.

The checkpoint is complete and stops at HUMAN_CHECKPOINT. The DBA prepared `backend/prisma/migrations/20261114120000_p11_assignment_integrity/migration.sql` plus the `schema.prisma` unique pairs and composite relations; the migration was not applied. All four gates returned: Architect, Security and Tester reported CHANGES REQUESTED with findings that were closed in the governance documents (middle-of-chain cancellation, the post-lock same-day instant, composite-FK actions with retained single-column keys, the frozen advisory-lock key with an identical-start re-read guard, the PATCH contract row, unified audit event names, a required reason, single-transaction application guidance and the accepted raw-SQL drift), and the DBA reported APPROVED for human migration review. Verified on the isolated instance: guard, identity, `prisma validate`, `prisma generate`, `tsc --noEmit`, `db-check.sh`, humanizer and `git diff --check` all pass. Existing data has zero assignment rows and zero violations; a restored production-like copy must repeat the preflight at deployment approval. Pilot-host `btree_gist` permission remains a pre-deployment check against the exact migration role.

The owner then approved application to the isolated test instance. The guard was re-verified and `npm run test:db:deploy` applied `20261114120000_p11_assignment_integrity` — 11 applied migrations. Row counts stayed identical across all 19 public tables; `btree_gist` 1.7, both unique pairs, both composite foreign keys, the period check and the exclusion constraint are present and validated; `shift_assignments_current_uq` and the tenant policy `shift_assignments_tenant_isolation` are unchanged. The constraint battery produced the expected SQLSTATEs (`23514`, `23P01`, `23505`, `23503` for both composite keys and missing references); empty cancellation intervals were accepted and invisible to overlap checks; adjacency stayed legal. Two-session tests proved blocking then `23P01` on commit, success after rollback, same-key advisory-lock serialization with `55P03` on timeout, and per-employee independence. Non-superuser tests as `attendpro_app` proved no-tenant reads zero, tenant A reads only tenant A, same-tenant insert accepted, cross-tenant insert refused with `42501`, and joins filtered to the calling tenant.

The migration exposed one pre-existing defect: `deactivateAssignment` closed future rows at `now`, an inverted period the old schema silently accepted and the CHECK now refuses with a 500. The owner authorized the minimal repair outside the P11.2 lifecycle slice — a future row closes onto its own start, a row in force closes at `now`, matching the approved DELETE contract. Typecheck, focused suites (24/24) and the full DB-backed suite pass at **805/805 across 36 files**. Two transient `accountEdges` 401s in the first full run were the pre-existing shared-staff-account race: green in isolation and in both full re-runs, and recorded with the defect in `docs/LESSONS.md`. Post-apply `prisma migrate diff` shows only the documented accepted drift. Nothing was committed, pushed or deployed; P11.2 controllers, lifecycle writes, UI and RLS remain untouched beyond the authorized close-path repair.

## P11.2 backend lifecycle at human checkpoint — 2026-11-15

Active branch: `codex/attendpro-phased-delivery`; HEAD `5c5542c`. With the database-integrity checkpoint accepted, the owner authorized only assignment lifecycle backend and tests. The Developer implemented effective-dated create, replace, future reschedule and cancellation, current deactivation, tenant-scoped reads and writes, and business-timezone date boundaries. Each lifecycle write takes the approved per-employee transaction lock, captures one post-lock `clock_timestamp()`, then writes one durable `tx.auditLog.create` record in the same transaction; failed audit inserts roll back the write. Tenant-scoped employee and shift `FOR SHARE` locks guard active-state checks. The attendance resolver uses `users.shiftId` only if the employee has no assignment history, and the staff schedule excludes empty cancelled intervals. No attendance history, schema, migration, RLS policy, frontend UI or P11a weekly-schedule code was changed in this slice.

QA and Security found a conflict between the earlier PATCH contract (leave preceding rows unchanged) and the owner's continuous-coverage requirement. After the third review loop, the owner approved moving only a contiguous predecessor's future end to the amended future start, leaving its start and realized span unchanged. O26, the technical design and API contracts now state this amendment. Focused guarded lifecycle tests passed 44/44 across four files; the final amended full backend suite passed **825/825 across 38 files**. Backend and frontend typechecks passed. Independent non-superuser `attendpro_app` rollback checks confirmed tenant-matched assignment and audit writes and employee/shift row locks, no-tenant reads zero and cross-tenant writes `42501`, with zero probe rows left. Final QA and Security reviews approved the amended code. The unchanged frontend baseline is 357 passing with four known failures. Earlier full-suite runs showed intermittent `controllerGuards` failures and seeded-account login failures; those files passed alone, and the final default backend run passed without modifying them. The shared index holds 129 staged paths with zero staged deletions; no commit, push or deployment. Backend code and verification are ready for human review. A slice-specific implementation plan was not approved under `docs/superpowers/plans/` before code work; raise this Dev-OS process exception at acceptance rather than marking that gate passed.

## P11.2 targeted backend acceptance verification — 2026-11-15

The owner conditionally accepted the lifecycle backend and requested five targeted tests, without expanding P11a or UI. A real HTTP integration test forced PostgreSQL `23P01` after the application precheck and found a 500; PrismaPg 6.19.3 supplied the SQLSTATE only within a `PrismaClientUnknownRequestError` message. The controller now matches that exact engine fragment and returns a fixed, sanitized 409. A PATCH audit-insert failure rolled back the predecessor, target and successor; foreign-tenant PATCH left rows and audits unchanged. The attendance fallback was reviewed: a cancelled `[F,F)` row never resolves as active, and any assignment history prevents `users.shiftId` from filling a gap.

The HTTP account-deactivation race showed that an assignment granted first remained effective when the account was subsequently disabled. The owner authorized a narrow repair to close current and future assignments, clear the pointer and write one durable assignment audit in the account transaction. Both DELETE and SUPERADMIN PUT deactivation paths use the employee advisory lock. HR retains its existing permission to deactivate STAFF. A deterministic DELETE test covers the grant-first state, and an injected account audit failure proves rollback. The staggered API race remains an additional timing-sensitive check, not proof of a specific winner.

Security found that a supplied `DATABASE_URL_APP` could bypass the test URL and that connection-string query keys could override the checked host. The suite and guarded verifier now clear the app URL after positive validation; the shared guard rejects all query keys except `schema`. Its no-DB contract test runs in a separate process. No other database, migration, schema or RLS policy was changed. The final full backend run on this exact state passed **841/841 across 39 files**; focused lifecycle tests passed 25/25 and guard tests passed 8/8. Backend and frontend typechecks passed, and the environment audit passed. Final QA and Security gates both returned APPROVED with informational residual risks only. The frontend baseline remains 357 passing and four previously known failures, with no frontend code changed.

`docs/attendpro/P11-BACKEND-PLAN-GATE-EXCEPTION.md` records the missed preimplementation Dev-OS plan gate. The existing technical design and P11/P11a plan do not constitute a preapproved slice plan under `docs/superpowers/plans/`; no later document is being represented as prior approval. The human checkpoint must review this exception. The shared Git index remains reserved for earlier work, and nothing was committed, pushed or deployed.
