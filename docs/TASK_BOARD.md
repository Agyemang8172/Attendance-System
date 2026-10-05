# Dev-OS Task Board & DAG Workflow State

> Single source of truth for active task execution, dependencies, and gating status.
> Maintained by the **Orchestrator** agent.

---

## Workflow State Columns

```
[ BACKLOG ] ➔ [ QUEUED ] ➔ [ IN_PROGRESS ] ➔ [ PARALLEL_GATE ] ➔ [ HUMAN_CHECKPOINT ] ➔ [ DONE ]
                                                    │
                                           ┌────────┼────────┐
                                           ▼        ▼        ▼
                                          QA     TESTER   SECURITY
```

---

## Active Board

### [ IN_PROGRESS ] — HUMAN ACTION REQUIRED
- **`TASK-201`**: Rotate Leaked MongoDB Credentials
  - **Assignee:** Human (Security)
  - **DependsOn:** None
  - **Triage Level:** CRITICAL
  - **ParallelGate:** [QA: pending, Tester: pending, Security: in_progress]
  - **HumanCheckpoint:** pending
  - **Action:** MongoDB Atlas → Database Access → Edit user "Godfred" → Change Password

- **`TASK-202`**: Provision PostgreSQL & Run Migrations
  - **Assignee:** Human + DBA
  - **DependsOn:** None
  - **Triage Level:** CRITICAL
  - **ParallelGate:** [QA: pending, Tester: pending, Security: pending]
  - **HumanCheckpoint:** pending
  - **Action:** Provision DB → Set DATABASE_URL in backend/.env → `npm run prisma:migrate`

- **`TASK-203`**: Seed Initial Data
  - **Assignee:** DBA
  - **DependsOn:** TASK-202
  - **Triage Level:** HIGH
  - **ParallelGate:** [QA: pending, Tester: pending, Security: pending]
  - **HumanCheckpoint:** pending
  - **Action:** `npm run db:seed` (prisma/seed.ts ready)

### [ DONE ] — Completed This Session (No DB Required)

#### Code Fixes (Developer)
- **`TASK-215`**: Fix SessionsChart Component → PieChart with OPEN/CLOSED/LATE
  - **Artifacts:** `src/components/charts/SessionsChart.jsx` rewritten
- **`TASK-216`**: Fix SuperAdminDashboard Status Enums (OPEN/CLOSED/LATE)
  - **Artifacts:** `src/pages/SuperAdminDashboard.jsx` - added `normStatus()` helper, fixed 5 comparisons
- **`TASK-217`**: Fix Settings Role Display - Already correct (uppercase from backend)
  - **Status:** Verified - no changes needed
- **`TASK-218`**: Fix Schedule Page Status Enums
  - **Artifacts:** `src/pages/Schedule.jsx` - updated `getDayStatus()` to normalize sessionStatus
- **`TASK-219`**: Fix Profile Badge Logic - Already correct (uses 'CLOSED')
  - **Status:** Verified - no changes needed

#### Infrastructure (DevOps + Developer)
- **`TASK-210`**: Structured Logging (Pino + Correlation IDs)
  - **Artifacts:** `backend/utils/logger.ts`, updated `backend/server.ts`, `backend/middleware/authMiddleware.ts`
  - **Features:** Request correlation IDs, structured logging, audit log helpers, slow request detection
- **`TASK-211`**: Swagger/OpenAPI Documentation
  - **Artifacts:** `backend/docs/swagger.ts`, integrated in `server.ts`
  - **Available at:** `/api/docs` (Swagger UI), `/api/docs.json` (raw spec)
- **`TASK-213`**: Error Boundary Integration
  - **Status:** Already exists at `src/components/ErrorBoundary.jsx` - ready to wrap App
- **`TASK-214`**: Clean Up Dead Code
  - **Action Items:** Remove SessionsChart duplicate ✅, unused files pending

### [ QUEUED ] — READY WHEN DB LIVE
- **`TASK-204`**: Backend Unit & Integration Tests (Vitest + Supertest)
- **`TASK-205`**: Frontend Unit Tests (Vitest + React Testing Library)
- **`TASK-206`**: E2E Tests (Playwright)

### [ QUEUED ] — CAN START NOW
- **`TASK-207`**: DESIGN.md via UI Designer (`/design` command)
- **`TASK-208`**: Anti-AI UI Audit (`ui-taste-check.sh`)
- **`TASK-209`**: Humanizer Documentation Audit (`humanize-check.sh`)

### [ BACKLOG ]
- **`TASK-212`**: GitHub Actions CI/CD Pipeline
- **`TASK-220`**: TESTING_GUIDE.md
- **`TASK-221`**: LESSONS.md Update
- **`TASK-222`**: CURRENT_STATE.md Final

---

## Completed — Architecture Migration

### [ DONE ] — Phase 1 Complete
- **`TASK-100`** through **`TASK-109`**: MongoDB→Prisma migration complete
  - All 27+ files migrated, TypeScript compiles ✅, Vite builds ✅

---

## Task Card Schema
```markdown
### TASK-XXX: [Title]
- **Assignee:** [Orchestrator | Developer | QA | Tester | Security | DevOps | DBA]
- **DependsOn:** [List of prerequisite TASK IDs]
- **Triage Level:** [TRIVIAL | STANDARD | CRITICAL]
- **ParallelGate:** [QA: pass/fail/pending, Tester: pass/fail/pending, Security: pass/fail/pending]
- **HumanCheckpoint:** [pending | approved]
- **Artifacts:** [List of PRs, commits, or files modified]
```