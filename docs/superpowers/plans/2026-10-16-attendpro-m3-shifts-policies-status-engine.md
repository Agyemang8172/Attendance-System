# Implementation Plan: AttendPro M3 — Shifts, Policies, Status Rule Engine, Timing Policy

- **Date:** 2026-10-16
- **Milestone:** M3 (Foundation: shifts, policies, status rule engine, effective-dated timing policy)
- **DependsOn:** M2 (committed as `a74c72a`)
- **Status:** Draft — awaiting owner approval
- **Target:** AttendPro v1 backend

---

## Overview

M3 wires the backend to the M2 database schema. M2 created the tables (shifts with minute-of-day fields, workplace_policies, policy_versions, shift_assignments, all with `business_id` tenancy and RLS). M3 implements the server-side logic that uses them:

1. **Shifts** — CRUD for shifts with `startMinute`/`endMinute`/`crossesMidnight` (0..1439 minute-of-day), replacing the deprecated `startTime`/`endTime` text columns.
2. **Policies** — workplace_policies + policy_versions with effective-dated versioning (grace minutes, auto clock-out, correction window, geo-fence).
3. **Status rule engine** — evaluates a punch into `EARLY` / `ON_TIME` / `LATE` / `OPEN_SESSION` / `CLOCK_OUT_MISSING` / `AUTO_CLOSED` / `ABSENT` / `REQUIRES_REVIEW` using the shift and policy in force at punch time.
4. **Timing policy (effective-dated)** — O15: timing changes take effect from the next business midnight; historical attendance is never recalculated; snapshots are preserved on the attendance row.

This plan also fixes the two TypeScript errors currently blocking the build:
- `controllers/attendanceController.ts:43` — `status: "PRESENT"` is no longer a valid enum value.
- `controllers/userController.ts:246` — user creation is missing the required `business` relation.

---

## Phases & Tasks

### Phase 1: Shift CRUD (backend controllers + routes)

- [ ] **Task 1.1:** Create `backend/controllers/shiftController.ts`
  - `GET /api/business/shifts` — list shifts for the tenant
  - `POST /api/business/shifts` — create a shift (minutes 0..1439, name unique per business)
  - `PATCH /api/business/shifts/:id` — update a shift (changing times does not rewrite history)
  - `POST /api/business/shifts/:id/deactivate` — set `is_active = false` (never delete)
- [ ] **Task 1.2:** Create `backend/routes/shiftRoutes.ts` and register in `server.ts`
- [ ] **Task 1.3:** All shift endpoints set `app.business_id` tenant context before querying
- [ ] **Task 1.4:** Validate input (minutes 0..1439, `endMinute` > `startMinute` unless `crossesMidnight`)

### Phase 2: Shift assignments (effective-dated)

- [ ] **Task 2.1:** Create `backend/controllers/assignmentController.ts`
  - `POST /api/business/shifts/:id/assignments` — close the employee's open assignment (`effectiveTo = effectiveFrom`), insert `shift_assignments`, sync `users.shift_id` pointer, all in one transaction
  - `GET /api/business/assignments` — list assignments for the tenant
  - `DELETE /api/business/assignments/:id` — soft-close (`effective_to = now()`), never delete
- [ ] **Task 2.2:** Create `backend/routes/assignmentRoutes.ts` and register in `server.ts`
- [ ] **Task 2.3:** Tenant-scoped queries; employee must be active and in the same business

### Phase 3: Workplace policies + effective-dated versions

- [ ] **Task 3.1:** Create `backend/controllers/policyController.ts`
  - `GET /api/business/policies` — list policies with their versions
  - `POST /api/business/policies` — create policy + version 1 in one transaction
  - `POST /api/business/policies/:id/versions` — close current version (`effectiveTo`), insert new version with monotonic number
- [ ] **Task 3.2:** Create `backend/routes/policyRoutes.ts` and register in `server.ts`
- [ ] **Task 3.3:** Validate ranges (grace 0..120, buffer 0..720, correction window 1..7 per O17, geo radius 25..1000, accuracy 10..500, freshness 10..600)

### Phase 4: Status rule engine (attendance evaluation)

- [ ] **Task 4.1:** Create `backend/utils/statusEngine.ts`
  - Pure function: given `clockIn`, `shift` (start/end minute, crosses midnight), `policy` (grace early/late), returns the `AttendanceStatus` enum value
  - `EARLY`: before shift start minus early threshold
  - `ON_TIME`: inside grace window
  - `LATE`: after grace window
  - `OPEN_SESSION`: clocked in, not yet closed
  - Midnight-crossing shifts evaluated against the policy in force at start time
- [ ] **Task 4.2:** Wire status engine into `clockIn` in `attendanceController.ts`
  - Replace hardcoded `status: "PRESENT"` with evaluated status
  - Replace `sessionStatus: "OPEN"` with `"OPEN_SESSION"` to match new enum
- [ ] **Task 4.3:** Wire status into `clockOut` — evaluate and persist `hoursWorked`, set `sessionStatus: "CLOSED"`

### Phase 5: Fix tenant relation on user creation

- [ ] **Task 5.1:** Update `controllers/userController.ts:246`
  - Add `business: { connect: { id: businessId } }` to the `prisma.user.create` data
  - `businessId` comes from the tenant context set on the request
- [ ] **Task 5.2:** Verify `tsc --noEmit` passes with zero errors

### Phase 6: Verification

- [ ] **Task 6.1:** `npx prisma validate` — schema still valid
- [ ] **Task 6.2:** `npx tsc --noEmit` — zero TypeScript errors
- [ ] **Task 6.3:** `bash .agents/scripts/db-check.sh` — migration safety passes
- [ ] **Task 6.4:** `bash .agents/scripts/humanize-check.sh docs/` — docs pass
- [ ] **Task 6.5:** No database migration run (no test database configured yet — O14 blocked)

---

## Execution Order

1. Phase 1 (Shift CRUD)
2. Phase 2 (Shift assignments)
3. Phase 3 (Policies + versions)
4. Phase 4 (Status rule engine)
5. Phase 5 (Fix user creation tenant relation + tsc errors)
6. Phase 6 (Verification)

---

## Constraints

- No destructive database operations (no `DROP`, `TRUNCATE`, `DELETE` on existing data)
- All writes are tenant-scoped (`business_id` from `app.business_id` setting)
- No migration files added in M3 (schema already complete from M2)
- No changes to `src/` (frontend) — backend only
- No commits or pushes without human approval via `.agents/scripts/commit.sh`
- Root history preserved — no force-push, no rebase of existing commits

---

## Evidence needed before starting

- Owner approval of this plan (this document)
- Confirmation that M2 (`a74c72a`) is the correct base to build on
