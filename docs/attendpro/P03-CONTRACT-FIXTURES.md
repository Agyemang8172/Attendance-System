# P03 — Contract fixtures and boundaries

- Date: 2026-11-01
- Status: verification complete, awaiting owner review
- Owner slice: `docs/attendpro/PHASED-IMPLEMENTATION-PLAN.md` §P03
- Fixture suite: `backend/tests/unit/contractFixtures.contract.test.ts`
- Run: `cd backend && npx vitest run --config vitest.unit.config.ts`

The fixtures below were copied from the controller selections and from the
objects the handlers write. They are not hand-written API wishes. The suite
asserts the emitted key sets against these fixtures, so a controller rename or
a dropped field fails the test before a screen does.

## 1. Response contracts

### 1.1 Attendance lists use a flat envelope

`GET /api/attendance/my-attendance` and `GET /api/attendance/all-attendance`
return:

```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "page": 1,
  "data": []
}
```

There is no `pagination` object. `count` is the size of this page, `total` is
the filtered row count, and `page` is the requested page. The query uses
`page` and `limit`; `limit` defaults to 50.

`my-attendance` filters on `startDate`, `endDate`, `status`, `sessionStatus`
and `search`. `all-attendance` filters on `startDate`, `endDate`, `userId`,
`department`, `sessionStatus` and `status`. Date filters compare `clockIn`.

`all-attendance` includes a nested `user` with `id`, `firstName`, `lastName`,
`employeeCode`, `department` and `role`. `my-attendance` returns the raw
attendance row without that join.

Source: `backend/controllers/attendanceController.ts` (`getMyAttendance`,
`getAllAttendance`).

### 1.2 Employees are the user directory under an HR alias

`GET /api/hr/employees` and `GET /api/users` are the same handler. Response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "currentPage": 1,
    "totalPages": 0,
    "totalUsers": 0
  }
}
```

User fields: `id`, `employeeCode`, `firstName`, `lastName`, `email`,
`phoneNumber`, `role`, `department`, `jobTitle`, `isActive`,
`mustChangePassword`, `shiftId`, `profileImageUrl`, `createdAt`, `updatedAt`.

HR sees STAFF only. SUPERADMIN sees every role. The word "employee" is a
screen label here, not a response key. The directory handler does not clamp an
empty result: zero rows produce `totalPages: 0`.

Source: `backend/controllers/userController.ts` (`getAllUsers`),
`backend/routes/hrRoutes.ts`.

### 1.3 Policies carry their versions

`GET /api/business/policies` returns `{ "success": true, "data": [] }` with no
pagination. Each policy is:

```json
{
  "id": "…",
  "businessId": "…",
  "shiftId": null,
  "name": "Default policy",
  "isDefault": true,
  "createdAt": "2026-10-01T00:00:00.000Z",
  "updatedAt": "2026-10-01T00:00:00.000Z",
  "shift": null,
  "versions": [
    {
      "id": "…",
      "businessId": "…",
      "policyId": "…",
      "versionNumber": 1,
      "effectiveFrom": "2026-10-01T00:00:00.000Z",
      "effectiveTo": null,
      "graceEarlyMinutes": 5,
      "graceLateMinutes": 5,
      "earlyThresholdMinutes": 0,
      "autoClockOutEnabled": false,
      "autoClockOutBufferMinutes": 15,
      "autoClockOutMaxOpenMinutes": 480,
      "correctionWindowDays": 3,
      "geoFenceRadiusMeters": 150,
      "locationAccuracyThresholdMeters": 50,
      "gpsFreshnessSeconds": 60,
      "observePublicHolidays": true,
      "createdAt": "2026-10-01T00:00:00.000Z"
    }
  ]
}
```

Versions are ordered by `versionNumber` descending. The field is
`versionNumber`, not `version`. The policy-level row carries no
`graceLateMinutes` or `shiftName`; those live on the version and the `shift`
object.

Routes: `GET /api/business/policies`, `POST /api/business/policies`,
`POST /api/business/policies/:id/versions`. There is no
`GET /api/business/policies/:id/versions`.

Source: `backend/controllers/policyController.ts`,
`backend/routes/policyRoutes.ts`.

### 1.4 Calendars carry their exceptions

`GET /api/business/calendars` returns `{ "success": true, "data": [] }` with no
pagination. Each calendar is:

```json
{
  "id": "…",
  "businessId": "…",
  "name": "Default calendar",
  "monday": true,
  "tuesday": true,
  "wednesday": true,
  "thursday": true,
  "friday": true,
  "saturday": false,
  "sunday": false,
  "timezone": "Africa/Accra",
  "isDefault": true,
  "createdAt": "2026-10-01T00:00:00.000Z",
  "updatedAt": "2026-10-01T00:00:00.000Z",
  "exceptions": [
    {
      "id": "…",
      "calendarId": "…",
      "date": "2026-12-25T00:00:00.000Z",
      "kind": "HOLIDAY",
      "name": "Christmas Day",
      "createdAt": "2026-10-01T00:00:00.000Z"
    }
  ]
}
```

Exceptions are ordered by `date` ascending. Routes: `GET
/api/business/calendars`, `PATCH /api/business/calendars/:id`,
`POST /api/business/calendars/:id/exceptions`. There is no
`POST /api/business/calendars` and no
`GET /api/business/calendars/:id/exceptions`. The API has no create route;
the default calendar comes from business setup.

Source: `backend/controllers/calendarController.ts`,
`backend/routes/calendarRoutes.ts`.

### 1.5 Branding is nested under settings

`GET` and `PATCH /api/business/settings` return:

```json
{
  "success": true,
  "data": {
    "name": "AttendPro Test",
    "timezone": "Africa/Accra",
    "branding": {
      "logoUrl": "",
      "brandColor": "#b45309",
      "supportEmail": "support@attendpro.test",
      "supportPhone": ""
    },
    "retentionYears": 7,
    "retentionEnabled": false,
    "attendanceRetentionDays": null,
    "auditRetentionDays": null
  }
}
```

The four branding columns are flat in the database and flat in the PATCH body.
They are grouped in the response. There is no top-level `logoUrl`,
`brandColor`, `supportEmail` or `supportPhone`.

Source: `backend/controllers/businessController.ts` (`presentSettings`).

### 1.6 The jobs status is an object

`GET /api/jobs/status` returns:

```json
{
  "success": true,
  "message": "Job status",
  "data": {
    "lastRun": null,
    "closed": 0,
    "flagged": 0
  }
}
```

`POST /api/jobs/auto-clock-out/run` returns
`data: { closed, flagged, businesses }`.

Source: `backend/controllers/jobController.ts`.

### 1.7 Pagination keys differ by surface

| Surface | Envelope |
| --- | --- |
| Users, `/hr/employees` | `pagination.totalUsers` |
| Help requests | `pagination.total` |
| Corrections (self and HR) | `pagination.total` |
| Reports (register, exceptions) | `pagination.total` |
| Audit list | `pagination.total` and `pagination.totalRecords` |
| Kiosk devices | `pagination.totalDevices` |
| Sites | `meta: { page, limit, total }` |
| Shifts, policies, calendars, assignments | no pagination |
| Staff schedule, staff off-days | no pagination |
| Attendance lists | flat `count`, `total`, `page` |

The audit list is the only surface that emits both `total` and `totalRecords`.
Every other surface emits one of them.

## 2. Boundary rules

The route tables use the shared `validate()` middleware. The suite sends bad
input through the real routers and asserts the real 400 body.

| Input | Rule | Response |
| --- | --- | --- |
| Calendar id | `z.string().uuid("Invalid calendar ID format")` | 400 `Invalid parameters`, `errors[0].field = "id"` |
| Exception date | `^\d{4}-\d{2}-\d{2}$` | 400 `Validation failed`, `errors[0].message = "Date must be YYYY-MM-DD"` |
| Policy version `effectiveFrom` | `z.string().datetime(...)` | 400 `Validation failed`, `errors[0].message = "Invalid effective from date"` |
| Policy id, user id, attendance id, correction id, audit id | UUID | 400 before the handler |
| Empty string where a UUID is required | fails `uuid()` | 400, not a 500 or a 404 |

Unmounted paths answer 404. The suite checks the three that the current
frontend tests still mock as successful reads or writes:

- `GET /api/business/policies/:id/versions`
- `GET /api/business/calendars/:id/exceptions`
- `POST /api/business/calendars`

## 3. Consumer mismatch inventory

This section records what the current tests assume. It does not repair the
screens. The owning repair slices are named so the work is not lost.

### 3.1 `src/__tests__/admin-flows.test.jsx`

| Test area | Current mock or fixture | Actual contract | Effect |
| --- | --- | --- | --- |
| Shared `paginated()` helper | `{ data: { data, pagination: { currentPage, totalPages, totalRecords } } }` for every screen | Attendance is flat; policies, calendars, shifts, assignments and staff schedule are unpaginated; users use `totalUsers`; devices use `totalDevices`; help, corrections and reports use `total` | Most screen tests pass against an envelope the server never sends |
| Policies, lines 237–241 and 261–265 | `GET /business/policies/:id/versions` returns `paginated([version])` | Route is not mounted | The version modal test reads a 404 path; `v1` only appears because the mock invents it |
| Policies fixture | Flat `graceLateMinutes`, `shiftName`, `version` | Nested `versions[].versionNumber`, `shift` object | The table and modal read fields that do not exist on the list response |
| Calendar, lines 295–301 and 801–805 | `GET /business/calendars/:id/exceptions` returns `paginated([exception])` | Route is not mounted; exceptions are nested on the calendar | The exception modal reads a 404 path |
| Calendar, line 809 | Clicks "Create calendar" | `POST /business/calendars` is not mounted | The create branch has no backend |
| Devices fixture | `siteName`, `createdAt`, `updatedAt` | `publicId`, `siteId`, `state`, `pairedAt`, `lastSeenAt`, `registeredAt`; no `siteName` | The device table asserts a site name the API does not return |
| Scheduling fixture | `employee`, `isActive` | `user`, `effectiveFrom`, `effectiveTo` | The schedule table reads fields that do not exist |
| Settings fixture | Flat `logoUrl`, `brandColor`, `supportEmail`, `supportPhone` | Nested `branding` | The settings form pre-fills from a shape the API does not return |
| StaffAttendance and StaffCorrectionNew | `{ data: { data, pagination } }` | Flat `{ count, total, page, data }` | The history tests never exercise the real envelope |
| HrCorrections fixture | `requester`, `employee`, `currentClockIn`, `currentClockOut`, `currentStatus` | `requestedBy`, `attendance.user`, `originalValues`, `proposedClockIn`, `proposedClockOut`, `reviewTier`, `status` | The decision panel reads renamed or absent fields |
| HrExceptions fixture | `user` | `employee` | The name lookup passes on a field the API does not send |
| HrAudit fixture | `pagination.totalRecords` | Both `total` and `totalRecords` are present | Tolerated; the test does not assert the page count |
| Staff schedule and off-days | Paginated mock | `{ success, data }` with no pagination | The tests do not exercise the real envelope |
| Help and correction lists | `pagination.totalRecords` | `pagination.total` | Page counts render undefined unless the screen reads `total` |
| ManageStaff | `totalUsers` and `PUBLIC_USER` fields | Match | This area is aligned |

### 3.2 `src/__tests__/admin-screens.test.jsx`

| Test area | Current fixture | Actual contract | Effect |
| --- | --- | --- | --- |
| Shared `emptyPage` | `pagination.totalRecords` | Key varies by surface (see 1.7) | Shell tests mount, but the page count is not the real key |
| Help request detail, lines 196–205 | `timeline`, `resolution` | `resolutionNote`, `resolvedAt`; no `timeline`, no `resolution` | The detail route test asserts a timeline the API does not send |
| Correction detail, lines 207–226 | `attendanceDate`, `tier`, `proposedValues`, `decision`, `auditTrail` | Raw correction row: `requestedAt`, `reviewTier`, `proposedClockIn`, `proposedClockOut`, `originalValues`, `approvedValues`, `status`, `decisionNote`, `decidedAt` | The detail route test asserts field names that do not exist |
| Correction trail, lines 306–344 | `requestedBy`, `reviewedBy`, `attendance.user`, `attendanceCorrectionRevisions`, `audits` | Matches `trailCorrectionSelect`; `/audit/corrections/:attendanceId` is mounted | Closest to the real contract; the envelope `{ success, data }` is not asserted |
| StaffAttendance, lines 274–288 | Asserts the request path only | `GET /attendance/my-attendance` is mounted | The path is right; the flat envelope is untested |

### 3.3 `src/__tests__/modal-branches.test.jsx`

The file makes no API call. It renders `AddEmployeeModal` and
`EditEmployeeModal` with props and checks the dialog branches. The employee
fixture matches `PUBLIC_USER`. `ResetPasswordModal` and `AttendanceTable` are
imported but not exercised. There is no contract mismatch to record, and no
contract coverage either.

### 3.4 Backend database suites

`backend/tests/user.test.ts` and `backend/tests/accountEdges.test.ts` are the
only places that could prove RLS, transactions, concurrency and PostgreSQL
serialisation. They were not run in P03 because this environment has no
isolated-target authorisation. The new fixture suite is no-database by design
and makes none of those claims.

## 4. What the fixture suite proves

- The routers do not mount the three paths the frontend tests still mock as
  successful.
- The real `validate()` middleware rejects non-UUID ids and malformed dates
  with the documented 400 body.
- Policies, calendars, settings, attendance, the register, the user directory,
  corrections, devices and the jobs status emit the documented envelopes and
  nesting.
- The emitted key sets equal the controller selections. A rename in a
  controller fails the suite.

## 5. What it does not prove

- Database behaviour, row-level security, transaction isolation or
  concurrency.
- That the screens consume the real shapes. Section 3 shows several that do
  not.
- That `Date` values survive JSON serialisation as ISO strings. That is an
  Express and PostgreSQL integration concern.

### 5.1 Observed production defect outside this slice

`getAllAttendance` builds its `where` clause from the query filters only. It
does not call `callerBusinessId` and does not add a `businessId` predicate,
unlike the other list handlers. Whether the tenant client and the RLS policies
close that gap depends on code this no-database suite cannot exercise. The
working-tree RLS client is also not part of the P02 commit. Route this to the
attendance repair slice or to Security; P03 records it and does not change it.

## 6. Deferred work

The plan asks for mock success on unmounted GET paths to be removed. The mocks
are recorded above but not removed in P03. Removing them now leaves the
consumer suite red because `Policies.tsx` and `CalendarSettings.tsx` still
call the unmounted paths, and repairing those screens is the next slice's
work. The honest handoff is this inventory, not a green suite built on
fabricated responses.

## 7. Gate evidence

| Check | Result |
| --- | --- |
| `npx vitest run --config vitest.unit.config.ts` | 44 tests, 2 files, all pass |
| `npx tsc --noEmit` in `backend` | 0 errors |
| Database suites | not run, no isolated target |
| Install, schema, migration, commit | none |

## 8. Review stop

The owner should review the mismatch table and decide which repair slice owns
each row. P03 does not repair the screens, does not touch the schema and does
not commit. The next slice is P04 (password and PIN operations), which depends
on this checkpoint.
