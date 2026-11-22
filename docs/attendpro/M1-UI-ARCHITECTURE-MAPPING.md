# AttendPro M1 — Stage 5: UI to Architecture and Data Mapping

- **Date:** 2026-10-16
- **Stage:** 5 of 6 in the product-owner UI/UX workflow
- **Baseline commit:** `f87ce1d` (M0), code state as of `c4ee602`
- **Milestone:** M1, pending owner approval
- **Owner:** UI Designer Agent
- **Companions:** `docs/attendpro/M1-SCREEN-DESIGNS.md` (Stage 4), `docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/M1-DATA-MODEL.md`, `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md`, `docs/attendpro/M1-ATTENDANCE-LIFECYCLE.md`, `docs/attendpro/M1-VISUAL-DESIGN-SYSTEM.md`
- **Status:** design only. No file under `src/` or `backend/` is modified.

---

## 0. What this stage does

Stage 4 designed the screens. This stage holds each one against the two documents that have to support it: the API contract in `M1-API-CONTRACTS.md` and the schema in `M1-DATA-MODEL.md`. The test is whether every screen can be built from the endpoints and tables that already exist.

Where a screen needs data that no endpoint returns, that is reported as a gap rather than assumed away. Gaps are collected in section 3.

This is an extension of `M1-API-CONTRACTS.md` §13, which maps a shorter list of actions. It does not replace it.

---

## 1. Master mapping

Nineteen tables are referenced, matching the nineteen models in `M1-DATA-MODEL.md`.

| Screen | Route | Endpoints | Tables | Rules that govern the screen |
|---|---|---|---|---|
| Public landing | `/` | `GET /api/public/preview` | none | PRD §6. Returns fictional data only and reads no tenant table. |
| Login | `/login` | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | `users`, `businesses`, `audit_logs` | Identical error for unknown email and wrong password. `403` when the account is deactivated. |
| Account recovery | `/account/recovery` | `POST /api/auth/recovery/request`, `POST /api/auth/recovery/verify` | `users`, `email_recovery_codes`, `audit_logs` | `O6`. Single-use code, 10-minute expiry, lock at five attempts, 60-second resend floor, no account enumeration, recovery only. |
| Set password | `/set-password` | `PUT /api/users/change-password` | `users`, `audit_logs` | Password policy; `mustChangePassword` clears on success. |
| Change PIN | `/profile/change-pin` | `POST /api/staff/profile/change-pin` | `users`, `audit_logs` | Six-digit PIN, differs from current, five failures lock, audit carries no PIN value. |
| Staff overview | `/dashboard` | `GET /api/auth/me`, `GET /api/staff/attendance`, `GET /api/attendance/my-attendance`, `GET /api/staff/schedule`, `GET /api/staff/off-days` | `attendances`, `shift_assignments`, `shifts`, `work_calendars`, `calendar_exceptions`, `audit_logs` | `O20` no punch action. `O24` no streak. Auto clock-out time comes from `O8`, never a literal 11:59 PM. |
| Staff attendance history | `/attendance` | `GET /api/staff/attendance` | `attendances`, `shifts` | Seven-day correction window (`O17`). Off-days come from `GET /api/staff/off-days`, not from empty rows. |
| Staff schedule | `/schedule` | `GET /api/staff/schedule`, `GET /api/staff/off-days` | `shift_assignments`, `shifts`, `work_calendars`, `calendar_exceptions` | `O16`. Off-days are computed from the calendar and exceptions. |
| Staff help requests | `/help-requests` | `GET /api/staff/help-requests`, `POST /api/staff/help-requests`, `GET /api/staff/help-requests/:id` | `attendance_help_requests`, `audit_logs` | Requester forced to self. Category allowlist. |
| Staff corrections | `/corrections` | `GET /api/staff/corrections`, `GET /api/staff/corrections/:id`, `POST /api/attendance/corrections` | `attendance_corrections`, `attendances`, `audit_logs` | `O17`. Seven-day window, reason required, one open correction per row. |
| Profile | `/profile` | `GET /api/staff/profile`, `PATCH /api/staff/profile` | `users`, `audit_logs` | Field allowlist. Email change returns `409` when taken. Achievements section removed (`O24`). |
| Settings | `/settings` | `GET /api/business/settings`, `PATCH /api/business/settings`, `PUT /api/users/change-password`, `PATCH /api/staff/profile` | `businesses`, `users`, `audit_logs` | `COMBINE` disposition. Personal sections for every role, business sections for SUPERADMIN. |
| HR overview | `/hr-dashboard` | `GET /api/hr/attendance/summary`, `GET /api/hr/attendance/exceptions` | `attendances`, `attendance_attempts` | Exception-led. Charts are secondary. |
| HR attendance | `/hr-attendance` | `GET /api/hr/attendance`, `GET /api/hr/attendance/summary` | `attendances`, `users`, `shifts`, `sites` | PRD §8 field set. HR never edits a cell. |
| HR exceptions | `/hr-exceptions` | `GET /api/hr/attendance/exceptions` | `attendances`, `attendance_attempts`, `sites` | Types `CLOCK_OUT_MISSING`, `REQUIRES_REVIEW`, `ABSENT`, `LOCATION_FLAGGED`. |
| HR help requests | `/hr-help-requests` | `GET /api/hr/help-requests`, `PATCH /api/hr/help-requests/:id` | `attendance_help_requests`, `audit_logs` | Business-scoped. |
| HR corrections | `/hr-corrections` | `GET /api/hr/corrections` | `attendance_corrections`, `users` | `reviewTier` shown on each row. |
| Correction decision | `/hr-corrections/:id` | `GET /api/hr/corrections`, `PATCH /api/hr/corrections/:id/decision`, `GET /api/audit/corrections/:attendanceId` | `attendance_corrections`, `attendance_correction_revisions`, `attendances`, `audit_logs` | `O17` no self-approval. `O21` backstop. Decision writes original, proposed and approved values. |
| Employee list | `/manage-staff` | `GET /api/hr/employees`, `POST /api/hr/employees` | `users`, `audit_logs` | HR scoped to `STAFF`. HR may create `STAFF` only. |
| Employee detail | `/manage-staff/:id` | `GET /api/hr/employees`, `PATCH /api/hr/employees/:id`, `GET /api/hr/attendance` | `users`, `attendances`, `shift_assignments` | HR acts on `STAFF` only. Last-superadmin rule guards role and active changes. |
| PIN reset | `/manage-staff/:id/reset-pin` | `POST /api/hr/users/:id/reset-pin` | `users`, `audit_logs` | Reason required. HR never sees the old or new PIN. |
| SUPERADMIN overview | `/superadmin-dashboard` | `GET /api/hr/attendance/summary`, `GET /api/kiosk/devices`, `GET /api/business/settings`, `GET /api/business/shifts`, `GET /api/business/assignments`, `GET /api/business/policies`, `GET /api/business/calendars`, `GET /api/sites` | `attendances`, `kiosk_terminals`, `businesses`, `shifts`, `shift_assignments`, `workplace_policies`, `work_calendars`, `calendar_exceptions`, `sites` | `O22` setup health. Readiness is derived from the configuration tables. |
| Shifts | `/shift-management` | `GET /api/business/shifts`, `POST /api/business/shifts`, `PATCH /api/business/shifts/:id`, `POST /api/business/shifts/:id/deactivate` | `shifts`, `audit_logs` | Deactivation never deletes attendance. |
| Schedules | `/scheduling` | `GET /api/business/assignments`, `POST /api/business/shifts/:id/assignments`, `DELETE /api/business/assignments/:id` | `shift_assignments`, `users`, `shifts`, `audit_logs` | One open assignment per employee. History preserved via `effectiveTo`. |
| Calendar | `/calendar-settings` | `GET /api/business/calendars`, `PATCH /api/business/calendars/:id`, `POST /api/business/calendars/:id/exceptions` | `work_calendars`, `calendar_exceptions`, `audit_logs` | `O16`. One default calendar per business. |
| Attendance policies | `/attendance-policies` | `GET /api/business/policies`, `POST /api/business/policies`, `POST /api/business/policies/:id/versions` | `workplace_policies`, `policy_versions`, `audit_logs` | `O15` effective-dated from next midnight, never recalculates history. `O8` buffer and maximum. |
| Sites | `/sites` | `GET /api/sites`, `POST /api/sites`, `PATCH /api/sites/:id`, `POST /api/sites/:id/deactivate` | `sites`, `audit_logs` | `O4`. Radius change does not rewrite past assessments. HR reads, SUPERADMIN writes. |
| Devices | `/devices` | `GET /api/kiosk/devices`, `POST /api/kiosk/pairing-codes`, `POST /api/kiosk/devices/:id/revoke` | `kiosk_terminals`, `audit_logs` | `O3`. 10-minute pairing code, 30-day token, 90-day cap, revoke preserves history. |
| Reports | `/reports` | `GET /api/reports/attendance-register`, `GET /api/reports/punctuality-summary`, `GET /api/reports/exceptions`, `GET /api/reports/attendance-register/export` | `attendances`, `audit_logs` | `O9`. CSV first, business time zone, formula-injection prefixing. |
| Audit log | `/audit-log` | `GET /api/audit`, `GET /api/audit/:id` | `audit_logs` | Append-only. No entry carries a PIN, pairing code, token or badge value. |
| 403 | `/403` | none | none | Client-side guard outcome. No data. |
| Kiosk | `/kiosk` | `POST /api/kiosk/pair`, `POST /api/kiosk/identify`, `POST /api/kiosk/verify-pin`, `POST /api/kiosk/cancel`, `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out`, `POST /api/kiosk/token/renew` | `kiosk_terminals`, `verification_sessions`, `qr_credentials`, `attendances`, `attendance_attempts`, `users`, `sites`, `audit_logs` | `O2`, `O3`, `O4`, `O5`. Punch needs a `VERIFIED` session and a kiosk token. Location is recorded, never shown. |

Every screen resolves to endpoints that exist in the contract except the four rows in section 3.

---

## 2. Rules that cross more than one screen

Three rules are enforced in several places and must not drift between them.

**No self-approval (`O17`).** Enforced on the server in `PATCH /api/hr/corrections/:id/decision`, shown as a fact on the decision screen, and implied by the requester field on the corrections list. A screen that merely hides the button is not enough; the contract rejects the request.

**Location is recorded but not displayed to the employee (`O4`).** The kiosk shows the punch result and never the location result. The assessment surfaces only on HR screens through `locationResult IN (OUTSIDE, UNKNOWN)`. Any kiosk screen that shows "outside" is a defect.

**Effective-dated policy (`O15`).** A policy change in `/attendance-policies` writes a new `policy_versions` row and does not recalculate history. The attendance table and reports read the snapshots on `attendances`, so they keep showing the rule that was in force then.

---

## 3. Gaps

Four screens in Stage 4 need something the contract does not yet provide. Each is written here rather than assumed, because building a screen against a missing endpoint is how a design becomes fiction.

**G1 — No setup-readiness endpoint.** The SUPERADMIN overview under `O22` derives a completion count from eight checks across six areas. Today that means six calls (`/business/settings`, `/business/shifts`, `/business/assignments`, `/business/policies`, `/business/calendars`, `/sites`) plus `/kiosk/devices`, and the readiness rules are then decided in the client. That is fragile: the definition of "setup complete" would live in the frontend where it cannot be tested or versioned. Suggested fix: a single `GET /api/business/readiness` returning eight named checks with their state, computed server-side. To be added to `M1-API-CONTRACTS.md` §5 before Stage 6.

**G2 — No single-employee read.** The employee detail screen at `/manage-staff/:id` needs one employee. The contract has `GET /api/hr/employees` (a list) and `PATCH /api/hr/employees/:id` but no `GET /api/hr/employees/:id`. The list endpoint could be filtered, but that returns an array and forces the client to pick. Suggested fix: add `GET /api/hr/employees/:id` with the same scoping as the list. To be added to §4.

**G3 — The decision endpoint has no backstop fields.** `O21` requires a backstop decision to record which condition justified it and a required reason. `PATCH /api/hr/corrections/:id/decision` currently accepts `{ decision, note? }` and validates only the self-approval and tier rules. It needs to accept and require a backstop reason and condition when the actor is a SUPERADMIN acting as a backstop, and to reject a backstop attempt when none of the three conditions holds. This is a contract change, not a screen change.

**G4 — The audit log has no backstop action in its vocabulary.** The audit screen marks backstop decisions so a reviewer can filter them. `GET /api/audit` filters by `action`, so the action value has to exist and be distinct. Suggested fix: define `correction.decided.backstop` as a distinct action alongside `correction.decided`, and say so in the audit section of the contract.

G3 and G4 depend on the owner approving the escalation rules in `M1-VISUAL-DESIGN-SYSTEM.md` §7, since the fields follow from the rules.

---

## 4. States mapped to errors

Stage 4 section 6 gave each screen four states. This is where the error state gets its content, so that no screen invents its own wording.

| UI state | Contract source | Screen behaviour |
|---|---|---|
| Empty | `200` with an empty collection | The screen names what is missing and offers the action that fills it. |
| Error | `400`, `401`, `403`, `404`, `409`, `429`, `500` | The screen shows the safe message from the typed error contract. A raw backend message is never shown, which is the `attendanceController` leak found at M0. |
| Unauthorized | `401` | Route to `/login`. |
| Forbidden | `403` | Route to `/403`. Never a blank page. |
| Conflict | `409` | Inline explanation, such as an open correction already existing for the row. |
| Rate limited | `429` | A countdown on the control that is limited, such as the recovery resend. |
| Success | `200` or `201` | A banner that names what changed. |

The existing `src/api/axios.ts` already centralizes the failure policy, so the mapping above is a set of messages rather than new plumbing.

---

## 5. Components and where their data comes from

| Component | Data source | Notes |
|---|---|---|
| `Sidebar` | `GET /api/auth/me` for role, plus static group definitions | Role decides the groups. |
| `DataTable` | the endpoint named per screen | Sorting is client-side within a page; paging is server-side. |
| `StatusBadge` | the `status` field on the row, plus `sessionStatus` | Eight states, one specified ground each (`F9`). |
| `KpiCard`, `KpiHero` | summary endpoints, or a readiness check under G1 | No client-computed rate with a hardcoded denominator. |
| `FilterBar` | screen query params | Mirrors the contract's query fields. |
| `ChatCard` | reporting endpoints | Demoted on HR screens. |
| `EmptyState` | derived from an empty result | Copy is per screen. |

---

## 6. What Stage 5 hands to Stage 6

- A complete screen-to-endpoint-to-table map with no screen resting on an endpoint that does not exist, once G1 to G4 are added to the contract.
- Four contract additions, two of which (G3, G4) wait on the escalation-rules approval.
- A single place where the error, empty, forbidden and success states are defined, so no screen improvises.

Stage 6 consolidates Stages 1 to 5 into one approval package and states exactly what the owner is approving.
