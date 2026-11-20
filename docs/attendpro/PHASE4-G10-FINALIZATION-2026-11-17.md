# Phase 4 Group 10 finalization record — 2026-11-17

Branch: `codex/attendpro-phased-delivery`. Entry point: `9d8407d`. Base of the
whole unpublished range: `origin/main` `acc0ff5`. This record states only what
was verified and committed in this phase. It supersedes the "Group 10 stays
uncommitted" sections of the Phase 3 record; everything else in Phase 3 stands.

## 1. Authorization for this phase

The owner approved the Group 10 dependency-category changes, the Prisma 6.19.3
dependency configuration, the `deepmerge-ts` override, the database bootstrap
script and the environment templates, subject to a final verification. The
documented Prisma 7 deprecation warning was accepted as a future maintenance
concern, not an instruction to upgrade Prisma. No push, deployment, production
database connection, bootstrap execution, migration, RLS change, P11.2 UI or
P11a work was authorized or performed.

## 2. Group 10 commits (two isolated commits)

Both commits were created through `.agents/scripts/commit.sh`. Patch SHA-256 is
the hash of the staged diff; tree is the root tree object at commit time.

| Step | Commit | Tree | Patch SHA-256 | Scope |
|---|---|---|---|---|
| 1 | `016b56c6405ff43b6f5d9a4965d7b7ad793f76da` | `73085f947c000b08527e3d8418c53baf741dda6b` | `28f11ae0973838d433b52271cc7a901e8465f3618a3d8daf53ece72f780fc01f` | Dependency remediation + lockfiles |
| 2 | `268f02cffb34204d462ec30b5f85fe0d2540cdb9` | `08bef3b4fce31893de656145d1b444b43b5360ed` | `05a95f795704969082a12ade190824de24c81de86c328cc08e56f3cce7c1bed7` | Bootstrap script + environment configuration |

The two commits are isolated by ownership, not by necessity. `backend/package.json`
carries both dependency edits and the `db:bootstrap` script line, so commit 1 was
written as the working-tree manifest minus only that one script line (valid JSON,
dependency hunks intact) and commit 2 adds the script line back together with
`bootstrap.ts`. Script lines do not affect the lockfile, so commit 1's lockfiles
are self-consistent on their own; this was confirmed by extracting commit 1's
blobs and running `npm ci --dry-run` for both root and backend. A single atomic
commit was therefore not required.

Commit 1 file scope: root `package.json`, root `package-lock.json`,
`backend/package.json` (dependency hunks only), `backend/package-lock.json`.
Commit 2 file scope: `backend/package.json` (`db:bootstrap` line only),
`backend/scripts/bootstrap.ts`, `.env.example`, `backend/.env.example`,
`backend/.gitignore`.

## 3. Task 1 — final Group 10 verification

Deployment compatibility is confirmed; there is no blocker.

- **CI:** `.github/workflows/ci.yml` runs `npm ci` (devDependencies included) in
  both the frontend and backend jobs, then `npx prisma generate`,
  `npx tsc --noEmit` and `npx prisma migrate deploy` in the backend job. Every
  tool that needs `tsx`, `prisma generate` or `prisma migrate` therefore runs in
  a devDependency-complete install.
- **Deployment:** `DEPLOYMENT-RUNBOOK.md` documents a full checkout then
  `cd backend && npm ci && npx prisma generate && npm run build`, with
  `npx prisma migrate deploy` and the new `npm run db:bootstrap` run from the
  same checkout. There is no `--omit=dev` path in the documented deployment. The
  Vercel target is the Vite frontend only (`vercel.json`: `buildCommand`
  `npm run build`, `outputDirectory` `dist`) and needs no Prisma.
- **Direct declarations (not transitive):** `prisma@6.19.3` and `tsx` are direct
  devDependencies in both root and backend; `@prisma/client`,
  `@prisma/adapter-pg` and `dotenv` are direct backend dependencies. `npm ls
  --depth=0` confirms all are direct. No source file imports `pg`, and the
  frontend bundle imports no Prisma, `dotenv` or `pg` module.
- **Clean install and runtime:** `npm ci` passes for both lockfiles; backend
  production install (`--omit=dev`) keeps `@prisma/client`, `@prisma/adapter-pg`,
  `dotenv` and `express` (runtime) and drops `tsx` (only scripts need it).
  `prisma validate` is valid and `prisma generate` succeeds with a placeholder
  URL, no migration and no database connection.
- **Bootstrap guards:** `assertProductionTarget` reads `DATABASE_URL`. The
  client the script connects with (`prismaUnscoped`) is built from the same
  `DATABASE_URL`, so the guarded target and the actual connection target are
  identical. The guards refuse a missing `BOOTSTRAP_CONFIRM`, a `_test`
  database name, a URL equal to `TEST_DATABASE_URL`, and a `DEV_DB_HOST` target,
  all before any connection. A non-empty business requires `--force`.
- **Secret handling:** passwords are read from the environment, validated by the
  shared `passwordString` policy, hashed with bcrypt cost 12, and never printed;
  the target label is `host:port/database` with no credentials. The new
  `backend/.env.example` documents the five kiosk keys and `JOB_TOKEN`, which
  closes the SEC-16 template gap.
- **Consistency:** root and backend lockfiles are in sync; the `deepmerge-ts`
  override resolves to `8.0.2` in the backend lock; `xlsx` is absent from the
  root lock.

## 4. Task 3 — test reconciliation (305 to 304)

There was no real test-count change. The authoritative P11.2 seven-suite total is
**304**, measured identically before and after the harness correction and present
in every preserved run log (`task3-*.log`, combined and isolated). The "305"
figure in the earlier checkpoint does not match any preserved log or any checked
state and was a transcription error.

The seven suites sum to 304: `assignmentLifecycle` 25, `staffSelfService` 19,
`controllerFailures` 110, `controllerGuards` 112,
`unit/assignmentController.contract` 5, `unit/attendanceAssignment.contract` 2,
`unit/userController.contract` 31. The harness correction (`72b6a2b`) changed
only how Prisma delegates are injected and restored; it added no test, removed no
test, and removed no assertion. Across the whole recovery range the only
test-declaration change anywhere in `backend/tests` is a rename inside
`accountEdges.test.ts` (outside P11.2) that keeps the count and tightens a
security assertion to "the PIN is never written to the audit trail". No business
behaviour, security assertion or required coverage was weakened.

## 5. Task 4 — integrated verification (final committed tip)

- **Frontend tests:** 25 files, 361/361 passed.
- **Backend tests:** 39 files, 843/843 passed against the guarded isolated test
  database (`localhost:5433/attendpro_test`, `test:db:check` confirmed the exact
  target; migrations already applied).
- **Combined P11.2 regression:** 7 files, 304/304 passed.
- **TypeScript:** frontend `tsc --noEmit` exit 0; backend `tsc --noEmit` exit 0.
- **Builds:** frontend `vite build` succeeded (one known `>500 kB` chunk warning);
  backend `tsc` build succeeded and emitted `dist/server.js`.
- **Secret scan:** gitleaks 8.30.1 over the full unpublished range
  (`origin/main..HEAD`, 51 commits): 0 leaks.
- **Git integrity:** `git fsck --full` clean; the chain from local `main`
  (`1804582`) to the tip is 32 linear commits; all three recovery refs resolve to
  their expected SHAs; phase2 worktree clean; the protected Desktop worktree is
  untouched (only its pre-existing untracked docs).

Dependency audit results (documented, not remediated in this phase) are in §7.

## 6. Task 5 — publication preparation

- `docs/TASK_BOARD.md` and `docs/CURRENT_STATE.md` are updated to the committed
  results in the same governance commit that adds this record.
- **Remote conflict check:** `origin` is
  `https://github.com/Agyemang8172/Attendance-System.git`. Only `refs/heads/main`
  (`acc0ff5`) exists on the remote; there is no remote
  `codex/attendpro-phased-delivery`. Publishing creates a new remote branch, no
  overwrite.
- **Exact publication command** (not run):
  `git push -u origin codex/attendpro-phased-delivery`
- **Workflow/deploy triggers:** the only workflow is `.github/workflows/ci.yml`,
  which runs on `pull_request` and on `push` to `main` only. Pushing the feature
  branch runs no workflow; opening the PR runs CI. There is no deploy workflow
  and no in-repo deploy trigger. `vercel.json` is a frontend SPA config; its
  actual deploy triggers live in the Vercel dashboard, so the owner should
  confirm the Vercel project is not set to build preview deployments for this
  branch or to deploy production from it. No backend or database is affected by a
  frontend preview.
- **PR summary:** "Restore and harden the AttendPro platform: secure two-role
  Prisma lanes, kiosk PIN lockout, route/portal fixes and admin coverage, a
  production bootstrap and dependency remediation, plus Dev-OS platform tooling.
  361 frontend tests, 843 backend tests, typechecks and both builds pass."

## 7. Remaining warnings and residual risk

- **Prisma 7 deprecation:** `package.json#prisma` warns that the config will move
  in Prisma 7. Informational; accepted as future maintenance, not an upgrade
  instruction.
- **Dependency advisories:** the audits are not clean. Root: 12 advisories (5
  moderate, 5 high, 2 critical); production-only: 1 high (`follow-redirects` via
  axios). Backend: 14 advisories (10 moderate, 2 high, 2 critical);
  production-only: 8 (6 moderate, 2 high). They fall into three groups:
  - Production, non-breaking fix available (`npm audit fix`): backend
    `body-parser` (DoS via trailing bytes), `fast-uri`, `ip-address`, `qs`; root
    `follow-redirects`.
  - Production, breaking fix only: backend `zod` (memory exhaustion; needs a
    zod 3 to 4 major migration, deliberately out of scope).
  - Dev-only tooling: `vitest`/`tinypool` (critical, dev), `@vitest/*`, `glob`,
    `minimatch`, `test-exclude`, `nodemon`, and the Prisma 6 transitive
    `@prisma/config`. Fixes require vitest 5 or Prisma 7.
  The `deepmerge-ts` advisory is resolved for the backend (override `8.0.2`); it
  remains flagged at root (`7.1.5`, dev-only, transitive) because the override
  was applied to the backend only.
- **Documentation drift:** `DEPLOYMENT-RUNBOOK.md` still states that a production
  bootstrap does not exist and that `backend/.env.example` omits the kiosk keys.
  Both are now out of date relative to the committed Group 10 files. The runbook
  is one of the deferred documentation paths and was intentionally not edited in
  this authorized scope; reconciling it is a recommended follow-up.
- **Frontend bundle:** the `>500 kB` chunk warning is pre-existing and does not
  fail the build.

## 8. Repository state after this phase

- Feature branch `codex/attendpro-phased-delivery` is fast-forwarded to this
  phase's final commit; `origin/main` remains `acc0ff5`; nothing was pushed.
- Recovery refs and Phase 1/2 backups remain intact.
- The protected main worktree stays detached at `ed6410c`. No destructive Git
  operation, push, deployment, migration, RLS change, bootstrap run or production
  database connection was performed.

Publication (push and pull request) remains blocked pending explicit human
go-ahead.
