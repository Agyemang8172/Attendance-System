# Dev-OS Task Board & DAG Workflow State

> Single source of truth for active task execution, dependencies, and gating status.
> Maintained by the **Orchestrator** agent.
> Refreshed at stage 4 on 2026-10-06. Evidence lives in `docs/CURRENT_STATE.md`.

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

## Gate Rules In Force

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
