# Project State

> This file is maintained by the Orchestrator agent. It is updated at each phase transition to preserve context across long sessions.

## Current Session — 2026-10-16

- **Task:** M7 (help requests, correction decisions with the no-self-approval backstop, reports + CSV, audit trail, retention settings) built, reviewed, and verified through the orchestrator; uncommitted, ready for the owner's commit decision. R1/R5/R6/R10 final values live in code (committed `8526a98` for R10/rehearsal; rulings ride in this set), every owner decision now closed.
- **Branch:** `main`, twelve commits ahead of `origin/main`, nothing pushed
- **Mode:** interactive, Orchestrator locked
- **State:** M5 committed (`63318bf`) plus the pause-record commit (`4fa1602`). M6 is written, reviewed (verdict: safe after fixes — the blocking re-flagging idempotence fix and the cheap hardening applied), and verified (`tsc` 0 errors, prisma valid, db-check, env parity, ui-taste, humanize all pass), uncommitted. `docs/attendpro/*.md` and the testing guide pass `humanize-check.sh`.

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

- M0 **DONE** — `chore/git-foundation`, commit `fea8a00`, pushed.
- M1 **DONE** — `feat/auth-foundation`, commits `7927e1f` and `c5ee5ff`, plus the
  GitGuardian config `9f08982`, merged to `main` via `merge/m1-into-main`.
- M2 **DONE** — `feat/design-tokens`, commit `6ad2bd6`, merged to `main`.
- M3 **DONE** — `feat/login-redesign`, commit `15be18c`, merged to `main`.
- M4 **DONE** — `feat/dashboard-redesign`, commit `277ec10`, pushed and merged.
- M5 **DONE** — `feat/sidebar-navigation`, commit `d599fee`, merged to `main`.
- M6 **DONE** — `feat/staff-management`, commit `76da9a0` (+ `.gitguardian.yaml`
  `624b5b2`), merged to `main` via PR #11.
- M7 **DONE** — `feat/staff-management` (stacked), commit `584d796`, merged to
  `main` via PR #12.
- M8 **DONE** — `test/regression-suite`, commit `38b0920` (+ docs `dc681a3`),
  merged to `main` via PR #13. Backend 71/71 and frontend 58/58 green as of
  2026-10-10.
- M9 **DONE** — `test/security-suite`, commit `165e09b`, merged to `main` via
  PR #14. Backend 78/78 and frontend 63/63 green as of 2026-10-10.
- M10 **DONE** — `qa/final-uiux-verification`, commit `20a1e43`, merged to
  `main` via PR #15. Agent-executed checks green (ui-taste-check 0/24, 20-rule
  audit, frontend 63/63, eslint and build clean); two uppercase residuals
  fixed; `CURRENT_STATE.md`, `AUDIT_REPORT.md` and `REGRESSION_SNAPSHOT.md`
  refreshed. Owner-run browser walkthrough and contrast re-measure itemised in
  `REGRESSION_SNAPSHOT.md` §5.

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
