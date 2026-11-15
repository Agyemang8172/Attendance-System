# Dev-OS Task Board & DAG Workflow State

## Current execution - 2026-11-01

The owner instructed the Orchestrator to proceed with the phased plan and per-phase Security/commit.sh gates. This authorizes starting dependency-eligible work, not bypassing concrete phase checkpoints, protected database/security actions, or commit review. P01 is the only active phase. Its explicit runtime-selection checkpoint still precedes runtime configuration/install changes. No push is authorized here.

| Unit | State | Assignee / owned files | Gate boundary |
|---|---|---|---|
| P01 | HUMAN_CHECKPOINT | DevOps authors docs/attendpro/P01-RUNTIME-COMPATIBILITY.md; Orchestrator owns state/board; QA/Tester/Security review | Node 26.12.1 selected by the owner. Runtime declarations/CI alignment and clean-install/Linux evidence remain open; no install or database access. |
| P02 | DONE | p02_repair (Developer) owned backend/controllers/userController.ts; Tester owns the no-database contract suite | Committed as `3d6b983` after owner approval. Committed tree re-verified: typecheck clean, 29 contract tests pass. No database suite or push. |
| P03 | DONE | Tester owned the contract artifact and fixture suite; QA reviews the mismatch inventory; Developer repairs only exposed production defects | Committed as `fa3f9b0` after owner approval. 15 fixture/boundary tests pass; mismatch inventory recorded. No database suite, screen repair or push. |
| P04 | HUMAN_CHECKPOINT | Security reviews the credential lanes; Tester owns the no-database security suite; Developer repairs exposed PIN-lane defects | `docs/attendpro/P04-AUTH-SECURITY-VERIFICATION.md` and `backend/tests/unit/authSecurity.contract.test.ts` are ready: 65 unit tests pass, 166 frontend tests pass, both typechecks clean. Four defects repaired. Database suites not run. Awaiting Security verdict and owner approval; no commit. |
| P05-P32 | BACKLOG | No active implementation assignee | Preserve dependency and separately gated child order. |

Extensive pre-existing application/document edits must not be staged as phase work or reverted. Phase commits use explicit file/hunk scope and `.agents/scripts/commit.sh` after QA/Tester/Security verdicts and the concrete human gate. No headless approval bypass or raw git commit.

## Historical delivery planning board - 2026-10-31

Update 2026-11-01: accepted Landing refinements are included in P30f; attendance outcome/auto-clock-out overlays are removed in future implementation while required feedback remains inline (UI-RESULTS-01). [SCREEN-REVIEW.md](attendpro/SCREEN-REVIEW.md) covers current versus conceptual target layouts for owner review. PLAN-20261101 review additions is at HUMAN_CHECKPOINT after documentation checks; all implementation units remain BACKLOG. No screen visuals beyond the accepted landing direction are silently approved.

Authority: [Decision Register G](attendpro/DECISION-REGISTER.md#g-final-delivery-and-information-architecture-approvals---2026-10-31), [Master Plan](attendpro/MASTER-GAP-REQUIREMENTS.md), [final IA](attendpro/INFORMATION-ARCHITECTURE.md). Detailed scope, acceptance, child slices and stop conditions are in the [Phased Implementation Plan](attendpro/PHASED-IMPLEMENTATION-PLAN.md).

| Task | State | Assignee | Boundary |
|---|---|---|---|
| PLAN-20261031 final approvals and phased delivery package | HUMAN_CHECKPOINT | Orchestrator; Architect authors phase plan; PM/QA review | Documentation verification passed; QA plan review approved on supplied evidence. Await owner review of the new execution plan. No implementation or commit. |

All execution units below are BACKLOG (NOT_STARTED). Proposed roles in the plan are not active assignments. Dependencies are completion gates, not permission to start. A future authorized task must declare an Assignee and owned files before IN_PROGRESS. Parent completion requires separately accepted children. P06a is listed because HR recovery needs that shared attendance slice, not all Staff repairs.

| Unit | Work | State | DependsOn |
|---|---|---|---|
| P01 | One-runtime compatibility selection | HUMAN_CHECKPOINT | None; DevOps evidence, Orchestrator gate |
| P02 | Secure Prisma account-controller recovery | DONE | P01 |
| P03 | Real API contract fixtures and focused checks | DONE | P02 |
| P04 | Password/PIN security operations | HUMAN_CHECKPOINT | P03 |
| P05 | Bounded detail/evidence contracts | BACKLOG | P03 |
| P06 | Staff existing journeys, separately gated children | BACKLOG | P04, P05 |
| P06a | Staff Attendance/shared table and Profile repair | BACKLOG | P04, P05 |
| P07 | HR Attendance/Exceptions repair | BACKLOG | P04, P05, P06a |
| P08 | HR Help/Corrections/Audit, separate children | BACKLOG | P04, P07 |
| P09 | HR operational dashboard | BACKLOG | P07, P08 |
| P10 | Shift definitions | DONE | P03 |
| P11 | Effective assignments | IN_PROGRESS | P02, P10 |
| P11a | Employee weekly schedules | BACKLOG | P11, P12 |
| P12 | Calendar administration contracts | BACKLOG | P03 |
| P13 | Site configuration/list contracts | BACKLOG | P03 |
| P14 | Policies and business settings, separate children | BACKLOG | P10, P12 |
| P15 | Device pairing/list/revocation UI | BACKLOG | P04, P13 |
| P16 | O15 timing semantics specification | BACKLOG | P11, P14 |
| P17 | O15 business-time/global-policy behavior | BACKLOG | P16 |
| P18 | O16 absence/storage semantics and DBA review | BACKLOG | P12, P16 |
| P19 | O16 idempotent absence and consumers | BACKLOG | P17, P18 |
| P20 | Requester withdrawal | BACKLOG | P08 |
| P21 | O6 delivery/security specification | BACKLOG | P04 |
| P22 | O6 recovery backend/UI/delivery, separate children | BACKLOG | P21 |
| P23 | O9 summary and flags/corrections data services | BACKLOG | P19, P20 |
| P24 | Three O9 CSVs and report UI | BACKLOG | P23, P11 |
| P25 | Employee Detail and authorized credentials | BACKLOG | P04, P05, P07, P11 |
| P26 | Standalone automatic camera-kiosk specification | BACKLOG | P15, P17, P25 |
| P27 | Kiosk implementation and physical-device evidence | BACKLOG | P26 |
| P28 | Authorized attempt evidence reads/presentation | BACKLOG | P05, P07 |
| P29 | Dedicated SA readiness dashboard | BACKLOG | P14, P15, P17, P19 |
| P30 | Approved navigation, compatibility aliases and landing refinement | BACKLOG | P06, P08, P09, P12, P24, P25, P29 |
| P30f | Accepted landing copy/player/preview/motion refinement | BACKLOG | P30 external prerequisites; separate review |
| P31 | O18 read-only impact assessment/conditional remedy plan | BACKLOG | P02, P05 |
| P32 | Integrated tests/coverage/CI/pilot evidence | BACKLOG | P01-P31; any separately approved required P31 remedy |

P03 verifies the contract package and records known consumer failures; it does not require the final whole-app coverage floor before repair. P32 enforces approved M10 frontend 39/74/59/39 and backend 90/85. Environment access, database writes, package changes, commits/pushes and deployment retain their separate authorization boundaries. Halt after three failed agent loops. Implementation passes QA/Tester/Security review and the human checkpoint; commits use `.agents/scripts/commit.sh`.

Planning verification: all ten changed/new planning and memory documents passed the repository humanizer; scoped diff whitespace check passed. Static checks confirmed 32 NOT_STARTED top-level phases, an acyclic graph including P06a, 40 unique mapped AP requirements and ten local links in the three new planning documents. No application tests or database operations ran. The parent/child prerequisite rule is stated in the phase plan; no child waits for its own parent to be DONE.

The recovery board below is a dated ledger. Its earlier unresolved choices are superseded by final owner approval; accepted REC-01 through REC-05 stay closed. Do not self-close REC-06 or start REC-07 from an old board row.

## Active recovery board - 2026-10-27

This board records execution status, not new architecture approval. [CURRENT_STATE.md](CURRENT_STATE.md) is the current evidence summary; [the decision register](attendpro/DECISION-REGISTER.md) records product authority. Historical milestone rows below are retained for provenance and must not be scheduled merely because an old row says queued or uncommitted.

| Task | Status | Dependency / acceptance boundary |
|---|---|---|
| REC-01 preservation | CLOSED - owner accepted | Existing preservation verified; do not recreate. |
| REC-02 frontend storage | CLOSED - owner accepted | Vitest/JSDOM binding corrected and verified. |
| REC-03 backend baseline | CLOSED - owner accepted | Dedicated local test target verified; backend baseline accepted. |
| REC-04 tenant/security verification | CLOSED - owner accepted | Local restricted-role path verified; temporary login cleaned up. Production deployment remains unverified; owner-connection retention is non-blocking follow-up. |
| REC-05 startup | CLOSED - owner accepted | Lazy Swagger implemented and verified. Historical roughly 38-second cause remains UNKNOWN/unreproduced. |
| REC-06 documentation reconciliation | IN PROGRESS - implementation authorized, acceptance pending | Reconcile documentation to recorded decisions; no application/database changes. Do not self-accept or close. |
| REC-07 and later | NOT STARTED | Await separate owner authorization after this bounded REC-06 work. |

### Current classification of carried work

- APPROVED CURRENT REQUIREMENT: tenant isolation, role authorization, kiosk-only QR + 4-digit PIN attendance and the other recorded approved decisions remain binding.
- IMPLEMENTED CURRENT BEHAVIOR: latest accepted backend evidence is 619/619 tests across 25 files, 119.36 seconds; coverage 93.42% statements/lines, 86.25% branches, 98.09% functions. No new tests ran during this documentation pass.
- APPROVED BUT NOT YET IMPLEMENTED: O15 business-timezone calculations and O16 schedule/calendar-aware no-show/absence behavior remain requirement gaps. Do not silently mark them complete or reduce scope.
- APPROVED BUT NOT YET IMPLEMENTED: O6 email account-recovery requirements remain approved; endpoints are absent and delivery was deferred in M8. Administrator reset is a separate implemented path.
- PLANNED/FUTURE: kiosk frontend with U-03 actions unresolved; leave/timetable upload v2; legal pages/links when real pages exist.
- UNRESOLVED DECISION: D-08 reset-PIN visibility, D-10 correction status UI and D-11 dismiss control retain their recorded decision/proposal status. No implementation authority is inferred.
- HISTORICAL/SUPERSEDED: prior milestone boards, duplicate M5 snapshots and past incident records below are historical evidence. MongoDB credential rotation remains UNKNOWN without confirmation.

## Historical milestone board - 2026-10-14 through 2026-10-21

The remainder is a dated archive of earlier execution records. Its active, queued, completion, branch and verification claims describe their original sessions only. The two M5 entries are duplicate snapshots (pre-commit delivery and committed follow-up), not two current tasks. Historical security records and prior test counts are preserved; use the active recovery board above for current status.


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
| M9 | Full test suite, testing guide, CI, security review, close-out | committed (`1804582`, 2026-10-21). Backend 22 files / 590 tests green, coverage 93.43% statements / 85.93% branches with the 90/85 gate enforced; frontend 98 tests green; typechecks, lint and build clean; frontend ratchet 29.95/71.38/49.79/29.95 against 29/71/49/29; Playwright 5 passed / 1 skipped (kiosk UI absent). Five production defects fixed (M9-B1..B5) plus SEC-20. Open: dependency scan 9 frontend + 4 backend high production advisories (SEC-01..06), release blockers SEC-07/SEC-08, no production bootstrap (SSB-2), and the CI workflow has not run on GitHub yet. | M8 |
| M10 | Release hardening and pilot readiness: JWT revocation, runtime RLS, PIN lockout, Swagger/CORS/forced-password gaps, PIN delivery, env parity, dead links, staff filters, production bootstrap, dependency remediation, frontend ratchet 39/74 | proposed 2026-10-21 — plan at `docs/superpowers/plans/2026-10-21-attendpro-m10-release-hardening.md`, awaiting owner decision on release mode, database host, `xlsx` removal and the CI-exercise push | M9 (committed) |

> Landing design reconciliation (2026-10-21): documentation only, no application code changed.
> Root `DESIGN.md` is the single design authority. `docs/attendpro/LANDING-PAGE-SPEC.md` is the
> landing contract, and `docs/attendpro/STATUS-PALETTE-PROPOSAL.md` is the proposed status palette
> awaiting owner approval. M8 remains complete for the portal and backend work, but the landing
> page has open visual, content, status-palette, and viewport-evidence gaps recorded in
> `docs/attendpro/M8-GAP-REGISTER.md` section C. The landing restyle is not authorised until the
> owner reviews the reconciled documents.

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

## P02 execution authorization

Owner explicitly selected Node 26.12.1 as the single initial runtime. P01 numeric selection is accepted; runtime declarations/CI alignment and clean-install/Linux/production evidence remain separately tracked and are not claimed complete.

[ HUMAN_CHECKPOINT ] P02 account-controller recovery. Assignee: p02_repair (Developer). Owned source: backend/controllers/userController.ts. Scope follows docs/superpowers/plans/2026-11-01-attendpro-p02-account-recovery.md. The controller reconciliation and its no-database contract suite are verified: 29 tests pass, backend typecheck is clean, gitleaks and environment parity pass. Database-backed suites were not run for lack of isolated-target authorization. QA/Security sign-off, the owner review and commit.sh remain pending. No database/schema/migration/install/push authorization.

## P03 execution authorization

[ DONE ] P03 contract fixtures and boundaries. Assignee: Tester (contract artifact and suite); QA reviewed the mismatch inventory. Committed as `fa3f9b0` through `.agents/scripts/commit.sh` after explicit owner approval. The commit carries `docs/attendpro/P03-CONTRACT-FIXTURES.md` and `backend/tests/unit/contractFixtures.contract.test.ts`. No database suite, screen repair or push.

## P04 execution authorization

[ HUMAN_CHECKPOINT ] P04 password and PIN security operations. Assignee: Security (credential review), Tester (no-database security suite), Developer (exposed PIN-lane defects). Owned source: `backend/controllers/staffProfileController.ts`, `backend/controllers/kioskVerifyController.ts`, `backend/utils/pinPolicy.ts`, `backend/tests/unit/authSecurity.contract.test.ts`, and the shared Security entry in `src/App.jsx`, `src/pages/Profile.tsx`, `src/components/Sidebar.tsx`, `src/pages/StaffChangePin.tsx`.

Evidence: `docs/attendpro/P04-AUTH-SECURITY-VERIFICATION.md`. Backend unit contracts 65/65, frontend suite 166/166, both typechecks clean, UI taste and humanizer clean. The self-service PIN lane now shares the kiosk R5 lockout, expires open verification sessions, and cannot overwrite a concurrent administrator reset. The shared Security entry is STAFF-only for the PIN screen.

Open: Security verdict on the four questions in the artifact; database-backed suites not run for lack of isolated-target authorization. No commit, push, database/schema/migration, install or deployment.

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

Ordinary password slice: HUMAN_CHECKPOINT after full frontend suite 192/192, two mocked browser checks, typecheck and scoped mechanical gates. Security approved; final QA verdict recorded with owner-review checkpoint. No staging/commit or next-slice execution implied.

Ordinary password ParallelGate: QA PASS; Tester PASS; Security PASS. HumanCheckpoint: pending. No commit or push.

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

## P06c — HUMAN_CHECKPOINT — 2026-11-03

Assignee: Orchestrator; Developer help_requests_developer, Tester help_requests_tester, QA help_requests_qa. Bounded Staff Help list/detail implementation complete;26 focused tests,32 relevant screen tests,3 intercepted browser checks and type/mechanical gates passed. Final review evidence: docs/attendpro/P06C-STAFF-HELP-VERIFICATION.md. Owner review required before any scoped commit through commit.sh. Live authentication remains unverified; no credentials/data changed. No staging, commit, push or next slice.

## P07a — IN_PROGRESS — 2026-11-03

Assignee: Orchestrator. Developer hr_attendance_developer owns bounded HR Attendance list/detail/helpers; Tester hr_attendance_tester owns tests/guide; QA hr_attendance_qa reviews. DependsOn P04, P05a and P06a accepted; P06c committed8880a30. Approved phase plan permits HR work without waiting for all Staff slices. No Exceptions, backend, routes, credentials/data, schema/migrations or permission changes. Plan: docs/superpowers/plans/2026-11-03-attendpro-hr-attendance-recovery.md. Stop after verification for owner review; no commit/push.

## P07a — HUMAN_CHECKPOINT — 2026-11-04

Assignee: Orchestrator; Developer hr_attendance_developer, Tester hr_attendance_tester, QA hr_attendance_qa. Implementation verified:29 focused tests,29 auth/routing tests, final frontend typecheck,3 intercepted browser cases and scoped mechanical gates passed. QA APPROVED without findings. Verification: docs/attendpro/P07A-HR-ATTENDANCE-VERIFICATION.md. No P07a staging/commit/push; owner review is next. P06c is committed8880a30; preserve unrelated tracked/untracked work. No next slice.

## P07b — IN_PROGRESS — 2026-11-04

Assignee: Orchestrator. Developer exceptions_developer owns Exceptions/helpers, minimal fixed-origin detail return and report pagination expression. Tester exceptions_tester owns new frontend/backend/browser tests and guide; QA exceptions_qa reviews. DependsOn P07a committedb4cc2b6. Scope and acceptance: docs/superpowers/plans/2026-11-04-attendpro-exceptions-recovery.md. No data/credential, schema/migration, permission, route or P28 detail expansion. No staging, commit, push or next slice.

## P07b — HUMAN_CHECKPOINT — 2026-11-05

QA approved the Exceptions recovery with no findings. Tests and limits are recorded in docs/attendpro/P07B-EXCEPTIONS-VERIFICATION.md. P07b awaits owner review with an empty staging index.

## P08a — IN_PROGRESS — 2026-11-05

Assignee: Orchestrator. Developer hr_help_developer owns HR Help source. Tester hr_help_tester owns focused frontend and mocked router tests, browser checks and the testing guide. QA hr_help_qa reviews the scoped diff and tenant and transition controls. Depends on P07b committed as 1826452. Scope is HR Help queue, direct detail and legal transitions under H-04. No schema, permission or live data changes.

## P08a — HUMAN_CHECKPOINT — 2026-11-05

QA approved HR Help recovery with no findings. Verification and limits are recorded in docs/attendpro/P08A-HR-HELP-VERIFICATION.md. P08a awaits owner review with an empty staging index.

## P08b1 — IN_PROGRESS — 2026-11-05

Assignee: Orchestrator. Developer reviewer_dev owns reviewer Corrections implementation. Tester reviewer_test owns focused tests and guide. P08a dependency committed at 1343d45. Scope and acceptance are recorded in the P08b1 execution note.

## P08b1 — HUMAN_CHECKPOINT — 2026-11-06

Reviewer Corrections recovery is implemented and verified. Evidence and runtime limits are in docs/attendpro/P08B1-REVIEWER-CORRECTIONS-VERIFICATION.md. The staging index is empty.

## P08b2 — DEPENDENCY CHECKPOINT — 2026-11-06

P08b1 committed as 9458cda. The next slice combines HR own submission and tracking. Business-zone input handling remains pending under the same timing dependency as P06d. Await owner direction on deferring the full slice or separately authorizing the tracking portion.

## P08b2a — DEPENDENCY CHECKPOINT — 2026-11-06

Own-request tracking awaits the scoped list and detail reads proposed in P05. P08b2b submission remains deferred on the authorized business-timezone read and applicable P17b work.

## P08b2a — IN_PROGRESS — 2026-11-06

Owner authorized the P05 own-correction GET prerequisite and HR tracking. Assignee: Orchestrator. Developer own_api, Tester own_test and Security own_review own the API gate. Frontend follows verification of the read contract. P08b2b remains deferred.

## P08b2a — HUMAN_CHECKPOINT — 2026-11-06

Own list and detail reads now answer at `GET /api/attendance/corrections` and `:id` for STAFF and HR. Both filter on the caller business and requester, carry the forced-password gate, and the detail uses an explicit projection with a snapshot allowlist. Same-tenant other-requester answers 403; foreign and absent records share a 404. HR tracking adds `/hr-corrections/mine` with status filtering, paging, return context and a read-only detail.

Evidence: 142 isolated backend tests, 8 own-tracking and 12 reviewer frontend cases, 4 Playwright cases, 327 passing frontend tests, both typechecks, UI taste, environment parity, redacted secret scan and humanizer. The four failing frontend cases sit in two untracked legacy test files and failed before this slice.

QA required the P08c correction-trail hunk in `App.jsx` to stay out of this commit scope. Security approved with minor findings. The owner review added `Cache-Control: no-store` to the own list read and a safe page bound to the shared correction list validator; the affected suites were rerun with unchanged results. Live authentication, database RLS and database-backed suites remain unverified. The staging index is empty. Proposed message: `feat(corrections): add HR own correction tracking`.

## P08b2a — COMMITTED — 2026-11-06

Committed through commit.sh as 1bd833b with `feat(corrections): add HR own correction tracking`. The P08c trail work, SEC-19 and older working-tree changes remain uncommitted. The next slice awaits Orchestrator scoping; implementation has not started. Dependency-eligible candidate: P08c audit and correction trail, since P07 and P08a, P08b1 and P08b2a are accepted. Owner authorization is still required. Residual risks: tenant-only corrections RLS with application-enforced requester scope, a missing composite index that needs DBA authorization, and unverified live authentication, database RLS, PostgreSQL concurrency and database-backed suites.

## P08c — IN_PROGRESS — 2026-11-07

Owner authorized P08c generic audit and correction trail. Assignee: Orchestrator. Developer audit_developer owns the audit reads, `HrAudit.tsx` and `HrCorrectionTrail.tsx`. Tester audit_tester owns the isolated contract, focused frontend and intercepted browser checks. QA audit_qa and Security audit_review own the scoped verdicts. DependsOn P07b, P08a, P08b1 and P08b2a, all accepted. Scope: truthful generic audit listing and the read-only correction trail, including date filters, nullable entity and actor handling, explicit failure states and withdrawn semantics. No permission expansion, schema, migration or unrelated screen changes. Preserve SEC-19 and all pre-existing work.

## P08c — HUMAN_CHECKPOINT — 2026-11-07

The audit listing and correction trail are repaired. The backend adds `Cache-Control: no-store` to all three audit reads, joins the acting user on trail audit rows, bounds the listing page and refuses a reversed date range. The audit screen renders real actor names, handles null entity ids, lists the events the backend writes, scopes action choices by role, shows the reason and actor type, sends inclusive UTC date instants, uses an inline failure state and keeps the mobile drawer above its scrim. The trail shows status and tier labels, original and approved evidence, revision before/after values, withdrawn semantics, a return link to the record, and separate empty, not-found and retry states.

Evidence: 155 isolated backend tests including 13 audit contracts, 9 focused frontend cases, 2 Playwright cases at 375px and 1440px, 336 passing frontend tests with the same four legacy failures, both typechecks and the scoped mechanical gates. See docs/attendpro/P08C-AUDIT-TRAIL-VERIFICATION.md. Live authentication, database RLS and the database-backed audit suite remain unverified. The staging index is empty. Proposed message: `fix(audit): recover audit history and correction trail`.

## P08c — COMMITTED — 2026-11-07

Committed through commit.sh as 6d2ec85 with `fix(audit): recover audit history and correction trail`. The commit carries 12 files: the audit controller, the audit listing validator hunk, the audit contract suite, `HrAudit.tsx`, `HrCorrectionTrail.tsx`, the App trail import and route, the focused frontend and browser specs, the P08c verification document and the P08c documentation entries. SEC-19's validator hunk, the Sidebar removals, `auditWriter.ts`, the older Kiosk and Security doc edits and the untracked legacy tests remain unstaged. No push or deploy.

Residual risks: live authentication, database RLS, PostgreSQL concurrency and the database-backed audit suite remain unverified; the HR audit subset and correction requester scope are handler-enforced while RLS is tenant-only; the trail stays keyed by attendance id because `audit_logs` has no attendance column; the audit table scrolls horizontally at 375px; search covers action, entity and reason only; business-time display waits for P17; the four legacy frontend failures remain in untracked files.

Next candidate: P09 HR operational dashboard (DependsOn P07, P08; P07a, P07b, P08a, P08b1, P08b2a and P08c are committed). P08b2b submission UI remains deferred on the authorized business-timezone read and P17b, and is not a dashboard-triage dependency. Strict alternative if P08 must be fully closed first: P10 shift definitions (DependsOn P03, DONE). No next slice started.

## P09 — IN_PROGRESS — 2026-11-07

Owner authorized P09 HR dashboard triage. Assignee: Orchestrator. Developer dashboard_developer owns `HrDashboard.tsx` and its focused and browser tests. Tester dashboard_tester owns the mocked contracts and browser fixtures. QA dashboard_qa and Security dashboard_review own the scoped verdicts. DependsOn P07 and P08, whose committed children are P07a, P07b, P08a, P08b1, P08b2a and P08c; P08b2b stays deferred and is not a dashboard-triage dependency. Scope: supported dated report and queue contracts, distinct concepts, meaningful attention links, stated coverage, explicit failure state, and a visible P17 pending note for device-date today. No schema, migration, permission or unrelated screen changes.

## P09 — HUMAN_CHECKPOINT — 2026-11-07

Assignee: Orchestrator; Developer dashboard_developer, Tester dashboard_tester, QA dashboard_qa and Security dashboard_review. The HR dashboard now reads the dated punctuality, exceptions and attendance-register reports plus the help and correction queue totals. It separates recorded rows, late arrivals, absent staff and open sessions; maps exception `employee`, `status` and `locationResult`; links each count and preview row to its owning screen with the relevant range or status; and replaces the full register and search with bounded previews. The page states its 100-row chart coverage, shows an inline failure with retry instead of zero metrics, and carries a visible P17 note for the device-date window.

Verification: 8 focused frontend cases, 2 Playwright cases at 375px and 1440px, 344 passing frontend tests with four known legacy failures in untracked files, both typechecks, UI taste, environment parity, humanizer and redacted secret scan. See docs/attendpro/P09-HR-DASHBOARD-TRIAGE-VERIFICATION.md.

QA requested changes for a missing-today bucket and stale date after midnight; both are fixed and tested. QA's follow-up approved P09 with minor findings: the attempt preview cannot link to an individual attempt until P28, and the missing-bucket alert uses generic failure copy. Security approved with a minor note: one row of help/correction content is returned with each count query, although the dashboard displays only the total. No route, permission, schema or write change; all reads remain tenant-scoped and the page sends GET requests only. No commit, push or deploy. Staging index is empty. Proposed files: `src/pages/HrDashboard.tsx`, `src/__tests__/hr-dashboard.test.tsx`, `src/__tests__/e2e/hr/dashboard.spec.ts`, the P09 verification document, and the P09 entries in `docs/TESTING_GUIDE.md`, `docs/TASK_BOARD.md` and `docs/CURRENT_STATE.md`. Proposed message: `feat(hr): recover dashboard triage`.

Residual risks: live authentication, database RLS, PostgreSQL concurrency and the database-backed suites remain unverified; the charts use at most the 100 most recent register rows and state that coverage; business-time display waits for P17; attempt rows link to the exceptions queue because Attempt Detail remains P28; the four legacy frontend failures remain in untracked files.

## P09 — COMMITTED — 2026-11-07

Committed through `.agents/scripts/commit.sh` as `129bc2952d7b242fba7ceea6bb03ffc4043fb6ed` with `feat(hr): recover dashboard triage`. The seven committed paths are `src/pages/HrDashboard.tsx`, the focused and browser dashboard tests, the P09 verification document and only the P09 additions to `docs/TASK_BOARD.md`, `docs/CURRENT_STATE.md` and `docs/TESTING_GUIDE.md`. The staged diff was reviewed before committing; the index is now empty. Older edits to those shared docs, SEC-19, Sidebar, auditWriter and all other unrelated tracked and untracked work remain uncommitted. No push or deploy.

Remaining risks: live authentication, database RLS, PostgreSQL concurrency and database-backed suites are unverified; chart data is limited to the most recent 100 register rows with coverage stated; business-local today waits for P17; individual attempt drill-through waits for P28; missing-bucket failures use generic copy; count-only queue reads still retrieve one full authorized row; four untracked legacy frontend tests fail.

Orchestrator dependency check: next plan-order candidate is P10 shift definitions. DependsOn P03 (DONE); P09 is not a prerequisite. P10 remains NOT_STARTED and needs separate owner authorization and assignees before implementation. P11 depends on P02 and P10. P08b2b remains deferred pending an authorized business-timezone read and applicable P17b work. No next slice started.

## P10 — IN_PROGRESS — 2026-11-07

Owner authorized P10 shift definitions. Assignee: Orchestrator; Developer shift_developer owns `src/pages/ShiftManagement.tsx`, the shift list controller and the shift list query validator hunk; Tester shift_tester owns focused backend/frontend and intercepted browser tests and the testing guide. QA shift_qa and Security shift_review own read-only scoped review. DependsOn P03 (DONE). Scope: genuine tenant-scoped filtered/searchable paginated list, minute-based create/edit, overnight geometry, active/deactivate behavior, and truthful load/mutation states. Preserve historical attendance and the existing role gates. No schema, migration, permission, assignment lifecycle or timing-policy changes. The pre-existing forced-password changes in `backend/routes/shiftRoutes.ts` and SEC-19 validator hunk are unrelated working-tree changes; preserve them outside any P10 staging. No commit, push or deploy.

## P10 — HUMAN_CHECKPOINT — 2026-11-10

Resumed P10 Shift Definitions from its existing implementation. QA approved the scoped slice with minor findings and no blockers. Security approved with two low findings and five informational notes. Passed 13 focused frontend tests, 12 mocked backend contract tests and two stateful Chromium cases at 375px and 1440px. Frontend and backend TypeScript checks, UI taste, environment parity with 27 variables, humanizer and scoped secret scans passed.

The corrections from both reviews are in place. Names are trimmed before validation. Shift times validate as minute-of-day, so an empty string, null, false or a decimal string is refused instead of being read as midnight. A failed deactivate shows a single alert. A page beyond the last available page returns to a valid page, including the case where the server reports no pages. The search field waits 300 ms before it queries, so typing costs one request rather than one per keystroke. The backend contract suite asserts the tenant-scoped filter, the ordering and the paging window, and it covers rejected minute input.

The P10 rewrite tightened the list response check, so the shared legacy fixture in `src/__tests__/admin-flows.test.jsx` gained the `success: true` flag the real API already returns. Without that flag the legacy shift case failed against the new page while passing against the previous one. The full frontend suite is 357 passing with the four known legacy failures in untracked files, and the backend unit suite is 167 passing.

Two items are deferred with reasons. The search term reaches the database as a contains filter without escaped metacharacters, which matches four other controllers here and grants no additional access; escaping needs database-level verification. The scheduling screen requests a thousand shifts in one call, which the existing page limit already refuses with a 400. The defect predates P10 and belongs to the assignment slice.

`docs/attendpro/M1-API-CONTRACTS.md` was left unchanged. It is a dated M1 design record whose header states that it is not a current implementation inventory, and another workstream has it staged. The implemented list contract is recorded in the P10 verification document instead.

Evidence applies to the current working tree; the pre-existing forced-password route and SEC-19 validator hunks stay outside the proposed P10 commit. The original staged batch is preserved exactly. Live authentication, database RLS and actual database concurrency remain unverified. See docs/attendpro/P10-SHIFT-DEFINITIONS-VERIFICATION.md. Proposed message is fix(shifts): recover definition contracts and workflow. P10 awaits owner review.

## P10 — COMMITTED — 2026-11-10

Committed through `.agents/scripts/commit.sh` as `5c5542c017e7c59bc334fd79989927d8262a00bb` with `fix(shifts): recover definition contracts and workflow`. The ten committed paths are `src/pages/ShiftManagement.tsx`, `backend/controllers/shiftController.ts`, the P10 hunks of `backend/validators/index.ts`, the focused backend contract test, the focused frontend test, the browser spec at `src/__tests__/e2e/sa/shift-definitions.spec.ts`, the P10 verification document, and the P10 additions to `docs/TASK_BOARD.md`, `docs/CURRENT_STATE.md` and `docs/TESTING_GUIDE.md`. The commit was prepared in an isolated index built from HEAD, so the shared staging batch of 130 entries was left untouched and still matches its earlier state. No push or deploy.

The shared index still holds the tree as it stood before this commit. It now shows the four new P10 files as staged deletions, and the P10 changes to the page, the validator and the three shared documents as staged reversions. That index needs a refresh for those paths before any further commit from it, or the P10 work would be undone. The legacy fixture fix in `src/__tests__/admin-flows.test.jsx` stays with the workstream that owns that file.

Residual risks: live authentication, database row-level security and real database concurrency remain unverified; unescaped search metacharacters and the scheduling screen's thousand-row request stay deferred to the assignment slice. P11 is the next plan-order candidate and depends on P02 and P10. No next slice started.

## P11 — dependency check — 2026-11-10

Orchestrator check after the P10 commit. P11 depends on P02 and P10, and both are done: P02 at 3d6b983 and P10 at 5c5542c. P11 is the next plan-order candidate, and no slice between P09 and P11 remains open. P11 stays NOT_STARTED until the owner authorizes it and assigns the roles the plan names.

Three defects are already visible in the P11 surface. `Scheduling.tsx` asks for a thousand employees and a thousand shifts, and both list routes cap the limit at 100, so those lookups fail with a 400. `listAssignments` returns a flat array while `Scheduling.tsx` reads a pagination envelope. The shift lookup also predates the P10 list contract, which now answers with a paginated envelope.

The plan's stop condition applies before any write change: the Architect and the owner review the history semantics of closing the current assignment and syncing the legacy `user.shiftId`. Two answers are needed first. Whether future and backdated assignments run on business time or device time is tied to the deferred P17b read. The atomic close-and-sync path needs database verification, because the one-open-assignment invariant rests on the partial unique index in the 20261015140000 shift scheduling migration and PostgreSQL is not reachable from this machine.

P08b2b and its business-time dependency stay deferred. No P11 work started, and no commit, push or deploy.

## P11 and P11a design approved — 2026-11-10

The owner approved the P11a product direction and ten further scheduling decisions. The Architect, DBA and Security reviewers finalized the design, and the governance documents were amended: the role matrix gained the schedule capabilities with four footnotes, five route rows and a screen row; the role experiences document gained the employee schedule surface; the API contracts gained five route rows and the reshaped staff schedule, assignment and audit rows; the decision register gained row O25; and the phased plan gained the P11a unit between P15 and P16, with P16 depending on it.

Three reviewer findings changed the design. The production restriction on one working period per day cannot be a partial index, because a partial index predicate may only read its own table, so it is a deferred trigger that P16 drops. The resolution chain needs two more tables, for personal days off and for holiday exceptions. And the attendance provenance foreign keys use `RESTRICT` rather than `SET NULL`, because a cascading null would erase the source the decision requires.

The implementation plan is in docs/attendpro/P11-P11A-IMPLEMENTATION-PLAN.md. It runs the pointer deprecation, the assignment lifecycle, the schema, the schedule writes and the resolver in that order, with a DBA gate before either migration is applied.

Two prerequisites block the acceptance tests. No PostgreSQL is reachable from this machine, so the exclusion constraints, the deferred triggers and the tenant policies cannot be exercised yet. And the `btree_gist` extension must be installable on the pilot host, because both exclusion constraints depend on it.

P11 and P11a stay NOT_STARTED pending owner authorization to implement. No application code, migration, schema change or git index change was made, and nothing was committed, pushed or deployed.

## P11 preparation checkpoint — 2026-11-10

The owner accepted the architecture direction and the phased plan, with migrations and persistence implementation still unauthorized.

The shared index was reconciled with the reviewed approach: the ten P10 paths were re-staged from the working tree. The four staged deletions of the new P10 files and the staged reversion of the shift page are gone, the six P10-owned paths now match HEAD in the index, and the four shared paths hold their workstream's batch together with the P10 content. All 875 non-P10 index entries are byte-identical before and after, and the working tree is unchanged apart from this project's own documentation. No staged entry reverses committed P10 work, and nothing unrelated was discarded or mixed.

The remaining decisions are now recorded as proposals rather than as settled answers, in both design documents, with the recommendation, the consequence of a different answer and the owner's confirmation still outstanding. The role matrix and the API contracts carry a line saying so.

The first implementation slice, P11.1, the legacy pointer deprecation, was reviewed as a specification in docs/attendpro/P11A-P11.1-POINTER-DEPRECATION-SLICE.md. It covers the exact file and symbol scope, the one breaking API surface, seven security tests and the acceptance criteria, and it changes no schema and no migration.

The assignment audit is now required to be durable and written in the same transaction as the assignment write, through the transaction client, because the shared writer swallows insert failures. History preservation is stated explicitly: no operation deletes an assignment row and no operation edits a realized period.

The development environment was inspected for a test database. The project already ships a guard and a deploy script for it, and the machine has a PostgreSQL 16.15 cluster installed with the extension the exclusion constraints need, but it is not running. The guard is fully configured: `backend/.env` names the test target and the development host, so all seven refusals are live. An earlier note in this entry said the development-host exclusion was unconfigured; that was wrong and is corrected here and in the implementation plan. Four setup options are proposed in the implementation plan, none started and none configured without approval, and the Option B procedure is written out in docs/attendpro/P11A-TEST-DATABASE-ENVIRONMENT-PROPOSAL.md.

P11 and P11a remain NOT_STARTED. No application code, migration, schema or RLS change was made, the shared index was reconciled only within the ten P10 paths, and nothing was committed, pushed or deployed. That was true at this checkpoint; P11.1 has since been implemented under the owner's separate authorization.

## P11.1 — IMPLEMENTED — 2026-11-10

The owner authorized P11.1, the legacy shift-pointer deprecation, and no other slice. Assignee: Orchestrator, with Developer, Tester, QA and Security gates.

Scope delivered: the `shiftId` field left the employee create and update schemas, the account controller's writes and the public user projection, and it left the user, create and update Swagger schemas. The `validShift` helper and its two call sites were deleted. The assignment path remains the only writer, and its pointer write now constrains the tenant in the same statement. The database column, its foreign key and its index are unchanged, and no migration, schema or RLS file was touched.

Files changed: `backend/validators/index.ts`, `backend/controllers/userController.ts`, `backend/controllers/assignmentController.ts`, `backend/docs/swagger.ts`, `backend/tests/unit/userController.contract.test.ts`, the new `backend/tests/unit/assignmentController.contract.test.ts`, `backend/tests/adminCrud.test.ts`, and the P11.1 entries in this board, the current state, the slice specification, the implementation plan and the two API documents that still advertised the field.

Verification: 169 mocked backend cases pass and 35 of them cover the two controllers, both typechecks are clean, and the frontend suite is 357 passing with the four known legacy failures. The live database suite could not execute: the guard verified `localhost:5432/attendpro_test` and the connection was refused, so the new integration assertions remain unverified until a database exists.

Review gates: Tester and Security approved the slice with findings, QA requested changes. Fixed from the findings: the integration test no longer mutates the shared fixture account, the created user's audit rows are cleaned up, the assertions check key absence rather than a value match, a new assignment-controller contract suite pins the tenant-scoped pointer write and the cross-tenant refusals, two API documents that still advertised the field were corrected, and the slice specification was amended where it misstated the mechanism and the route method.

Reported and not fixed, because each is outside this slice: a stale `backend/dist` build still advertises the field, so a release must rebuild; the account endpoints ignore an unknown field silently rather than rejecting it, which is an owner choice between silence and a strict schema; deactivating an assignment does not clear the pointer, so it can outlive its assignment, which belongs to P11.2; the assignment audit is still a stdout line, which P11.2 requires to become durable; and the Swagger user schema omits `profileImageUrl`, which the code returns.

P11.1 is at the acceptance checkpoint. P11.2 and P11a remain NOT_STARTED, no schema or migration work is authorized, and nothing was committed, pushed or deployed.

## P11.1 — verification closure — 2026-11-10

The owner authorized the Option B test instance and a correction to the slice: an account request that carries the legacy pointer is now refused with a clear field error rather than having the field stripped in silence.

**The correction.** Both account schemas declare the field as `never`, so a request without it is valid and a request carrying it is refused with a message that says a shift is set through an assignment. The controller reports that reason and keeps the original generic wording for every other field. The dedicated assignment workflow is untouched: it is the only writer of the pointer, and its write stays tenant-scoped.

**The instance.** An isolated PostgreSQL 16.10 instance now runs for the suites: the official EnterpriseDB portable binaries, downloaded over TLS, matching the published content length exactly and passing the archive's CRC test, with the SHA-256 recorded. The data directory is a temporary folder outside every installation and outside the repository, the instance listens on port 5433 on the loopback interface only, and the credentials are throwaway. The existing ServBay cluster, the managed development database and every other database were left alone. Two Windows details were needed and are recorded in the environment proposal: a forked server process needs the `pgsql/bin` and `pgsql/lib` folders on `PATH`, or it dies with a DLL initialisation failure, and the Windows tools must be given a closed standard input and told never to prompt for a password.

**The database.** The project's own guard accepted the target, `localhost:5433/attendpro_test`, and all ten existing migrations were applied to it and nowhere else. The guard's other settings were not touched: `TEST_DB_HOST`, `TEST_DB_NAME`, `DEV_DB_HOST` and the development `DATABASE_URL` are unchanged, and only the port in the one test URL line differs.

**The live assertions.** The database-backed suite that could never run before now passes: the crud suite is 20 of 20, including the three new assertions, and the response body shows the refusal with the field named. The row level security posture was proved directly against the instance: the application role exists as a non-superuser, row level security is enabled on the five tenant tables, a read with no tenant set returns no rows, a write for another tenant is refused by the policy, and a write for the app role's own tenant passes it.

**The pre-existing failures.** The full database-backed suite is 774 passing and 23 failing. All 23 are pre-existing and none is caused by this slice: with the pre-P11.1 code swapped back in, the same 23 fail. They are guard-ordering expectations in the account controller, where a body check runs before the authentication and tenant checks, so an anonymous or tenantless caller receives a validation error rather than 401 or 400. They had never surfaced because the suite could not run. They are recorded for a separate slice.

**Release verification.** The backend was rebuilt and the built artifact no longer exposes the field: the user schemas compile to a type that refuses any value, while the policy and report schemas keep their own separate field. A smoke test against the built artifact confirms that a create or update carrying the pointer is refused with the same message and that a request without it parses without the key.

**Files changed.** `backend/validators/index.ts`, `backend/controllers/userController.ts`, `backend/controllers/assignmentController.ts`, `backend/docs/swagger.ts`, `backend/tests/unit/userController.contract.test.ts`, the new `backend/tests/unit/assignmentController.contract.test.ts`, `backend/tests/adminCrud.test.ts`, `backend/.env` for the one test URL line, and the P11.1 entries in this board, the current state, the slice specification, the implementation plan, the environment proposal and the API contracts.

**Git index.** Untouched by this work. The 875 non-P10 index entries remain byte-identical to the pre-reconciliation snapshot, 129 paths stay staged, and no staged entry reverses committed P10 work.

P11.1 is ready for final acceptance. P11.2 and P11a remain NOT_STARTED, and nothing was committed, pushed or deployed.

## P11.1 — ACCEPTED — 2026-11-11

The owner accepted P11.1 as complete within its approved scope. The slice is implemented and verified; it is not committed.

Verification record:

- The live integration suite passes 20 of 20, including the three assertions that could not run before the isolated instance existed.
- All ten existing migrations were applied to the isolated test database, and to nothing else.
- The tenant-isolation posture was verified directly against the instance: the application role is a non-superuser, row level security is enabled on the five tenant tables, a read with no tenant set returns no rows, a write for another tenant is refused by the policy, and a write for its own tenant passes it.
- No schema or migration change was made for P11.1. The column, its foreign key and its index are as they were.
- No commit, push or deployment has been authorized for P11.1.

Two groups of failures remain open and are recorded rather than closed:

- The 23 database-backed failures in the account controller area. They are proven pre-existing and are the subject of the guard-ordering proposal below.
- The four frontend failures, which are the known baseline in the untracked coverage and modal files.

## Next-step proposals — 2026-11-11

Two proposals are prepared for the owner's decision. Neither is implemented.

**Proposal A, the account controller guard ordering** — `docs/attendpro/P11A-ACCOUNT-GUARD-ORDERING-REMEDIATION.md`. The twenty-three failures share one shape: a handler answers 400 where the test expects 401, a tenant refusal, or 500. The route middleware already answers in the right order, so the observable API is correct and the failures come from direct handler calls that bypass it. Four handlers check the body before the caller is resolved, and the account controller derives its tenant from the token rather than through `callerBusinessId`, so the tenant refusal the tests expect is unreachable in it. The proposal names the affected routes and handlers, the precedence to hold, three remediation options with a recommendation, the focused regression tests, and the compatibility risks. It stays inside the account controller and its two test files.

**Proposal B, the P11.2 assignment lifecycle** — `docs/attendpro/P11-ASSIGNMENT-LIFECYCLE-PROPOSAL.md`. Five product rules are still open and are not treated as approved: the start anchor and overnight ownership, the exact backdating boundary, whether a live row may be rescheduled, whether a cancelled future assignment lets the previous one resume, and what a business timezone change does to stored future assignments. Each carries a recommendation and its consequence. The slice needs one migration carrying the exclusion constraint, the composite tenant foreign keys and their two prerequisite unique indexes, durable audit rows written inside the write transaction, tenant safeguards, and ten concurrency and constraint tests. The isolated instance is suitable: the extension the constraint needs was installed by the application role during this work, and the ten existing migrations applied cleanly to it.

P11.2 and P11a remain NOT_STARTED. The shared Git index is unchanged, and nothing was committed, pushed or deployed.

## Proposal A implemented; P11.2 design finalized — 2026-11-14

The owner approved Proposal A. The account controller now settles the caller and administrator role before judging malformed bodies in `createUser`, `updateUser` and `resetPin`. The shared `managed` helper gained a pre-transaction validation hook after authentication and authorization. `updateUser` repeats the parse guard inside the operation so an invalid body cannot reach a write even if that hook changes later. `resetPin` checks the HMAC key inside the transaction after the caller and body guards; a missing key still fails closed before any write and the transaction rolls back.

The twenty-three reported failures are closed individually:

- Two anonymous guard cases, `createUser` and `resetPin`, now answer 401 before malformed-body errors. A third regression case covers the same ordering in `updateUser`.
- Three `Account has no business` expectations were inapplicable to the account controller. `users.businessId` is non-nullable, and the controller resolves an actor by account id and request business rather than calling `callerBusinessId`. They were replaced with seven tenant-mismatch cases against a real administrator plus a 200 positive control for the same account in its own business.
- The two `staffProfile.changePin` failure arms now carry the business id present on a real authenticated request, so they reach the injected database failure.
- The sixteen account failure arms, eight handlers under both Error and non-Error branches, now intercept `findFirst`, which those handlers actually call, as well as `findUnique`. The spies target the raw application client and restore its exact delegate methods, so they do not poison later files.

QA and Security reviewed the first implementation and requested two blocking corrections: an `unknown` reset reason broke the backend typecheck, and restoring tenant-proxy wrappers made the tests order-dependent. Both were fixed. Their smaller findings were also addressed: `updateUser` has an explicit malformed-body ordering case, the tenant positive control requires 200, and the tenant explanation now matches the id-and-business account lookup. The focused guard and failure suites pass 222 of 222 in either requested order; the failure suites together with the later utility consumer pass 260 of 260; the real HTTP account suite passes 20 of 20; the account contract suite passes 31 of 31; and both backend and frontend typechecks are clean. The full database-backed suite passes 805 of 805 across 36 files. The frontend runtime suite remains at its unchanged baseline of 357 passing and four known failures.

Proposal B is finalized as design and governance only. Decision O26, the assignment API rows and the P11.2 design now require future business-local dates at midnight, overnight ownership by the start date, no historical backdating, same-day replacement at the transaction instant, append-only audited replacement, durable future-cancellation evidence, restored predecessor coverage, and immutable stored UTC instants after a timezone change. Cancellation is represented by closing the future row onto itself, reopening the predecessor's end and writing both changes and the reason in the same transaction. The acceptance gate requires tenant-safe constraints, durable atomic audits, real concurrent-write tests and non-superuser RLS tests.

P11.2 persistence remains NOT_STARTED. No schema, migration or RLS file was changed. No commit, push or deployment was performed. The shared index still has 129 staged paths, zero staged deletions, and the 875 non-P10 entries remain byte-identical to the preserved snapshot.

## P11.2 database-integrity checkpoint — DONE — 2026-11-14/15

The owner accepted Proposal A and authorized only the first P11.2 internal checkpoint: migration preparation and database-integrity review. Assignees: Orchestrator; Architect for design consistency; DBA for schema, migration SQL, compatibility inspection and rollback analysis; Security for tenant-boundary and audit review; Tester for constraint and concurrency coverage. P11.1 remains accepted and uncommitted.

Authorized outputs are a proposed migration, any required Prisma schema edits, existing-data compatibility findings, constraint and rollback risks, a concurrency test plan, the exact changed-file list and Git index status. The migration may add `btree_gist`, prerequisite composite unique indexes, tenant-safe composite foreign keys, the assignment-period check and the non-overlap exclusion constraint. No controller, UI or RLS-policy work is authorized.

The isolated target must be verified as `localhost:5433/attendpro_test` before every database operation. Existing data may be inspected read-only. The new migration must not be applied. ServBay, the managed development database and production are prohibited. This task stops at HUMAN_CHECKPOINT for migration approval.

### Gate outcomes and verification — 2026-11-14

- **Architect** — CHANGES REQUESTED; all five findings closed in the governance documents: cancelled rows evaluate as `ENDED` first, middle-of-chain cancellation restores the predecessor through the next non-empty successor, composite-FK actions are fixed at `ON DELETE RESTRICT ON UPDATE CASCADE` with the single-column keys retained, one `clock_timestamp()` is captured after the advisory lock for same-day boundaries, and the PATCH contract row plus reason semantics are defined.
- **DBA** — APPROVED for human migration review. Prepared `backend/prisma/migrations/20261114120000_p11_assignment_integrity/migration.sql` and the matching `schema.prisma` unique pairs and composite relations. Not applied, not generated, not deployed. No RLS change.
- **Security** — CHANGES REQUESTED; required changes closed: FK/Prisma strategy documented with the accepted drift, single-transaction application and lock-window guidance added, the advisory-lock contract frozen with the identical-start re-read guard, empty cancellation intervals documented as an intentional exclusion exception, and event names unified as `created`/`replaced`/`rescheduled`/`cancelled`/`deactivated` with `reason` required. Pilot-host `btree_gist` permission stays open as a pre-deployment verification against the exact migration role.
- **Tester** — CHANGES REQUESTED; closed by the migration artifact, the frozen lock key, the identical-start 409 guard, the PATCH row, the documented `23P01` normalization requirement, and the test-only audit trigger accepted as a disposable-database test method.

Orchestrator verification: isolated identity `attendpro_test|attendpro_test|::1:5433` with 10 applied migrations confirmed before every query; `npm run test:db:check`, `npx prisma validate`, `npx prisma generate`, backend `tsc --noEmit`, `.agents/scripts/db-check.sh` for the new migration, `git diff --check` and the humanizer all pass. Drift was separated against HEAD's schema: this checkpoint contributes only the two composite FK replacements and two unique pairs; the remaining attendance, kiosk and user index and column drift pre-exists in the test database and is unrelated to this checkpoint. Existing-data inspection found zero `shift_assignments` rows and zero violations, so a restored production-like copy must repeat the preflight at deployment approval.

### Migration applied and verified after owner approval — 2026-11-15

The owner approved application to the isolated test instance only. The guard was re-verified, then `npm run test:db:deploy` applied `20261114120000_p11_assignment_integrity` — 11 applied migrations. Evidence:

- **Unchanged data** — row counts identical across all 19 public tables before and after; `shift_assignments=0`.
- **Catalog** — `btree_gist` 1.7 installed; `shift_assignments_period_ck`, `shift_assignments_no_overlap`, `shift_assignments_business_user_fkey` and `shift_assignments_business_shift_fkey` all present and validated with `ON UPDATE CASCADE ON DELETE RESTRICT`; both composite unique pairs created; `shift_assignments_current_uq` preserved; the tenant policy `shift_assignments_tenant_isolation` (USING + WITH CHECK) and RLS enabled state unchanged.
- **Constraint battery** — expected SQLSTATEs throughout: `23514` inverted period, `23P01` overlap, adjacency accepted (2 rows), different-employee overlap accepted, empty cancellation intervals accepted with `isempty=true` and coexisting with open and later rows, `23505` second open row, `23503` on both composite cross-tenant keys and on all missing references; final committed count 0.
- **Concurrency** — two-session insert blocked and failed `23P01` when the holder committed; succeeded when it rolled back; the exact `hashtextextended('attendpro:assignment:…')` lock timed out with `55P03` on the same key, was acquired immediately for a different employee, and re-acquired after release.
- **Non-superuser RLS** as `attendpro_app` (non-super, no bypass) — no tenant reads 0 rows; tenant A reads only tenant A; same-tenant insert accepted; cross-tenant insert refused with `42501` policy violation; tenant-filtered join returns only tenant A; table empty after every rollback.

**Migration-exposed defect and authorized repair.** The first full suite run fell to 802/805. The deterministic failure was `adminCrud > soft-closes an assignment`: the existing `deactivateAssignment` closed any row at `new Date()`, so cancelling a future assignment wrote `effective_to < effective_from` — silent corruption before, a correct `23514` refusal (HTTP 500) now. With the owner's explicit authorization, the minimal repair landed: a future row closes onto its own `effectiveFrom`, a row in force closes at `now`, matching the approved DELETE contract. Typecheck clean, focused suites 24/24, full suite restored to **805/805 across 36 files**. Two transient `accountEdges` 401s in that first run were the pre-existing shared-staff-account parallel race — green in isolation and in both full re-runs; both incidents are logged in `docs/LESSONS.md`.

Post-apply `prisma migrate diff` shows only the documented accepted drift (retained single-column keys, Prisma's preferred FK names, and the unrelated pre-existing test-database divergence). No RLS change, no P11.2 lifecycle code, no UI code, no commit, push or deployment.

## P11.2b backend lifecycle slice — HUMAN_CHECKPOINT — 2026-11-15

The owner accepted the database-integrity checkpoint and authorized the next controlled slice: **Assignment Lifecycle Backend**. Assignee: Developer subagent (implementation). Gates: QA, Tester and Security reviewers; Orchestrator runs the final verification.

Scope: effective-dated create, replacement (POST and new PATCH), cancellation and deactivation per the finalized design, O26 and the API contract rows; the approved per-employee advisory lock as the first lifecycle statement after tenant context; one `clock_timestamp()` captured after the lock for same-day boundaries; one durable `tx.auditLog.create` row per successful write with atomic rollback on audit failure; `23P01`/`23505` mapped to `409` without database internals; cancelled zero-length intervals excluded from active resolution; `users.shiftId` kept transitional; business-local date and timezone rules preserved.

Explicitly out of scope: P11a weekly schedules, P11.2 UI, new migrations, RLS policy changes, unrelated work. Database safety: isolated guarded `attendpro_test` only; no commit, push or deployment; shared index preserved. Verification: real integration tests for future assignment, cancellation, replacement, overlap and concurrent writes, audit-failure rollback, non-superuser RLS checks, backend regression suite, both typechecks, frontend baseline, QA and Security review. The task stops at the backend acceptance checkpoint.

**Backend acceptance review.** Developer implemented POST/PATCH/DELETE lifecycle transactions, business-local date conversion, scoped employee and shift row locks, one captured post-lock transaction instant, durable audit writes, conflict mapping, effective-dated reads and cancelled-interval exclusion. Tester added real database lifecycle coverage and updated assignment contract tests. The owner resolved the third review loop's PATCH conflict: a contiguous predecessor's future end may move to the amended start so a forward reschedule does not leave the current shift uncovered. The amended rule is recorded in O26, the technical design and API contracts. Final QA and Security reviews approved this implementation. No P11a, UI, migration or policy work was done in this slice.

**Verification.** Guarded target: `localhost:5433/attendpro_test`. Focused tests passed 44/44 across four files; the final amended full backend run passed **825/825 across 38 files**. Backend and frontend typechecks and environment parity passed. `SET LOCAL ROLE attendpro_app` rollback tests proved no-tenant reads zero; same-tenant employee/shift `FOR SHARE` locks and assignment/audit inserts succeed; cross-tenant assignment and audit inserts each fail `42501`; cleanup left zero probe rows. The unchanged frontend baseline remains 357 passed and four known failures across 25 files. Earlier parallel full backend runs intermittently failed in `controllerGuards.test.ts` (112/112 alone); a one-worker run later hit seeded-account login 500s, but `auth.test.ts` passed 19/19 alone. The final default full backend run passed without changes to those unrelated tests.

**Acceptance boundary.** Backend verification and QA/Security gates passed; await human acceptance. End-to-end HTTP `23P01` mapping, PATCH-specific audit-failure rollback, foreign-tenant PATCH and a concurrent employee-deactivation API race remain targeted follow-ups; the direct-SQL exclusion battery, targeted SQLSTATE mapping test, transaction audit rollback and role-level RLS tests cover their underlying mechanisms. A slice-specific implementation plan was not approved under `docs/superpowers/plans/` before code work; flag this process exception at review. Shared Git index: 129 previously staged paths; do not stage, commit, push or deploy.

## P11.2 backend acceptance verification — HUMAN_CHECKPOINT — 2026-11-15

The owner conditionally accepted the 825/825 backend baseline and authorized only targeted verification, not new lifecycle features. Assignee: Tester subagent owns isolated PostgreSQL HTTP tests for real `23P01` → safe 409, PATCH audit-failure rollback, foreign-tenant PATCH and both API race orders for employee deactivation. Orchestrator owns the `users.shiftId` fallback review, the process-exception record, regression runs and the final human checkpoint; QA and Security review the result. Preserve the 129 staged paths; no schema, migration, RLS, P11a, UI, commit, push or deployment.

Targeted HTTP tests found two defects: PrismaPg 6.19.3 wrapped a real `23P01` in an unknown-request message, producing 500, and an assignment granted before account deactivation stayed effective. The Developer mapped only that exact engine error signature to a fixed 409 message. The owner separately authorized ending current and future assignment periods, clearing the legacy pointer and writing durable assignment audit evidence atomically in both account-deactivation paths. HR's existing permission to deactivate STAFF was preserved. A deterministic DELETE test now proves both assignments close when the grant succeeds first; the staggered HTTP race remains supplemental concurrency coverage.

Security identified two test-target gaps: the suite could retain an externally supplied `DATABASE_URL_APP`, and connection-string query parameters could override the checked host. Setup now drops the external app URL after validation, and the shared guard allows only the `schema` query key. The guarded authentication verifier clears the external app URL before importing Prisma. The setup guard's no-DB tests use a separate process to avoid Vitest module-cache state.

Final verification on this exact state: the full backend run passed **841/841 across 39 files**; focused lifecycle tests passed 25/25; backend and frontend typechecks and the environment audit passed. Final QA and Security gates both returned APPROVED; their residual risks are informational only (driver-format coupling in the 23P01 marker, the supplemental timing-based race, per-run test-database growth, unvalidated pagination in `listAssignments`, and the guard not checking the port). The human checkpoint reviews the slice, the two authorized repairs and the plan-gate exception below.

The required preapproved, slice-specific plan was absent from `docs/superpowers/plans/` when implementation started. `docs/attendpro/P11-BACKEND-PLAN-GATE-EXCEPTION.md` records the exception without treating a later document as prior approval. The human acceptance gate must explicitly review it.
