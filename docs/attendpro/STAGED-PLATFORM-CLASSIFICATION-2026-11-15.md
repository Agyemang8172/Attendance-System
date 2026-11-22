# Staged platform classification, 2026-11-15

Branch: `codex/attendpro-phased-delivery`. HEAD: `ed6410c` (feat(assignments): complete P11.2 effective-dated assignment lifecycle backend). The index holds 124 staged paths from platform work that predates and postdates HEAD. This report classifies every staged path, maps the eight known failing backend tests at HEAD to the staged changes that fix them, and proposes commit groups. It is a planning review; nothing in it commits, stages, or reverts anything.

Working-tree files that are NOT part of the staged set and are out of scope here: `docs/attendpro/P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md` (untracked), `.agents/memory/handoffs/handoff-2026-11-15-p112-backend.md`, `docs/CURRENT_STATE.md`, `docs/TASK_BOARD.md`, `docs/attendpro/P03-CONTRACT-FIXTURES.md` (all unstaged-only modifications), plus the unstaged halves of the eight MM/AM files, which are handled in the surgical-isolation section.

## Overview

The staged set contains seven distinguishable arcs:

1. **SEC-07 two-role Prisma client lane routing.** Script and controller changes that route reads and writes through either the tenant-scoped default client or the owner-connection `prismaUnscoped` export of `backend/config/prismaClient.ts` (present at HEAD). Includes kiosk device-token middleware, the auto-clock-out job lane, the audit writer fallback, and the lookup-hardening unit tests.
2. **M10 release hardening, security phases 3 and 4.** SEC-10 (production Swagger disabled, lazy load), SEC-11 (dev-only CORS origins), SEC-12 (`requirePasswordChange` on the seven remaining route families; the middleware itself is committed at HEAD in `backend/middleware/requirePasswordChange.ts` from commit `7927e1f`), SEC-14 (coarse-network account limiter keying), and SEC-09 (CSP headers in `vercel.json`).
3. **SEC-13 cumulative kiosk PIN lockout.** The user row becomes the durable failure counter in `backend/controllers/kioskVerifyController.ts`, with route comment and test updates.
4. **SEC-19 list-filter hardening.** Attendance list filters (`sessionStatus`, `status`, `search`) in `backend/validators/index.ts` plus `backend/controllers/attendanceController.ts`, and shift list `search` plus unsafe-page refine in the same validator file. Frontend placeholder text in `src/pages/StaffAttendance.tsx`.
5. **SEC-08/SEC-15 frontend alignment.** Store the fresh token returned by `PUT /users/change-password` (HEAD already revokes the old token and returns a new one), show the reset PIN once to the administrator, remove dead sidebar links (SEC-18), fix the unreachable pairing-code form (M9-B6).
6. **Design and landing reconciliation.** `DESIGN.md` revision, `ProductWalkthrough`, the rebuilt landing page, and the documentation set that governs them.
7. **Dev-OS platform files and governance records.** `.agents/`, `.codex/`, `AGENTS.md`, decision-register-driven supersession notes on the M1 documents, and historical-notices on the older proposal documents.

Dependency remediation (package version moves and removals) and the SSB-2 production bootstrap script share the two `package.json` files, which forces them into one commit group or requires hunk surgery.

## Per-path classification

Kind codes: code, test, docs, tooling, config. Completeness codes: COMPLETE (self-consistent with HEAD plus the rest of its group), PARTIAL (depends on files inside or outside the staged set), UNAPPROVED-DESIGN (forward-looking plan or proposal), REFERENCE-ONLY (records and supersession notes).

### Arc A: SEC-07 two-role client lane routing and lookup hardening (9 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `backend/controllers/jobController.ts` | code | COMPLETE | Requires `prismaUnscoped` export (HEAD). Switches the auto-clock-out sweep and the job-status session branch to the correct connection lane. |
| `backend/controllers/kioskDeviceController.ts` | code | COMPLETE | Requires `backend/utils/tenantContext.ts` and `prismaUnscoped` (both at HEAD). Public pairing scan moves to the owner connection; the guarded update runs inside `runWithTenant`. |
| `backend/middleware/kioskAuthMiddleware.ts` | code | COMPLETE | Same dependencies. Device token names the tenant: terminal read through the owner connection, then `runWithTenant` wraps the rest of the request. Also removes a redundant null check. |
| `backend/utils/auditWriter.ts` | code | COMPLETE | Requires `tenantContext` (HEAD). Default client parameter now resolves to the tenant client when a tenant is set, owner connection otherwise. |
| `backend/scripts/test-seed.ts` | tooling | COMPLETE | Two-line switch to `prismaUnscoped`; seed writes need the owner connection. |
| `backend/scripts/verify-auth.ts` | tooling | PARTIAL | Staged hunk is the `prismaUnscoped` import switch (SEC-07). One unstaged line (`delete process.env.DATABASE_URL_APP`) belongs to the same arc but is not staged. See surgical notes. |
| `backend/tests/tenantContext.test.ts` | test | COMPLETE | New unit suite for `runWithTenant`/`currentTenant` and the array-form `$transaction` refusal in the HEAD client. No database. |
| `backend/tests/tenantLookup.test.ts` | test | COMPLETE | New unit suite for `authenticateLookup`: parameterized identifier, no owner fallback, error propagation. Mocks the client. |
| `backend/tests/auth.test.ts` | test | COMPLETE | Adds lookup-failure, bcrypt work-factor, and inactive-account coverage. Depends on `backend/utils/tenantLookup.ts`, `backend/utils/passwords.ts`, `backend/utils/logger.ts` (all HEAD). |

### Arc B: M10 hardening phases 3 and 4, SEC-10/11/12/14 plus SEC-09 config (12 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `backend/server.ts` | code | COMPLETE | Adds `swaggerEnabled`, `setupLazySwagger`, `allowedOriginsFor`, `coarseNetwork`, `accountAuthKey`; exports `accountAuthLimiter`. SEC-10, SEC-11, SEC-14. Requires `express-rate-limit` 8.7.0 (`ipKeyGenerator`), which HEAD's lock already pins. |
| `backend/docs/swagger.ts` | code | PARTIAL (hunk) | Staged hunk changes `setupSwagger` to accept `Router`, which the lazy loader needs. Three unstaged hunks remove `shiftId` from the swagger schemas; those belong to a later P11.1 contract cleanup, not this arc. See surgical notes. |
| `backend/tests/security.test.ts` | test | COMPLETE | New suites for SEC-14 keying, SEC-10/11 production surface, and SEC-12 gate coverage. Imports the new `server.ts` exports, so it must land with `server.ts`. |
| `backend/tests/swagger.test.ts` | test | COMPLETE | New suite for lazy Swagger initialization. Imports `setupLazySwagger` from `server.ts`, so it must land with it. File starts with a UTF-8 BOM; harmless but worth normalizing. |
| `backend/routes/assignmentRoutes.ts` | code | COMPLETE | `requirePasswordChange` import plus four middleware calls. The middleware exists at HEAD; other route files already use it. |
| `backend/routes/calendarRoutes.ts` | code | COMPLETE | Same pattern, three routes. |
| `backend/routes/kioskDeviceRoutes.ts` | code | COMPLETE | Same pattern, three routes. |
| `backend/routes/policyRoutes.ts` | code | COMPLETE | Same pattern, three routes. |
| `backend/routes/qrRoutes.ts` | code | COMPLETE | Same pattern, two routes. |
| `backend/routes/shiftRoutes.ts` | code | COMPLETE | Same pattern, four routes. |
| `backend/routes/siteRoutes.ts` | code | COMPLETE | Same pattern, four routes. |
| `vercel.json` | config | COMPLETE | Adds CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` headers (SEC-09 cheap half). No code dependency. |

### Arc C: SEC-13 cumulative kiosk PIN lockout (3 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `backend/controllers/kioskVerifyController.ts` | code | COMPLETE | Reworks the mismatch transaction: session counter stays as the second layer, the user row `pinFailedCount` read back inside the transaction drives the cumulative lock. No schema change (columns exist at HEAD). |
| `backend/routes/kioskVerifyRoutes.ts` | code | COMPLETE | Comment-only hunk documenting the SEC-13 counter placement. |
| `backend/tests/kioskVerify.test.ts` | test | COMPLETE | Cumulative lock across separate sessions, lock survives a fresh session, counter clears after the lock lapses. Depends on the controller change and HEAD audit helpers. |

### Arc D: SEC-19 list-filter hardening (4 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `backend/validators/index.ts` | code | COMPLETE | Two hunks: `getMyAttendanceSchema` gains `sessionStatus`, `status`, `search`; `shiftListQuerySchema` gains `search` and the unsafe-page refine (`Number.isSafeInteger((page - 1) * 100)`). |
| `backend/controllers/attendanceController.ts` | code | COMPLETE | Thirteen-line hunk in `getMyAttendance` applying the three filters to the own-rows `where`. |
| `backend/tests/attendance.test.ts` | test | COMPLETE | Filter application and unknown-status 400 coverage. Depends on both SEC-19 files. |
| `src/pages/StaffAttendance.tsx` | code | COMPLETE | One-line search placeholder change ("Remarks or closure reason...") aligning the UI copy with what the API actually reads. |

### Arc E: baseline-failure test alignment (3 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `backend/tests/accountEdges.test.ts` | test | COMPLETE | Token refresh after change-password, PIN-returned-once expectations. Fixes three of the eight HEAD failures. Test-only. |
| `backend/tests/user.test.ts` | test | COMPLETE | Fresh-token usage after change-password plus the new SEC-08 revocation suite. Fixes two HEAD failures and adds coverage for HEAD behavior. Test-only. |
| `backend/tests/unit/attendanceDetail.contract.test.ts` | test | COMPLETE | Adds `listMyCorrections` and `getOwnCorrectionDetail` to the correction-controller mock. Fixes the collection-level failure. Test-only. |

### Arc F: landing reconciliation (3 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `src/pages/Landing.tsx` | code | COMPLETE | Rebuilt to the approved landing contract in `docs/attendpro/LANDING-PAGE-SPEC.md` and Decision Register G.4: `Example Organisation`, `#preview` anchor, one Sign in action pair, walkthrough integration. |
| `src/components/landing/ProductWalkthrough.tsx` | code | COMPLETE | New 528-line DOM/SVG walkthrough component with six scenes, transcript, and reduced-motion handling, per LANDING-PAGE-SPEC section 3.7. |
| `src/__tests__/landing.test.tsx` | test | COMPLETE | Rewritten to the approved copy, anchor, dt-before-dd order, walkthrough controls. Depends on both files above. |

### Arc G: SEC-08 frontend token storage plus auth-routing tests (4 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `src/utils/auth.ts` | code | COMPLETE | Adds `updateToken`. No dependency beyond HEAD. |
| `src/pages/SetPassword.jsx` | code | COMPLETE | Stores `response.data.token` after change-password. Matches HEAD's SEC-08 response shape. |
| `src/pages/Settings.jsx` | code | COMPLETE | Same pattern. |
| `src/__tests__/auth-routing.test.jsx` | test | PARTIAL (hunks in two arcs) | One hunk updates the landing copy expectation (belongs with Arc F), the other two hunks assert the fresh token (belong here). See surgical notes. |

### Arc H: screen fixes, SEC-15/SEC-18 plus M9-B6 (3 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `src/pages/ManageStaff.tsx` | code | COMPLETE | Shows the reset PIN once in a one-time modal with copy button (SEC-15). HEAD's controller already returns `data.pin`; the old toast claiming the PIN was sent to the employee is removed. |
| `src/components/Sidebar.tsx` | code | COMPLETE | Removes the Audit Log and Help and Corrections nav items (SEC-18: point links at screens that exist). |
| `src/pages/Devices.tsx` | code | COMPLETE | Fixes the M9-B6 defect where the pairing form modal rendered with `open={false}` behind the same flag as the result, so no pairing code could be generated. |

### Arc I: M10 frontend coverage ratchet (4 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `src/__tests__/admin-flows.test.jsx` | test | PARTIAL | New 850-line interaction suite. The staged version's shared `paginated` mock lacks `success: true`; the unstaged two-line fix adds it. Screens such as `src/pages/ShiftManagement.tsx` check `data.success`, so the staged state alone may fail its own suite. Commit should include the unstaged line. |
| `src/__tests__/admin-screens.test.jsx` | test | COMPLETE | New shell-render suite for the working screens against a stubbed API. |
| `src/__tests__/modal-branches.test.jsx` | test | COMPLETE | New suite for AddEmployeeModal, EditEmployeeModal, ResetPasswordModal, AttendanceTable branches. |
| `src/test/setup.ts` | tooling | COMPLETE | Adds the vitest/jsdom type reference and stubs `localStorage` with the jsdom storage. |

### Arc J: dependency remediation plus SSB-2 production bootstrap (8 paths)

| Path | Kind | State | Dependencies and notes |
|---|---|---|---|
| `backend/scripts/bootstrap.ts` | code | COMPLETE | New guarded production bootstrap: refuses test databases, the development host, and non-empty databases without `--force`; reads passwords from env, validates them through the API policy, never prints them. Uses `prismaUnscoped` (HEAD). |
| `backend/package.json` | config | COMPLETE (as a unit) | Three arcs in one file: `db:bootstrap` script (SSB-2), prisma 6.19.3 and move of `prisma` to devDependencies (SEC-06 remediation), `deepmerge-ts` override. Cannot be split by file. |
| `backend/package-lock.json` | config | COMPLETE | Pairs with `backend/package.json`; must land in the same commit. |
| `package.json` | config | COMPLETE (as a unit) | SEC-02/03/05 remediation: `xlsx` removed, `axios` and `react-router-dom` bumped; `prisma`/`@prisma/adapter-pg`/`@prisma/client` moved to devDependencies; `dotenv` and `pg` moved to devDependencies. |
| `package-lock.json` | config | COMPLETE | Pairs with root `package.json`; 950 changed lines; must land in the same commit. |
| `.env.example` | config | COMPLETE | Adds the `BOOTSTRAP_*` block matching `backend/scripts/bootstrap.ts` (SEC-16/SSB-2). Placeholders only. |
| `backend/.env.example` | config | COMPLETE | New backend template covering the two-role split, test-database guards, HMAC keys, seed and bootstrap variables. Placeholders only. |
| `backend/.gitignore` | config | COMPLETE | Un-ignores `.env.example` so the backend and root templates can stay tracked and in step (SEC-16). |

### Arc K: Dev-OS platform files (33 paths)

| Path | Kind | State | Notes |
|---|---|---|---|
| `AGENTS.md` | tooling | COMPLETE | Dev-OS rules digest. |
| `.agents/memory/decisions/ADR-001-attendpro-delivery-ia.md` | docs | REFERENCE-ONLY | Approved delivery and placement decisions, 2026-10-31. |
| `.agents/memory/handoffs/handoff-2026-10-31-planning.md` | docs | REFERENCE-ONLY | Planning session handoff record. |
| `.agents/memory/handoffs/handoff-2026-11-01-screen-review.md` | docs | REFERENCE-ONLY | Screen-review session handoff record. |
| `.agents/skills/source-command-auto/SKILL.md` through `.agents/skills/source-command-telemetry/SKILL.md` (10 files) | tooling | COMPLETE | Dev-OS slash-command skill definitions. |
| `.codex/agents/*.toml` (19 files: architect, dba, developer, devops, eval-engineer, executive-proxy, memory-manager, orchestrator, pm, qa, release-manager, researcher, security, sre, tech-lead, tech-writer, telemetry, tester, ui-designer) | tooling | COMPLETE | Generated agent persona definitions from `.agents/agents/`. |

### Arc L: design governance documents (16 paths)

| Path | Kind | State | Notes |
|---|---|---|---|
| `DESIGN.md` | docs | COMPLETE | Revision 2026-10-21: declared GOVERNING, Paper and Brass confirmed as the single authority, section 11.3 status palette added as awaiting approval. |
| `docs/DESIGN_PROPOSAL.md` | docs | REFERENCE-ONLY | Marked APPROVED AS SOURCE, superseded by root `DESIGN.md`. |
| `docs/attendpro/DESIGN-PLAN.md` | docs | UNAPPROVED-DESIGN | Screen-level design plan, proposed for owner review, with a 2026-10-31 authority update pointing at the Decision Register section G. |
| `docs/attendpro/LANDING-PAGE-SPEC.md` | docs | UNAPPROVED-DESIGN | Landing acceptance contract; carries the G.4 refinement note. |
| `docs/attendpro/SCREEN-REVIEW.md` | docs | UNAPPROVED-DESIGN | Source-versus-target screen atlas, documentation only. |
| `docs/attendpro/STATUS-PALETTE-PROPOSAL.md` | docs | UNAPPROVED-DESIGN | Measured colour proposal, explicitly not approved and not implemented. |
| `docs/attendpro/INFORMATION-ARCHITECTURE.md` | docs | COMPLETE | Owner-approved final IA, 2026-10-31, with the 2026-11-01 attendance-feedback update. |
| `docs/attendpro/M1-SCREEN-DESIGNS.md` | docs | REFERENCE-ONLY | Supersession note. |
| `docs/attendpro/M1-UI-AUDIT.md` | docs | REFERENCE-ONLY | Supersession note plus landing-gap cross-reference. |
| `docs/attendpro/M1-VISUAL-DESIGN-SYSTEM.md` | docs | REFERENCE-ONLY | Supersession note. |
| `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md` | docs | REFERENCE-ONLY | REC-06 and D-01-to-D-05 supersession notes; `Finest Supermarket, Accra` sample formally retired. |
| `docs/attendpro/M1-MILESTONES-AND-DEPENDENCIES.md` | docs | REFERENCE-ONLY | Supersession note. |
| `docs/attendpro/M1-REVIEW-PACKAGE.md` | docs | REFERENCE-ONLY | Retained as approval history. |
| `docs/attendpro/M8-GAP-REGISTER.md` | docs | COMPLETE | Adds section C: landing gaps L1 through L12 with evidence and gates. |
| `docs/attendpro/M9-SECURITY-REVIEW.md` | docs | REFERENCE-ONLY | Historical snapshot notice. |
| `docs/ATTENDPRO_PRD.md` | docs | COMPLETE | Adds section 0 status classification table (2026-10-27) and corrects the kiosk verification description to QR plus PIN. |

### Arc M: M1 reconciliation notes, staged hunks only (6 paths)

| Path | Kind | State | Notes |
|---|---|---|---|
| `docs/attendpro/M1-ARCHITECTURE.md` | docs | REFERENCE-ONLY | REC-06 status/supersession note. |
| `docs/attendpro/M1-ATTENDANCE-LIFECYCLE.md` | docs | REFERENCE-ONLY | REC-06 note; R10 and M8-R10 status. |
| `docs/attendpro/M1-KIOSK-SECURITY.md` | docs | REFERENCE-ONLY | REC-06 note; R5 PIN policy supersession. |
| `docs/attendpro/M1-API-CONTRACTS.md` | docs | PARTIAL (hunk) | Staged hunk is the REC-06 note. The unstaged part adds P11a schedule endpoints and shiftId-refusal rows that reference the untracked `P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md`; keep it out of the staged commit. |
| `docs/attendpro/M1-ROLE-EXPERIENCES.md` | docs | PARTIAL (hunk) | Staged hunk is the REC-06 note. Unstaged part carries the P11a employee-schedule role paragraphs. |
| `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md` | docs | PARTIAL (hunk) | Same split: staged REC-06 note, unstaged P11a matrix row. |

### Arc N: M10 hardening plan and RLS design (2 paths)

| Path | Kind | State | Notes |
|---|---|---|---|
| `docs/superpowers/plans/2026-10-21-attendpro-m10-release-hardening.md` | docs | COMPLETE | The owner-approved M10 plan that defines SEC-01 through SEC-19 and the pilot gate. It is the spec for Arcs B, C, D and J. |
| `docs/attendpro/M10-RLS-DESIGN.md` | docs | COMPLETE | Documents the implemented restricted-role runtime design (SEC-07), with the REC-04 acceptance note. |

### Arc O: governance records (6 paths)

| Path | Kind | State | Notes |
|---|---|---|---|
| `AUDIT_REPORT.md` | docs | REFERENCE-ONLY | Historical-snapshot notice prepended. |
| `docs/AUTH_DESIGN_PROPOSAL.md` | docs | REFERENCE-ONLY | Historical unapproved proposal notice. |
| `docs/IMPLEMENTATION_PLAN.md` | docs | REFERENCE-ONLY | Delivery pointer plus historical notice. |
| `docs/PROJECT_REQUIREMENTS.md` | docs | REFERENCE-ONLY | Historical draft notice. |
| `docs/CHANGELOG.md` | docs | COMPLETE | Adds the 2026-10-21 correction entry about unsupported viewport-verification claims. |
| `docs/superpowers/plans/2026-10-17-attendpro-m8-portals-landing.md` | docs | REFERENCE-ONLY | Post-approval addendum (2026-10-21) recording the landing reconciliation conditions. |

### Arc P: phased planning and delivery docs (8 paths)

| Path | Kind | State | Notes |
|---|---|---|---|
| `docs/attendpro/MASTER-GAP-REQUIREMENTS.md` | docs | COMPLETE | Owner-approved AP-01 to AP-40 baseline. |
| `docs/attendpro/PHASED-IMPLEMENTATION-PLAN.md` | docs | PARTIAL (hunk) | Staged add is the full plan through P32. Unstaged hunk adds the P11a section and changes P16 DependsOn; commit the staged plan now, the P11a section later together with the untracked P11A design. |
| `docs/attendpro/P05-DETAIL-CONTEXT-CONTRACTS.md` | docs | PARTIAL (hunk) | Staged add still lists `shiftId` in the employee-detail projection; the unstaged hunk corrects it to match HEAD's P11.1 pointer removal. Prefer committing with the unstaged line included. |
| `docs/attendpro/P01-RUNTIME-COMPATIBILITY.md` | docs | COMPLETE | Adds the owner checkpoint approving Node 26.12.1 as the initial runtime. |
| `docs/superpowers/plans/2026-11-01-attendpro-p02-account-recovery.md` | docs | COMPLETE | P02 execution slice plan. |
| `README.md` | docs | COMPLETE | Corrects the stack description (PostgreSQL 16, Prisma 6, kiosk backend implemented and kiosk frontend planned) and documents `db:bootstrap`. |
| `docs/TESTING_GUIDE.md` | docs | COMPLETE | Corrected API paths, PIN-reset one-time visibility note (D-08 unresolved), testing walkthrough updates. |
| `docs/attendpro/DEPLOYMENT-RUNBOOK.md` | docs | COMPLETE | Deployment runbook update including the bootstrap flow and Postgres 16 service container notes. |

## Baseline-failure fix mapping

At HEAD, eight backend tests fail in four files. Reading the staged diffs against the committed code gives the following mapping. No test was run; confidence is reasoning-based and marked per file.

### `backend/tests/unit/shiftDefinitions.contract.test.ts` (3 failures)

- **Failures:** "filters and pages business shifts for HR" and for SUPERADMIN, and "rejects bad list filters and unsafe paging before a database read".
- **Root cause:** the committed `shiftListQuerySchema` in `backend/validators/index.ts` has no `search` key, so `backend/middleware/validate.ts` replaces `req.query` with the stripped parse result and `backend/controllers/shiftController.ts` (which already reads `search` from `req.query` and builds `name: { contains: search, mode: "insensitive" }`) never sees it. `page: Number.MAX_SAFE_INTEGER` also passes the committed schema, and `search: "x".repeat(101)` is stripped instead of rejected, so the 400 expectations fail.
- **Minimal staged fix set:** `backend/validators/index.ts` only, specifically the `shiftListQuerySchema` hunk (search plus the unsafe-page refine).
- **Test-only or code:** requires staged code (the validator hunk). The controller already supports search, so no controller change is needed. The `getMyAttendanceSchema` hunk in the same file belongs to SEC-19, not to this fix, but the file can be committed whole without harm.
- **Confidence:** high. The validate middleware assigns `req.query = result.data`, and the test asserts an exact `where` object containing the name filter.

### `backend/tests/accountEdges.test.ts` (3 failures)

- **Failures:** "rejects a new password equal to the current one", "rejects a new password that fails the policy", "resets a staff PIN and never returns the PIN in the response".
- **Root cause:** HEAD's `backend/controllers/userController.ts` already implements SEC-08 (`return { token: signAccessToken(updated), ... }` at line 309) and SEC-15 (reset-pin returns `{ userId, pinUpdatedAt, pin }` at line 337). The committed test keeps using the stale pre-change `staffToken`, so the two 400-expectation tests receive 401 instead, and the PIN test asserts `pin` is absent when the controller now returns it once.
- **Minimal staged fix set:** `backend/tests/accountEdges.test.ts` only.
- **Test-only or code:** test-only.
- **Confidence:** high. The staged hunk updates `staffToken` from the response and rewrites the PIN assertion to `toMatch(/^\d{4}$/)` with an audit-trail exclusion check.

### `backend/tests/user.test.ts` (2 failures)

- **Failures:** "rejects a still-valid token after deactivation" and "blocks app until temporary credential replaced" (both in the deactivation and forced-change describes).
- **Root cause:** same SEC-08 root: the tests reuse `targetToken` across a change-password call that revokes it at HEAD, so the requests fail with 401 before the assertions about deactivation and the lifted gate can be exercised.
- **Minimal staged fix set:** `backend/tests/user.test.ts` only. The file also adds the SEC-08 revocation describe (four new tests) covering old-claim rejection, self-change revocation, admin reset revocation, and role-change revocation.
- **Test-only or code:** test-only.
- **Confidence:** high.

### `backend/tests/unit/attendanceDetail.contract.test.ts` (collection-level failure)

- **Failure:** the whole file errors before any test runs.
- **Root cause:** at HEAD, `backend/server.ts` mounts `backend/routes/correctionRoutes.ts` at `/api/attendance/corrections`, and that router imports `listMyCorrections` and `getOwnCorrectionDetail` from `backend/controllers/correctionController.ts`. The committed test's `vi.mock` factory for the correction controller did not export those two names, so the route module receives undefined handlers and the suite fails at import.
- **Minimal staged fix set:** `backend/tests/unit/attendanceDetail.contract.test.ts` only (adds the two mock exports and updates the three expectations from 404 to the mocked lanes).
- **Test-only or code:** test-only.
- **Confidence:** high. HEAD's `backend/routes/attendanceRoutes.ts` line 28 contains the `next("router")` fall-through that lets the separately mounted correction router own the prefix, confirming the routes exist.

## Proposed commit groups

Order matters only where noted. Each group is self-consistent with HEAD plus the previously committed groups. Docs and tooling groups are kept separate from code groups. The Dev-OS commit gate requires all commits to go through `.agents/scripts/commit.sh`.

1. **`test(backend): align account, user and attendance-detail suites with committed SEC-08 and SEC-15 behavior`** (3 files: `backend/tests/accountEdges.test.ts`, `backend/tests/user.test.ts`, `backend/tests/unit/attendanceDetail.contract.test.ts`). Rationale: test-only changes that make the existing suite green against HEAD; safest first commit and clears four of the eight baseline failures plus the collection failure.
2. **`fix(security): route kiosk and job lanes through the two-role prisma clients (SEC-07)`** (9 files: `backend/controllers/jobController.ts`, `backend/controllers/kioskDeviceController.ts`, `backend/middleware/kioskAuthMiddleware.ts`, `backend/utils/auditWriter.ts`, `backend/scripts/test-seed.ts`, `backend/scripts/verify-auth.ts` staged hunk, `backend/tests/tenantContext.test.ts`, `backend/tests/tenantLookup.test.ts`, `backend/tests/auth.test.ts`). Rationale: one coherent lane-routing arc; all dependencies (`prismaUnscoped`, `tenantContext`, `tenantLookup`) are at HEAD.
3. **`fix(kiosk): make the PIN lockout cumulative across verification sessions (SEC-13)`** (3 files: `backend/controllers/kioskVerifyController.ts`, `backend/routes/kioskVerifyRoutes.ts`, `backend/tests/kioskVerify.test.ts`). Rationale: self-contained controller rework plus its coverage; no shared files with other groups.
4. **`fix(attendance): validate and apply staff attendance list filters and shift list search (SEC-19)`** (4 files: `backend/validators/index.ts`, `backend/controllers/attendanceController.ts`, `backend/tests/attendance.test.ts`, `src/pages/StaffAttendance.tsx`). Rationale: validator, controller, and tests in one commit; also fixes the remaining three baseline failures in `shiftDefinitions.contract.test.ts` (tracked-clean, so it turns green automatically once the validator lands).
5. **`fix(security): disable production documentation and dev CORS, key the account limiter by network, gate configuration routes (SEC-10/11/12/14)`** (12 files: `backend/server.ts`, `backend/docs/swagger.ts` staged hunk, `backend/tests/security.test.ts`, `backend/tests/swagger.test.ts`, the seven route files `assignmentRoutes.ts`, `calendarRoutes.ts`, `kioskDeviceRoutes.ts`, `policyRoutes.ts`, `qrRoutes.ts`, `shiftRoutes.ts`, `siteRoutes.ts`, `vercel.json`). Rationale: `security.test.ts` spans SEC-12 route coverage and the SEC-10/11/14 server exports, so the server, routes, and tests must land together. `vercel.json` (SEC-09) rides along as config with no code dependency.
6. **`feat(landing): rebuild the landing page to the approved contract with the product walkthrough`** (3 files: `src/pages/Landing.tsx`, `src/components/landing/ProductWalkthrough.tsx`, `src/__tests__/landing.test.tsx`). Rationale: one feature unit governed by `LANDING-PAGE-SPEC.md`. Must land before group 7 because `auth-routing.test.jsx` contains a landing-copy hunk.
7. **`fix(auth-ui): store the fresh token returned by change-password (SEC-08)`** (4 files: `src/utils/auth.ts`, `src/pages/SetPassword.jsx`, `src/pages/Settings.jsx`, `src/__tests__/auth-routing.test.jsx` whole file). Rationale: after group 6, the whole auth-routing file is green; its SEC-08 hunks pair with the two pages and the `updateToken` helper.
8. **`fix(admin-ui): show the reset PIN once, remove dead nav links, reach the pairing-code form (SEC-15/18, M9-B6)`** (3 files: `src/pages/ManageStaff.tsx`, `src/components/Sidebar.tsx`, `src/pages/Devices.tsx`). Rationale: three small screen corrections that depend only on HEAD backend behavior.
9. **`test(frontend): add the M10 coverage ratchet suites`** (4 files: `src/__tests__/admin-flows.test.jsx` including its unstaged mock-success line, `src/__tests__/admin-screens.test.jsx`, `src/__tests__/modal-branches.test.jsx`, `src/test/setup.ts`). Rationale: after groups 6 to 8 the screens these suites drive are in their final staged shape; `admin-flows` also exercises the Devices and ManageStaff fixes. Requires the unstaged `success: true` mock fix to be added to the commit (see surgical notes).
10. **`chore(platform): dependency remediation and the guarded production bootstrap (SSB-2, SEC-06)`** (8 files: `backend/scripts/bootstrap.ts`, `backend/package.json`, `backend/package-lock.json`, `package.json`, `package-lock.json`, `.env.example`, `backend/.env.example`, `backend/.gitignore`). Rationale: the two package files carry both arcs, so they share one commit; lock and manifest pairs stay together. No code group above depends on these versions (the only new import, `ipKeyGenerator`, exists in the already-pinned `express-rate-limit` 8.7.0), so this group can also run last among code groups.
11. **`docs(design): adopt DESIGN.md as governing authority and record the landing and screen review set`** (16 files: `DESIGN.md`, `docs/DESIGN_PROPOSAL.md`, `docs/attendpro/DESIGN-PLAN.md`, `docs/attendpro/LANDING-PAGE-SPEC.md`, `docs/attendpro/SCREEN-REVIEW.md`, `docs/attendpro/STATUS-PALETTE-PROPOSAL.md`, `docs/attendpro/INFORMATION-ARCHITECTURE.md`, `docs/attendpro/M1-SCREEN-DESIGNS.md`, `docs/attendpro/M1-UI-AUDIT.md`, `docs/attendpro/M1-VISUAL-DESIGN-SYSTEM.md`, `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md`, `docs/attendpro/M1-MILESTONES-AND-DEPENDENCIES.md`, `docs/attendpro/M1-REVIEW-PACKAGE.md`, `docs/attendpro/M8-GAP-REGISTER.md`, `docs/attendpro/M9-SECURITY-REVIEW.md`, `docs/ATTENDPRO_PRD.md`). Rationale: the design governance set, staged hunks only.
12. **`docs(governance): add REC-06 supersession notes to the M1 design set`** (6 files: `docs/attendpro/M1-ARCHITECTURE.md`, `docs/attendpro/M1-ATTENDANCE-LIFECYCLE.md`, `docs/attendpro/M1-KIOSK-SECURITY.md`, `docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/M1-ROLE-EXPERIENCES.md`, `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md`, staged hunks only). Rationale: the reconciliation notes are independent of the P11a material left unstaged in three of these files.
13. **`docs(records): mark historical proposals and audits as superseded`** (6 files: `AUDIT_REPORT.md`, `docs/AUTH_DESIGN_PROPOSAL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/PROJECT_REQUIREMENTS.md`, `docs/CHANGELOG.md`, `docs/superpowers/plans/2026-10-17-attendpro-m8-portals-landing.md`). Rationale: provenance notices only.
14. **`docs(m10): add the approved release-hardening plan and the RLS design record`** (2 files: `docs/superpowers/plans/2026-10-21-attendpro-m10-release-hardening.md`, `docs/attendpro/M10-RLS-DESIGN.md`). Rationale: the spec documents for the security commits; landing after the code keeps the record honest about what shipped.
15. **`docs(planning): add the master gap register, phased plan, P01 and P02 slices, and delivery docs`** (8 files: `docs/attendpro/MASTER-GAP-REQUIREMENTS.md`, `docs/attendpro/PHASED-IMPLEMENTATION-PLAN.md` staged add, `docs/attendpro/P05-DETAIL-CONTEXT-CONTRACTS.md` preferably including its unstaged correction line, `docs/attendpro/P01-RUNTIME-COMPATIBILITY.md`, `docs/superpowers/plans/2026-11-01-attendpro-p02-account-recovery.md`, `README.md`, `docs/TESTING_GUIDE.md`, `docs/attendpro/DEPLOYMENT-RUNBOOK.md`). Rationale: planning baseline and user-facing delivery docs.
16. **`chore(devos): add the Dev-OS platform files`** (33 files: `AGENTS.md`, the three `.agents/memory/` records, the ten `.agents/skills/` definitions, the nineteen `.codex/agents/*.toml`). Rationale: tooling with no code dependency; separate from application work.

## Shared-file surgical isolation notes

Five staged files carry hunks from more than one arc, and two of them (plus one doc) have unstaged halves that belong with their staged content.

1. **`backend/docs/swagger.ts` (MM).** Staged: the `setupSwagger(app: Router)` signature change, required by `backend/server.ts` in group 5. Unstaged: three hunks removing `shiftId` from `UserResponse`, `CreateUserRequest`, and `UpdateUserRequest`, which document HEAD's P11.1 pointer removal. The staged hunk belongs to group 5; the unstaged hunks belong to a later P11.1 contract-cleanup commit and must not ride with group 5.
2. **`backend/scripts/verify-auth.ts` (MM).** Staged: the `prismaUnscoped` import switch (SEC-07, group 2). Unstaged: one line, `delete process.env.DATABASE_URL_APP`, which makes the script's owner-connection assumption hold when an app-role URL is set in the environment. Same arc; recommend adding the unstaged line to the group 2 commit rather than leaving it dangling.
3. **`src/__tests__/auth-routing.test.jsx` (M, two arcs).** Hunk 1 (line 159) changes the landing copy assertion and belongs to group 6 (landing). Hunks 2 and 3 (lines 295 onward) assert the fresh token and belong to group 7. Because group 6 precedes group 7 in the proposed order, committing the whole file in group 7 is safe and avoids hunk surgery. Committing it in group 6 would break the SEC-08 assertions until group 7.
4. **`src/__tests__/admin-flows.test.jsx` (AM).** Staged: the full 850-line suite whose shared `paginated` mock lacks `success: true`. Unstaged: the two-line fix adding `success: true`. Screens under test check `data.success` (for example `src/pages/ShiftManagement.tsx` line 162), so the staged state alone likely fails. The unstaged line must be included in the group 9 commit.
5. **`docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/M1-ROLE-EXPERIENCES.md`, `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md` (all MM).** Staged: REC-06 notes (group 12). Unstaged: P11a schedule endpoints, role paragraphs, and matrix rows that reference the untracked `docs/attendpro/P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md`. Keep the unstaged halves out; they should land in a future P11a documentation commit together with that design document.
6. **`docs/attendpro/PHASED-IMPLEMENTATION-PLAN.md` (AM).** Staged add is the complete P01-to-P32 plan (group 15). Unstaged hunk adds the P11a section and changes P16 DependsOn; same future P11a commit as above.
7. **`docs/attendpro/P05-DETAIL-CONTEXT-CONTRACTS.md` (AM).** The staged add still lists `shiftId` in the employee-detail overview row, which contradicts HEAD's P11.1 behavior; the unstaged hunk fixes exactly that line. Recommend including the unstaged line in the group 15 commit so the committed document does not contradict committed code.

## Risks and open questions

1. **Secrets and env templates.** `.env.example`, `backend/.env.example`, and the `backend/.gitignore` change contain placeholders only; no real values found in the staged diffs. The backend template ends without a trailing newline and carries commented-out optional variables. Both templates define `BOOTSTRAP_SUPERADMIN_PASSWORD` style variables whose values must never be filled in committed files. The `.gitignore` now explicitly un-ignores `backend/.env.example`; verify no real `backend/.env` becomes trackable through this change (it does not, since only `.env.example` is negated).
2. **Package.json and lock pairing.** Root `package.json` removes `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, and `dotenv` from dependencies and re-adds `prisma`, the Prisma packages, `pg`, and `dotenv` under devDependencies; `xlsx` is dropped entirely. Backend `package.json` does the same for `prisma` and bumps Prisma to 6.19.3. Both lockfiles must be committed with their manifests. Open question: any production path that imports Prisma at runtime (migrations, seeds, the bootstrap script) now requires devDependencies to be installed on the host; the deployment runbook should be checked against this before the pilot. The `deepmerge-ts` override in the backend manifest has no visible consumer in the staged diffs; confirm it is needed.
3. **`vercel.json`.** The CSP allows `connect-src 'self' https:` and `style-src 'unsafe-inline'`, both deliberate trade-offs worth a second look during security review. The file also fixes a missing trailing newline.
4. **SEC-12 route gating asymmetry.** The staged gate covers shifts, assignments, policies, calendars, sites, kiosk devices, and QR credentials. Route families that already had the gate at HEAD (users, attendance, corrections, audit, reports, help, staff profile and schedule) are unchanged, which is consistent; no contradiction found.
5. **Unfinished or contradictory items.** `backend/.env.example` lacks a trailing newline; `backend/tests/security.test.ts` lacks one as well; `backend/tests/swagger.test.ts` starts with a BOM. The staged `docs/attendpro/P05-DETAIL-CONTEXT-CONTRACTS.md` contradicts HEAD until its unstaged line is included (noted above). The staged `src/__tests__/admin-flows.test.jsx` likely fails without its unstaged line (noted above). The untracked `P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md` is referenced by the staged-file unstaged parts and should be committed with them, not left dangling.
6. **D-08 remains unresolved.** The staged test, controller behavior, and `docs/TESTING_GUIDE.md` all treat the once-shown reset PIN as observed implementation, not approved visibility. The docs are consistent about this; nothing in the staged set should be read as resolving D-08.
7. **Coverage ratchet runtime ordering.** Group 9 depends on groups 6 through 8 for the screens it drives; committing it earlier risks red tests against screens still in their HEAD shape.
8. **Node runtime policy.** `README.md` and `docs/attendpro/P01-RUNTIME-COMPATIBILITY.md` state that the supported runtime policy remains unresolved despite the owner selecting Node 26.12.1 for the initial runtime. CI still selects Node 20. This inconsistency is documented rather than fixed by the staged set.
