# AttendPro M9 Security Review

- **Date:** 2026-10-19
- **Scope:** AttendPro v1 (M1–M8 code, M9 test and CI work)
- **Reviewer:** Security review pass for the M9 close-out
- **Status:** Release-blocking findings remain open. The application is not
  cleared for a public production launch until SEC-01 through SEC-08 are
  resolved or formally accepted by the owner. SEC-20 was fixed during this
  review pass; the remaining open findings are listed below.

---

## 1. Scope

The review covered the frontend, backend, database migrations, jobs, and
delivery configuration:

- Authentication, session handling, and role authorization
- Kiosk pairing, QR identification, PIN verification, and punch flow
- Attendance, corrections, help requests, reports, and audit logging
- Prisma schema, migrations, and row-level security policies
- Dependency trees for the frontend and backend
- Secret handling and environment parity
- Security headers, CORS, rate limiting, and input validation
- CI workflow introduced in M9

The kiosk client is out of scope because no kiosk UI exists in this
repository. The backend kiosk API was reviewed instead.

---

## 2. Method

Static review of the routes, controllers, middleware, validators, Prisma
schema, and migrations. Targeted checks for injection sinks, raw SQL, unsafe
HTML rendering, credential generation, token revocation, and tenant isolation.
Dependency and secret scans were run locally on 2026-10-19.

### Commands run

| Command | Result |
|---|---|
| `npm run lint` (root) | Pass |
| `npm run typecheck` (root) | Pass |
| `npm run test:unit` (root) | 98 tests passed in 11 files |
| `npm run build` (root) | Pass; largest chunk 996.78 kB, build warns about chunk size |
| `npx playwright test --list` | 6 tests in 5 files; kiosk spec is skipped |
| `npm run test:coverage` (root) | Pass at the staged ratchet: 98 tests in 11 files; 29.95% statements, 71.38% branches, 49.79% functions, 29.95% lines (floor 29/71/49/29) |
| `npx tsc --noEmit` (backend) | Pass |
| Backend `npm run test:coverage` | Pass: 22 files, 590 tests; 93.43% statements, 85.93% branches, 98.05% functions, 93.43% lines (gate 90/85) |
| `npm audit --json` (root) | 34 advisories: 2 critical, 24 high, 6 moderate, 2 low |
| `npm audit --json --prefix backend` | 10 advisories: 2 critical, 7 high, 1 moderate |
| `gitleaks detect --no-git --redact --source <dir>` | No leaks in `src`, `backend/controllers`, `backend/routes`, `backend/middleware`, `backend/utils`, `backend/config`, `backend/scripts`, or `backend/prisma` |

The backend gate is met and enforced in CI. The frontend uses the owner-approved
staged ratchet: the measured baseline is the floor, and the statement and branch
floors rise every milestone until they reach 90/85. The dependency scan remains
advisory until SEC-01..SEC-06 are triaged.

---

## 3. Findings

Severity follows the Security Agent scale: CRITICAL, HIGH, MEDIUM, LOW, INFO.

| ID | Severity | Finding | Evidence | Status |
|---|---|---|---|---|
| SEC-01 | Critical | `vitest` and its `tinypool` dependency are exposed to prototype-pollution-to-RCE advisories in both dependency trees. They are development tools, but a compromised CI or developer machine can execute code. | `npm audit` root and backend | Open |
| SEC-02 | High | `axios` 1.x carries multiple direct advisories (prototype pollution, header injection, proxy bypass, DoS). It is the frontend's only HTTP client. | `package.json`, `src/api/axios.ts` | Open |
| SEC-03 | High | `xlsx` 0.18.5 carries prototype pollution and ReDoS advisories and is a direct production dependency. | `package.json`, Excel export path | Open |
| SEC-04 | High | `vite` and `vitest` dev-server advisories allow path traversal and arbitrary file reads when the dev server is reachable. Development only, but the dev server binds locally by default. | `npm audit` root | Open |
| SEC-05 | High | `react-router` 7.15.0 resolves to advisories covering CSRF, open redirect, XSS in RSC mode, and route-matching DoS. | `npm audit` root | Open |
| SEC-06 | High | `prisma` and `@prisma/config` resolve to high advisories through `deepmerge-ts` and `effect`. | `npm audit` root and backend | Open |
| SEC-07 | High | Row-level security is enabled on 19 tables, but the runtime Prisma client connects with `DATABASE_URL` only. `DATABASE_URL_APP` is documented and never read, so the application connects as the table owner and bypasses every policy. Tenant isolation depends on application-level `businessId` filters. | `backend/config/prismaClient.ts:14-16`; `grep -r DATABASE_URL_APP backend` returns nothing | Open |
| SEC-08 | High | Password change and admin password reset do not revoke existing JWTs. `User.tokenVersion` exists in the schema but is never read or incremented for user sessions, so a stolen 8-hour token survives a reset. | `backend/prisma/schema.prisma`; `backend/controllers/authController.ts:34,74-77`; `backend/controllers/userController.ts:585-600,665-675` | Open |
| SEC-09 | Medium | The bearer token and user record are stored in `localStorage`, and the frontend ships no Content-Security-Policy. Any XSS becomes token theft. | `src/utils/auth.ts:6-7`; `index.html`; `vercel.json` | Open |
| SEC-10 | Medium | Swagger UI and the raw OpenAPI document are mounted without authentication at `/api/docs` and `/api/docs.json`. They disclose the full route surface and schemas. | `backend/server.ts:47`; `backend/docs/swagger.ts:269-291` | Open |
| SEC-11 | Medium | CORS always allows `http://localhost:5173`, `:5174`, and `:3000` in addition to `CORS_ORIGIN`, including in production. A malicious local page can reach the API with credentials if a token is available. | `backend/server.ts:54-77` | Open |
| SEC-12 | Medium | `requirePasswordChange` is missing on the shift, assignment, policy, calendar, site, QR, and kiosk-device route families. An account still holding a temporary password can call those APIs. Role gates still apply. | `backend/routes/shiftRoutes.ts`, `assignmentRoutes.ts`, `policyRoutes.ts`, `calendarRoutes.ts`, `siteRoutes.ts`, `qrRoutes.ts`, `kioskDeviceRoutes.ts` | Open |
| SEC-13 | Medium | PIN lockout is counted per verification session. A new session resets `pinAttemptCount` to zero, and `user.pinFailedCount` increments without ever triggering a cumulative lock. Nine wrong guesses per session times 60 identifies per 15 minutes allows a 10,000-value PIN space to be walked in roughly five hours with a stolen badge and a valid kiosk token. | `backend/controllers/kioskVerifyController.ts:490,551-570`; `backend/routes/kioskVerifyRoutes.ts:42-43` | Open |
| SEC-14 | Medium | The account login limiter key includes `req.ip`, so it does not bound guesses against one account across sources as its comment claims. | `backend/server.ts:115-130` | Open |
| SEC-15 | Medium | `resetPin` generates a four-digit PIN and returns only `{ userId, pinUpdatedAt }`. The HR toast says the new PIN "has been sent to them", but no delivery channel exists, so the administrator cannot give the user the PIN. | `backend/controllers/userController.ts:760-811`; `src/pages/ManageStaff.tsx:201` | Open |
| SEC-16 | Low | `backend/.env.example` omits `JOB_TOKEN`, `PIN_HMAC_KEY`, `QR_SECRET_KEY`, `KIOSK_PAIRING_KEY`, and `KIOSK_TOKEN_KEY`. The root `.env.example` documents all five, so the two files disagree. | `backend/.env.example` | Open |
| SEC-17 | Low | There is no production bootstrap path (SSB-2). `backend/prisma/seed.ts` is a guarded development seed: it refuses unless `SEED_CONFIRM=development` and `DATABASE_URL` matches `DEV_DB_HOST`, and it creates one SUPERADMIN and one HR account. `backend/scripts/test-seed.ts` writes only the fixture accounts into the guarded local `attendpro_test` database. | `backend/prisma/seed.ts`; `backend/scripts/test-seed.ts`; `backend/tests/dbGuard.ts` | Partly fixed — development and test seeding work; the production bootstrap remains open |
| SEC-18 | Low | The HR dashboard links to `/hr-exceptions/:id`, the attendance drawer links to `/hr-audit/corrections/:id`, and the SUPERADMIN sidebar links to `/admin-help-corrections`. None of those routes exists. | `src/pages/HrDashboard.tsx`; `src/pages/HrAttendance.tsx:309`; `src/components/Sidebar.tsx:186`; `src/App.jsx` | Open |
| SEC-19 | Low | The staff attendance screen sends `status`, `sessionStatus`, and `search`, but `getMyAttendance` reads only the date range. The help-request status filter offers `PENDING` and `IN_PROGRESS` while the API accepts `OPEN`, `IN_REVIEW`, `RESOLVED`, and `CLOSED`. | `src/pages/StaffAttendance.tsx:186-206`; `backend/controllers/attendanceController.ts:834-868`; `src/pages/StaffHelpRequests.tsx:211-214` | Open |
| SEC-20 | High | Nine staff screens called paths beginning with `/api` on an axios client whose base URL already ends in `/api`. The request resolved to `/api/api/...` and returned 404, so schedule, off-days, help requests, corrections, and PIN change failed in the browser. | `src/api/axios.ts:4`; `src/pages/StaffDashboard.tsx:89-120`; `StaffSchedule.tsx:162-163`; `StaffOffDays.tsx:81`; `StaffHelpRequests.tsx:148`; `StaffCorrections.tsx:149`; `StaffHelpRequestNew.tsx:60`; `StaffCorrectionNew.tsx:102`; `StaffChangePin.tsx:43` | Fixed — all 14 calls now pass the path relative to the `/api` base, and the backend mounts match (`/staff/schedule`, `/staff/off-days`, `/staff/help-requests`, `/staff/corrections`, `/staff/profile/change-pin`, `/attendance/corrections`). |
| SEC-21 | Info | No kiosk UI exists. Pairing, identification, PIN entry, and punching are API-only. | `src/App.jsx`; `src/pages/` | Accepted |
| SEC-22 | Info | No deployment workflow exists. Deployment is a manual owner action documented in the runbook. | `.github/workflows/` | Accepted |
| SEC-23 | Info | The Excel export path depends on `xlsx`, which is also SEC-03. CSV and PDF paths avoid it. | `src/pages/HrReports.tsx` | Accepted |

---

## 4. Verified open items

Each item below was reproduced by reading the named code, not inferred from a
summary.

### 4.1 Tenant isolation is policy-only at runtime (SEC-07)

Every tenant table has `ENABLE ROW LEVEL SECURITY` and a
`current_setting('app.business_id', true)` policy. The Prisma client builds its
adapter from `DATABASE_URL`, not `DATABASE_URL_APP`, and no code issues
`SET app.business_id`. The migration itself records that the owner role
bypasses RLS. The application filters by `businessId` in controllers, so the
practical risk depends on every future query remembering that filter.

### 4.2 Password reset leaves old sessions alive (SEC-08)

`User.tokenVersion` is present at `schema.prisma:376`. User tokens are signed
with `{ userId, role, mustChangePassword }` and an 8-hour lifetime. The auth
middleware verifies the signature and loads the user, but never compares a
token version. Password reset and password change update the hash and the
forced-change flag only. Kiosk tokens do use a device `tokenVersion`, which
shows the pattern is already understood.

### 4.3 PIN reset has no delivery path (SEC-15)

`resetPin` generates `pin = String(randomInt(0, 10_000)).padStart(4, "0")`,
hashes it, stores it, and returns `{ userId, pinUpdatedAt }`. The plaintext PIN
leaves scope at the end of the handler. The HR toast claims it was sent. The
result is a reset the user cannot complete and a support path that pushes staff
toward insecure channels.

### 4.4 Kiosk PIN lockout is session-scoped (SEC-13)

`PIN_MAX_ATTEMPTS` is 10, so a session locks after 10 mismatches. The session
counter starts at zero for every new identification. `user.pinFailedCount` and
`pinLastFailedAt` are written on each failure, but `pinLockedUntil` is set only
when the current session reaches the limit. Cancelling and starting a new
session after nine failures leaves the account unlocked. The identify limiter
allows 60 attempts per 15 minutes per kiosk, which bounds but does not stop the
attack.

### 4.5 Forced password change has gaps (SEC-12)

The middleware is applied to attendance reads, audit, business, corrections,
HR, reports, staff help, staff profile, and staff schedule routes. The seven
route families named in the table mount `authMiddleware` and role checks
without it. A SUPERADMIN or HR account that still owes a password change can
therefore create shifts, assignments, policies, calendars, sites, and QR
credentials, and can pair or revoke kiosk devices.

### 4.6 The PIN reset message is false (SEC-15)

The ManageStaff handler receives a success response and shows
"The new PIN has been sent to them." No email, SMS, or in-app delivery exists
for a PIN. This is a correctness and trust issue, and it hides the fact that
the reset cannot be completed by the user.

### 4.7 Staff screens double-prefixed the API path (SEC-20, fixed)

The axios client sets `baseURL` to `VITE_API_URL`, which ends in `/api`. Fourteen
staff calls passed a path that also started with `/api`, so the browser
requested `/api/api/...`. The backend has no such route. Schedule, off-days,
help requests, corrections, and PIN change therefore failed with 404 even
though the same backend routes worked when called with the correct path.

The fix removed the redundant prefix from every call (ten screens, fourteen
requests). The paths now match the backend mounts: `/staff/schedule`,
`/staff/off-days`, `/staff/help-requests`, `/staff/corrections`,
`/staff/profile/change-pin`, and `/attendance/corrections`.

---

## 5. Controls verified

These controls are present and behaved as expected during review.

| Control | Evidence |
|---|---|
| Secret scanning | Gitleaks 8.30.1 found no leaks across the eight source directories |
| Password hashing | bcrypt with cost 12 (`backend/controllers/userController.ts:15`) |
| Credential randomness | `crypto.randomInt` and `crypto.randomBytes`; no `Math.random` in credential code |
| SQL injection surface | No `$queryRaw`, `$executeRaw`, or unsafe variants in application code; Prisma parameterizes its queries |
| XSS sinks | No `dangerouslySetInnerHTML` or `innerHTML` in `src` |
| API security headers | `nosniff`, `DENY` framing, `no-referrer`, COOP, CORP, DNS prefetch off, HSTS in production |
| Request body limit | 10 kB JSON limit (`backend/server.ts:51`) |
| Login throttling | 10 per 15 minutes per IP and 8 per 15 minutes per account plus IP |
| Kiosk token revocation | Device `tokenVersion` checked on every kiosk request |
| Kiosk secret handling | HMAC-SHA-256 with server-side keys; hashes and salts stored, not plaintext |
| Role authorization | `authorizeRole` on HR, SUPERADMIN, and kiosk route families |
| Audit trail | Auth, attendance, corrections, help requests, PIN events, and report exports write audit rows |
| RLS coverage | 19 tables enable RLS; 22 policies exist across the migrations |
| Validation | Zod schemas on request bodies and query parameters |
| Sensitive error handling | API hides stack traces outside development; login responses use fixed copy |

---

## 6. Dependency detail

### Root project (34 advisories)

- Critical: `vitest`, `tinypool`
- Direct high: `axios`, `postcss`, `prisma`, `tailwindcss`, `vite`, `xlsx`
- Transitive high: `@prisma/config`, `brace-expansion`, `braces`,
  `browserslist`, `chokidar`, `deepmerge-ts`, `effect`, `fast-glob`, `flatted`,
  `form-data`, `js-yaml`, `micromatch`, `minimatch`, `nanoid`, `picomatch`,
  `react-router`, `rollup`, `source-map-js`
- Low: two advisories not listed above

### Backend (10 advisories)

- Critical: `vitest`, `tinypool`
- Direct high: `nodemon`, `prisma`
- Transitive high: `@prisma/config`, `braces`, `chokidar`, `deepmerge-ts`,
  `effect`
- Moderate: `@vitest/mocker`

`npm audit fix` was not run. Several fixes cross major versions, and the M9
constraints forbid new production dependencies and unapproved upgrades. The
owner should schedule a dependency upgrade as a separate security milestone.

---

## 7. Accepted risks

| Risk | Why it is accepted for this close-out | Condition to revisit |
|---|---|---|
| Kiosk UI absent | The backend contract is tested; the UI is a separate deliverable | Re-review pairing and PIN entry when the kiosk client ships |
| Public API docs | Useful during development and the deployment stays private | Disable or protect `/api/docs` before a public launch |
| Bearer token in `localStorage` | No third-party scripts and no CSP yet; moving to httpOnly cookies needs backend session changes | Add CSP and revisit token storage in the next security milestone |
| Manual deployment | M9 documents the path and the owner controls the trigger | Add an approved deploy workflow when a real environment exists |
| Development-only advisories in `vitest`, `tinypool`, and `vite` | They do not ship in the production bundle | Upgrade in the same dependency pass as the production packages |
| `xlsx` export | CSV and PDF cover the reporting need; Excel is optional | Replace or isolate `xlsx` if Excel export becomes required |

---

## 8. Release gate

| Gate | Status |
|---|---|
| Frontend lint | Pass |
| Frontend typecheck | Pass |
| Frontend unit tests | Pass (98/98) |
| Frontend production build | Pass |
| Playwright discovery | Pass (6 tests, 5 files, 1 skipped) |
| Playwright run (live backend + seeded fixtures) | Pass (5 passed, 1 skipped — the kiosk UI does not exist) |
| Secret scan | Pass (no leaks) |
| Dependency scan, no critical or high | Fail (production trees: 9 high frontend and 4 high backend, no critical; full trees including development packages: 4 critical and 31 high) |
| Backend tests | Pass (22 files, 590 tests) against the local `attendpro_test` database |
| Backend coverage gate | Pass (93.43% statements / 85.93% branches against 90/85; functions 98.05%, lines 93.43%) |
| Frontend coverage ratchet | Pass at the owner-approved floor (29.95% statements / 71.38% branches / 49.79% functions / 29.95% lines against 29/71/49/29); the final 90/85 target is not met yet |
| RLS enforcement | Fail (SEC-07) |
| Token revocation | Fail (SEC-08) |
| Staff portal API paths | Pass (SEC-20 fixed) |

The owner must decide which findings block the private pilot and which can move
to the next milestone. SEC-01 through SEC-08 should be treated as blockers for
a public launch.

---

## 9. Remediation log (M9)

Five production defects surfaced while the M9 suite was written. They were fixed
in the same pass, with regression cover:

| ID | Defect | Fix | Cover |
|---|---|---|---|
| M9-B1 | Express 5 re-parses `req.query` on every read, so `Object.assign(req.query, …)` was discarded. Paginated list endpoints received strings or `NaN`; correction, help-request and register reads returned 500, and the exceptions page silently returned an empty list. | `backend/middleware/validate.ts` now defines an own `query` property over the prototype getter. | `backend/tests/{correction,helpRequest,report}.test.ts` assert the real 200/paginated contract. |
| M9-B2 | Shift creation omitted the legacy `start_time` / `end_time` TEXT columns, which are still `NOT NULL` in the database although Prisma marks them optional. Every `POST /api/business/shifts` returned 500. | `backend/controllers/shiftController.ts` mirrors the minute pair into the legacy columns on create and update. | `backend/tests/shift.test.ts` reads the stored values back. |
| M9-B3 | The M8-R4 `GET /api/audit` listing was never built, so the HR audit screen and the SUPERADMIN audit log received 404. | Added `listAudit` / `getAuditById`, the validators, and both routes; HR reads the supervised subset, SUPERADMIN the whole trail. | `backend/tests/audit.test.ts` covers the 401 gate, pagination and tenant scoping. |
| M9-B4 | The JSON attendance register read the live shift name before the historical snapshot, contradicting its own docstring and the CSV handler. | `backend/controllers/reportController.ts` reads `shiftNameSnapshot` first. | `backend/tests/report.test.ts`. |
| M9-B5 | Six user-controller catches handled only `instanceof Error`; a non-Error throw left the request open until the client timed out. | Added the explicit 500 `else` arm to `getAllUsers`, `getUserById`, `createUser`, `updateUser`, `resetPassword` and `changePassword`. | `backend/tests/controllerFailures.test.ts` injects both the Error and non-Error arms. |
| SEC-20 | Ten staff screens double-prefixed `/api`, so the browser requested `/api/api/...` and every call 404'd. | Removed the redundant prefix from all fourteen calls. | Frontend typecheck and unit suite; e2e specs exercise the login paths. |
