# Dev-OS Task Board & DAG Workflow State

> Single source of truth for active task execution, dependencies, and gating status.
> Maintained by the **Orchestrator** agent.
> AttendPro baseline opened 2026-10-14. Evidence lives in `docs/CURRENT_STATE.md`.

---

## AttendPro — Active Board (2026-10-14)

The programme is AttendPro. M0 (investigation) is committed (`c4ee602`), and the M1 design set is committed (`b403a66`). M1 is **approved** (owner, 2026-10-16). M2 (implementation foundation) is **complete** (`a74c72a`): 19-model Prisma schema, nine forward migrations with Row Level Security, test-database guard built. M3 (shifts, policies, status rule engine, timing policy) is **complete**: backend controllers, routes, validators and status engine implemented, `tsc` clean at zero errors. M4 (employees, sites, calendars, QR credentials) is **complete**: HR routes with audited PIN reset, sites with geo-fence, work calendars, QR issue/revoke. Nothing has been pushed to `origin/main`.

M0 artefacts (committed):

- `docs/ATTENDPRO_PRD.md` — PRD v1.0
- `docs/attendpro/M0-REALITY-CHECK.md` — repository reality check
- `docs/attendpro/M0-FORENSIC-RECONCILIATION.md` — re-verification of every §22 finding
- `docs/attendpro/DECISION-REGISTER.md` — O1 to O22 confirmed or noted

M1 design set (committed `b403a66`):

- `docs/attendpro/M1-*.md` including `M1-REVIEW-PACKAGE.md` (deliverables 1–17 complete)
- All pass `humanize-check.sh` clean

### [ COMPLETE ] — M2 implementation foundation

- **Assignee:** Implementer agent, orchestrated
- **DependsOn:** M1 (approved)
- **State:** committed as `a74c72a`
- **Delivered:**
  - `backend/prisma/schema.prisma` expanded to the 19 models of `M1-DATA-MODEL.md`, validated and generated
  - nine forward migrations `20261015120000`–`20261015200000` with Row Level Security, tenant policies, append-only grants, triggers and the hardened login function
  - `backend/scripts/db-guard.sh` enforcing the `_test` suffix and the expected host (O14)

### [ COMPLETE ] — M3 shifts, policies, status rule engine

- **Assignee:** Implementer agent, orchestrated
- **DependsOn:** M2 (complete)
- **State:** committed (`d31a5a0`)
- **Delivered:**
  - `backend/controllers/shiftController.ts` + `routes/shiftRoutes.ts` — shift CRUD (minute-of-day, name unique per business)
  - `backend/controllers/assignmentController.ts` + `routes/assignmentRoutes.ts` — shift assignments (transactional open/close/sync)
  - `backend/controllers/policyController.ts` + `routes/policyRoutes.ts` — workplace policies + effective-dated versions
  - `backend/utils/statusEngine.ts` — EARLY/ON_TIME/LATE/OPEN_SESSION evaluation wired into clockIn
  - `backend/controllers/userController.ts` — tenant (`business`) relation on user creation
  - `backend/controllers/attendanceController.ts` — removed `status: "PRESENT"`, uses evaluated status
  - `backend/utils/logger.ts` — shift/policy/assignment audit functions
  - `backend/validators/index.ts` — shift/policy validators, 8-value attendance status enum
  - Routes registered in `backend/server.ts`
- **Verification:** `tsc --noEmit` = 0 errors; `prisma validate` valid; `db-check.sh` passed; humanize-check clean

### [ COMPLETE ] — M4 SUPERADMIN employee, site, calendar and badge management

- **Orchestration:** implemented in-session, then independently reviewed by a review agent (verdict: safe after fixes) and documented by a separate docs agent; both findings applied.
- **DependsOn:** M3 (complete)
- **State:** committed (`f2db8e4`, reviewed)
- **Delivered:**
  - `backend/routes/hrRoutes.ts` — `/api/hr` reusing the `userController` list/create/update handlers rather than duplicating them; tenant scoping added inside those handlers
  - `userController.resetPin` — audited kiosk PIN reset (`HMAC-SHA-256` with `PIN_HMAC_KEY` and a per-record salt), lockout counters cleared, PIN never returned
  - `backend/controllers/siteController.ts` + `routes/siteRoutes.ts` — sites CRUD with geo-fence validation
  - `backend/controllers/calendarController.ts` + `routes/calendarRoutes.ts` — calendars, single default (O22), dated exceptions
  - `backend/controllers/qrController.ts` + `routes/qrRoutes.ts` — QR issue (token shown once, only a keyed hash stored) and revoke
  - validators and audit events for all of the above
- **Verification:** `tsc --noEmit` = 0 errors; `prisma validate` valid; `db-check.sh` passed on 10 migrations; `humanize-check` clean. Review-agent fixes applied: per-tenant last-superadmin rule (also on delete), round-trip calendar-date check, STAFF-only PIN reset target, directory gate parity, IANA timezone validation, policy-derived site radius, distinct default-calendar conflict message. `docs/TESTING_GUIDE.md` gained Scenarios I–O from the docs agent.
- **Deferred:** tenant-isolation regression tests (reviewer MINOR-5); kiosk session invalidation on PIN reset (reviewer MINOR-6 — delivered in M5 Phase 0).

### [ COMPLETE ] — M5 kiosk pairing, QR+PIN, atomic punch

- **Orchestration:** five agents ran sequentially — Phase 0 hardening, Phase 1 device lifecycle, Phases 2–3 identify+PIN, Phase 4 atomic punch, review-fix application — plus an independent review agent (verdict: safe after fixes; α both blocking findings applied) and a docs agent (Scenarios P–U in the testing guide).
- **DependsOn:** M4 (committed) + the post-M4 audit findings
- **State:** written, reviewed, all gates green, uncommitted
- **Delivered:**
  - Phase 0: wrap-around status engine + same-evening clock-out guard wired into the punch; merged-geometry shift validation; UTC date basis; shift-scoped policy lookup; catch blocks always answer with redacted bodies; `utils/tenant.ts` dedupe; policy-default race fixed; PIN reset expires open sessions; preview glyphs fixed
  - Phase 1: pairing codes (single live, 10 min, shown once), device tokens (30-day, renewed on use, 90-day hard age), `kioskAuthMiddleware`, devices list/revoke, `utils/kioskKeys.ts`, `utils/rateLimit.ts`
  - Phases 2–3: `utils/location.ts` (INSIDE/OUTSIDE/UNKNOWN, flagged not blocked; thresholds final per R1, owner 2026-10-17); `identify` / `verify-pin` / `cancel`; 2-minute hashed-handle sessions; 10 attempts / 5-minute lock (final per R5, owner 2026-10-17); evidence attempt rows on every failure
  - Phase 4: kiosk-scoped atomic punch with session lock+consume inside the transaction, dated shift resolution, schema snapshot columns; correction submission with tier and window; read aliases kept
  - Fixes: legacy catch hardening completed on `attendanceController`; §11 audit events now also persist to `audit_logs` table via `utils/auditWriter.ts` (paired/renewed/expired/revoked/rejected, session started/succeeded/failed/locked/expired/cancelled, attendance.recorded, attendance.location_flagged)
- **Verification:** `tsc` 0 errors; `prisma validate` valid; db-check, env parity (10 vars), ui-taste, humanize all pass
- **Deferred:** status engine still UTC (O15); `authenticate_lookup` login rewiring; RLS `app.business_id` app wrapper. The `attemptId` idea on corrections was dropped outright by the R6 ruling (owner, 2026-10-17), and the R5 ruling settled the PIN/lock values.

### [ COMPLETE ] — M5 kiosk pairing and QR+PIN attention (committed `63318bf`)

- **DependsOn:** M4 (committed) plus the post-M4 audit findings, which the M5 plan Phase 0 absorbs.

Post-M4 audit (2026-10-16, two review agents — one over M0–M3 records, one technical health):

- **Green:** 19 models ↔ 9 migrations ↔ 19 RLS policies align with `M1-DATA-MODEL.md`; decisions O1/O2/O15/O22 verified in code; `tsc` 0 errors; `prisma validate` valid; env parity (8/8 documented), db-check, humanize all pass; all 10 routers wired with no shadowing; tree clean, 11 commits unpushed.
- **Defects folded into M5 Phase 0:** cross-midnight status-engine math (wrap-around early grace, same-evening clock-out guard), `evaluateClockOutStatus` wired but never called, shift validators allow flag/geometry inconsistency, clock-in ignores shift-scoped policies, date-basis split (local vs UTC), catch blocks that hang on non-Error throws, `error.message` leaked in 500 bodies, `callerBusinessId` duplicated 6×, policy-default race in `createPolicy`.
- **Architecture gaps needing owner decisions:** RLS wrapper (`set_config('app.business_id')`) absent from application code despite fail-closed migration policies; `authenticate_lookup` SQL function unused by login; `db-guard.sh` has no invocation point.
- **Cosmetic:** `✓` glyphs in `docs/attendpro/previews/design-comparison.html` fail ui-taste.

### [ COMPLETE ] — M6 automatic clock-out job

- **Orchestration:** four agents ran sequentially/in-parallel — Phase 1 job auth + routes, Phases 2–3 the sweep + status + runbook — plus an independent review agent (verdict: safe after fixes) and a docs agent (Scenario V in the testing guide); a fix agent applied all findings.
- **DependsOn:** M5 (committed `63318bf`)
- **State:** written, reviewed, all gates green, uncommitted
- **Delivered:**
  - `backend/middleware/jobAuthMiddleware.ts` — `JOB_TOKEN` service-token guard (constant-time compare, fail-closed 401); `requireJobOrSuperadmin` for the status lane
  - `backend/jobs/autoClockOut.ts` + `backend/utils/shiftWindow.ts` — the idempotent sweep: one transaction holding `pg_try_advisory_xact_lock` (second run answers 409); per-row classification against the effective policy version; enabled+overdue rows close at shift end + offset (buffer fallback 120 minutes); disabled policies are left untouched; unresolvable windows/policies are flagged `REQUIRES_REVIEW` **once** (repeat sightings skipped); every write guarded by `updateMany WHERE sessionStatus = OPEN`; hours arithmetic identical to the punch path; UTC snapshot math, timezone application deferred to O15
  - `backend/controllers/jobController.ts` + `backend/routes/jobRoutes.ts` — `POST /api/jobs/auto-clock-out/run` (job token, auth before validate, 5/min limiter) and `GET /api/jobs/status` (`{ lastRun, closed, flagged }`; job lane sees all, SUPERADMIN own business)
  - `writeAudit` extended with an optional `actorType` override (SYSTEM for job rows); `job.auto_clock_out_closed`/`_flagged` audit rows
  - `docs/runbook-jobs.md` — trigger/status walkthrough for the owner's 15-minute scheduler; no in-app timer
  - Testing guide Scenario V: arrange → run → verify write → idempotence → genuine clock-out wins → disabled policy → unresolvable window → 409 concurrency → authorization
- **Review findings applied:** flagged-path idempotence (blocking); auth-first on run; policy-cache miss correctness; `businessId` filter on the policy lookup; runbook rate-limit note; O8-vs-lifecycle conflict registered as **R10** in `DECISION-REGISTER.md` (needs an owner ruling)
- **Verification:** `tsc` 0 errors; `prisma validate` valid; db-check, env parity (11 vars), ui-taste, humanize all pass
- **Decision 1 note:** the HR correction-decision endpoint (R7) was NOT folded into M6 — it stays queued for its own plan.

### [ QUEUED ] — AttendPro milestones

| Milestone | Scope | Gate | DependsOn |
|-----------|-------|------|-----------|
| M0 | Investigation and reality check | committed | none |
| M1 | Architecture and UI design (full set delivered) | approved (owner, 2026-10-16) | M0 |
| M2 | Foundation: tenant model, schema/migrations with RLS, isolated test database, repository reconciliation | complete (committed `a74c72a`) | M1 (approved) |
| M3 | Shifts, policies, status rule engine, timing policy (effective-dated) | complete (tsc clean, 0 errors) | M2 |
| M4 | SUPERADMIN: employees, shift assignment, calendars/sites/kiosks, policies | committed (`f2db8e4`, reviewed) | M3 |
| M5 | Kiosk: pairing, QR+PIN, location assessment, atomic punch, tenant isolation | committed (`63318bf`, reviewed) | M4 |
| M6 | Automatic clock-out job, shift-aware, flagged | complete (reviewed, tsc 0 errors, uncommitted) | M5 |
| M7 | Help requests, corrections with audit trail (no self-approval), reports, audit, retention | complete (reviewed, tsc 0 errors, uncommitted) | M6 |
| M8 | Staff and HR portals, public landing page + the three ruled endpoint additions (M8-R1/R2/R4: staff change-pin, staff schedule/off-day reads, generic audit listing — all zero-migration) | complete — committed `f011053` + `e6f41eb`. The commit carried 8 failing `auth-routing` tests, 5 legacy `.tsx` type errors and a missing `/set-password` route; M9 fixed all three. The M8-R4 listing was not built until M9 (M9-B3). | M7 |
| M9 | Full test suite, testing guide, CI, security review, close-out | in progress — Phases 0–6 written, uncommitted. Backend 22 files / 590 tests green against the guarded local `attendpro_test` DB, coverage 93.43% statements / 85.93% branches with the 90/85 gate enforced in CI; frontend 98 tests green; typechecks, lint and build clean; frontend coverage ratchet passes at 29.95/71.38/49.79/29.95 against 29/71/49/29; Playwright 5 passed / 1 skipped (kiosk UI absent). Five production defects fixed (M9-B1..B5) plus SEC-20. Open: dependency scan 9 frontend + 4 backend high production advisories (SEC-01..06), release blockers SEC-07/SEC-08, no production bootstrap (SSB-2), and the CI workflow has not run on GitHub yet. | M8 |

### [ COMPLETE ] — M7 help requests, correction decisions, reports, audit trail, retention

- **Orchestration:** four phase agents in sequence (Phase 0 help requests, Phase 1 the decision heart, Phase 2 reports + CSV, Phase 3 audit trail + retention) plus an independent review agent (verdict: safe after fixes — 1 must-fix, 2 majors, cheap hardening; all applied by a fix agent) and a docs agent (Scenarios W–Y, humanize clean). Two subagent-launch failures mid-run (network/spawn errors) were retried; phases otherwise clean. No migrations needed — the Phase-3 tables were already proven by the O14 rehearsal.
- **DependsOn:** M6 (committed `6002e1c`) + the ruling set (`8526a98`)
- **State:** written, reviewed, all gates green, uncommitted
- **Delivered:**
  - Help lane: staff submit/list/detail (category allowlist pin/kiosk/profile/access/other, subject 3–120, body ≤4000), HR queue + enforced ladder OPEN→IN_REVIEW→RESOLVED/CLOSED, same-generic 404/403, durable audits (`help.request_submitted`/`_resolved`/`_status_changed`), 5/15-min submission limiter
  - Decision heart: `PATCH /api/hr/corrections/:id/decision` with the full 403 matrix in one commented table (no-self-approval absolute; ESCALATED = second active HR or SUPERADMIN backstop with condition + reason ≤500; half-sent never falls through); approval applies proposed values under an observed-values drift guard (409 "record changed"); `PROPOSED` revision rows now too; `correction.decided`(.backstop)/`correction.escalated` in `audit_logs`
  - Reports: register (snapshot-aware names, 190-day cap), punctuality summary (absent = no-row, active STAFF only, per day/employee/shift), exceptions (review rows + OUTSIDE/UNKNOWN attempts), O9 CSV export — streamed, backpressure-aware, disconnect-detecting, injection-guard-then-escape, business-timezone times, one `report.exported` audit row on clean completion only
  - Audit + retention: `GET /api/audit/corrections/:attendanceId` full trail (corrections + revisions + audits); `GET/PATCH /api/business/settings` — retention knobs with `retentionEnabled=true` refused per O10, ranges + `.strict()`, audited; no deletion job in M7
  - `writeAudit` extended with optional beforeValues/afterValues (additive); contracts row 141 formalized with its 409
- **Verification:** `tsc` 0 errors; `prisma validate` valid; db-check, env parity (11 vars), humanize clean (TESTING_GUIDE, contracts cell, state docs)
- **Deferred:** calendar-aware absence (day-close job owner); per-decision-denial audit rows (deliberate); generic `GET /api/audit?action=` listing (docs reference one; not in contracts scope for M7)

### [ BLOCKED ] — carried risks

- **Test isolation (F7 / O14):** resolved by the designated Prisma Postgres test instance;
  `TEST_DB_HOST` and the destructive-reset guard are wired, and the backend suite runs
  against it.
- **Frontend type check (F1):** resolved in M9 — `npm run typecheck` is 0 errors, including
  the five legacy `.tsx` components that were renamed from JSX without types.
- **Nested `backend/.git` (F5 / O13):** preserved untouched until the owner approves a
  preservation method.

---

## Workflow State Columns

```
[ BACKLOG ] -> [ QUEUED ] -> [ IN_PROGRESS ] -> [ PARALLEL_GATE ] -> [ HUMAN_CHECKPOINT ] -> [ DONE ]
                                              |
                                     +--------+--------+
                                     v        v        v
                                    QA     TESTER   SECURITY
```

---

---

> **Prior generation — superseded.** Everything below this line belongs to the earlier
> dev-os bootstrap (the `dev-os` monorepo slice plan, `DESIGN.md` findings, `TASK-2xx`,
> `TASK-3xx`, `TASK-4xx`). It is kept for history and is not the active board. The active
> board is the AttendPro section above.

## Gate Rules In Force (prior generation)

From `DESIGN.md` section 8 (approved 2026-10-06):

| Rule | Effect on this board |
|---|---|
| 1 | The 24 existing frontend files are remediated, not grandfathered |
| 2 | Section 2 is complete only once the auth pairs are measured and findings 4, 4a, 4b, 4c are cleared |
| 3 | `ui-taste-check.sh` must pass before any commit containing frontend files — **it currently fails on finding 5** |
| 4 | No focus ring may ship below 3:1; `amber-700` on light, `yellow-500` on chrome |
| 5 | Design tokens need a code mechanism before section 2 is referenced from implementation |

Rule 3 is the reason `TASK-405` precedes every slice: the pre-commit hook fires on any staged
`.tsx`/`.jsx`, so finding 5 blocks all frontend commits, not just its own file.

---

## Active Board

### [ HUMAN ] — Owner Action Required

- **`TASK-201`**: Rotate Leaked MongoDB Credentials
  - **Assignee:** Human (Security)
  - **DependsOn:** None
  - **Triage Level:** CRITICAL
  - **ParallelGate:** [QA: n/a, Tester: n/a, Security: in_progress]
  - **HumanCheckpoint:** pending
  - **Action:** MongoDB Atlas -> Database Access -> Edit user -> Change Password
  - **Unblocks:** `TASK-223`

- **`TASK-224`**: Commit the `.env.example` placeholder fix
  - **Assignee:** Human (Owner)
  - **DependsOn:** None
  - **Triage Level:** STANDARD
  - **State:** file changed, **not staged, not committed**
  - **HumanCheckpoint:** awaiting the literal word "approve" in chat
  - **Change:** root `.env.example` `DATABASE_URL` was a literal `user:password@localhost:5432`;
    now `postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME`. Original value never printed.

- **`TASK-223`**: History rewrite to purge `7c9fc2a` credentials
  - **Assignee:** Human (Owner) + Release Manager
  - **DependsOn:** `TASK-201`
  - **Triage Level:** CRITICAL
  - **Authorised:** PRD sections 12, 13, 14 — Owner signed 2026-10-06
  - **Fixed sequence:** rotate Atlas password **first** -> back up the repository **second** ->
    single force-push **third**
  - **Scope:** authorisation covers this one operation only; ordinary pushes stay fast-forward

### [ IN_PROGRESS ]

- **`TASK-400-series` + `TASK-300-series`**: Stage 4 board construction — this document.

### [ DONE ] — Stage 1, 2, 3 (closed)

- **`TASK-207`**: DESIGN.md via UI Designer
  - **Artifacts:** `DESIGN.md`, 314 lines / 8 sections, signed 2026-10-06
  - **ParallelGate:** [QA: pass (3 rounds), Tester: pass, Security: pass]
  - **HumanCheckpoint:** approved

- **`TASK-209`**: Humanizer Documentation Audit
  - **Artifacts:** `humanize-check.sh` clean on PRD and DESIGN.md
  - **ParallelGate:** [QA: pass, Tester: n/a, Security: pass]

- **`TASK-202`**: Provision PostgreSQL and Run Migrations
  - **Evidence:** `prisma migrate status` -> "Database schema is up to date!"; 1 migration
    `20261005000000_init`; `db-check.sh` passed
  - **HumanCheckpoint:** approved

- **`TASK-203`**: Seed Initial Data
  - **Evidence:** 2 shifts, 7 users, 2 attendance rows; Morning 06:00-14:00 (7 users),
    Afternoon 14:00-22:00; **night shift absent**; 14 indexes
  - **Passwords:** read from `backend/.env`, absent from code, seed throws if unset

### [ QUEUED ] — Stage 5 Pre-Flight (gate-blocking)

- **`TASK-400`**: Give design tokens a code mechanism
  - **Assignee:** Developer
  - **DependsOn:** None
  - **Triage Level:** HIGH
  - **Rule:** DESIGN.md section 8 rule 5
  - **Action:** CSS custom properties in `src/index.css` and/or Tailwind theme colours, so
    section 2 token names resolve in code instead of staying documentation

- **`TASK-405`**: Finding 5 — remove emoji used as icons
  - **Assignee:** Developer
  - **DependsOn:** None
  - **Triage Level:** HIGH
  - **Rule:** DESIGN.md section 8 rule 3
  - **Evidence:** `ui-taste-check.sh` exits 1 — 5 hits across 2 files
    (`Profile.tsx` x4, `Dashboard.tsx` x1)
  - **Blocks:** every slice, because the pre-commit hook runs the gate on staged frontend files

### [ QUEUED ] — Stage 5 Feature Slices

Strictly sequential per PRD section 12: no slice starts before the previous one is pushed.
Each slice runs the full inner loop: **code -> tests -> QA + Security gate ->
HUMAN_CHECKPOINT -> commit -> push**.

| Task | Slice | Scope | PRD issues it clears |
|---|---|---|---|
| `TASK-300` | A | Authentication and RBAC | — |
| `TASK-301` | B | Attendance capture and correction | issue 3 |
| `TASK-302` | C | User management (`/manage-staff`) | — |
| `TASK-303` | D | Reporting and dashboards | — |
| `TASK-304` | E | Shift management, shift assignment UI inside `/manage-staff` modals | issues 1, 2 |
| `TASK-305` | F | Auto-close job for abandoned open sessions | issues 4, 5 |
| `TASK-310` | — | Late threshold reads shift start from DB, not the `06:30` literal | issue 6 |

- **DependsOn:** each slice depends on the slice above it.
- **ParallelGate:** [QA: pending, Tester: pending, Security: pending] per slice.
- **HumanCheckpoint:** pending per slice — the Owner signs off before the push.
- **Rationale:** A first because RBAC is the security foundation everything else calls through;
  E late because issue 2 (non-UUID seed IDs) needs the shift API to exist; F last because its
  triage depends on E's shift data; issue 6 after F because it reads a field E introduces.

### [ QUEUED ] — DESIGN.md Finding Remediation

Task numbers map as `TASK-4NN` = finding N. Each finding is closed either inside the slice that
first touches its files (section 8 rule 1, touch-on-modify) or in the closing sweep.

| Task | Finding | Severity | Primary slice | Files |
|---|---|---|---|---|
| `TASK-401` | 1 Focus rings 1.76:1 vs 3:1 | Critical | A | `Login.tsx:213,243,257`, three `SetPassword` inputs |
| `TASK-402` | 2 Accent on light canvas 1.83:1 | High | distributed + sweep | 35 `text-yellow-500`, light backgrounds only |
| `TASK-403` | 3 `slate-400` on light 2.45-2.56:1 | High | A + B/C/D + sweep | `KpiCard`, `Dashboard`, `HrDashboard`, `ManageStaff`, `Login`, `SetPassword` |
| `TASK-404` | 4 / 4a / 4b / 4c semantic + accent contrast | High | D | `KpiCard.jsx:11`, `Dashboard.tsx:184-186,244`, `HrDashboard.tsx:172`, `SuperAdminDashboard.jsx:341` |
| `TASK-405` | 5 Emoji as icons | Medium | **pre-flight** | `Profile.tsx` x4, `Dashboard.tsx` x1 |
| `TASK-406` | 6 No active press state | Medium | distributed + sweep | `active:scale` count is 0 |
| `TASK-407` | 7 Shadow colour contradicting section 5 | Medium | C | `AddEmployeeModal.jsx:154` + 4 more |
| `TASK-408` | 8 `transition-all` and `duration-300` | Medium | early sweep | `Sidebar.tsx:143,189` |
| `TASK-409` | 9 Borders at 1.42:1 | Medium | sweep | 4 x `border-slate-300` |
| `TASK-410` | 10 Radius sprawl, five values | Low | sweep | `2xl` 31, `lg` 29, `xl` 13, `full` 6, `md` 2 |
| `TASK-411` | 11 Fractional spacing utilities | Low | sweep | 21 occurrences, section 4 |
| `TASK-412` | 12 Mixed icon sets, resting `shadow-sm`, missing `cursor-pointer` | Low | early sweep | `fa` + `sl` in one sidebar |
| `TASK-413` | 13 Plex Mono 700 requested, not loaded | Low | D | `KpiCard.jsx:37`, `SuperAdminDashboard.jsx:446,456,469`, `index.html:8` |
| `TASK-414` | 14 Auth screens use `stone`, outside `slate` | Low | A | `Login.tsx:125,208,238`, `SetPassword.jsx:38,172`, `ErrorBoundary.jsx:33` |
| `TASK-415` | Closing sweep — any finding its slice did not close | — | post-slice | runs before stage 6 |

`TASK-404` also closes section 8 rule 2, which needs findings 4, 4a, 4b, and 4c cleared for
section 2 to be called complete.

### [ QUEUED ] — Stages 6 to 10

- **`TASK-204`**: Backend Unit & Integration Tests (Vitest + Supertest) — unblocked, DB is live
- **`TASK-205`**: Frontend Unit Tests (Vitest + React Testing Library) — unblocked
- **`TASK-206`**: E2E Tests (Playwright) — unblocked
- **`TASK-220`**: `docs/TESTING_GUIDE.md` (stage 7)
- **`TASK-221`**: `LESSONS.md` update (stage 10)
- **`TASK-222`**: `CURRENT_STATE.md` final pass (stage 10)
- **`TASK-212`**: GitHub Actions CI/CD pipeline (stage 10)

### [ BACKLOG ]

Nothing. Stage 4 emptied it into the slices above.

---

## The DAG

```
OWNER PATH (does not gate slices)
  TASK-201 rotate Atlas password
       |
       v
  TASK-223 repo backup -> one force-push          [release, PRD s12-14]

  TASK-224 .env.example placeholder               [awaiting "approve"]


STAGE 4   this board + docs/CURRENT_STATE.md      [awaiting "approve"]
       |
       v
STAGE 5 PRE-FLIGHT   both must pass before any frontend commit
  TASK-400 token mechanism                         [section 8 rule 5]
  TASK-405 remove 5 emoji                          [section 8 rule 3, ui-taste exits 1]
       |
       v
  TASK-300  A auth/RBAC        -----> findings 401, 403, 414
       |        code -> tests -> QA+Security -> HUMAN_CHECKPOINT -> commit -> push
       v
  TASK-301  B attendance       -----> clears PRD issue 3
       v
  TASK-302  C user mgmt        -----> finding 407
       v
  TASK-303  D reporting        -----> findings 404, 413, part of 402/403
       v
  TASK-304  E shift mgmt       -----> clears PRD issues 1 + 2
       v
  TASK-305  F auto-close job   -----> clears PRD issues 4 + 5
       v
  TASK-310  issue 6 late threshold reads shift start from DB
       v
  TASK-415  closing sweep — remaining findings 402, 406, 408-412
       |
       v
STAGE 6    TASK-204 / 205 / 206 full test suite
STAGE 7    TASK-220 TESTING_GUIDE.md
STAGE 8    QA standards audit
STAGE 9    TASK-221 security + secret scan
STAGE 10   humanize + TASK-212 CI/CD + TASK-222 CURRENT_STATE final
```

### Structural constraints encoded above

1. **Slices are strictly serial.** PRD section 12 forbids starting a slice before the previous
   one is pushed. There is no parallelism across `TASK-300` to `TASK-305`.
2. **Pre-flight is parallel and blocking.** `TASK-400` and `TASK-405` have no dependencies and
   can run together, but neither slice may start until both are green.
3. **The owner path is independent.** `TASK-201` and `TASK-223` gate only the credential purge,
   not feature delivery. Mongo Atlas rotation does not block release.
4. **Findings ride along with slices.** Section 8 rule 1 makes touch-on-modify the default, so a
   finding is closed by whichever slice first edits its file. `TASK-415` is the backstop.

---

## Completed — Architecture Migration

### [ DONE ] — Phase 1 Complete

- **`TASK-100`** through **`TASK-109`**: MongoDB to Prisma migration complete
  - All 27+ files migrated, TypeScript compiles, Vite builds

### [ DONE ] — Code Fixes (Developer)

- **`TASK-215`**: SessionsChart rewritten as PieChart with OPEN/CLOSED/LATE —
  `src/components/charts/SessionsChart.jsx`
- **`TASK-216`**: SuperAdminDashboard status enums fixed with `normStatus()` helper,
  5 comparisons — `src/pages/SuperAdminDashboard.jsx`
- **`TASK-217`**: Settings role display verified correct, no change needed
- **`TASK-218`**: Schedule page status enums fixed in `getDayStatus()` — `src/pages/Schedule.jsx`
- **`TASK-219`**: Profile badge logic verified correct, no change needed

### [ DONE ] — Infrastructure (DevOps + Developer)

- **`TASK-210`**: Structured logging — `backend/utils/logger.ts`, `backend/server.ts`,
  `backend/middleware/authMiddleware.ts`; correlation IDs, audit helpers, slow-request detection
- **`TASK-211`**: Swagger/OpenAPI — `backend/docs/swagger.ts`, served at `/api/docs`
  and `/api/docs.json`
- **`TASK-213`**: Error boundary exists at `src/components/ErrorBoundary.jsx`
- **`TASK-214`**: Dead code cleanup — SessionsChart duplicate removed, unused files pending

---

## Task Card Schema

```markdown
### TASK-XXX: [Title]
- **Assignee:** [Orchestrator | Developer | QA | Tester | Security | DevOps | DBA]
- **DependsOn:** [List of prerequisite TASK IDs]
- **Triage Level:** [TRIVIAL | STANDARD | HIGH | CRITICAL]
- **ParallelGate:** [QA: pass/fail/pending, Tester: pass/fail/pending, Security: pass/fail/pending]
- **HumanCheckpoint:** [pending | approved]
- **Artifacts:** [List of PRs, commits, or files modified]
- **Evidence:** [Raw command output backing the claim]
```

### Commit and push discipline

- Commits go through `commit.sh` in headless mode; the pre-commit hook blocks `git commit`
  without `DEVOS_COMMIT_APPROVED=true`.
- `commit.sh` does **not** stage — run `git add` first, scope by scope.
- Never run git operations in parallel; they share one index.
- No push without an explicit Owner checkpoint. No `--no-verify`.
- Destructive database commands are run by the Owner, not the agents.


## Execution checkpoint — latest owner authorization

The owner approved the remaining screen compositions, kiosk brass-on-dark action emphasis with ink labels, existing semantic colors and frozen attendance status tokens, with contrast verification during implementation. Business-specific timezone, shifts, schedules, calendars, policies, sites and terminals come from authorized business configuration.

Phased execution is now authorized with a stop for review after each bounded slice. QA, Tester, Security and secret-scanning evidence precede the human commit checkpoint; commits use `.agents/scripts/commit.sh`. No automatic commit or push, database/schema/migration change, installation or deployment is implied.

P01 has existing compatibility evidence ready for review. Concrete Node 26.12.1 selection remains at HUMAN_CHECKPOINT under the plan's explicit numeric-runtime gate. P02 remains BACKLOG until that prerequisite is accepted. No production source was changed during this checkpoint.


## P04 PIN correction commit checkpoint — 2026-11-02

Owner approved committing the reviewed P04 PIN security slice through commit.sh. QA, Tester and Security approved the late-lock observed-state guards and strict audit writes. The no-database backend suite passes 69 tests; both typechecks, environment parity, scoped secret scanning and whitespace checks pass. Real database concurrency, rollback and RLS remain unverified.

Ordinary Change Password UI is the next authorized bounded slice, separate from forced setup. P04 is not fully complete. P05 detail/context contracts remain proposals for review; no endpoint or schema implementation is authorized by this commit.


## Ordinary password commit approval — 2026-11-02

Owner approved proceeding after review. The ordinary Change Password slice passed QA, Tester and Security: full frontend 192/192, focused 31/31, two mocked browser checks at 375px and 1440px, typecheck, scoped JavaScript lint and mechanical gates. Prepare only this reviewed scope for commit.sh; no push. Live authentication/database checks remain separate.

Next phase P05 is contract review only: proposed detail/context reads must be checked against current source and permissions. No missing endpoint, schema or database implementation is authorized by this transition.
