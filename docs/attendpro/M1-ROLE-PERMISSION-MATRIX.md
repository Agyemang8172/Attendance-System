# AttendPro M1 — Role and Permission Matrix

- **Date:** 2026-10-16
- **Milestone:** M1
- **Status:** design only. M1 is not approved and M2 is not authorized. No route, screen, or migration described here exists in code.
- **Baseline commit:** `f87ce1d`
- **Owner:** Architect Agent
- **Companions:** `docs/ATTENDPRO_PRD.md` (§4 is the authoritative role definition), `docs/attendpro/DECISION-REGISTER.md`, `docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md`, `docs/attendpro/M1-ARCHITECTURE.md`, `docs/attendpro/M1-DATA-MODEL.md`, `docs/attendpro/M1-KIOSK-SECURITY.md`

This document answers one question for every capability in version one: which of the three
roles may do it, and under exactly what restriction. It is written against the owner's
2026-10-16 review (the O and R rows in the decision register) and against the revised API
contracts and navigation map, so it can be checked line by line against both.

---

## 1. The three roles

PRD §4 defines exactly three business-level roles. There are no others in version one.

| Role | Purpose (PRD §4) | Who creates the account |
|------|------------------|-------------------------|
| STAFF | Views personal attendance and relevant employment information. | Created by HR (role forced to STAFF) or SUPERADMIN through the employee-management area. |
| HR | Monitors attendance and manages authorized employee and attendance workflows. | Created by SUPERADMIN. HR may not create HR accounts. |
| SUPERADMIN | Manages the configuration and users of their own business. | Created at business provisioning by the product owner's controlled process (O1, O11). Only one business, only that business's data. |

Two boundaries apply to all three rows:

- **SUPERADMIN is scoped to its own business.** It is not a platform-wide administrator (PRD §4.3, register O1/O11). It sees and changes one tenant and nothing else.
- **Every account belongs to exactly one business** and cannot switch memberships (PRD §5 rules 1 and 2). The business scope comes from the identity, never from a request parameter (`M1-ARCHITECTURE.md` §2.1).

## 2. Roles and capabilities not in version one

Version one ships three roles and no more. The following are explicitly out, each with the register row that put it out:

| Not in version one | Why | Register ref |
|--------------------|-----|--------------|
| Platform-operations administrator | No platform-wide operator login. The product owner provisions business accounts through a controlled seed or admin process. A dedicated operator role is revisited only on a concrete need. | O11 (with O1) |
| Public self-registration | No public sign-up for businesses or staff. The `/register` screen and the `POST /api/public/business-registration` endpoint do not ship. | O1 |
| Leave approver | Leave requests, leave allocation and timetable upload are deferred to version two. There is no leave workflow and therefore no one to approve one. Only calendars, working-day and off-day configuration, and absence stay in version one. | O16 |
| Kiosk user role | The kiosk is a paired **device**, not a role. Its token carries no employee identity and authorizes only the kiosk endpoints. Devices are not listed in the three-role model anywhere in this matrix; they appear in §3.3 and §4 as a separate credential class. | O3 |
| Biometric authentication | Fingerprint and facial recognition are excluded from the initial release (PRD §1). | PRD §1 |
| Any future role | A fourth role requires a PRD §4 change and owner approval. Nothing in this matrix may be relaxed "temporarily" to simulate one. | PRD §4 |

## 3. Permission matrix

Rows are capabilities, grouped by area. Columns are the three roles plus the exact
restriction that applies. Cell values are `allow`, `deny`, or `conditional`; the bracketed
marker after a cell points to the footnote directly under the tables. A `conditional` cell
is never a maybe: the condition is stated in the denial column or the footnote.

### 3.1 Identity and accounts

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| Sign in, refresh session, sign out | allow [a] | allow [a] | allow [a] | Every request re-verifies the account is active and the `tokenVersion` is current (O12). |
| View own profile | allow | allow | allow | Self rows only. |
| Edit permitted own profile fields | allow [b] | conditional [b] | conditional [b] | Self only; field allowlist. No self-profile route exists for HR or SUPERADMIN in the contracts — see §7 item 5. |
| Create an employee account | deny | conditional [c] | allow [c] | HR may create STAFF accounts only. SUPERADMIN may create any role in its own business, guarded by the last-superadmin rule. |
| Edit or deactivate an employee account | deny | conditional [c] | allow [c] | HR acts on STAFF only. Deactivation preserves history. |
| Change own password | allow | allow | allow | Self only. |
| Administratively reset a user's password | deny | conditional [c] | allow | HR resets STAFF only; SUPERADMIN resets anyone in its business. |
| Set or change own kiosk PIN | conditional [f] | conditional [f] | conditional [f] | Self only, but no route exists in the contracts yet — see §7 item 3. PIN is stored as a keyed hash (O2). |
| Reset another user's kiosk PIN | deny | conditional [d] | allow [d] | Target must be STAFF for HR; a reason is required; the actor never sees the old or new PIN; the action is audited (O2, O7). |
| Recover a locked-out account by email code | conditional [g] | conditional [g] | conditional [g] | Pre-sign-in, no role yet. Six digits, 10-minute expiry, single use, no account enumeration. Email codes are never part of the kiosk clock-in path (O6). |

### 3.2 Scheduling and calendars

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| View own assigned shifts and off-days | allow | deny [h] | deny [h] | Self rows only. The contracts expose own-schedule routes to STAFF only. |
| View the shift list | deny | allow | allow | HR is read-only. |
| Create, edit, activate, deactivate shifts | deny | deny | allow | Deactivation never deletes attendance history (PRD §11). |
| Assign employees to shifts | deny | deny | allow | Employee must be active and in the tenant; assignment is effective-dated. |
| View shift assignments | deny | allow | allow | Business scope only. |
| Manage the working calendar, working days, holidays and overrides | deny | conditional [i] | allow | HR reads only. One default calendar per business in v1 (O22). |
| Configure the timing policy (late grace, auto clock-out, correction window, geo-fence defaults) | deny | deny | allow [j] | Effective-dated versions; a change applies from the next business midnight and never recalculates history (O15). |
| View automatic clock-out job status | deny | deny | allow | Own business only. |

### 3.3 Kiosks and devices

The kiosk is a paired device, not a role (O3). Its token authorizes only the routes in the
`kiosk` column of §4 and carries no employee identity, so a stolen kiosk token never
becomes a stolen staff session.

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| Generate a one-time device pairing code | deny | deny | allow [k] | From the devices page. Code shown once, 10-minute expiry. |
| List kiosk devices and their state | deny | deny | allow | Own business only. |
| Revoke a kiosk device | deny | deny | allow [l] | State set to REVOKED, `tokenVersion` bumped, history preserved. |
| Pair a device (redeem a pairing code) | deny | deny | deny [m] | Held by an unpaired device, which is `public` until a token is issued. No web role performs this. |
| Renew a kiosk token | deny | deny | deny [m] | Kiosk token only; 30-day window, 90-day maximum age. |
| Identify an employee by QR | deny | deny | deny [m] | Kiosk token only. A QR alone never authorizes anything (O5). |
| Verify an employee PIN | deny | deny | deny [m] | Kiosk token only. |
| **Record a punch (clock-in or clock-out)** | **deny [n]** | **deny [n]** | **deny [n]** | **The most important denial in this matrix. A punch requires a kiosk device token and a single-use `VERIFIED` verification session. No web session of any role reaches the punch routes — not to punch for themselves and not to punch for anyone else (PRD §7, O2, O5). An HR-assisted override exists instead; see §3.5.** |

### 3.4 Sites and geo-fences

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| View sites | deny | conditional [o] | allow | HR is read-only. |
| Create, edit, activate, deactivate sites | deny | deny | allow [p] | A radius change does not rewrite past attempt assessments (O4). |
| Review location flags (OUTSIDE / UNKNOWN attempts) | deny | allow | allow | Flagged for review, never blocked; the employee is never told they are outside. |

### 3.5 Attendance records

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| View own attendance history | allow | allow | allow | Self rows only for STAFF; HR and SUPERADMIN reach their own rows through the business table. |
| View the business attendance table, summary and exceptions | deny | allow | allow | Own business only, derived from identity plus RLS (`M1-ARCHITECTURE.md` §2, §3). |
| Dismiss an attendance alert | conditional [q] | allow | deny [r] | STAFF dismisses own rows only. SUPERADMIN has no dismiss route — see §7 item 6. |
| Record an HR-assisted punch (override) | deny | conditional [s] | conditional [s] | Provisional O7. Reason required; the actor cannot be the target; closure reason `HR_ASSISTED`; audited. Bypasses the kiosk by design, so it needs owner confirmation. |

### 3.6 Corrections

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| Submit a correction to an attendance record | conditional [t] | deny [u] | deny [u] | Self rows only, within the correction window (default seven days), with a reason. No attachments in v1 (O17). |
| View own correction requests | allow | allow | allow | STAFF sees own only; HR and SUPERADMIN reach theirs through the business queue. |
| View the business correction queue | deny | allow | allow | Own business only. |
| Decide a same-day correction | deny | conditional [v] | allow [v] | The reviewer must not be the requester (PRD §4.2, §14, O17). Checked server-side. |
| Decide an escalated correction (older than same day, or raised by an HR user) | deny | conditional [w] | conditional [w] | R7 is open: who decides an HR user's own correction. See §7 item 1. Never the requester. |
| View correction revision history | deny | allow | allow | Append-only (`attendance_correction_revisions`, three enforcement layers). |

### 3.7 Help requests

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| Submit a help request | allow | deny [x] | deny [x] | Requester is forced to self; category allowlist. PRD §4.1 reserves submission for staff and the contracts have no HR or SUPERADMIN submit route. |
| View the business help-request queue | deny | allow | allow | Own business only. STAFF sees own requests through its own routes. |
| Resolve or close a help request | deny | allow | allow | Status change is audited. |

### 3.8 Reports and CSV exports

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| View reports (attendance register, punctuality summary, exceptions) | deny | allow | allow | Business scope; reports read historical snapshots, so an old period shows the policy that was in force then. |
| Export CSV | deny | conditional [y] | allow [y] | O9 three reports. Times in the business timezone; cells beginning `=`, `+`, `-`, `@` are prefixed with an apostrophe. The flags-and-corrections report is role-limited. |

### 3.9 Audit

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| View the audit log | deny | conditional [z] | allow | HR sees attendance, location, PIN-reset and correction events only; SUPERADMIN sees the full business log. |
| View one audit entry in full | deny | deny | allow | Own business only. |
| View correction history for an attendance row | deny | allow | allow | Corrections and their revisions for the business. |
| Edit or delete any audit entry | deny [aa] | deny [aa] | deny [aa] | No role, no route. Append-only by grants, RLS policies and a trigger (`M1-ARCHITECTURE.md` §3.6). Retention purge is an owner-role process, not an application action. |

### 3.10 Business settings

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| View business profile and settings | deny | deny | allow | Own business only. |
| Edit business profile, timezone, branding, support contact | deny | deny | allow [bb] | Validated and persisted; before-and-after values audited; no change rewrites historical attendance (PRD §9). |
| Configure data retention | deny | deny | conditional [cc] | Per business, off by default. Enabling deletion requires Ghana legal advice first (O10). |
| Issue or revoke an employee QR credential | deny | deny | allow [dd] | Hash stored, payload shown once, reissue revokes the previous credential, deactivated employees hold no usable credential (O5). |

### 3.11 Security administration

| Capability | STAFF | HR | SUPERADMIN | Denial or condition |
|---|---|---|---|---|
| Deactivate an account with full revocation | deny | conditional [c] | allow [ee] | HR deactivates STAFF only. Deactivation bumps `tokenVersion`, revokes the QR credential, disables or resets the PIN, blocks further attendance actions, and preserves all history (O12). |
| Trigger the automatic clock-out pass manually | deny | deny | deny [ff] | Service token (`JOB_TOKEN`) only. The scheduled worker is the normal path; a user session never triggers it. |
| Manage roles above one's own level | deny | deny | allow | HR cannot create or promote to HR or SUPERADMIN. The last-superadmin rule prevents SUPERADMIN from removing its own final administrator. |

### 3.12 Footnotes

- [a] The session is verified against the database on every request, so a role or business scope held in a stale token cannot outlive the account (`M1-ARCHITECTURE.md` §2.1, O12).
- [b] Self rows only; the field allowlist is `firstName, lastName, email, phoneNumber, profileImageUrl`.
- [c] The actor's role ceiling applies: HR can only act on STAFF; SUPERADMIN can act on any role in its own business, subject to the last-superadmin rule.
- [d] A reason is required and recorded. The response never contains the PIN itself.
- [f] The Change PIN screen exists in `M1-NAVIGATION-AND-SCREENS.md` §7.2 for STAFF, but the API contracts contain no self-service PIN route for any role. Recorded as conflict 3 in §7.
- [g] Account recovery is pre-authentication, so it belongs to no role. The response is identical whether or not the email exists (O6).
- [h] A denial here means the contracts expose no route, not a policy that HR or SUPERADMIN may never see their own schedule. Recorded as a gap in §7 item 5.
- [i] HR reads the calendar through the business-settings read routes; only SUPERADMIN writes it.
- [j] One grace value applies business-wide; versions carry `effectiveFrom` and `effectiveTo`; a shift already open is evaluated against the policy it started under (R4 recommendation).
- [k] Pairing code is shown once, expires in 10 minutes, stored only as a keyed hash.
- [l] Revocation is audited and deletes no attendance the device created.
- [m] These capabilities belong to the kiosk device credential, not to any human role. See §4, kiosk column.
- [n] The punch routes accept a kiosk token plus a `VERIFIED`, unconsumed verification session and nothing else. The server recomputes the action and does not trust a client-supplied one.
- [o] HR reads sites because its exception review needs them; it cannot create or edit one.
- [p] Site coordinates and radius are validated; 150 m is an example radius, not a fixed rule (O4).
- [q] STAFF dismisses an alert on its own attendance row only.
- [r] SUPERADMIN has no dismiss route in the contracts even though it has the business-wide attendance screen. Recorded as conflict 6 in §7.
- [s] Provisional O7: the assisted override bypasses QR-plus-PIN by design and needs owner confirmation before M2.
- [t] The record's date must be inside the correction window (default seven days, `correctionWindowDays` on `PolicyVersion`), the attendance must belong to the requester, and no open correction may already exist for the row.
- [u] The contracts scope the submit route to STAFF (self), so HR has no way to raise a correction on its own record. Recorded as conflict 2 in §7.
- [v] Same-day tier: the reviewer must differ from the requester, checked server-side.
- [w] Escalated tier: SUPERADMIN or a second HR user decides, never the requester. Which of the two is still open as R7; see §7 item 1.
- [x] PRD §4.1 reserves help-request submission for staff, and the contracts define no submit route for the other roles. An HR user who cannot clock in uses the same audited recovery order as everyone else (O7).
- [y] CSV export applies the O9 sanitisation. The flags-and-corrections report is role-limited; the register and punctuality reports are business-wide.
- [z] HR's audit view is filtered by event type at the service layer, not by a separate table.
- [aa] Enforced three times: no UPDATE/DELETE grant, no UPDATE/DELETE RLS policy, and a trigger that raises on any write attempt.
- [bb] Audited with before-and-after values.
- [cc] Retention configuration is allowed; enabling deletion is not, until legal advice (O10).
- [dd] The original credential is not recoverable; a deactivated employee's credential stops working.
- [ee] One transaction: bump `tokenVersion`, revoke the QR credential, clear or disable the PIN, preserve history, audit the action.
- [ff] The manual job route requires the `JOB_TOKEN` service credential, which is a machine identity outside the three-role model.

## 4. Route-level mapping

Every route in `M1-API-CONTRACTS.md` mapped to the role that may call it, so the matrix
above is checkable against the contracts. `kiosk` means a paired-device token; `public`
means no credential.

| Route | STAFF | HR | SUPERADMIN | kiosk / public / job |
|---|---|---|---|---|
| `POST /api/auth/login` | — | — | — | public |
| `POST /api/auth/logout`, `POST /api/auth/refresh`, `GET /api/auth/me` | allow | allow | allow | — |
| `POST /api/auth/recovery/request`, `POST /api/auth/recovery/verify` | — | — | — | public (pre-sign-in) |
| `PUT /api/users/change-password` | allow (self) | allow (self) | allow (self) | — |
| `PUT /api/users/:id/reset-password` | — | conditional (STAFF targets only) | allow | — |
| `GET /api/public/preview` | — | — | — | public |
| `POST /api/public/business-registration` | — | — | — | public, excluded by O1 (returns 501) |
| `GET /api/staff/attendance`, `GET /api/staff/schedule`, `GET /api/staff/off-days` | allow (self) | — | — | — |
| `POST /api/staff/help-requests`, `GET /api/staff/help-requests`, `GET /api/staff/help-requests/:id` | allow (self) | — | — | — |
| `GET /api/staff/corrections`, `GET /api/staff/corrections/:id` | allow (self) | — | — | — |
| `GET /api/staff/profile`, `PATCH /api/staff/profile` | allow (self) | — | — | — |
| `GET /api/hr/attendance`, `/summary`, `/exceptions` | — | allow | allow | — |
| `GET /api/hr/employees`, `POST /api/hr/employees`, `PATCH /api/hr/employees/:id` | — | conditional (STAFF scope) | allow | — |
| `POST /api/hr/users/:id/reset-pin` | — | conditional (STAFF targets) | allow | — |
| `GET /api/hr/help-requests`, `PATCH /api/hr/help-requests/:id` | — | allow | allow | — |
| `GET /api/hr/corrections`, `PATCH /api/hr/corrections/:id/decision` | — | conditional (not the requester) | conditional (not the requester) | — |
| `GET /api/business/settings`, `PATCH /api/business/settings` | — | — | allow | — |
| `GET /api/business/shifts` | — | allow (read) | allow | — |
| `POST /api/business/shifts`, `PATCH /api/business/shifts/:id`, `POST /api/business/shifts/:id/deactivate`, `POST /api/business/shifts/:id/assignments` | — | — | allow | — |
| `GET /api/business/assignments`, `DELETE /api/business/assignments/:id` | — | allow (read) | allow | — |
| `GET /api/business/policies`, `POST /api/business/policies`, `POST /api/business/policies/:id/versions` | — | — | allow | — |
| `GET /api/business/calendars` | — | allow (read) | allow | — |
| `PATCH /api/business/calendars/:id`, `POST /api/business/calendars/:id/exceptions` | — | — | allow | — |
| `POST /api/business/employees/:id/qr-credential`, `POST /api/business/qr-credentials/:id/revoke` | — | — | allow | — |
| `GET /api/sites` | — | allow (read) | allow | — |
| `POST /api/sites`, `PATCH /api/sites/:id`, `POST /api/sites/:id/deactivate` | — | — | allow | — |
| `POST /api/kiosk/pairing-codes`, `GET /api/kiosk/devices`, `POST /api/kiosk/devices/:id/revoke` | — | — | allow | — |
| `POST /api/kiosk/pair` | — | — | — | public (unpaired device) |
| `POST /api/kiosk/token/renew`, `POST /api/kiosk/identify`, `POST /api/kiosk/verify-pin`, `POST /api/kiosk/cancel` | — | — | — | kiosk token |
| `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out` | deny | deny | deny | kiosk token + `VERIFIED` session |
| `POST /api/attendance/assisted` | — | conditional (provisional O7, not the target) | conditional (provisional O7, not the target) | — |
| `POST /api/attendance/corrections` | allow (self) | — [F3] | — [F3] | — |
| `GET /api/attendance/my-attendance` | allow (self) | — | — | — |
| `GET /api/attendance/all-attendance` | — | allow | allow | — |
| `PATCH /api/attendance/:id/dismiss-alert` | allow (self) | allow | — [F5] | — |
| `POST /api/jobs/auto-clock-out/run` | — | — | — | job (service token) |
| `GET /api/jobs/status` | — | — | allow (own business) | job |
| `GET /api/reports/attendance-register`, `/punctuality-summary`, `/exceptions`, `/attendance-register/export` | — | allow | allow | — |
| `GET /api/audit` | — | conditional (event-type filter) | allow | — |
| `GET /api/audit/:id` | — | — | allow | — |
| `GET /api/audit/corrections/:attendanceId` | — | allow | allow | — |

### 4.1 Routes this matrix cannot attribute

Four findings came out of mapping the contracts. Each is a gap in the contracts, not a
decision made here.

- **F1 — the legacy `/api/users` account-administration routes have no role column.** `M1-API-CONTRACTS.md` §12 keeps `POST /api/users`, `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id` and `DELETE /api/users/:id` for account administration and says the HR-scoped views wrap the same service, but no roles row exists anywhere for them. This matrix cannot attribute them. Recommendation in §7 item 4.
- **F2 — the two password routes are attributed in prose, not in a table.** `PUT /api/users/change-password` (self, any authenticated role) and `PUT /api/users/:id/reset-password` (SUPERADMIN any, HR STAFF only) carry their roles in a paragraph under §1 rather than a roles column. Attributable, but the placement makes them easy to miss in review.
- **F3 — no route lets HR submit a correction on its own record.** `POST /api/attendance/corrections` is STAFF (self) only, yet O17 and open row R7 both assume HR users raise corrections that need an independent approver. Conflict 2 in §7.
- **F4 — no route backs the Change PIN screen.** `M1-NAVIGATION-AND-SCREENS.md` §7.2 gives STAFF a `/profile/change-pin` screen; the contracts contain no PIN self-service route for anyone. Conflict 3 in §7.

## 5. Screen-level mapping

The real screens from `M1-NAVIGATION-AND-SCREENS.md` and the role that sees each. A screen
visible to a role without a matching route is flagged.

| Screen (route) | Role that sees it | Backed by |
|---|---|---|
| Public landing and preview (`/`) | Anyone (pre-sign-in) | `GET /api/public/preview` |
| Login (`/login`) | Anyone | `POST /api/auth/login` |
| Business registration (`/register`) | — | Does not ship: excluded by O1 (nav §7.1 marks it conditional) |
| Account recovery (`/account/recovery`) | Anyone locked out, before sign-in | `POST /api/auth/recovery/request`, `POST /api/auth/recovery/verify` |
| Set password (`/set-password`) | Any authenticated user with the forced-change flag | `PUT /api/users/change-password` |
| Unauthorized (`/forbidden`), Not found (`*`) | Any | Route guards only |
| STAFF overview (`/dashboard`), My Attendance (`/staff/attendance`), My Schedule (`/schedule`), Off-days (`/staff/off-days`) | STAFF | `GET /api/staff/attendance`, `/schedule`, `/off-days` |
| Help requests list, new, detail (`/staff/help-requests*`) | STAFF | `POST` and `GET /api/staff/help-requests` |
| Corrections list, new, detail (`/staff/corrections*`) | STAFF | `GET /api/staff/corrections`; submission via `POST /api/attendance/corrections` |
| Profile and Security (`/profile`) | STAFF | `GET` and `PATCH /api/staff/profile` |
| Change PIN (`/profile/change-pin`) | STAFF | **No route — conflict 3 in §7** |
| HR overview (`/hr-dashboard`), Attendance (`/hr-attendance`), Exceptions (`/hr-exceptions`) | HR | `GET /api/hr/attendance`, `/summary`, `/exceptions` |
| Employees, employee detail (`/manage-staff`, `/manage-staff/:id`) | HR (STAFF scope), SUPERADMIN (full) | `GET`, `POST`, `PATCH /api/hr/employees` |
| PIN reset (`/manage-staff/:id/reset-pin`) | HR (STAFF targets), SUPERADMIN | `POST /api/hr/users/:id/reset-pin` |
| Help requests (`/hr-help-requests`, `:id`) | HR | `GET` and `PATCH /api/hr/help-requests` |
| Corrections, decision view (`/hr-corrections`, `:id`) | HR | `GET /api/hr/corrections`, `PATCH /api/hr/corrections/:id/decision` |
| Correction Revision History (`/hr/corrections/revisions`) | HR | **No list route — conflict 6 in §7** |
| Reports (`/hr-reports`) | HR | `GET /api/reports/*`, CSV export |
| Audit History (`/hr-audit`) | HR | `GET /api/audit` (event-type filtered) |
| SUPERADMIN overview (`/superadmin-dashboard`), Attendance (`/admin-attendance`) | SUPERADMIN | `GET /api/hr/attendance` family and `GET /api/attendance/all-attendance` |
| Employees (`/manage-staff`, elevated actions) | SUPERADMIN | `POST /api/hr/employees` with the SUPERADMIN role column |
| Shift Management (`/shift-management`), Scheduling (`/scheduling`) | SUPERADMIN | `POST`, `PATCH /api/business/shifts`, assignments routes |
| Attendance Policies (`/attendance-policies`) | SUPERADMIN | `GET`, `POST /api/business/policies`, versions route |
| Calendar Settings (`/calendar-settings`) | SUPERADMIN | `GET /api/business/calendars`, `PATCH`, exceptions routes |
| Sites (`/sites`) | SUPERADMIN (HR read-only, per nav §7.4) | `GET /api/sites` (HR), `POST`, `PATCH`, deactivate (SUPERADMIN) |
| Devices (`/devices`) | SUPERADMIN | `GET /api/kiosk/devices`, `POST /api/kiosk/pairing-codes`, revoke route |
| Help and Corrections (`/admin-help-corrections`) | SUPERADMIN | `GET /api/hr/help-requests`, `GET /api/hr/corrections` |
| Correction Revision History (`/corrections/revisions`) | SUPERADMIN | **No list route — conflict 6 in §7** |
| Reports (`/reports`) | SUPERADMIN | `GET /api/reports/*`, CSV export |
| Audit Log (`/audit-log`) | SUPERADMIN | `GET /api/audit`, `GET /api/audit/:id` |
| Business Settings (`/settings`) | SUPERADMIN | `GET`, `PATCH /api/business/settings` |
| Kiosk device setup (`/kiosk/setup`) | SUPERADMIN standing at the device | `POST /api/kiosk/pair` |
| Kiosk attendance flow (`/kiosk`) | Paired kiosk device | `POST /api/kiosk/identify`, `/verify-pin`, `/cancel`; punches under kiosk authentication |

## 6. Enforcement

The matrix is enforced by mechanisms that are specified elsewhere; this section names them
rather than re-explaining them.

| Matrix rule | Enforcing mechanism |
|---|---|
| Who the caller is | `authMiddleware` reloads the account row from the database on every request and `roleMiddleware` checks the role (`M1-ARCHITECTURE.md` §1, §2.1). A stale token cannot carry a stale role. |
| Which business the caller may touch | `businessId` is derived from the identity and never from the request; the `tenantContext` middleware attaches it and repositories scope every query by it (`M1-ARCHITECTURE.md` §2.1–§2.3). |
| Business scope at the database | Row Level Security on `app.business_id`, fail-closed, behind the application scoping (`M1-ARCHITECTURE.md` §3.2, §3.3). |
| Own-rows-only restrictions (self attendance, self corrections, self help requests) | The repository query forces `user_id = self` or `requester_id = self`; ownership is rechecked on single-row reads (`M1-API-CONTRACTS.md` §3, §8). |
| Account revocation on deactivation | `tokenVersion` increment (O12): every authenticated request verifies the user is active and the version current; deactivation also revokes the QR credential and disables or resets the PIN (`M1-ARCHITECTURE.md` §8.4). |
| Kiosk authorization | The kiosk middleware rechecks the device row, `state = ACTIVE`, `tokenVersion` and token expiry on every request (O3, `M1-ARCHITECTURE.md` §8.3, `M1-KIOSK-SECURITY.md` §2.5). |
| The punch denial (§3.3) | The punch routes sit behind kiosk authentication and a single-use `VERIFIED` session; a staff bearer token is rejected before any attendance logic runs (`M1-API-CONTRACTS.md` §8, `M1-ARCHITECTURE.md` §1). |
| No self-approval (O17) | Server-side check on the decision route that the reviewer differs from the requester; tier assignment is computed, not chosen (`M1-API-CONTRACTS.md` §4, `M1-ARCHITECTURE.md` §10). |
| Append-only history (O17, O21) | Three layers on `audit_logs`, `attendance_correction_revisions` and `attendance_attempts`: no UPDATE/DELETE grant, no UPDATE/DELETE RLS policy, and a blocking trigger (`M1-ARCHITECTURE.md` §3.6). |
| Audit trail on write | Every sensitive write in the contracts lists its `INSERT audit_logs` in the database-operations column; the log never carries a PIN, pairing code, token or badge value (`M1-KIOSK-SECURITY.md` §11). |
| Cross-tenant probes | A row from another business returns 404, never a 403 that confirms it exists (`M1-ARCHITECTURE.md` §2.3). |
| Hiding a screen is not security | Every route is authorized independently of the UI; the navigation guards are convenience only (PRD §5 rule 7, `M1-NAVIGATION-AND-SCREENS.md` §9, state U). |

## 7. Conflicts and open items

Places where PRD §4, the API contracts and the navigation doc disagree, plus the open R7
row. Each has options and a recommendation. None is decided here; the owner decides.

1. **R7 — who decides an HR user's own correction (open).** O17 forbids self-approval and requires an independent review path for HR's own corrections, but the register has not settled who provides it.
   - Option (a): a second HR user decides.
   - Option (b): SUPERADMIN decides.
   - Option (c): an owner-designated approver list.
   - Recommendation (register row R7): (b) where only one HR exists, otherwise (a). This matrix writes the escalated tier as `conditional` for both HR and SUPERADMIN so either answer fits without a rewrite.
2. **HR cannot submit a correction on its own record (contracts vs O17).** `POST /api/attendance/corrections` is scoped to STAFF (self), yet O17's no-self-approval rule and R7 both presume HR users raise corrections. The assisted-override route is not a substitute: it is a provisional admin action with a different audit meaning.
   - Option (a): extend the submit route to any authenticated role acting on their own attendance, with HR submissions forced to the escalated tier.
   - Option (b): leave HR corrections out of v1 entirely and record that in O17.
   - Recommendation: (a). It keeps one route, one window rule and one tier computation, and R7 then has something to apply to.
3. **Change PIN screen with no route (navigation vs contracts).** §7.2 of the navigation doc gives STAFF a `/profile/change-pin` screen; the contracts have no self-service PIN route for any role, only the HR reset.
   - Option (a): add `POST /api/staff/pin` (self, current-PIN verification, audited) in the implementation milestone.
   - Option (b): drop the screen and route all PIN changes through the HR reset.
   - Recommendation: (a). PIN self-service reduces HR reset traffic and matches O2's intent; the exact policy values still follow R5.
4. **Legacy `/api/users` account-admin routes have no role attribution (contracts F1).** Five routes are kept with no roles column, so their callers are undefined.
   - Option (a): attribute them exactly like the `/api/hr/employees` equivalents (HR on STAFF, SUPERADMIN on any) and mark them as thin aliases.
   - Option (b): retire them in v1 and keep only `PUT /api/users/change-password` and the reset route under `/api/users`.
   - Recommendation: (b) where the HR routes already cover the function, (a) for the read routes the current frontend still calls. Either way the roles column must be written before M2.
5. **No self-profile route for HR and SUPERADMIN (contracts gap).** `PATCH /api/staff/profile` is STAFF-scoped, and the account menu in the navigation doc offers Profile to every role.
   - Option (a): widen the profile route to any authenticated role with the same field allowlist and self-only scoping.
   - Option (b): leave HR and SUPERADMIN profile edits to the employee-management routes, with the last-superadmin rule protecting their own rows.
   - Recommendation: (a). A self-service profile edit is not an elevated action and should not require another user.
6. **Dismiss-alert and correction-revision screens do not match the routes.** `PATCH /api/attendance/:id/dismiss-alert` allows STAFF and HR but not SUPERADMIN, even though SUPERADMIN owns the business-wide attendance screen; and the two Correction Revision History screens have no list endpoint — the only revision route is `GET /api/audit/corrections/:attendanceId`, which needs an attendance id the list screens do not have.
   - Option (a): add SUPERADMIN to the dismiss route and add a correction-list route that carries revision summaries.
   - Option (b): leave both as they are and narrow the screens.
   - Recommendation: (a) for the revision list, since two screens are already designed against it; for dismiss-alert, (a) is consistent but low priority — HR can perform the action on SUPERADMIN's behalf in v1.
7. **Off-days scope note is stale (navigation vs O16 and contracts).** The navigation doc §11.4 says the data model puts the off-day calendar entity out of scope, but O16 keeps off-day configuration in version one and the contracts define `/api/business/calendars` with exceptions plus `GET /api/staff/off-days`.
   - Option (a): treat the navigation note as superseded by O16 and ship the off-days screen against the calendar routes.
   - Option (b): keep the screen empty until a separate off-day entity exists.
   - Recommendation: (a). O16 is the later, owner-confirmed decision and the routes already back it.

## 8. Requirement-to-mechanism map

| PRD requirement | Covered by |
|---|---|
| §4.1 STAFF: view own attendance, status, shifts, off-days | §3.1 self rows, §3.2 own schedule rows; routes `GET /api/staff/*`; screens §5 STAFF block |
| §4.1 STAFF: change password, update permitted profile | §3.1 rows "Change own password" and "Edit permitted own profile fields" |
| §3.1 row "Set or change own kiosk PIN" | §3.1 row, conflict 3 in §7 |
| §4.1 STAFF: submit and track help and correction requests | §3.6 submit row, §3.7 submit row; `POST /api/attendance/corrections`, `POST /api/staff/help-requests` |
| §4.1 STAFF: no routine clock-in or clock-out from the portal | **§3.3 punch row — deny for all three roles**, backed by kiosk authentication (§6) |
| §4.1 STAFF: cannot view other employees' records | §6 own-rows-only and RLS rows |
| §4.2 HR: business attendance summaries, records, filters, exceptions | §3.5 business attendance row; `GET /api/hr/attendance`, `/summary`, `/exceptions` |
| §4.2 HR: manage employee accounts within granted permissions | §3.1 employee rows with the HR STAFF-only ceiling [c] |
| §4.2 HR: review help requests and decide corrections | §3.7 resolve row, §3.6 decision rows |
| §4.2 HR: no self-approval | §3.6 reviewer ≠ requester conditions [v] [w]; §6 no-self-approval row; R7 open, §7 item 1 |
| §4.2 HR: no access to another business | §6 business-scope and RLS rows |
| §4.2 HR: reports and relevant audit history | §3.8 rows, §3.9 audit row with the HR event-type filter [z] |
| §4.3 SUPERADMIN: business profile and branding | §3.10 edit row |
| §4.3 SUPERADMIN: manage users and roles | §3.11 role ceiling row, §3.1 rows with the SUPERADMIN column |
| §4.3 SUPERADMIN: shifts, assignments, calendars, working hours, off-days | §3.2 rows |
| §4.3 SUPERADMIN: attendance rules and auto clock-out switch | §3.2 timing-policy row (O15) |
| §4.3 SUPERADMIN: register and revoke kiosk devices | §3.3 device rows (O3) |
| §4.3 SUPERADMIN: reports and audit history | §3.8 and §3.9 rows |
| §4.3 SUPERADMIN: own business only, not platform-wide | Header of §1; §6 business-scope rows; O1, O11 |
| §5 rules 1–5 (one business per user, no switching, per-role scope) | §1 boundaries; §6 identity and business-scope rows |
| §5 rules 6–8 (every record and operation enforced server-side, tests prove isolation) | §6 entire table; RLS and the isolation tests T18–T21 in `M1-ARCHITECTURE.md` §3.5 |

---

M1 remains unapproved. Nothing in this document authorizes implementation; M2 stays
unauthorized until the owner approves the M1 set and the open rows in §7 are answered.
