# Implementation Plan: AttendPro M4 — SUPERADMIN Employee, Site, Calendar, QR Management

- **Date:** 2026-10-16
- **Milestone:** M4 (SUPERADMIN: employees, sites, calendars, QR issuance)
- **DependsOn:** M3 (committed)
- **Status:** Draft — awaiting owner approval
- **Target:** AttendPro v1 backend

---

## Overview

M4 builds the SUPERADMIN/HR employee and site management layer on top of the M2 schema and M3 shift/policy engine. No new database tables or migrations are needed — all tables (`users`, `sites`, `work_calendars`, `calendar_exceptions`, `qr_credentials`) already exist from M2.

Deliverables:

1. **Employee management** (`/api/hr/employees`) — list, create, update staff. HR may act on STAFF only; SUPERADMIN may act on any role; role/`is_active` changes guarded by the last-superadmin rule.
2. **PIN reset** (`/api/hr/users/:id/reset-pin`) — HR/SUPERADMIN resets a staff member's PIN (transaction: new PIN hash/salt, clear failed count and lockout, audit).
3. **Sites** (`/api/sites`) — list and create work sites with geo-fence (latitude, longitude, radius).
4. **Calendars** (`/api/business/calendars`) — list working calendars with exceptions, update calendar fields (weekday flags, timezone, default), add holiday/working-override exceptions.
5. **QR credential issuance** (`/api/business/employees/:id/qr-credential`) — SUPERADMIN issues/revokes a staff QR credential (transaction: revoke active, insert new, audit `qr.reissued`).

All endpoints are tenant-scoped (`business_id` from `app.business_id`). No `src/` (frontend) changes.

---

## Phases & Tasks

### Phase 1: Employee management routes

- [ ] **Task 1.1:** Create `backend/routes/hrRoutes.ts`
  - `GET /api/hr/employees` — paginated employees; HR scoped to `role = STAFF`; SUPERADMIN sees all
  - `POST /api/hr/employees` — create employee; HR may request `STAFF` only; SUPERADMIN may request any role; server generates password
  - `PATCH /api/hr/employees/:id` — update employee; HR scoped to STAFF; SUPERADMIN role/`is_active` changes guarded by last-superadmin rule
- [ ] **Task 1.2:** Create `backend/controllers/hrController.ts` with `listEmployees`, `createEmployee`, `updateEmployee`
- [ ] **Task 1.3:** Register `hrRoutes` in `backend/server.ts` at `/api/hr`
- [ ] **Task 1.4:** Add employee validators (`listEmployeesSchema`, `createEmployeeSchema`, `updateEmployeeSchema`) to `backend/validators/index.ts`

### Phase 2: PIN reset

- [ ] **Task 2.1:** Add `POST /api/hr/users/:id/reset-pin` to `hrRoutes`
- [ ] **Task 2.2:** Add `resetPin` to `hrController` — one transaction: generate PIN, hash+salt, clear `pinFailedCount`/`pinLockedUntil`, set `pinUpdatedAt`, insert `audit_logs` with actor/target/reason; never return the PIN
- [ ] **Task 2.3:** Add `resetPinSchema` validator (param `id`, body `{ reason }`)

### Phase 3: Sites

- [ ] **Task 3.1:** Add `GET /api/sites` and `POST /api/sites` to an existing or new `siteRoutes.ts`
  - List: paginated, tenant-scoped
  - Create: SUPERADMIN only; name unique per business; latitude -90..90; longitude -180..180; radiusMeters 25..1000
- [ ] **Task 3.2:** Add `siteController.ts` with `listSites`, `createSite`
- [ ] **Task 3.3:** Add site validators

### Phase 4: Calendars and exceptions

- [ ] **Task 4.1:** Add routes under `/api/business/calendars`
  - `GET` — list calendars with exceptions (SUPERADMIN, HR read)
  - `PATCH /:id` — update calendar (SUPERADMIN); at most one default per business (O22)
  - `POST /:id/exceptions` — add holiday or working-override exception (SUPERADMIN); unique per calendar+date
- [ ] **Task 4.2:** Add `calendarController.ts` with `listCalendars`, `updateCalendar`, `createCalendarException`
- [ ] **Task 4.3:** Add calendar validators

### Phase 5: QR credential issuance

- [ ] **Task 5.1:** Add `POST /api/business/employees/:id/qr-credential` to a routes file (SUPERADMIN)
- [ ] **Task 5.2:** Add `issueQrCredential` to controller — transaction: revoke employee's active credential (`revokedAt = now()`), insert new `qr_credentials` row with hashed token, audit `qr.reissued`; payload shown once in response
- [ ] **Task 5.3:** Add `qrCredentialSchema` validator

### Phase 6: Verification

- [ ] **Task 6.1:** `npx tsc --noEmit` — zero errors
- [ ] **Task 6.2:** `npx prisma validate` — schema valid
- [ ] **Task 6.3:** `bash .agents/scripts/db-check.sh` — migration safety passes
- [ ] **Task 6.4:** `bash .agents/scripts/humanize-check.sh docs/` — docs pass
- [ ] **Task 6.5:** No database migration run (O14 blocked — no `DATABASE_URL`)

---

## Execution Order

1. Phase 1 (Employee management)
2. Phase 2 (PIN reset)
3. Phase 3 (Sites)
4. Phase 4 (Calendars)
5. Phase 5 (QR credential issuance)
6. Phase 6 (Verification)

---

## Constraints

- No new migrations or schema changes (M2 tables already exist)
- No destructive database operations
- All writes tenant-scoped (`business_id`)
- No `src/` (frontend) changes
- Last-superadmin rule: cannot deactivate the only SUPERADMIN or change their role
- HR may only act on STAFF targets
- No commits or pushes without human approval via `.agents/scripts/commit.sh`
- Root history preserved

---

## Evidence needed before starting

- Owner approval of this plan (this document)
