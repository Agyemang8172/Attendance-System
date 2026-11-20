# Phase 3 platform recovery record — 2026-11-17

Branch: `codex/attendpro-phased-delivery`. Base: `ed6410c`
(`ed6410c815ad3225b00ff2e45131b70b49122675`). This record is written after the
authorized commit sequence and states only results that were actually committed
and verified. It commits no code; it is the governance record for the recovery.

## 1. Human authorization scope

The owner authorized **conditional sequential commits for Groups 6–9 and Group 11
only**, with Group 10 remaining blocked pending separate approval. Two supporting
commits were authorized explicitly: the minimal test-harness prerequisite required
by Group 6/7, and the backend harness correction (commit only if verified). No
push, deployment, migration, RLS change, P11.2 UI work, or P11a implementation was
authorized or performed. Groups 1–5 were left untouched.

## 2. Commit chain (oldest first, from `ed6410c`)

All commits were made through `.agents/scripts/commit.sh` (Dev-OS human commit
gate; raw `git commit` is blocked). Trees are the exact root tree object SHAs
recorded at commit time.

| Unit | Commit | Tree | Scope |
|---|---|---|---|
| G1 (pre-existing) | `2b8a1649019138213977f11a8dc7de61af5b73dd` | `78496e2ce8977dd02beeb8a632ad2bb0f5b36f53` | Test alignment (Arc E) |
| G2 (pre-existing) | `689f6c194d8a96a90257b258437da1df3c7189c3` | `22c0369368382d4f54c2c4fa7bc17b2b3d566599` | SEC-07 two-role Prisma lane routing |
| G3 (pre-existing) | `a4016bbf0c9d57cf668033eb3ca37c0fdbc6869e` | `26ddde31a256610b3354ddeb4d88847631282732` | SEC-13 cumulative kiosk PIN lockout |
| G4 (pre-existing) | `6c127200323272419e96d38a1ea3c4019ce70463` | `62f9362eec57d81539b7eacb44452634da572dfa` | SEC-19 staff/shift filter validation |
| G5 (pre-existing) | `64a967b64012023b3caf8ef12b016da51da76188` | `29d79eefdcd1dbe428d09a72b583815a7dece504` | SEC-10/11/12/14 + SEC-09 hardening |
| Prerequisite | `c9f4dc557d08ebd2e8c743e3e6c99d7901f51217` | `3395fb2a5f0978af08c94481049d7aef5fc177a1` | JSDOM `localStorage` stub in `src/test/setup.ts` (G6/7 dependency) |
| G6 | `35c682977334471c32cfc036ee445768682e938f` | `e9b9775be478ea6de15aeb376f8ec6c20bf1c492` | Landing page + walkthrough + M8 copy; landing-copy hunk of `auth-routing.test.jsx` |
| G7 | `9c1061e2bebe633d330b2dcf02eeeae88940c035` | `497cd1b44efeee7dc0952a8fc6929f0820d32b8b` | Fresh-token storage + role route guards; fresh-token hunks of `auth-routing.test.jsx` |
| G8 | `8a665dee43c9b7a3da4c6f4b632907a8c85df9fb` | `09a9fbfb3d0afe537287ef640905b30f4193af3a` | Staff management, device scoping, sidebar visibility |
| G9 | `436b27bc200832f669ed4af49a5ca995a514072b` | `170265c12f45bd840cd99f72f8ebea35be5d29b1` | Admin flow, screen and modal coverage suites |
| Harness | `72b6a2b4804172695136319ed81412bc7f0dd9c9` | `af5b093f31aa0ca22273323c88be1715c0bc122a` | Prisma delegate mock-leak correction (test files only) |
| G11 tooling | `405988a694a101e48f2596509b6d73c43428fd53` | `eef501f3f3e7ebdb69c837c3806e825ecc4d2f25` | 33 Dev-OS platform files (Arc K) |

G6/G7 share `src/__tests__/auth-routing.test.jsx`; the two hunks were split by
patch so G6 owns only the landing-copy assertion (`@@ -156`) and G7 owns only the
fresh-token hunks (`@@ -292`, `@@ -303`). The pre-extraction G9 patch hash
`4d0b3e6e…` was superseded by `3850160c…` after `setup.ts` was extracted into the
prerequisite commit; G8's hash `a3aa4206…` is unchanged. The original combined
candidate (61 paths) is preserved as a patch with SHA-256
`165dcad6e8b3254ccfc9af6268d232c0fc53bb05ff2d59fd210288ecd5cafd66` and tree
`5f876fcc346daaa150c57ec6372111dfb23d9917`.

## 3. Full 124-path reconciliation

The snapshot diff `ed6410c..d89133f` contains exactly 124 paths. Every path is
accounted for below; none remain unresolved.

| Category | Count | Paths / justification |
|---|---|---|
| Already committed (G1–G5) | 31 | Entire `git diff --name-only ed6410c 64a967b` set — see §2. |
| Included in an approved commit (G6–G9, prereq, G11 tooling, governance) | 53 | Prereq (1) + G6 (3 + auth-routing) + G7 (3) + G8 (3) + G9 (3) + G11 tooling (33) + governance records (6) + this record set (1). Committed in the units listed in §2 and in the governance commit. |
| Deferred with justification (documentation arcs L/M/N/P) | 32 | Arc L (16) design governance, Arc M (6) M1 reconciliation, Arc N (2) M10 plan/RLS design, Arc P (8) phased planning. All at baseline state in the candidate worktree. Per the classified states, several are REFERENCE-ONLY, UNAPPROVED-DESIGN, or superseded; the remainder are broad documentation arcs explicitly excluded from the human-authorized commit set. They require a separate documentation commit approval. |
| Uncommitted by human decision (G10) | 8 | `backend/scripts/bootstrap.ts`, `backend/package.json`, `backend/package-lock.json`, `package.json`, `package-lock.json`, `.env.example`, `backend/.env.example`, `backend/.gitignore`. Verified per §5 but deliberately left uncommitted. |

31 + 53 + 32 + 8 = 124. The 32 deferred paths were confirmed unchanged in the
candidate worktree (worktree state equals baseline `ed6410c` for modified files,
or the file is absent in both). Two harness files
(`backend/tests/controllerFailures.test.ts`, `backend/tests/controllerGuards.test.ts`)
are outside the 124-path snapshot; they are modifications to already-baseline
files and were committed separately as the verified harness correction.

## 4. Verification evidence

- **Prerequisite necessity:** with baseline `src/test/setup.ts`, the G6/G7 tests
  fail 41 tests (`localStorage is not available because --localstorage-file was
  not provided`); with the staged stub they pass. Log:
  `C:/Users/USER/AppData/Local/Temp/opencode/g67-baseline-setup.log`.
- **G6:** `landing.test.tsx` 12/12.
- **G7:** `auth-routing.test.jsx` 29/29; root `npx tsc --noEmit` exit 0 (the
  baseline `ChangePassword.tsx` `updateToken` error is resolved).
- **G8:** `admin-screens.test.jsx` 32/32.
- **G9:** the three new suites 61/61.
- **Harness:** combined seven-suite P11.2 run 304/304 at commit time; the same
  combined run previously passed 8/8 consecutive times, individual suites passed
  (assignmentLifecycle 25/25, staffSelfService 19/19, controllerFailures 110/110,
  controllerGuards 112/112), and backend `tsc` passed. Evidence:
  `task3-V2-combined-1..8.log`, `task3-ind-*.log`, `task3-tsc2.log`,
  `harness-final-combined.log`. Definitive root cause evidence (`mockRestore()`
  leaves Prisma delegate methods `undefined`): `probe4.log`.
- **Frontend cumulative (pre-commit):** battery 102/102, `vite build` pass
  (~1.08 MB chunk warning), `bash .agents/scripts/ui-taste-check.sh` pass (70 files).
- **G11 review:** no secrets, machine-specific paths, or auto-approve bypasses in
  the 33 platform files. `AGENTS.md` and the agent personas enforce the human
  commit gate (raw `git commit` blocked; all commits via `commit.sh`; human
  approval for heavy dependencies and breaking changes). `devos123` is the
  documented universal dev fixture password, not a secret. No conflicting
  instructions were found. The only anomalies are illustrative obsolete stack
  examples in generic Dev-OS prompts, which do not encode project decisions.

## 5. Group 10 verification (review only — NOT committed)

The 8 G10 paths remain uncommitted. No production bootstrap was run and no
production database connection was made; all checks used placeholder URLs and an
isolated sandbox at `C:/Users/USER/AppData/Local/Temp/opencode/g10-verify`.

- **Clean installs:** `npm ci --dry-run --ignore-scripts` passed for both root
  and backend lockfiles; a real clean `npm ci` passed in the backend sandbox.
- **Runtime deps:** root production install (`--omit=dev`) contains no Prisma,
  `pg`, `dotenv` or `xlsx` (the root is a Vite SPA and needs none at runtime).
  Backend production install keeps `@prisma/client`, `@prisma/adapter-pg`,
  `dotenv`, and `prisma` (the CLI is pulled transitively by `@prisma/client`),
  but not `tsx`.
- **Prisma CLI in CI/deployment:** `.github/workflows/ci.yml` runs `npm ci`
  (devDependencies included) then `npx prisma generate` and
  `npx prisma migrate deploy`; Prisma 6.19.3 is available. There is no deploy
  workflow; deployments are manual per `DEPLOYMENT-RUNBOOK.md`.
- **Schema checks:** `npx prisma validate` passed and `npx prisma generate`
  succeeded without migrations or a database connection. `package.json#prisma`
  emits a Prisma 7 deprecation warning (informational).
- **Override/removals:** the `deepmerge-ts` `^8.0.2` override resolves to 8.0.2 in
  the lock; `xlsx` is absent from the root lock.
- **Bootstrap guards:** with `BOOTSTRAP_CONFIRM` missing, a `_test` database, a
  URL equal to `TEST_DATABASE_URL`, and a URL on `DEV_DB_HOST`, the script failed
  before any DB connection with the expected messages. Password policy accepts a
  strong password and rejects a weak one; bcrypt cost is 12; no code path prints
  a password value. The non-empty-database guard (`--force` required) was
  verified by code inspection, not executed (would require a DB).
- **Env parity:** all ten `BOOTSTRAP_*` keys match across `.env.example`,
  `backend/.env.example`, and `bootstrap.ts`.

**G10 approval requirements:** the owner must separately authorize committing the
dependency category moves, Prisma pin/override, `db:bootstrap` script, and env
template changes; confirm the deployment path installs devDependencies where
`tsx`/`prisma migrate` are invoked; and acknowledge the Prisma 7 deprecation
warning. Until then G10 stays uncommitted.

## 6. Repository state

Main worktree: detached at `ed6410c` (protected recovery point). The
`codex/attendpro-phased-delivery` branch worktree held `64a967b` before this
sequence; the authorized commits were created in the detached Phase 3 worktree
and the branch is fast-forwarded only after final review. `origin/main` remains
`acc0ff5`. Nothing was pushed. Recovery refs and backups from Phase 1 remain
intact (see `PHASE1-GIT-RECOVERY-RECORD-2026-11-16.md`).
