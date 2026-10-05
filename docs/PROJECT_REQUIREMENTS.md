# Project Requirements — AttendPro Attendance System

> Generated with the Dev-OS `project-requirements` skill.
> Review, edit, and approve this document before handing it to the Orchestrator for execution.

## 1. Executive Summary

AttendPro is a browser-based attendance system for a small organization. Staff sign in and record the start and end of their workday. HR and superadmins review those records, manage staff accounts, and read aggregated hours and session counts. The product replaces informal or paper tracking with records that can be audited later.

The system runs locally today against PostgreSQL. Sign-in, forced password change, role enforcement, clock-in, clock-out, and reporting were verified end to end on 2026-10-05 with 13 of 13 API checks passing on the compiled build. This document records what the code actually does, the decisions behind it, and the work left before deployment.

## 2. Core Workflows (The Happy Path)

### 2.1 Sign in and first-time password change
A user submits email and password at `/login` and receives a JWT valid for 24 hours. Accounts created by the seed and by user creation carry `mustChangePassword = true`, so the client routes the user to `/set-password`. `PUT /api/users/change-password` verifies the current password, hashes the new one, and sets the flag to false. The client then sends the user to the dashboard matching their role: `/dashboard` for STAFF, `/hr-dashboard` for HR, `/superadmin-dashboard` for SUPERADMIN.

### 2.2 Clock in and clock out
An authenticated staff member on `/dashboard` starts a session. The server rejects a second open session for the same user, then creates an `Attendance` row with `sessionStatus = OPEN`, `status = PRESENT`, the clock-in timestamp, and optionally the device IP and coordinates. Ending the session finds the open row, computes `hoursWorked` as the difference between clock-in and clock-out in hours, sets `sessionStatus = CLOSED`, and stores the result.

### 2.3 Review attendance
HR and superadmins call `GET /api/attendance/all-attendance`, which joins the owning user and filters by date range, user, department, session status, and attendance status. Staff call `GET /api/attendance/my-attendance`, which returns only their own rows. Both paginate.

### 2.4 Manage staff accounts
A superadmin at `/manage-staff` creates an account through `POST /api/users`. The server generates an employee code and a temporary password, hashes the latter, and returns `tempPassword` in the response so the admin can pass it on. HR and superadmins may edit a user with `PUT /api/users/:id`. A superadmin deactivates with `DELETE /api/users/:id`, which is a soft delete: `isActive` becomes false and the account can no longer sign in.

### 2.5 Clock-out reminder on the staff dashboard
The staff dashboard scans its own records for sessions the system is expected to close automatically and shows a warning toast asking the user to review the record. Section 10 records why this path never fires in the current build.

## 3. Architecture & Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 3, React Router 7, axios, Recharts, xlsx, react-hot-toast, react-icons |
| Backend | Express with TypeScript, Zod validation at the route boundary, Swagger UI at `/api/docs` |
| Data | PostgreSQL through Prisma ORM 6.14 with the `PrismaPg` driver adapter |
| Auth | JWT signed with `JWT_SECRET`, bcrypt hashing at cost 10 |
| Roles | `STAFF`, `HR`, `SUPERADMIN`, enforced by `authorizeRole(...)` on each route |
| Logging | Pino with child loggers per domain, correlation IDs, request logging, slow-request warnings |
| Build | `tsc` to `dist/`, generated client copied into `dist/generated` |
| API base | `VITE_API_URL` on the client; `PORT`, `CORS_ORIGIN`, `NODE_ENV` on the server |

### Request pipeline

`correlationIdMiddleware` → `requestLogger` → `express.json({ limit: "10kb" })` → CORS → rate limiter → routes → error handler.

The general limiter allows 100 requests per IP per 15 minutes. The login route sits behind a stricter bucket of 10 attempts over the same window. The CORS handler rejects an origin outside the allowlist with 403.

### Data model

`User` holds identity, role, department, job title, `isActive`, `mustChangePassword`, an optional `shiftId`, and timestamps. `Shift` holds a name plus start and end times, and one shift may be assigned to many users. `Attendance` belongs to one user through a cascading foreign key and holds the date, clock-in and clock-out timestamps, `status`, `sessionStatus`, `hoursWorked`, optional IP and coordinates, and free-text `remarks`.

Indexes exist on `users(email)`, `users(employee_code)`, `users(department)`, `users(is_active)`, `attendances(user_id)`, `attendances(date)`, `attendances(session_status)`, and the composite `attendances(user_id, date)`.

Enums: `Role { SUPERADMIN, HR, STAFF }`, `AttendanceStatus { PRESENT, ABSENT, LATE, HALF_DAY, ON_LEAVE }`, `SessionStatus { OPEN, CLOSED }`.

### Seed data

One superadmin, one HR account, five staff accounts, and two shifts: Morning (06:00 to 14:00) and Afternoon (14:00 to 22:00). Passwords are read from `SUPERADMIN_PASSWORD`, `HR_PASSWORD`, and `STAFF_PASSWORD` at seed time and are never written to the repository. Every seeded account has `mustChangePassword = true`.

## 4. API Contract

Every route below is prefixed `/api` and validated by Zod before the controller runs.

| Method | Path | Roles allowed | Validation | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | public | `loginSchema` | Returns token and user |
| GET | `/users` | SUPERADMIN, HR | `getUsersQuerySchema` | `page`, `limit` (max 100, default 10), `search`, `department`, `role`, `isActive` |
| POST | `/users` | SUPERADMIN | `createUserSchema` | Generates employee code and `tempPassword` |
| PUT | `/users/change-password` | any authenticated | `changePasswordSchema` | New password minimum 8 characters |
| GET | `/users/:id` | SUPERADMIN, HR, STAFF | `getUserByIdSchema` | UUID required |
| PUT | `/users/:id` | SUPERADMIN, HR | `updateUserSchema` | Partial body |
| DELETE | `/users/:id` | SUPERADMIN | `deleteUserSchema` | Soft delete via `isActive` |
| POST | `/attendance/clock-in` | any authenticated | `clockInSchema` | Optional IP and coordinates |
| POST | `/attendance/clock-out` | any authenticated | `clockOutSchema` | Computes `hoursWorked` |
| GET | `/attendance/my-attendance` | any authenticated | `getMyAttendanceSchema` | Date range, `page`, `limit` default 50 |
| GET | `/attendance/all-attendance` | SUPERADMIN, HR | `getAllAttendanceSchema` | Date range, `userId`, `department`, `sessionStatus`, `status`, pagination |
| PATCH | `/attendance/:id/dismiss-alert` | any authenticated (no role guard) | `attendanceIdSchema` | Scoped to the caller's own rows |
| GET | `/health` | public | none | Reports database reachability |

`GET /users/:id` is defined and unused by the client. There is no logout endpoint; logout clears `localStorage` on the client. There is no password-reset flow.

## 5. Domain Rules

- One open session per user at a time. A second clock-in returns 400.
- `hoursWorked` is derived, not entered. It is written only at clock-out.
- Passwords are hashed with bcrypt cost 10 and never logged.
- Soft delete is the only form of user removal, so historical attendance rows keep their owner.
- `Attendance.userId` cascades on delete, though deletion is never used in practice.
- Employee codes are generated sequentially and enforced unique by the database.
- `mustChangePassword` gates the first session and clears on a successful password change.

## 6. Frontend Surface

| Route | Access | Page | API calls |
|---|---|---|---|
| `/login` | public | `Login.tsx` | `POST /auth/login` |
| `/dashboard` | STAFF | `Dashboard.tsx` | clock-in, clock-out, my-attendance, dismiss-alert |
| `/hr-dashboard` | HR, SUPERADMIN | `HrDashboard.tsx` | all-attendance |
| `/superadmin-dashboard` | SUPERADMIN | `SuperAdminDashboard.jsx` | all-attendance, `GET /users?limit=1` |
| `/manage-staff` | SUPERADMIN | `ManageStaff.jsx` | `GET /users`, `DELETE /users/:id` |
| `/profile` | any authenticated | `Profile.tsx` | my-attendance |
| `/schedule` | STAFF | `Schedule.jsx` | my-attendance |
| `/settings` | any authenticated | `Settings.jsx` | `PUT /users/change-password` |
| `/set-password` | any authenticated | `SetPassword.jsx` | `PUT /users/change-password` |

`App.jsx` enforces three guards: `ProtectedRoute` for any authenticated user, an HR guard allowing HR and SUPERADMIN, and a SUPERADMIN guard. The sidebar filters its items by role and shows Dashboard (STAFF), HR Dashboard (HR, SUPERADMIN), My Profile (all), My Schedule (STAFF), Settings (all), Manage Staff (SUPERADMIN), and Logout.

Shared components: `Layout`, `Sidebar`, `ErrorBoundary`, `KpiCard`, `StatBadge`, `AttendanceTable`, `StaffTable`, `AddEmployeeModal`, `EditEmployeeModal`, `HoursChart`, `SessionsChart`.

Tokens are held in `localStorage` under `token` and `user`. `utils/auth.ts` exposes `login`, `logout`, `isAuthenticated`, `getCurrentUser`, and `getToken`. An interceptor attaches the bearer token and, on a 401, clears storage and returns the user to `/login`.

## 7. Edge Cases & Error Handling

| Scenario | Behaviour in the build |
|---|---|
| Wrong password at sign-in | 401; the response does not reveal whether the account exists |
| Missing email or password | 400 with a field-level message |
| Staff member calls an admin route | 403 |
| Missing or expired token | 401; client clears storage |
| Second clock-in while a session is open | 400 with `You already have an active session open` |
| Clock-out with no open session | 400 |
| Database unreachable | `GET /api/health` returns 503 |
| Origin outside the CORS allowlist | 403 `Origin not allowed` |
| Body larger than 10kb | 413 from the JSON parser |
| Rate limit exceeded | 429 with a standard message |
| Duplicate employee code or email | Rejected by a unique constraint |
| Malformed UUID in a path parameter | 400 from Zod before the controller runs |
| Unhandled controller error | Pino logs it with the correlation ID and returns a generic 500 |

## 8. Non-Functional Requirements

**Performance.** Sign-in and attendance reads should return within 300 ms under local conditions. Pagination defaults keep response sizes bounded: 10 rows for users, 50 for attendance.

**Security.** Each admin route declares its allowed roles. Passwords are hashed and never logged. Secrets come from environment variables and `.env` is excluded from version control. Gitleaks, environment parity, migration safety, UI taste, and humanizer checks run before every commit.

**Compatibility.** The backend must run on Node 23 with the Prisma driver adapter. The native and binary engines do not start on that version, and the generated client is imported directly from `../generated/prisma` rather than through the `@prisma/client` wrapper. Both constraints apply in continuous integration.

**Observability.** Every request carries a correlation ID through the request logger and the error handler. Pino uses child loggers for the auth, attendance, user, and database domains. Slow requests are logged with a warning.

## 9. System Design Decisions

| Decision | Where it lives | What forced it |
|---|---|---|
| Prisma driver adapter with `PrismaPg` | `backend/prisma/schema.prisma`, `backend/config/prismaClient.ts` | Node 23 hangs with the native engine |
| Generated client imported directly | `../generated/prisma/index.js` in controllers, routes, and seed | The `@prisma/client` wrapper re-export is unavailable |
| Prisma 6.14 rather than 7 | `backend/package.json` | Prisma 7 does not support Node 23 |
| Zod at the route boundary | `backend/middleware/validate.ts` | Rejects malformed input before a controller runs |
| Role middleware per route | `backend/middleware/roleMiddleware.ts` | Keeps authorization next to the route definition |
| Soft delete for users | `isActive` plus the login check | Preserves historical attendance ownership |
| Derived `hoursWorked` | `attendanceController.clockOut` | Prevents self-reported hour inflation |
| Employee code generated server-side | `userController.generateEmployeeCode` | Removes a field from the create form |
| Temporary password returned on create | `userController.createUser` | The admin hands the credential to the new user in person |
| Single-open-session enforcement | `clockIn` and `clockOut` queries | Avoids overlapping rows for one person |
| Composite index on user and date | `schema.prisma` | The main dashboard query filters on both |
| Correlation ID before routing | `server.ts` line 18 | Errors must be traceable from the first middleware |
| Client-side logout only | `utils/auth.ts` | No refresh-token rotation exists, so a server-side denylist adds nothing |
| Alert state written into `remarks` | `attendanceController.dismissAlert` | No dedicated column exists; see section 10 |
| Two shifts, Morning and Afternoon | `backend/prisma/seed.ts` | Product decision recorded in section 12 |
| Hosted database and deploy target | Section 12 | Product decisions recorded below |

## 10. Known Issues

These are defects found during the scan. They are recorded here so the Orchestrator can turn them into tasks instead of documenting them as working behaviour.

| # | Issue | Evidence |
|---|---|---|
| 1 | Shifts are unreachable. The model, seed, and `shiftId` field all exist, but no shift endpoint, controller reference, or UI field exists anywhere. `grep -c shift` over `src/`, `routes/`, and `controllers/` returns 0. | `backend/prisma/schema.prisma`, no `routes/shiftRoutes.ts` |
| 2 | Seeded shift IDs are not UUIDs (`shift-morning`), while both `createUserSchema` and `updateUserSchema` require `shiftId` to be a UUID. Even if a client sent a real seeded ID, Zod would reject it. | `seed.ts:46-48` against `validators/index.ts:19,35` |
| 3 | `dismissAlert` is scoped to `where: { id, userId }` and has no role guard, so it only ever matches the caller's own record. HR and superadmins receive 404 on a staff record, which makes the documented alert-clearing workflow unusable for managers. | `attendanceController.ts:265-272`, `attendanceRoutes.ts` |
| 4 | `alertDismissed` and `autoClosedOut` are declared on the frontend `AttendanceRecord` type but are never produced by the backend. The staff dashboard filters on `autoClosedOut === true && alertDismissed === false`, so that branch can never run. Dismissal is stored by appending `alert_dismissed:<timestamp>` to `remarks`, which the API does not read back as a flag. | `src/types/index.ts` against `attendanceController.ts:276-283`, `Dashboard.tsx:55` |
| 5 | No auto-close job exists. The toast text claims the system clocked the user out at 11:59 PM, but no scheduler, cron, or `setInterval` runs in the backend, so sessions left open stay open indefinitely. | `grep` for `setInterval|cron|autoClose` returns nothing |
| 6 | The late threshold is hardcoded to 06:30 in `Schedule.jsx`, independent of the Morning shift start of 06:00 and independent of the database. | `Schedule.jsx:11-14` |

### Triage decisions

| Issue | Decision |
|---|---|
| 1, 2 | Build shift management. A `/api/shifts` endpoint and a UI to create shifts and assign them to staff become a feature slice. The non-UUID seed ID in issue 2 must be resolved inside that slice, because a UUID-only validator cannot reference `shift-morning`. |
| 3 | Accepted as designed. `dismissAlert` stays scoped to the caller's own records and is not widened to HR and SUPERADMIN. |
| 4, 5 | Build the auto-close job. Sessions left open are closed by the system, which also gives `autoClosedOut` and `alertDismissed` real values to return. |
| 6 | Open. No decision recorded yet. |

## 11. Delivery Roadmap: Current State → Future State

| # | Area | Current state | Future state | Dev-OS stage |
|---|---|---|---|---|
| 1 | Requirements | This document | Approved by the Owner | inception |
| 2 | Design | No root `DESIGN.md`; frontend work is gated | Root `DESIGN.md` with archetype tokens | design |
| 3 | Task tracking | `TASK_BOARD.md` and `CURRENT_STATE.md` still report branch `main` and an unprovisioned database | Board reflects the applied migration, seeded data, and the current branch | tasks |
| 4 | Seed data | Three shifts including Night | Two shifts, Morning and Afternoon. Complete. | implementation |
| 5 | Backend | Working, verified at 13 of 13 checks | Covered by automated tests | implementation, tests |
| 6 | Frontend | Builds clean, focus indicators fixed | Covered by component and end-to-end tests | tests |
| 7 | Known issues | Six defects recorded in section 10, triage decided | Issues 1, 2, 4, 5 resolved by the two slices below; issue 3 accepted; issue 6 still open | tasks |
| 8 | Shift management | Shifts exist as data only, unreachable through any endpoint or screen | `/api/shifts` with create, list, and assignment; a screen at `/manage-staff` or its own route | feature slice E |
| 9 | Auto-close job | No scheduler; sessions left open stay open and the dashboard reminder never fires | Scheduled close with `autoClosedOut` and `alertDismissed` returned by the API | feature slice F |
| 10 | Test guide | Absent | `docs/TESTING_GUIDE.md` with walkthroughs and seed accounts | testing-guide |
| 11 | QA | Waiting on `DESIGN.md` | Design gate and standards audit completed | qa |
| 12 | Security | Gitleaks clean, role checks verified; older MongoDB credentials remain in git history and are not release-blocking | History purged and rotation recorded in the OWASP review | security |
| 13 | Continuous integration | None | Pipeline runs build plus the five gates and applies migrations | release |
| 14 | Deployment | Local only | Prisma Postgres as the hosted database, frontend and API on Vercel | release |

## 12. Product Decisions

Recorded from the Owner on 2026-10-05.

| Question | Decision |
|---|---|
| Seed shifts | Two only: Morning and Afternoon. Night is removed. |
| Hosted database | Prisma Postgres |
| Deployment target | Vercel |
| Logout endpoint and password-reset flow | Out of scope for now. The Owner is not certain and wants it revisited. |
| Does rotating the leaked MongoDB credentials block release? | No. It is tracked under security but does not gate a release. |
| Who signs off at human checkpoints | The Owner |

### Build sequencing

Slices are delivered one at a time, each with its own test pass, QA gate, checkpoint, commit, and push. No slice starts before the previous one is pushed.

| Slice | Scope |
|---|---|
| A | Authentication and role enforcement |
| B | Attendance sessions, clock-in and clock-out |
| C | User management and staff records |
| D | Reporting and dashboards |
| E | Shift management: endpoint, assignment, and screen (issues 1 and 2) |
| F | Auto-close job for open sessions (issues 4 and 5) |

## 13. Open Questions for Human Review

Resolved on 2026-10-05 and recorded in sections 10, 11, and 12: the `shift-night` row was deleted from the local database; shifts get a management screen and API; `dismissAlert` is not widened beyond the caller's own records; an auto-close job will be built; and slice A is authentication and role enforcement.

> [!WARNING]
> The Architect Agent could not deduce the following. Please fill these in:
- [ ] Issue 6, the hardcoded 06:30 late threshold: should it read the assigned shift's start time from the database, or be removed entirely?
- [ ] Confirm whether `/manage-staff` gains shift assignment inside its existing modals, or shifts get their own route.
- [ ] Confirm that issue 6 blocks no slice and can be scheduled after slice F.

---
*Approved by [Human Name] on [Date]*
