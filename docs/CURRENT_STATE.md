# Project State

> This file is maintained by the Orchestrator agent. It is updated at each phase transition to preserve context across long sessions.

## Current Session — 2026-10-19

- **Task:** M9 in progress — full test suite, testing guide, CI, security review, close-out. M8 is committed (`f011053` + `e6f41eb`) and the M9 plan is approved at `docs/superpowers/plans/2026-10-18-attendpro-m9-test-ci-security-closeout.md`.
- **Branch:** `main`, eighteen commits ahead of `origin/main`, nothing pushed.
- **Mode:** interactive, Orchestrator locked.
- **State:** M9 Phases 0–6 are written but uncommitted. The suite runs against a dedicated local `attendpro_test` database; `tests/dbGuard.ts` verifies the exact host and name and refuses the development database, a `_test`-only guess, or a hosted Prisma host. Backend `tsc --noEmit` is clean and the backend suite is green (22 files, 590 tests); backend coverage is **93.43% statements / 85.93% branches**, and the 90/85 thresholds are enforced in `backend/vitest.config.ts` and CI. Frontend `typecheck` and `lint` are clean, the unit suite is green (98 tests / 11 files), and the production build succeeds. The frontend uses the owner-approved staged ratchet: 29.95% statements / 71.38% branches / 49.79% functions / 29.95% lines against a 29/71/49/29 floor, with the floor rising every milestone until 90/85. Playwright passed 5 of 5 runnable tests; the kiosk test is skipped because no kiosk UI exists. `ui-taste-check`, `db-check`, `env-check` and `humanize-check` pass. Five production defects surfaced by the new tests were fixed (M9-B1..B5), as was the staff-portal double `/api` prefix (SEC-20). The development seed now creates a SUPERADMIN and an HR account behind `SEED_CONFIRM=development`; a production bootstrap is still open (SSB-2). The dependency scan still reports 9 high frontend and 4 high backend production advisories, and the security review keeps SEC-07 (runtime RLS bypass) and SEC-08 (no JWT revocation on password reset) as public-launch blockers. The CI workflow has not been exercised on GitHub yet.

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
- M9 **IN PROGRESS** — working tree only, not committed. Backend 22 files / 590
  tests green against a guarded local `attendpro_test` database, with coverage at
  93.43% statements / 85.93% branches and the 90/85 gate enforced. Frontend 11
  files / 98 tests green; typecheck and lint clean; build clean; the staged
  frontend coverage ratchet passes at 29.95/71.38/49.79/29.95 against 29/71/49/29.
  Playwright 5 passed / 1 skipped. CI now starts its own Postgres 16 service
  container and runs the backend coverage command, so no database secret is
  required. Testing guide, security review, deployment runbook and close-out docs
  are written. The dependency scan (9 frontend + 4 backend high production
  advisories) and SEC-01..SEC-08 remain the open release decisions; the CI
  workflow itself has not run on GitHub yet. The owner must authorize the commit.
- M10 **NOT STARTED**.

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


## P04 PIN correction commit checkpoint — 2026-11-02

Owner approved committing the reviewed P04 PIN security slice through commit.sh. QA, Tester and Security approved the late-lock observed-state guards and strict audit writes. The no-database backend suite passes 69 tests; both typechecks, environment parity, scoped secret scanning and whitespace checks pass. Real database concurrency, rollback and RLS remain unverified.

Ordinary Change Password UI is the next authorized bounded slice, separate from forced setup. P04 is not fully complete. P05 detail/context contracts remain proposals for review; no endpoint or schema implementation is authorized by this commit.


## Ordinary password commit approval — 2026-11-02

Owner approved proceeding after review. The ordinary Change Password slice passed QA, Tester and Security: full frontend 192/192, focused 31/31, two mocked browser checks at 375px and 1440px, typecheck, scoped JavaScript lint and mechanical gates. Prepare only this reviewed scope for commit.sh; no push. Live authentication/database checks remain separate.

Next phase P05 is contract review only: proposed detail/context reads must be checked against current source and permissions. No missing endpoint, schema or database implementation is authorized by this transition.
