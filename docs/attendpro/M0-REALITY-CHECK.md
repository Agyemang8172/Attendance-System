# AttendPro M0 — Repository Reality Check

- **Date:** 2026-10-14
- **Baseline commit:** `f87ce1d` on `main`
- **Sources:** AttendPro PRD v1.0 (`docs/ATTENDPRO_PRD.md`) and a fresh read of the
  repository. Every claim below was produced by a command run against the working tree,
  not copied from an earlier report.

This document records what the repository actually contains. It is the first of the two
M0 evidence artefacts; the second is `M0-FORENSIC-RECONCILIATION.md`.

---

## 1. Stack

| Layer | What is present | Evidence |
|-------|-----------------|----------|
| Frontend | React + Vite, Tailwind, `react-router-dom` | `package.json`, `src/App.jsx` |
| Frontend language | Mixed `.jsx` and `.tsx` | `src/pages` holds both |
| Backend | Express + TypeScript, run with `tsx` | `backend/package.json`, `backend/server.ts` |
| ORM | Prisma Client with `driverAdapters` preview | `backend/prisma/schema.prisma` |
| Database | PostgreSQL | `datasource db { provider = "postgresql" }` |
| Backend tests | Vitest + Supertest | `backend/vitest.config.ts` |
| Frontend tests | Vitest + React Testing Library | `vitest.config.ts` |
| Logging | Pino, correlation IDs | `backend/utils/logger.ts` |
| API docs | Swagger at `/api/docs` | `backend/docs/swagger.ts` |

The PRD asks in §21 that this stack be preserved unless architecture review justifies a
change. Nothing in the current tree argues for a change.

## 2. Data model

The schema holds three models and three enums.

- **User** — `employeeCode`, `firstName`, `lastName`, `email`, `password`, `phoneNumber`,
  `role` (default `STAFF`), `department`, `jobTitle`, `isActive`, `profileImageUrl`,
  `mustChangePassword`, `shiftId`, timestamps.
- **Shift** — `name`, `startTime`, `endTime`, `createdAt`. Start and end times are stored
  as strings, with no overnight flag and no active flag.
- **Attendance** — `date`, `clockIn`, `clockOut`, `status` (default `PRESENT`),
  `sessionStatus` (default `OPEN`), `hoursWorked`, `checkInIp`, `checkInLat`,
  `checkInLng`, `remarks`, `userId`, timestamps.

Enums:

- `Role` — `SUPERADMIN`, `HR`, `STAFF`
- `AttendanceStatus` — `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `ON_LEAVE`
- `SessionStatus` — `OPEN`, `CLOSED`

Two facts matter for the PRD:

1. **There is no business or tenant entity.** Every user, shift, and attendance row is
   global. PRD §5 requires each record to carry a business owner and every query to
   enforce it.
2. **Attendance is bound to `User` with `ON DELETE CASCADE`.** Deleting a user deletes
   their attendance history. PRD §17 says cascading deletes must not erase historical
   attendance.

## 3. Migration history

One migration: `20261005000000_init`. It creates `users`, `shifts`, and `attendances`,
their indexes, and two foreign keys. A search of the migration tree for
`ROW LEVEL SECURITY` returns nothing. There are no RLS statements, and no Supabase or
policy layer.

## 4. API surface

Routes are mounted in `backend/server.ts`:

| Mount | Router | Purpose |
|-------|--------|---------|
| `/api/users` | `userRoutes.ts` | user management |
| `/api/auth` | `authRoutes.ts` | login, password change |
| `/api/attendance` | `attendanceRoutes.ts` | clocking and attendance reads |

Attendance endpoints:

| Method | Path | Guard | Notes |
|--------|------|-------|-------|
| POST | `/api/attendance/clock-in` | auth + password-change gate | any authenticated role |
| POST | `/api/attendance/clock-out` | auth + password-change gate | any authenticated role |
| GET | `/api/attendance/my-attendance` | auth | own records |
| GET | `/api/attendance/all-attendance` | auth + `SUPERADMIN`/`HR` | no business scope |
| PATCH | `/api/attendance/:id/dismiss-alert` | auth | stores state in `remarks` |

There is no kiosk route, no QR route, no OTP route, and no background job.

## 5. Frontend surface

Routes registered in `src/App.jsx`:

| Path | Screen | Guard |
|------|--------|-------|
| `/login` | `Login.tsx` | public |
| `/set-password` | `SetPassword.jsx` | password-change gate |
| `/dashboard` | `Dashboard.tsx` | STAFF |
| `/profile` | `Profile.tsx` | authenticated |
| `/schedule` | `Schedule.jsx` | authenticated |
| `/hr-dashboard` | `HrDashboard.tsx` | HR |
| `/superadmin-dashboard` | `SuperAdminDashboard.jsx` | SUPERADMIN |
| `/manage-staff` | `ManageStaff.jsx` | HR/SUPERADMIN |
| `/settings` | `Settings.jsx` | SUPERADMIN |
| `/` | `AuthenticatedHome` | redirect |

There is no public landing page. The root path sends an unauthenticated visitor to
`/login`, so PRD §6 (public dashboard-style preview) has no screen today.

The app carries nine page components. The PRD names screens that have no component yet:
attendance corrections, help requests, shift management, scheduling, attendance
policies, kiosk management, reports, audit log, and a kiosk interface.

## 6. Behaviour of the clocking code

`backend/controllers/attendanceController.ts`:

- `clockIn` writes `status: "PRESENT"` as a literal. No status is computed from a shift,
  a grace rule, or the clock time. PRD §12 requires the backend to calculate status from
  configured rules.
- `clockIn` reads an open session with `findFirst`, then creates a row in a separate
  statement. Two simultaneous requests can both pass the read and both create a row, so
  one employee can hold two open sessions. PRD §17 asks for a constraint or transaction
  that prevents this.
- Every handler returns `error.message` in the 500 body. PRD §20 asks for safe error
  messages.
- `getAllAttendance` filters by date, user, department, session, and status. It has no
  business filter, because no business column exists.

## 7. Tests

| Suite | Location | Count |
|-------|----------|-------|
| Backend | `backend/tests/*.test.ts` | `attendance`, `auth`, `security`, `user` |
| Frontend | `src/**/*.test.{js,jsx,ts,tsx}` | 7 files |

`backend/tests/setup.ts` sets `NODE_ENV=test` and `PORT=0` and nothing else. It does not
point `DATABASE_URL` at a separate test database. `backend/vitest.config.ts` describes
the suite as "integration tests against one local database". `backend/tests/fixtures.ts`
upserts three real user accounts. Taken together, the backend suite writes to whichever
database `DATABASE_URL` names, which is the development database. PRD §22 item 4 asks
this question directly, and the answer is that the tests can modify and delete records.

## 8. Build and type checking

| Command | Result |
|---------|--------|
| `backend`: `npx tsc --noEmit` | exit 0, no errors |
| root: `npx tsc --noEmit` | 43 errors across 7 files |
| root: `npm run build` | not re-run this session (Vite build) |
| root: `npm run lint` | not re-run this session |

The 43 frontend errors sit in `src/pages/Dashboard.tsx` (17), `src/pages/Profile.tsx`
(18), `src/pages/HrDashboard.tsx` (4), `src/api/axios.ts` (1), `src/components/Layout.tsx`
(1), `src/components/Sidebar.tsx` (1), and `src/pages/Login.tsx` (1). Neither package
defines a `typecheck` script, so nothing in CI or the commit hook runs `tsc` today. The
PRD §19 rule that a feature is not complete until it is tested applies here: the frontend
does not currently pass a type check.

## 9. Git state

- **Root repository:** branch `main`, clean working tree, 6 commits ahead of
  `origin/main`, none pushed.
- **Nested repository:** `backend/.git` exists. It is a second Git repository inside the
  backend directory.

The nested repository is treated as a preservation question in the forensic
reconciliation, not cleaned up here. PRD §22 item 6 requires inspection before any
cleanup.

## 10. Dev-OS gates

All Layer 2 and Layer 3 scanners run from the maintained (Windows-safe) versions.
`db-check.sh` fails closed and, against the current migration, reports `users`, `shifts`,
and `attendances` as created without RLS. `ui-taste-check.sh` passes over the 24 frontend
files. `env-check.sh` passes with the six environment variables documented in
`.env.example`.

---

## Coverage summary

| PRD area | Present today | Gap |
|----------|---------------|-----|
| Public preview (§6) | none | screen, API |
| Staff dashboard (§7) | partial: `Dashboard`, `Profile`, `Schedule` | schedule/off-days model, help, corrections |
| HR dashboard (§8) | `HrDashboard` | status calc, exceptions, reports |
| SUPERADMIN settings (§9) | `Settings`, `ManageStaff` | shifts, policies, kiosk, audit |
| Kiosk (§10) | none | whole subsystem |
| Shifts and scheduling (§11) | `Shift` model (name, start, end) | overnight, active flag, assignment UI |
| Status and punctuality (§12) | `AttendanceStatus` enum | rule engine, policy versions |
| Automatic clock-out (§13) | none | job, settings |
| Help and corrections (§14) | none | two workflows |
| Employee management (§15) | `userController` | business scope, deactivate rules |
| SMS recovery (§16) | none | provider, recovery flow |
| Data model (§17) | 3 models | 8 of 11 entities missing |
| API (§18) | 3 areas | 8 of 11 areas missing |
| Security and privacy (§20) | auth, RBAC, hashing | tenant isolation, kiosk auth, OTP |

The next artefact, `M0-FORENSIC-RECONCILIATION.md`, re-verifies each finding the PRD
§22 lists and records where the PRD and the current code diverge.
