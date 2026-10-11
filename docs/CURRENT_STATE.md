# Project State

> This file is maintained by the Orchestrator agent. It is updated at each phase transition to preserve context across long sessions.

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
