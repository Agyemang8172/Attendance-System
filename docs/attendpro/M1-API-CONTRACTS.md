# AttendPro M1 — API Contracts

- **Date:** 2026-10-16
- **Baseline commit:** `f87ce1d`
- **Milestone:** M1
- **Owners:** Architect Agent and DBA Agent
- **Companions:** `docs/attendpro/M1-ARCHITECTURE.md`, `docs/attendpro/M1-DATA-MODEL.md`, `docs/attendpro/M1-KIOSK-SECURITY.md`
- **Status:** design only. No route is implemented here.

This is the route contract for every area in PRD §18. Each table gives the method, path,
allowed roles, request, response, validation, database operations, and error cases.
Paths follow the existing `/api/<area>` convention.

**Revision 2026-10-16.** The owner's M1 design review on this date replaced SMS one-time
codes with a QR badge plus a PIN, added sites and geo-fencing, kiosk pairing, an
effective-dated timing policy and the correction rules. Every OTP route is gone. Leave
request, leave allocation and timetable upload are deferred to version two, so no leave
endpoint appears here. The roles stay `STAFF`, `HR` and `SUPERADMIN`. The decisions are
recorded in `docs/attendpro/DECISION-REGISTER.md` and designed to as settled, not as
defaults.

---

## 0. Conventions

**Response envelope.** Success responses use the shape the API already returns:
`{ "success": true, "data": ..., "message"?: ... }`. Error responses use
`{ "success": false, "code": ..., "message": ... }` with an optional `errors` array of
`{ field, message }` for validation failures. Error codes and status mapping are the
typed contract in `M1-ARCHITECTURE.md` §6.

**Roles.** `public` needs no credential. `STAFF`, `HR`, and `SUPERADMIN` are the three
business roles (PRD §4). `kiosk` means a device token issued by `POST /api/kiosk/pair`
and renewed by `POST /api/kiosk/token/renew`; it proves a paired kiosk and carries no
employee identity. `job` means the service token for the background worker. `STAFF`
acting on their own record is written as "self". An unpaired device redeeming a pairing
code is `public`, because it holds no token yet.

**Tenant scope.** No endpoint accepts a `businessId` in the body, query, or a client
header. The server derives it from the authenticated identity (`M1-ARCHITECTURE.md`
§2.1) and every database operation runs inside a tenant transaction with
`app.business_id` set (`M1-ARCHITECTURE.md` §3.3). The "Database operations" column
assumes that wrapper, so it lists the entity work rather than the setting itself.

**Pagination.** List endpoints accept `page` (default 1) and `limit` (default 50, max
100) and return `{ data, pagination: { currentPage, totalPages, total } }`, matching the
existing `userController` shape.

**Rate limits.** The existing IP limiters stay. The kiosk routes add the kiosk-keyed and
employee-keyed limiters from `M1-KIOSK-SECURITY.md` §7. Disabled under `NODE_ENV=test`.

**Safe errors.** No endpoint returns `error.message`, a stack trace, an employee id, a
badge value, a phone number, or an attendance state in a failure body. Failures use the
safe-message table in `M1-KIOSK-SECURITY.md` §10. An unknown QR and a cross-business QR
return the same message.

**Error cases column.** Every endpoint can also return `500 INTERNAL_ERROR` for an
unexpected fault; that case is omitted from each row to keep the tables readable and is
covered once by `M1-ARCHITECTURE.md` §6.

---

## 1. Authentication

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| POST | `/api/auth/login` | public | body `{ email, password }` | `{ success, token, user: { id, email, firstName, lastName, role, businessId, mustChangePassword } }` | `loginSchema` (existing): email format, password non-empty | `SELECT * FROM authenticate_lookup($1)` (SECURITY DEFINER); bcrypt compare; audit login | `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED` (identical for unknown email and wrong password), `403 ACCOUNT_DEACTIVATED`, `429 RATE_LIMITED` |
| POST | `/api/auth/logout` | STAFF, HR, SUPERADMIN | bearer header | `{ success, message }` | `authMiddleware` | audit logout | `401 UNAUTHENTICATED` |
| POST | `/api/auth/refresh` | STAFF, HR, SUPERADMIN | body `{ refreshToken }` | `{ token, refreshToken, expiresIn }` | token present and well-formed; **Provisional O12** | lookup refresh record, rotate, revoke if account inactive; audit | `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED` (expired or revoked), `403 ACCOUNT_DEACTIVATED` |
| GET | `/api/auth/me` | STAFF, HR, SUPERADMIN | bearer header | `{ success, data: { id, email, firstName, lastName, role, businessId, department, jobTitle, mustChangePassword } }` | `authMiddleware` | `SELECT` own user in tenant transaction | `401 UNAUTHENTICATED` |
| POST | `/api/auth/recovery/request` | public | body `{ email }` | `{ success, message }` (always the same, whether or not the email exists) | email format; resend no more often than once every 60 seconds per account and per IP | lookup the user by email; on a hit `INSERT email_recovery_codes` with a keyed hash of a six-digit code, 10-minute expiry; send through the email adapter; audit `email.recovery_issued`. No code value is logged | `400 VALIDATION_FAILED`, `429 RATE_LIMITED` |
| POST | `/api/auth/recovery/verify` | public | body `{ email, code, newPassword }` | `{ success, message }` | code is six digits; newPassword meets the password policy; the code is unexpired and unused | lock the recovery row; constant-time compare; on a match set the password, bump `tokenVersion`, mark the code used; on a mismatch increment `attemptCount`, lock at five; audit | `400` (wrong or expired code, same message), `401 UNAUTHENTICATED`, `409 CONFLICT` (code already used), `429` (attempts exhausted) |

Password change and administrative password reset stay under `/api/users` because that is
where they live today. `PUT /api/users/change-password` (self, any authenticated role) and
`PUT /api/users/:id/reset-password` (SUPERADMIN any, HR STAFF only) keep their current
contracts and gain the tenant scope. Email codes are for account recovery only (O6); they
are never part of the kiosk clock-in path.

**Recovery order (O7).** A forgotten PIN is reset by HR through the audited route in §4; a
lost or broken badge is reissued and the old credential revoked; any other failure goes to
a correction request (§8). A failed attempt is never a successful punch.

**PRD §18 coverage:** Authentication (login, session handling, password changes,
authorized profile access, account recovery). **§16** covers recovery. **§20** covers
token handling.

---

## 2. Public website

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| GET | `/api/public/preview` | public | none | `{ success, data: { branding, sampleStats, sampleRows } }` | none; returns fictional sample data only | none. Reads no tenant table (PRD §6 privacy rule) | none |
| POST | `/api/public/business-registration` | public | body `{ businessName, adminFirstName, adminLastName, adminEmail }` | `201 { success, data: { businessId } }` or `501 NOT_IMPLEMENTED` | **O1**: operator provisioning, so this endpoint is not shipped. If O1 is later reversed, it needs its own validation and abuse limits | would create `businesses` and the first SUPERADMIN | `400`, `409 CONFLICT`, `501` while excluded |

The public preview never touches live attendance or employee data (PRD §6). The sample
rows are static.

---

## 3. Staff

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| GET | `/api/staff/attendance` | STAFF (self) | query `startDate, endDate, page, limit` | paginated own attendance rows | date range well-formed and ordered | `SELECT attendances WHERE business_id AND user_id = self` | `400`, `401` |
| GET | `/api/staff/schedule` | STAFF (self) | query `from, to` | `{ data: [ { shiftId, shiftName, date, startMinute, endMinute } ] }` | dates well-formed | `SELECT shift_assignments` joined to `shifts`, effective in range | `400`, `401` |
| GET | `/api/staff/off-days` | STAFF (self) | query `from, to` | `{ data: [ { date, kind, name } ] }` | dates well-formed | `SELECT work_calendars` and `calendar_exceptions` for the business default calendar; absence rule is in `M1-DATA-MODEL.md` §8 | `400`, `401` |
| POST | `/api/staff/help-requests` | STAFF (self) | body `{ category, subject, body }` | `201 { data: { id, status } }` | category in allowlist (`pin`, `kiosk`, `profile`, `access`, `other`), subject ≤120, body ≤4000 | `INSERT attendance_help_requests` (requester forced to self) | `400`, `401` |
| GET | `/api/staff/help-requests` | STAFF (self) | query `status, page, limit` | paginated own requests | status enum, paging | `SELECT WHERE business_id AND requester_id = self` | `400`, `401` |
| GET | `/api/staff/help-requests/:id` | STAFF (self) | param `id` | `{ data: request }` | id is uuid | `SELECT` with ownership check | `400`, `401`, `403`, `404` |
| GET | `/api/staff/corrections` | STAFF (self) | query `status, page, limit` | paginated own corrections | status enum, paging | `SELECT WHERE business_id AND requested_by_id = self` | `400`, `401` |
| GET | `/api/staff/corrections/:id` | STAFF (self) | param `id` | `{ data: correction }` | id uuid | `SELECT` with ownership check | `400`, `401`, `403`, `404` |
| GET | `/api/staff/profile` | STAFF (self) | bearer header | `{ data: profile }` | `authMiddleware` | `SELECT` own user | `401` |
| PATCH | `/api/staff/profile` | STAFF (self) | body of permitted fields | `{ data: updated }` | allowlist: `firstName, lastName, email, phoneNumber, profileImageUrl`; email format; phone format | `UPDATE` own user; audit | `400`, `401`, `409` (email taken) |
| POST | `/api/staff/profile/change-pin` | STAFF (self) | bearer header; body `{ currentPin, newPin }` | `{ data: { pinUpdatedAt } }` | `currentPin` is six digits; `newPin` meets the PIN policy and differs from `currentPin`; five failed attempts lock the account and rate limits apply per account (R5 sets the exact numbers) | constant-time compare against `User.pinHash`; on a match rehash into `pinHash`, set `pinUpdatedAt`, clear `mustChangePin`; `INSERT audit_logs` with actor and outcome only, never a PIN value | `400`, `401`, `429` (attempts exhausted or temporarily locked) |

Staff cannot clock in or out from this area. The PRD §7 rule that staff use the kiosk means
the clock-in and clock-out contracts live under Attendance (§8) and require a kiosk token.
Correction submission moved to `POST /api/attendance/corrections` (§8); this area keeps the
self-scoped correction reads. No leave endpoint exists: leave is deferred to version two
(O16).

**PRD §18 coverage:** Staff (personal attendance history, schedule, help requests,
correction reads). Reconciliation with existing `/api/attendance/my-attendance` is in §12.

---

## 4. HR

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| GET | `/api/hr/attendance` | HR, SUPERADMIN | query `startDate, endDate, employeeId, shiftId, department, status, page, limit` | paginated business attendance with employee summary | filters validated; range bounded | `SELECT attendances WHERE business_id` plus filters | `400`, `401`, `403` |
| GET | `/api/hr/attendance/summary` | HR, SUPERADMIN | query `date` | `{ expected, clockedIn, late, incomplete, exceptions }` | date well-formed | aggregate counts over `attendances` for the date | `400`, `401`, `403` |
| GET | `/api/hr/attendance/exceptions` | HR, SUPERADMIN | query `startDate, endDate, type` | paginated exceptions | type in `{ CLOCK_OUT_MISSING, REQUIRES_REVIEW, ABSENT, LOCATION_FLAGGED }` | `SELECT` status in the set, plus attempts with `locationResult IN (OUTSIDE, UNKNOWN)` | `400`, `401`, `403` |
| GET | `/api/hr/employees` | HR, SUPERADMIN | query `search, department, isActive, page, limit` | paginated employees | paging; HR is scoped to STAFF in the service | `SELECT users WHERE business_id`; HR filter to `role = STAFF` | `400`, `401`, `403` |
| POST | `/api/hr/employees` | HR, SUPERADMIN | body `{ firstName, lastName, email, department, role?, phoneNumber?, jobTitle? }` | `201 { data, tempPassword }` | HR may request `STAFF` only; email format; server generates the password | `INSERT users` with `business_id` forced from tenant; audit | `400`, `401`, `403` (HR asking for HR or SUPERADMIN), `409` (email taken) |
| PATCH | `/api/hr/employees/:id` | HR, SUPERADMIN | body allowlist | `{ data: updated }` | HR may act on STAFF only; SUPERADMIN role and active changes guarded by the last-superadmin rule | `UPDATE users`; audit | `400`, `401`, `403`, `404`, `409` |
| POST | `/api/hr/users/:id/reset-pin` | HR, SUPERADMIN | param `id`; body `{ reason }` | `201 { data: { userId, pinUpdatedAt } }` | target is STAFF in the tenant; HR acts on STAFF only; reason required, ≤500 | one transaction: generate a new PIN, store `pinHash` and `pinSalt`, clear `pinFailedCount` and `pinLockedUntil`, set `pinUpdatedAt`; `INSERT audit_logs` with actor, target and reason. HR never sees the old or new PIN in the response | `400`, `401`, `403`, `404` |
| GET | `/api/hr/help-requests` | HR, SUPERADMIN | query `status, page, limit` | paginated business requests | status enum | `SELECT WHERE business_id` | `400`, `401`, `403` |
| PATCH | `/api/hr/help-requests/:id` | HR, SUPERADMIN | body `{ status, resolutionNote? }` | `{ data: updated }` | status enum; note length | `UPDATE attendance_help_requests`; audit | `400`, `401`, `403`, `404` |
| GET | `/api/hr/corrections` | HR, SUPERADMIN | query `status, reviewTier, page, limit` | paginated business corrections with `reviewTier` on each row | status enum; tier in `{ SAME_DAY, ESCALATED }` | `SELECT attendance_corrections WHERE business_id` | `400`, `401`, `403` |
| PATCH | `/api/hr/corrections/:id/decision` | HR, SUPERADMIN | body `{ decision, note?, backstopCondition?, backstopReason? }` | `{ data: { correction, attendance, escalation: { type, condition } } }` | decision in `{ APPROVED, REJECTED }`; no self-approval (rejected with `403`); `ESCALATED` tier may only be decided by SUPERADMIN acting as backstop, or a second HR user (never the requester); backstop requires `backstopCondition` in `{ UNCLAIMED_24H, CONFLICT_OF_INTEREST, EXPLICIT_HANDOFF }` and `backstopReason` (non-empty, ≤500); enforce backstop eligibility server-side; explicit handoff is auditable; write `correction.decided` or `correction.decided.backstop` (and `correction.escalated` on explicit handoff) to `audit_logs` with original/proposed/approved values, actor/role, target, attendanceId, correctionId, condition, reason | one transaction: `SELECT` correction and attendance; `UPDATE attendance_corrections`; on approval `UPDATE attendances` and `INSERT attendance_correction_revisions`; `INSERT audit_logs` with distinct action and backstop metadata | `400`, `401`, `403` (self-approval, insufficient tier, backstop not eligible), `404`, `409` (already decided) |

`reviewTier` is set at submission: `SAME_DAY` when the record's date is the current business
day, `ESCALATED` when it is older and still inside the seven-day window (O17). Nobody
approves their own record.

HR sees only its own business (PRD §4.2), and the tenant scope plus RLS enforce it.

**PRD §18 coverage:** HR (business-scoped attendance queries, employee management,
authorized reviews, PIN reset).

---

## 5. Business settings

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| GET | `/api/business/settings` | SUPERADMIN | none | `{ data: { name, timezone, branding, retentionYears, retentionEnabled } }` | none | `SELECT businesses WHERE id = tenant` | `401`, `403` |
| PATCH | `/api/business/settings` | SUPERADMIN | body `{ name?, timezone?, logoUrl?, brandColor?, supportEmail?, supportPhone? }` | `{ data: updated }` | timezone must be a valid IANA name | `UPDATE businesses`; audit before and after | `400`, `401`, `403` |
| GET | `/api/business/shifts` | SUPERADMIN, HR (read) | query `isActive` | `{ data: shifts }` | none | `SELECT shifts WHERE business_id` | `401`, `403` |
| POST | `/api/business/shifts` | SUPERADMIN | body `{ name, startMinute, endMinute, crossesMidnight? }` | `201 { data: shift }` | minutes 0..1439; name ≤80 and unique per business | `INSERT shifts`; audit | `400`, `401`, `403`, `409` |
| PATCH | `/api/business/shifts/:id` | SUPERADMIN | body `{ name?, startMinute?, endMinute?, crossesMidnight?, isActive? }` | `{ data: updated }` | same as create; changing times does not rewrite history | `UPDATE shifts`; audit | `400`, `401`, `403`, `404`, `409` |
| POST | `/api/business/shifts/:id/deactivate` | SUPERADMIN | none | `{ success, message }` | shift exists in tenant | `UPDATE shifts SET is_active = false`; audit. Never deletes attendance (PRD §11) | `401`, `403`, `404`, `409` |
| POST | `/api/business/shifts/:id/assignments` | SUPERADMIN | body `{ employeeId, effectiveFrom }` | `201 { data: assignment }` | employee in tenant and active; date well-formed | one transaction: close the employee's open assignment (`effectiveTo = effectiveFrom`), `INSERT shift_assignments`, sync `users.shift_id`; audit | `400`, `401`, `403`, `404`, `409` |
| GET | `/api/business/assignments` | SUPERADMIN, HR | query `employeeId?` | `{ data: assignments }` | id uuid | `SELECT shift_assignments WHERE business_id` | `400`, `401`, `403` |
| DELETE | `/api/business/assignments/:id` | SUPERADMIN | param `id` | `{ success }` | id uuid | `UPDATE shift_assignments SET effective_to = now()`; audit | `400`, `401`, `403`, `404` |
| GET | `/api/business/policies` | SUPERADMIN | none | `{ data: [ { policy, versions } ] }` | none | `SELECT workplace_policies` and `policy_versions` | `401`, `403` |
| POST | `/api/business/policies` | SUPERADMIN | body `{ name, shiftId?, graceLateMinutes, graceEarlyMinutes, earlyThresholdMinutes, autoClockOutEnabled, autoClockOutBufferMinutes?, autoClockOutMaxOpenMinutes?, correctionWindowDays?, geoFenceRadiusMeters?, locationAccuracyThresholdMeters?, gpsFreshnessSeconds?, observePublicHolidays?, effectiveFrom }` | `201 { data: { policy, version } }` | grace 0..120; buffer 0..720; max open 60..1440; correction window 1..7 (O17); geo radius 25..1000; accuracy 10..500; freshness 10..600; timezone-aware date | transaction: `INSERT workplace_policies`, `INSERT policy_versions` version 1; audit | `400`, `401`, `403`, `409` |
| POST | `/api/business/policies/:id/versions` | SUPERADMIN | the same timing fields plus `effectiveFrom` | `201 { data: version }` | `effectiveFrom` after the current version's start; monotonic version number | transaction: close the current version (`effectiveTo`), `INSERT policy_versions`; audit | `400`, `401`, `403`, `404`, `409` |
| GET | `/api/business/calendars` | SUPERADMIN, HR (read) | none | `{ data: [ { calendar, exceptions } ] }` | none | `SELECT work_calendars` and `calendar_exceptions` | `401`, `403` |
| PATCH | `/api/business/calendars/:id` | SUPERADMIN | body `{ name?, monday?..sunday?, timezone?, isDefault? }` | `{ data: updated }` | at most one default calendar per business (O22) | `UPDATE work_calendars`; audit | `400`, `401`, `403`, `404`, `409` |
| POST | `/api/business/calendars/:id/exceptions` | SUPERADMIN | body `{ date, kind, name }` | `201 { data: exception }` | kind in `{ HOLIDAY, WORKING_OVERRIDE }`; unique per calendar and date | `INSERT calendar_exceptions`; audit | `400`, `401`, `403`, `404`, `409` |
| POST | `/api/business/employees/:id/qr-credential` | SUPERADMIN | param `id` | `201 { data: { id, qrPayload } }` (payload shown once) | employee in tenant and active; **O5** SUPERADMIN prints | transaction: revoke the employee's active credential, `INSERT qr_credentials`; audit `qr.reissued` | `400`, `401`, `403`, `404` |
| POST | `/api/business/qr-credentials/:id/revoke` | SUPERADMIN | param `id` | `{ success }` | id uuid | `UPDATE qr_credentials SET revoked_at`; audit | `400`, `401`, `403`, `404` |

Only the SUPERADMIN configures the business (PRD §4.3). Every change is validated and
persisted, and no change rewrites historical attendance (PRD §9): the shift and policy
snapshots on `attendances` are untouched.

**Timing policy is effective-dated (O15).** The grace period, the auto-clock-out buffer and
maximum, the correction window, the geo-fence and accuracy defaults, and the holiday
observation flag live on `PolicyVersion`, each version carrying `effectiveFrom` and
`effectiveTo`. A change takes effect from the next midnight in the business time zone, is
saved as a new version, and never recalculates historical classifications. A shift that
crosses midnight is evaluated against the policy in force when it started (R4).

**Kiosk administration moved.** The `/api/business/kiosks` routes from the earlier draft are
replaced by the pairing and device routes in §7 (`/api/kiosk/pairing-codes`,
`/api/kiosk/devices`).

**PRD §18 coverage:** Business settings (profile, shifts, assignments, effective-dated
timing policy, working calendar and holidays, employee QR issuance).

---

## 6. Sites and geo-fences

A `Site` is a place of work with a geo-fence centre and radius (O4, O22). The radius is an
example value, not a fixed rule: an attempt outside the fence is flagged, never blocked.

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| GET | `/api/sites` | SUPERADMIN, HR (read) | query `isActive, page, limit` | paginated sites | paging | `SELECT sites WHERE business_id` | `400`, `401`, `403` |
| POST | `/api/sites` | SUPERADMIN | body `{ name, latitude, longitude, radiusMeters?, isActive? }` | `201 { data: site }` | name ≤80 and unique per business; latitude −90..90; longitude −180..180; radiusMeters 25..1000, default from the policy | `INSERT sites` with `business_id` forced from tenant; audit | `400`, `401`, `403`, `409` |
| PATCH | `/api/sites/:id` | SUPERADMIN | body `{ name?, latitude?, longitude?, radiusMeters?, isActive? }` | `{ data: updated }` | same as create; a radius change does not rewrite past attempt assessments | `UPDATE sites`; audit | `400`, `401`, `403`, `404`, `409` |
| POST | `/api/sites/:id/deactivate` | SUPERADMIN | none | `{ success, message }` | site exists in tenant | `UPDATE sites SET is_active = false`; audit. Kiosks and past attempts keep their `site_id` | `401`, `403`, `404`, `409` |

A kiosk may be bound to a site; an attempt records the site whose fence was evaluated
(`M1-KIOSK-SECURITY.md` §6). Deactivating a site stops it from being used for new
assessments and leaves history intact.

**PRD §18 coverage:** Business settings (sites and geo-fences). **O4** and
`M1-KIOSK-SECURITY.md` §6 cover the assessment rules.

---

## 7. Kiosk pairing and verification

The kiosk authenticates as a device and verifies employees with a QR badge plus a PIN. The
pairing flow replaces the earlier registration-plus-secret flow (`M1-KIOSK-SECURITY.md`
§2). Every route below except `POST /api/kiosk/pair` requires a kiosk device token; the
device management routes require a SUPERADMIN session.

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| POST | `/api/kiosk/pairing-codes` | SUPERADMIN | body `{ label, siteId? }` | `201 { data: { kioskId, publicId, pairingCode, expiresAt } }` (code shown once) | label ≤80; site in tenant if supplied | one transaction: create or reuse the `KioskTerminal` row with `state = PENDING_PAIRING`, store only `pairingCodeHash` (keyed with the pairing key), set `pairingCodeExpiresAt = now + 10 minutes`; audit | `400`, `401`, `403`, `404` |
| POST | `/api/kiosk/pair` | public (unpaired device) | body `{ pairingCode }` | `{ token, publicId, expiresAt }` (kiosk token, 30-day window) | code present; terminal `state = PENDING_PAIRING` and `pairingCodeExpiresAt` not passed; rate limited by kiosk and IP | constant-time compare of the keyed hash; on a match clear `pairingCodeHash` and expiry, set `state = ACTIVE`, `pairedAt = now`, store `tokenHash`, issue token; audit `kiosk.paired` | `400` (wrong or expired code, same message), `429 RATE_LIMITED` |
| POST | `/api/kiosk/token/renew` | kiosk | bearer kiosk token | `{ token, expiresAt }` | token present, `state = ACTIVE`, `tokenVersion` current; renewal never extends past 90 days from `tokenIssuedAt` | recheck the terminal on every call; move `tokenExpiresAt = now + 30 days`, update `lastSeenAt`, rotate `tokenHash`; audit `kiosk.token_renewed`. Past the 90-day maximum the terminal returns to `PENDING_PAIRING` | `401` (revoked, wrong version, or expired), `403` (business inactive), `429` |
| GET | `/api/kiosk/devices` | SUPERADMIN | query `state, siteId, page, limit` | paginated devices with `state`, `lastSeenAt`, `pairedAt` | paging; state in `{ PENDING_PAIRING, ACTIVE, REVOKED, EXPIRED }` | `SELECT kiosk_terminals WHERE business_id` | `400`, `401`, `403` |
| POST | `/api/kiosk/devices/:id/revoke` | SUPERADMIN | param `id`; body `{ reason? }` | `{ data: revoked }` | id uuid; terminal in tenant | `UPDATE kiosk_terminals SET state = REVOKED`, increment `tokenVersion`, `revoked_at`, `revoked_by_user_id`; audit `kiosk.revoked`. History preserved; re-pairing issues a new token | `400`, `401`, `403`, `404`, `409` |
| POST | `/api/kiosk/identify` | kiosk | body `{ qrToken, latitude, longitude, accuracyMeters, capturedAt }` | `{ sessionId, employeeDisplayName, permittedAction, locationResult }` (no employee id, no phone) | qr token format; location fields optional but validated when present; rate limited per kiosk | verify kiosk (§7 device check); hash the token and match `qr_credentials`; confirm employee active and in the kiosk's business; compute the permitted action from current state; evaluate the location against the kiosk's site; `INSERT verification_sessions` (`QR_ACCEPTED`) and `INSERT attendance_attempts` with the location fields and `locationResult`; audit `verify.session_started` | `400`, `401`, `403` (inactive employee), `404` (unknown or cross-business QR, same message), `429` |
| POST | `/api/kiosk/verify-pin` | kiosk | body `{ sessionId, pin }` | `{ result, action, status }` | session `QR_ACCEPTED` or `PIN_PENDING`, unexpired, bound to this kiosk; pin is 6 digits; rate limited per employee and per kiosk | constant-time compare against `User.pinHash` with `pinSalt`; on a match set session `VERIFIED` and clear the PIN failure counter; on a mismatch increment the session attempt count and `pinFailedCount`, and at the limit set session `LOCKED` and `pinLockedUntil`, audit `pin.verify_failed` and `pin.locked` | `400` (wrong PIN, attempts left not disclosed), `401`, `403`, `404`, `429` (attempts exhausted or temporarily locked) |
| POST | `/api/kiosk/cancel` | kiosk | body `{ sessionId }` | `{ success }` | session bound to this kiosk | `UPDATE verification_sessions` to `EXPIRED`; audit | `400`, `401`, `403`, `404` |

The identify and verify messages follow the safe-message table in `M1-KIOSK-SECURITY.md`
§10. An unknown QR and a cross-business QR return the same message, so the kiosk does not
confirm whether a token exists in another business. A QR alone never authorizes a punch.
PIN attempt limits, temporary lockouts and employee-keyed rate limits carry the exact
values from R5 once the owner confirms them.

**Location (O4).** Requests carry `latitude`, `longitude`, `accuracyMeters` and
`capturedAt`. The response and the stored attempt record `locationResult` as `INSIDE`,
`OUTSIDE` or `UNKNOWN`. Poor accuracy or a stale capture gives `UNKNOWN`, never `OUTSIDE`.
`OUTSIDE` and `UNKNOWN` are flagged for review, not blocked.

**PRD §18 coverage:** Kiosk identification (pairing, device management, kiosk validation,
QR validation, PIN verification, verification-session creation). **§10.3** covers the
security rules.

---

## 8. Attendance

A punch needs a kiosk device token and a single-use `VERIFIED` verification session. A
staff session cannot reach these routes, which is the PRD §7 rule that the kiosk records
attendance. The punch recomputes the action server-side and does not trust a
client-supplied action (PRD §10.2 step 5).

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| POST | `/api/attendance/clock-in` | kiosk | body `{ verificationSessionId, latitude, longitude, accuracyMeters, capturedAt }` | `201 { data: attendance }` | session is `VERIFIED`, unexpired, unconsumed, bound to this kiosk; the server-derived action is `CLOCK_IN`; the employee has no open session | one transaction: lock the session, set `CONSUMED`, resolve shift and policy effective now, `INSERT attendances` with snapshots, `INSERT attendance_attempts` with the location fields and `locationResult`, audit `attendance.recorded`; flag `OUTSIDE` and `UNKNOWN` with `attendance.location_flagged` | `400`, `401`, `403`, `404`, `409` (open session already exists) |
| POST | `/api/attendance/clock-out` | kiosk | body `{ verificationSessionId, latitude, longitude, accuracyMeters, capturedAt }` | `200 { data: attendance }` | session conditions as above; the server-derived action is `CLOCK_OUT`; an open session exists | one transaction: set session `CONSUMED`, `UPDATE attendances` set `clock_out`, `session_status = CLOSED`, `closure_reason = VERIFIED_CLOCK_OUT`, recompute hours, `INSERT attendance_attempts` with the location fields; audit | `400` (no open session), `401`, `403`, `404`, `409` |
| POST | `/api/attendance/assisted` | HR, SUPERADMIN | body `{ employeeId, action, occurredAt, reason }` | `201` or `200 { data: attendance }` | **Provisional O7** HR-assisted override; reason required; employee in tenant; the actor cannot be the target | transaction: create or close the attendance with `closure_reason = HR_ASSISTED`; `audit attendance.assisted` with actor and reason | `400`, `401`, `403`, `404`, `409` |
| POST | `/api/attendance/corrections` | STAFF, HR (self) | body `{ attendanceId, reason, proposedClockIn?, proposedClockOut? }`, optional `attemptId` for a failed punch (R6) | `201 { data: { id, status: SUBMITTED, reviewTier } }` | id uuid; reason required and ≤2000; the attendance belongs to the caller; the record's date is within the correction window (default seven days, O17); no open correction for the row; an HR officer submitting on their own record is still never the approver of it (R7) | `SELECT` the attendance; compute `reviewTier` (`SAME_DAY` or `ESCALATED`); `INSERT attendance_corrections` with `originalValues`; audit | `400`, `401`, `403`, `404`, `409` when an open correction already exists or the window has passed |
| GET | `/api/attendance/my-attendance` | STAFF (self) | query `startDate, endDate, page, limit` | paginated own rows | date range | `SELECT WHERE business_id AND user_id = self` | `400`, `401` |
| GET | `/api/attendance/all-attendance` | HR, SUPERADMIN | query as §4 | paginated business rows | filters validated | `SELECT WHERE business_id` | `400`, `401`, `403` |
| PATCH | `/api/attendance/:id/dismiss-alert` | STAFF (self), HR | param `id` | `{ success }` | id uuid; self owns the row unless HR | `UPDATE attendances SET alert_dismissed_at` (a dedicated column replaces the remarks string) | `400`, `401`, `403`, `404` |

Duplicate requests cannot create two punches: the session is single-use, and
`attendances.source_verification_session_id` is unique (PRD §10.3, §17).

**Corrections (O17).** An employee may correct their own record within seven days with a
reason. HR approves same-day fixes; older fixes follow a stricter review and are stored as
`reviewTier = ESCALATED`. Nobody approves their own record. The decision route is
`PATCH /api/hr/corrections/:id/decision` (§4), and the full history is append-only. No
attachments in v1.

**PRD §18 coverage:** Attendance (atomic clock-in and clock-out transitions, corrections,
audit records). **§16** covers recovery.

---

## 9. Background jobs

The automatic clock-out runs on a schedule (`M1-ARCHITECTURE.md` §4). The HTTP surface
exists for a manual pass and for status.

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| POST | `/api/jobs/auto-clock-out/run` | job (service token) | body `{ businessId? }` | `{ closed, flagged, businesses }` | service token matches `JOB_TOKEN`; idempotent | advisory lock; per business tenant transaction: close eligible open sessions, flag ambiguous ones, `INSERT audit_logs` | `401`, `409 CONFLICT` (another run holds the lock), `500` |
| GET | `/api/jobs/status` | SUPERADMIN (own), job | none | `{ lastRun, closed, flagged }` | none | `SELECT audit_logs` for `actor_type = SYSTEM` | `401`, `403` |

The job runs every 15 minutes. An open session past scheduled shift end plus a buffer
(default two hours) is closed at the scheduled shift end and flagged; with no shift it
closes after a maximum duration (default 14 hours, O8). The job is idempotent: it only
closes rows still `OPEN`, so a rerun matches nothing. Turning it on or off is a business
setting in the effective-dated timing policy (§5).

**PRD §18 coverage:** Background jobs (configurable, shift-aware automatic closure).
**§13** covers the rules.

---

## 10. Reporting

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| GET | `/api/reports/attendance-register` | HR, SUPERADMIN | query `startDate, endDate, employeeId?, shiftId?, page, limit` | paginated register rows | range bounded; filters validated | `SELECT attendances WHERE business_id` | `400`, `401`, `403` |
| GET | `/api/reports/punctuality-summary` | HR, SUPERADMIN | query `startDate, endDate, groupBy` | counts of early, on time, late, absent | groupBy in `{ employee, shift, day }` | aggregate over `attendances.status` | `400`, `401`, `403` |
| GET | `/api/reports/exceptions` | HR, SUPERADMIN | query `startDate, endDate` | exception list, including location flags | range bounded | `SELECT` status in the exception set and attempts with `locationResult IN (OUTSIDE, UNKNOWN)` | `400`, `401`, `403` |
| GET | `/api/reports/attendance-register/export` | HR, SUPERADMIN | query range, `format=csv` | `text/csv` stream | **O9** three reports in CSV first; range bounded; times in the business time zone; cells beginning `=`, `+`, `-` or `@` are prefixed with an apostrophe | streamed `SELECT WHERE business_id` | `400`, `401`, `403` |

Reports are business-scoped and read the historical snapshots, so a report for an old
period shows the shift and policy that were in force then (PRD §12).

**PRD §18 coverage:** Reporting (authorized attendance reports, filters, exports).

---

## 11. Audit

| Method | Path | Roles | Request | Response | Validation | Database operations | Error cases |
|--------|------|-------|---------|----------|------------|---------------------|-------------|
| GET | `/api/audit` | SUPERADMIN, HR (limited) | query `actorUserId?, action?, entityType?, startDate?, endDate?, page, limit` | paginated audit entries | filters validated; HR sees attendance, location, PIN-reset and correction events only | `SELECT audit_logs WHERE business_id` | `400`, `401`, `403` |
| GET | `/api/audit/:id` | SUPERADMIN | param `id` | `{ data: entry }` | id uuid | `SELECT` | `400`, `401`, `403`, `404` |
| GET | `/api/audit/corrections/:attendanceId` | SUPERADMIN, HR | param `attendanceId` | `{ data: [ corrections ] }` | id uuid | `SELECT attendance_corrections`, `attendance_correction_revisions` and related audits | `400`, `401`, `403`, `404` |

The audit log records `correction.decided` (normal HR decision), `correction.decided.backstop` (SUPERADMIN backstop decision), and `correction.escalated` (explicit handoff). All correction decisions include original, proposed and approved values, actor/role, target user, attendanceId, correctionId, reason, and, for backstop, the backstop condition. No audit row carries a PIN, a pairing code, a token or a badge value (`M1-KIOSK-SECURITY.md` §11).

**PRD §18 coverage:** Audit (authorized retrieval of audit and correction history).

---

## 12. Reconciliation with the current API

The three mounted routers today are `/api/users`, `/api/auth`, `/api/attendance`. The
following table records what changes.

| Current route | Disposition |
|---------------|-------------|
| `POST /api/auth/login`, `POST /api/auth/logout` | Kept; login adds `businessId` to the response and the token context |
| `PUT /api/users/change-password`, `PUT /api/users/:id/reset-password` | Kept unchanged |
| `POST /api/users`, `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id` | Kept under `/api/users` for account administration; the HR-scoped views in §4 wrap the same service and add tenant scope. These five have no role column in the legacy router, so the roles are stated here: `POST /api/users` is SUPERADMIN only and creates a user inside its own business; `GET /api/users` and `GET /api/users/:id` are SUPERADMIN; `PUT /api/users/:id` is SUPERADMIN (HR reaches the same service through the §4 wrapper); `DELETE /api/users/:id` is SUPERADMIN only and deactivates rather than deleting a row, which increments `tokenVersion`, revokes the QR credential and disables the PIN (O12) |
| `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out` | Moved to kiosk authentication with a `VERIFIED` QR-plus-PIN session. A staff token no longer reaches these (M0 finding N5, PRD §7) |
| `GET /api/attendance/my-attendance` | Superseded by `GET /api/staff/attendance`; the old path may be kept as an alias for one release |
| `GET /api/attendance/all-attendance` | Superseded by `GET /api/hr/attendance` with the tenant filter the current query lacks |
| `PATCH /api/attendance/:id/dismiss-alert` | Kept; writes `alert_dismissed_at` instead of appending to `remarks` |
| Earlier `/api/otp/*` draft routes | Removed. Replaced by `POST /api/kiosk/identify`, `POST /api/kiosk/verify-pin`, and the paired-device routes in §7 |
| Earlier `/api/business/kiosks/*` draft routes | Moved to `/api/kiosk/pairing-codes` and `/api/kiosk/devices` in §7 |
| Earlier `/api/staff/corrections` submit | Moved to `POST /api/attendance/corrections` in §8; self-scoped reads stay under `/api/staff/corrections` |
| Any leave route | Not present. Leave is deferred to version two (O16) |

The current handlers return `error.message` in 500 bodies (M0 finding N4). Every route in
this document uses the typed error contract instead, and the kiosk routes return the safe
messages from `M1-KIOSK-SECURITY.md` §10.

---

## 13. Screen-to-endpoint traceability (PRD §19)

PRD §19 requires each screen action to map to an endpoint. The mapping below covers the
areas built in M1; the UI design phase owns the full screen inventory.

| Screen action | Endpoint |
|---------------|----------|
| Staff signs in | `POST /api/auth/login` |
| Staff requests a password reset | `POST /api/auth/recovery/request`, `POST /api/auth/recovery/verify` |
| Staff views own attendance | `GET /api/staff/attendance` |
| Staff submits a help request | `POST /api/staff/help-requests` |
| Staff submits a correction | `POST /api/attendance/corrections` |
| Staff views own corrections | `GET /api/staff/corrections` |
| Staff changes their PIN | `POST /api/staff/profile/change-pin` |
| HR views the attendance table | `GET /api/hr/attendance` |
| HR reviews an exception | `GET /api/hr/attendance/exceptions` |
| HR reviews a correction | `GET /api/hr/corrections`, `PATCH /api/hr/corrections/:id/decision` |
| HR submits a correction on their own record | `POST /api/attendance/corrections` (decided by someone else; R7 is open) |
| HR resets a forgotten PIN | `POST /api/hr/users/:id/reset-pin` |
| SUPERADMIN edits business settings | `PATCH /api/business/settings` |
| SUPERADMIN edits the timing policy | `POST /api/business/policies`, `POST /api/business/policies/:id/versions` |
| SUPERADMIN creates a shift | `POST /api/business/shifts` |
| SUPERADMIN assigns a shift | `POST /api/business/shifts/:id/assignments` |
| SUPERADMIN manages sites | `POST /api/sites`, `PATCH /api/sites/:id` |
| SUPERADMIN issues a QR credential | `POST /api/business/employees/:id/qr-credential` |
| SUPERADMIN starts a device pairing | `POST /api/kiosk/pairing-codes` |
| SUPERADMIN views or revokes devices | `GET /api/kiosk/devices`, `POST /api/kiosk/devices/:id/revoke` |
| Kiosk pairs | `POST /api/kiosk/pair` |
| Kiosk identifies an employee | `POST /api/kiosk/identify` |
| Kiosk verifies the PIN | `POST /api/kiosk/verify-pin` |
| Kiosk punches | `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out` |
| Visitor views the public preview | `GET /api/public/preview` |

---

## 14. Open items for the owner

1. Confirm O12 (refresh flow). If it is declined, `POST /api/auth/refresh` is dropped and
   the access token keeps a working-day lifetime as it does today.
2. Confirm O7 (HR-assisted override) and the fields it may set, since it bypasses the
   kiosk QR-plus-PIN step by design.
3. Confirm O9 (report set and export format). The table covers register, punctuality
   summary, and exceptions in CSV.
4. Confirm R5 (PIN specifics: length, attempt limit, lockout duration) and R1 (GPS
   accuracy and stale-location thresholds). Both set values inside the contracts above.
5. Confirm R3 (scan surface) and R7 (independent approval for HR's own corrections). Each
   changes a route's role rule: R3 fixes whether `POST /api/kiosk/pair` is bound to a
   shared kiosk or an employee device, and R7 fixes who may decide an `ESCALATED` tier.
6. Confirm whether the two superseded attendance read paths (`my-attendance`,
   `all-attendance`) stay as aliases for one release or are removed.
