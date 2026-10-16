# AttendPro M1 — Navigation and Screens

- **Date:** 2026-10-16
- **Revision:** owner design review of 2026-10-16 applied (O16, O2, O3, O4, O6)
- **Baseline commit:** `f87ce1d`
- **Milestone:** M1
- **Owner:** UI Designer Agent
- **Companions:** `DESIGN.md` (root, section 11 "AttendPro Surfaces"), `docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/M1-KIOSK-SECURITY.md`, `docs/attendpro/DECISION-REGISTER.md`
- **Status:** design only. No component, route, or file under `src/` or `backend/` is modified by this document.

This document is the navigation map and screen inventory PRD §19 items 1, 2, 3, 4, 5, 8, and 9 ask for. It covers the five interface areas the PRD names: the public website (§6), the STAFF portal (§7), the HR portal (§8), the SUPERADMIN area (§9), and the kiosk (§10). API areas are referenced by name only; the method, path, request, and error contracts live in `docs/attendpro/M1-API-CONTRACTS.md`.

---

## 0. How this document relates to the rest of M1

| Question | Answered here | Elsewhere |
|---|---|---|
| What does each screen look like? | Layout, components, states | `DESIGN.md` §11 for the kiosk and landing tokens |
| Which API area serves a screen? | Section 7, by area name | `M1-API-CONTRACTS.md` §1-§11 and its §13 screen-to-endpoint table |
| Which database models are touched? | Not here | `docs/attendpro/M1-DATA-MODEL.md` |
| How is a kiosk secured? | Screen states and privacy | `docs/attendpro/M1-KIOSK-SECURITY.md` |

Route paths in this document are proposals in the flat style the current `src/App.jsx` already uses (`/hr-dashboard`, `/superadmin-dashboard`, `/manage-staff`, `/settings`). Where a proposed path replaces an existing one, the existing screen component is named so the migration is traceable.

---

## 1. Design system this map assumes

The interface vocabulary is the one already in `src/`. New screens reuse it rather than inventing a parallel set.

| Layer | Already in the code | Reused by |
|---|---|---|
| App shell | `Layout.tsx` (chrome sidebar offset, accent strip), `Sidebar.tsx` (role-filtered nav, account popover) | Every authenticated area |
| Metric primitives | `KpiCard.jsx` (`KpiHero` 2-column hero, `KpiCard` dense metric) | STAFF, HR, SUPERADMIN overviews |
| Data table | `AttendanceTable.jsx` (sticky header, sort, pagination, exception-first rows), `StaffTable.jsx` | HR attendance, admin attendance, staff history |
| Status | `StatBadge.jsx`, extended to the eight PRD §12 statuses (`DESIGN.md` §11.3) | Everywhere a status appears |
| Loading | `Skeleton.jsx` (`BentoSkeleton`, `TableSkeleton`, `ChartSkeleton`) | Every data screen |
| Charts | `HoursChart.jsx`, `SessionsChart.jsx` | HR and SUPERADMIN overviews |
| Forms and modals | `AddEmployeeModal.jsx`, `EditEmployeeModal.jsx`, `ResetPasswordModal.jsx` | Employee management, corrections, policies |
| Guardrails | `ErrorBoundary.jsx`, `react-hot-toast` toasts, the reset of `axios.ts` interceptors | Every screen |

New primitives M1 introduces, specified in `DESIGN.md` and built in the implementation milestone: an eight-value `StatusBadge`, a `FilterBar`, a server-side `Pagination` control, an actionable `EmptyState`, a right-side `DetailDrawer`, a `CorrectionForm`, a `PolicyVersionEditor`, and the kiosk's `KioskKeypad` on-screen PIN keypad.

### 1.1 Responsive behaviour (PRD §19 item 4)

| Breakpoint | Sidebar | Tables | Metrics |
|---|---|---|---|
| `< 640px` | Off-canvas drawer, scrim, mobile top bar | Horizontally scrollable with a pinned first column; row opens the detail drawer | Single column, hero first |
| `640px - 1024px` | Off-canvas drawer | Scrollable | Two columns |
| `>= 1024px` | Persistent 256px chrome sidebar | Full grid, sticky header | Four-column bento (hero spans two) |
| Kiosk | Fixed landscape, single column, no responsive reflow below 768px | No tables | Large-format only |

---

## 2. Public website (§6)

The public site is display-only. It explains the product, shows a sample preview, and offers Sign in. It reads the Public website API area, which returns fictional sample data and never touches a tenant table.

```
Public website
├─ Product overview (home)              /
├─ Product preview (sample dashboard)   /#preview   (anchor on the same page)
├─ Sign in                              /login
└─ Business registration                /register   (only if O1 flips to self-serve; hidden otherwise)
```

Notes:

- The current `/` route is `AuthenticatedHome`, which sends an unauthenticated visitor to `/login` (M0 finding: no public screen exists). M1 replaces the unauthenticated branch with the public landing page and keeps the authenticated branch redirecting to the role home.
- The preview is a preview, not a live dashboard. It shows one short figure row and a five-row sample table; it does not list every statistic or employee (PRD §6).
- Sign in links to account recovery (`/account/recovery`, section 7.6) for an employee who cannot sign in. That screen works from an email recovery code (O6) and sends nothing by text message.

Sample preview content (all fictional, shown with a "sample data" note):

| Employee | Shift | Clock-in | Status |
|---|---|---|---|
| Kwabena Mensah | Morning | 05:55 AM | Early |
| Akosua Boateng | Morning | 06:00 AM | On time |
| Yaw Owusu | Morning | 06:18 AM | Late |
| Abena Asante | Afternoon | 02:04 PM | Late |
| Kofi Appiah | Night | -- | Open session |

Sample figure row: Expected today 42 · Clocked in 37 · Late 5 · Open sessions 3. Business shown: Finest Supermarket, Accra.

---

## 3. STAFF portal (§7)

A STAFF user lands on their own overview. Navigation follows PRD §7, minus the leave item, which the owner deferred to version two.

```
STAFF portal
├─ Overview                 /dashboard
├─ My Attendance            /staff/attendance
├─ My Schedule              /schedule
├─ Off-days                 /staff/off-days
├─ Help Requests            /staff/help-requests
│     ├─ New request        /staff/help-requests/new
│     └─ Request detail     /staff/help-requests/:id
├─ Attendance Corrections   /staff/corrections
│     ├─ New correction     /staff/corrections/new
│     └─ Correction detail  /staff/corrections/:id
└─ Profile and Security     /profile
      ├─ Change password    /set-password
      └─ Change PIN         /profile/change-pin
```

Account menu (from the sidebar popover): Profile, Settings, Sign out.

> **Hard rule (PRD §7): the STAFF portal contains no clock-in and no clock-out button.** Attendance is recorded at the authorised kiosk only. The overview may show today's status, the assigned shift, and the last recorded clock-in and clock-out as read-only facts, and it may link to a help request when a punch looks wrong. It must not offer a routine punch action.
>
> Remediation note: the current `src/pages/Dashboard.tsx` renders `Clock In` and `Clock Out` buttons and calls the attendance clock endpoints (M0 §6, `M1-API-CONTRACTS.md` §12). M1 removes those controls. The endpoint itself moves to kiosk authentication, so a staff session can no longer reach it.

Overview content: today's status, assigned shift, last clock-in and clock-out, recent attendance history, upcoming workdays or off-days where supported, and any pending help or correction requests.

---

## 4. HR portal (§8)

The HR dashboard is exception-first. PRD §8 names the overview and the attendance table; the remaining items follow from the HR capabilities in PRD §4.2. HR sees only its own business.

```
HR portal
├─ Overview             /hr-dashboard
├─ Attendance           /hr-attendance
├─ Exceptions           /hr-exceptions
├─ Employees            /manage-staff
│     ├─ Employee detail /manage-staff/:id
│     └─ PIN reset       /manage-staff/:id/reset-pin
├─ Help Requests        /hr-help-requests
│     └─ Request detail  /hr-help-requests/:id
├─ Corrections          /hr-corrections
│     └─ Decision view   /hr-corrections/:id
├─ Correction Revisions  /hr/corrections/revisions
├─ Reports              /hr-reports
└─ Audit History        /hr-audit
```

The attendance table carries the fields PRD §8 lists: Employee, Employee code, Shift, Clock-in, Clock-out, Status, Exception, Actions. It supports search, filtering, and pagination. HR does not edit a cell in place; a correction follows the correction workflow and keeps its audit trail (PRD §8, §14). HR cannot approve a correction it requested (PRD §4.2).

---

## 5. SUPERADMIN area (§9)

The SUPERADMIN manages one business. The main navigation follows the items PRD §9 lists in that order, plus the Sites and Devices screens the decision register now requires (O3, O4).

```
SUPERADMIN area
├─ Overview              /superadmin-dashboard
├─ Attendance            /admin-attendance
├─ Employees             /manage-staff          (shared screen, elevated actions)
├─ Shift Management      /shift-management
├─ Scheduling            /scheduling
├─ Attendance Policies   /attendance-policies
├─ Calendar Settings     /calendar-settings
├─ Sites                 /sites
├─ Devices               /devices
├─ Help and Corrections  /admin-help-corrections
├─ Correction Revisions   /corrections/revisions
├─ Reports               /reports
├─ Audit Log             /audit-log
└─ Business Settings     /settings
```

Employee management, shift management, and settings all write through the Business settings API area for the configuration pieces and through HR for account actions. A settings change is validated and persisted (PRD §9), and it never rewrites the meaning of a historical attendance record (`DESIGN.md`; `M1-API-CONTRACTS.md` §5). Sites and kiosk devices have their own API areas (`M1-API-CONTRACTS.md` §6 and §7) and their own screens below.

---

## 6. Kiosk (§10)

The kiosk is a single-purpose surface with no navigation, no sidebar, and no dashboard. It runs its own route so the app chrome never appears on it. A one-time pairing code entered at setup pairs the device and issues a device token, which is attached to every kiosk call.

```
Kiosk (no app chrome)
├─ Device setup / pairing    /kiosk/setup
└─ Attendance flow           /kiosk
      Ready → Scanning → Awaiting PIN → Verifying → Success
                                                   └→ Failure
                                                   └→ Locked / expired
```

The kiosk screen states and their privacy behaviour are in section 8.

---

## 7. Screen inventory

State codes used in the last column: **L** loading, **E** empty, **Err** error, **U** unauthorized, **S** success. A dash means the state does not apply to that screen. Section 9 defines what each state looks like.

> **O16:** Leave returns in version two, so no leave row appears in the tables below; calendars, working days, and off-days all stay in version one.

### 7.1 Public website

| Screen | Role | Route | Purpose | Key components | States |
|---|---|---|---|---|---|
| Public landing / preview | Public | `/` | Explain the product, show a sample dashboard, offer Sign in | Brand header, product summary, sample figure row, sample attendance table (`StatusBadge`), corner-bracket frame, footer | L · E · Err · S |
| Login | Public | `/login` | Authenticate and route to the role home | `Login.tsx` (existing), inline error bar, password toggle | L · Err · S |
| Business registration (conditional) | Public | `/register` | Create a business and its first SUPERADMIN, only if O1 flips to self-serve | Registration form, validation summary | L · Err · S |

### 7.2 STAFF portal

| Screen | Role | Route | Purpose | Key components | States |
|---|---|---|---|---|---|
| Overview | STAFF | `/dashboard` | Today's status, shift, last punch, pending requests. No punch controls. | `KpiHero`, `KpiCard`, `ClockPill` (read-only), `AttendanceTable` (5-col) | L · E · Err · U · S |
| My Attendance | STAFF | `/staff/attendance` | Full personal clock-in and clock-out history with filters | `AttendanceTable`, date-range `FilterBar`, `Pagination` | L · E · Err · U |
| My Schedule | STAFF | `/schedule` | Assigned shifts across a date range | Shift calendar list, empty-with-action state | L · E · Err · U |
| Off-days | STAFF | `/staff/off-days` | Off-days from `WorkCalendar` + `CalendarException` (real view) | Off-day list with holiday/override notes, empty-with-action state | L · E · Err · U |
| Help Requests | STAFF | `/staff/help-requests` | List own help requests and their status | Request list, status chips, `Pagination` | L · E · Err · U |
| New help request | STAFF | `/staff/help-requests/new` | Submit a help request | `CorrectionForm`-style form with category allowlist, character counts | L · Err · S |
| Help request detail | STAFF | `/staff/help-requests/:id` | Read one request and its resolution history | Detail layout, timeline | L · Err · U · S |
| Attendance Corrections | STAFF | `/staff/corrections` | List own correction requests | Request list, status chips, `Pagination` | L · E · Err · U |
| New correction | STAFF | `/staff/corrections/new` | Propose a correction to one attendance record | `CorrectionForm`, attendance picker, before/after preview | L · Err · U · S |
| Correction detail | STAFF | `/staff/corrections/:id` | Read one correction and its decision | Detail layout, before/after, audit trail | L · Err · U · S |
| Profile and Security | STAFF | `/profile` | Update permitted profile fields and change password | `Profile.tsx` (existing), password field, `ResetPasswordModal` pattern | L · Err · U · S |
| Change PIN | STAFF | `/profile/change-pin` | Set or change the personal PIN used at the kiosk, from the profile | PIN form (new PIN, confirm field), policy hint, confirmation dialog | L · Err · U · S |

### 7.3 HR portal

| Screen | Role | Route | Purpose | Key components | States |
|---|---|---|---|---|---|
| Overview | HR | `/hr-dashboard` | Exception-forward summary for the business | `KpiHero`, `KpiCard`, `HoursChart`, `SessionsChart`, exception strip | L · E · Err · U |
| Attendance | HR | `/hr-attendance` | Business attendance table with the PRD §8 fields | `AttendanceTable` (7-col, exception-first), `FilterBar`, `Pagination` | L · E · Err · U |
| Exceptions | HR | `/hr-exceptions` | Missing clock-outs, review cases, absences | `AttendanceTable` filtered, type tabs | L · E · Err · U |
| Employees | HR | `/manage-staff` | Find and manage employee accounts within HR scope | `StaffTable.tsx` (existing), `AddEmployeeModal`, `EditEmployeeModal` | L · E · Err · U · S |
| Employee detail | HR | `/manage-staff/:id` | One employee's profile, shift, and attendance | Detail layout, `AttendanceTable` (scoped), assignment summary | L · Err · U · S |
| PIN reset | HR, SUPERADMIN | `/manage-staff/:id/reset-pin` | Audited reset of an employee's PIN with a required reason; HR acts on STAFF only and never sees the old or new PIN | Reason field (required), confirmation dialog, audit note, success banner | L · Err · U · S |
| Help Requests | HR | `/hr-help-requests` | Review and resolve business help requests | Request list, `DetailDrawer`, status control | L · E · Err · U · S |
| Corrections | HR | `/hr-corrections` | Review and decide correction requests | Request list, before/after diff, decision panel | L · E · Err · U · S |
| Correction Revision History | HR | `/hr/corrections/revisions` | Per-revision history from `AttendanceCorrectionRevision` | Revision table (revisionNo, valuesBefore, valuesAfter, actor, date, reason), filters by attendance/correction | L · E · Err · U |
| Reports | HR | `/hr-reports` | Punctuality and exception reports, CSV export | Report selector, date range, `Pagination`, export button | L · E · Err · U · S |
| Audit History | HR | `/hr-audit` | Attendance and correction events only | Audit list, filters, `DetailDrawer` | L · E · Err · U |

### 7.4 SUPERADMIN area

| Screen | Role | Route | Purpose | Key components | States |
|---|---|---|---|---|---|
| Overview | SUPERADMIN | `/superadmin-dashboard` | Business health: headcount, month totals, late rate | `KpiHero`, `KpiCard`, `HoursChart`, `SessionsChart`, report block | L · E · Err · U |
| Attendance | SUPERADMIN | `/admin-attendance` | Business-wide attendance table | `AttendanceTable` (7-col), `FilterBar`, `Pagination` | L · E · Err · U |
| Employees | SUPERADMIN | `/manage-staff` | Full account management for the business | `StaffTable`, `AddEmployeeModal`, `EditEmployeeModal`, `ResetPasswordModal` | L · E · Err · U · S |
| Shift Management | SUPERADMIN | `/shift-management` | Create, edit, activate, deactivate shifts | Shift list, overnight toggle, time editor, assignment entry | L · E · Err · U · S |
| Scheduling | SUPERADMIN | `/scheduling` | Assign employees to shifts with an effective date | Assignment table, employee picker, effective-date control | L · E · Err · U · S |
| Attendance Policies | SUPERADMIN | `/attendance-policies` | Grace rules, thresholds, auto clock-out, policy versions | `PolicyVersionEditor`, version timeline, effective-date control | L · E · Err · U · S |
| Calendar/Holiday Settings | SUPERADMIN | `/calendar-settings` | Manage `WorkCalendar`, working week, `CalendarException` (holidays/overrides) | Calendar form, exception table, working-week toggles | L · E · Err · U · S |
| Sites / geo-fence | SUPERADMIN (HR read-only) | `/sites` | List, create, and edit sites: name, latitude, longitude, radius in metres (150 m is the example, not a rule); activate or deactivate. HR can view; only SUPERADMIN edits. | Site list with active flag, site form (coordinates, radius in metres), activate/deactivate confirmation | L · E · Err · U · S |
| Devices / kiosk pairing | SUPERADMIN | `/devices` | List kiosk terminals with their state (`PENDING_PAIRING`, `ACTIVE`, `REVOKED`, `EXPIRED`), generate a one-time pairing code (10-minute expiry), show paired-at and last-seen, revoke a device | Device table with state badges, one-time pairing-code panel with expiry, paired-at and last-seen columns, revoke confirmation dialog | L · E · Err · U · S |
| Help and Corrections | SUPERADMIN | `/admin-help-corrections` | Business-wide help and correction queue | Request list, decision panel, `DetailDrawer` | L · E · Err · U · S |
| Correction Revision History | SUPERADMIN | `/corrections/revisions` | Full revision history from `AttendanceCorrectionRevision` | Revision table with filters | L · E · Err · U |
| Reports | SUPERADMIN | `/reports` | Attendance register, punctuality summary, exceptions, CSV | Report selector, date range, export button | L · E · Err · U · S |
| Audit Log | SUPERADMIN | `/audit-log` | Full business audit history | Audit list, actor and action filters, `DetailDrawer` | L · E · Err · U |
| Business Settings | SUPERADMIN | `/settings` | Name, timezone, branding, retention, auto clock-out toggle | `Settings.jsx` (existing), sectioned form, save confirmation | L · Err · U · S |

### 7.5 Kiosk

| Screen | Role | Route | Purpose | Key components | States |
|---|---|---|---|---|---|
| Device setup / pairing | SUPERADMIN (at the device) | `/kiosk/setup` | Enter the one-time pairing code shown on the devices page and obtain the device token; the code expires 10 minutes after it is issued | Setup form, pairing-code field, expiry note, connection check | L · Err · S |
| Attendance flow | Kiosk device | `/kiosk` | QR identification, PIN verification, atomic punch, result, reset | `KioskKeypad` (on-screen PIN keypad), large-format prompt, live clock, result panel | L · Err · S (full state list in section 8) |

### 7.6 Shared screens

| Screen | Role | Route | Purpose | Key components | States |
|---|---|---|---|---|---|
| Account recovery | Any, before sign-in (employee-facing) | `/account/recovery` | Request a six-digit recovery code by email, enter it, then set a first PIN; the code is single-use with a 10-minute expiry and no account enumeration | Email field, six-digit code entry, resend control with a 60-second limit, set-PIN form | L · Err · S |
| Set password | Any authenticated, flag set | `/set-password` | Forced first-login password change | `SetPassword.jsx` (existing), policy meter | L · Err · U · S |
| Unauthorized (403) | Any authenticated | `/forbidden` | A valid session lacks permission for the target | Message panel, link to the role home | — |
| Not found (404) | Any | `*` | Unknown route | Message panel, link home | — |

---

## 8. Kiosk screen states and privacy behaviour (PRD §10)

The verification-session state machine is defined in `docs/attendpro/M1-KIOSK-SECURITY.md` §4.2 (`QR_ACCEPTED`, `PIN_PENDING`, `VERIFIED`, `CONSUMED`, `LOCKED`, `EXPIRED`). This table maps those states to what the screen shows and what it must never show.

| Screen state | Trigger | On screen | Privacy behaviour | API area (name only) | Exit |
|---|---|---|---|---|---|
| Ready | Idle; on load; after any result | "Present your QR code", business name, live clock. Nothing else. | No employee data of any kind. Never shows the previous person's name, shift, or status (`DESIGN.md` §11.4). | -- | QR presented → Scanning |
| Scanning | QR credential captured | "Reading your code…" with a bounded progress indicator | Never echoes the QR token. Shows the employee's first name only after the backend confirms a match, never the employee id or phone. | Kiosk pairing and verification | Match → Awaiting PIN; reject → Failure |
| Awaiting PIN | A verification session exists and PIN entry begins | "Enter your PIN" on the `KioskKeypad` on-screen keypad. A PIN is typed, never sent: no code reaches the employee by email or text message. | Never displays the phone number, employee code, department, or attendance state. The action the kiosk is about to take is not shown as a promise; the backend decides it at punch time. | Kiosk pairing and verification | PIN entered → Verifying; expiry or attempts exhausted → Locked / expired |
| Verifying | PIN submitted | "Checking your PIN…" with a non-blocking indicator | No result is revealed until the punch is committed. The kiosk never shows how many attempts remain. | Kiosk pairing and verification, Attendance | Persisted → Success; rejected → Failure |
| Success | The punch is recorded in the database | Employee first name, the action ("clocked in" / "clocked out"), and the resulting status, in large format | Shows the first name and the action only. No phone number, employee code, hours, department, or shift. The punch also carries its location assessment (INSIDE, OUTSIDE or UNKNOWN), and an outside or unknown result is flagged for review rather than shown here. Clears after 6s and resets to Ready. | Attendance | Auto-return → Ready |
| Failure | Rejected QR, wrong PIN, expired session, inactive employee, or provider fault | The safe message from `M1-KIOSK-SECURITY.md` §10, e.g. "That PIN is not correct. Try again." or "Badge not recognised. See HR." | A wrong PIN gets one generic message and no attempt countdown. Messages tell the employee what to do and tell an attacker nothing. An unknown QR and a cross-business QR show the same message, and neither reveals whether a token exists elsewhere. Clears after 8s. | Kiosk pairing and verification | Auto-return → Ready; "See HR" path for lockout |
| Locked / expired | Attempts exhausted, temporary PIN lockout, or the session expired | "Too many tries. Try again later or see HR." or "Start again. Scan your badge.", with the HR-assisted instruction | No identity beyond a generic message, no attempt countdown, and no hint of the geo-fence. A lockout is cleared on its own or by the HR-assisted PIN reset. Clears after 8s and drops all local state. The server also refuses any stale session because it is single-use and expiring. | Kiosk pairing and verification | Auto-return → Ready |

The location assessment (INSIDE, OUTSIDE or UNKNOWN) is recorded with every punch. An attempt outside the site is flagged for review, never presented to the employee as a failure, and the employee is not told they are outside, because that would disclose the geo-fence (`M1-KIOSK-SECURITY.md` §6, O4).

Cross-cutting rules for every kiosk state, from `DESIGN.md` §11.4: 20 seconds of no input returns to Ready and drops local state; the Ready screen is the only screen that persists; the device stays awake with OS notifications suppressed; the screen is cleared on result, on cancel, and on error.

---

## 9. State conventions

These definitions let the inventory above stay short. They apply to every area.

| State | Rule |
|---|---|
| Loading (L) | A pulse skeleton that matches the geometry of the content that will replace it (`BentoSkeleton`, `TableSkeleton`, `ChartSkeleton`, plus form and detail skeletons). No blank screen, no layout shift. |
| Empty (E) | Explanatory copy plus a concrete next action. A staff history with no records says records appear once attendance is logged and offers the help-request path; an HR exception list that is empty says so and offers the attendance table. No dead-end "No data" panel. |
| Error (Err) | An inline panel with a retry for the failed region, and a toast for a background failure. Messages are safe: no stack traces, no `error.message` passthrough (the current handler behaviour M0 §6 flags is replaced by the typed error contract). |
| Unauthorized (U) | The route guards (`StaffRoute`, `AdminRoute`, `SuperAdminRoute`, `ProtectedRoute` in `src/App.jsx`) redirect an unauthenticated visitor to `/login` and a wrong-role session to its own home. A valid session that lacks a specific permission reaches the 403 screen, never a blank page. The backend independently authorises every request (PRD §5 rule 7). |
| Success (S) | A confirmation state. Destructive or configuration actions show a confirmation dialog first, then a success banner that names what changed. Attendance punches show the result on the kiosk, not in the portals. |

Form validation and confirmation flows (PRD §19 item 6) follow one pattern: validate on submit with field-level messages from the typed error contract, keep the submit disabled while in flight, and confirm irreversible actions (revoke a kiosk, deactivate a shift, approve a correction) in a dialog that restates the consequence.

---

## 10. Screen-to-API-area traceability (PRD §19 items 9 and 10)

Each UI action maps to one API area by name. The exact method, path, request shape, and error cases are the contract in `docs/attendpro/M1-API-CONTRACTS.md`; the screen-to-endpoint rows there are §13.

| Screen action | API area |
|---|---|
| Visitor views the public preview | Public website |
| User signs in, signs out, or refreshes a session | Authentication |
| User changes a password | Authentication (self), with the existing Users paths for administrative reset |
| Anyone requests an email recovery code or redeems it to set a first PIN | Authentication |
| Staff sets or changes their own PIN | Authentication (self) |
| Staff views own attendance, schedule, off-days, or profile | Staff |
| Staff submits or reads a help request | Staff |
| Staff submits or reads a correction request | Staff |
| HR views the attendance table, summary, or exceptions | HR |
| HR manages employees within scope | HR, with Business settings for account administration |
| HR resets an employee's PIN with a reason | HR |
| HR reviews help requests | HR |
| HR decides a correction | HR, with Audit for the recorded decision |
| HR and SUPERADMIN read reports and export | Reporting |
| SUPERADMIN reads the audit log | Audit |
| SUPERADMIN edits the business profile, shifts, assignments, or policies | Business settings |
| SUPERADMIN manages the working calendar, working days, and holidays | Business settings |
| SUPERADMIN creates, edits, activates, or deactivates Sites and geo-fences; HR reads them | Sites and geo-fences |
| SUPERADMIN generates a pairing code or revokes a kiosk device | Kiosk pairing and verification |
| SUPERADMIN issues or revokes a QR credential | Business settings |
| Kiosk redeems a pairing code and obtains a device token | Kiosk pairing and verification |
| Kiosk identifies an employee from a QR credential | Kiosk pairing and verification |
| Kiosk identifies, verifies a PIN, or punches | Kiosk pairing and verification |
| Kiosk records an atomic clock-in or clock-out | Attendance |
| Automatic clock-out runs or reports status | Background jobs |
| Anyone reads correction history for a record | Audit |

---

## 11. Open items and PRD ambiguities

1. **HR navigation is proposed, not quoted.** PRD §8 names only the overview and the attendance table; the other HR items come from PRD §4.2. The owner should confirm the final HR list.
2. **Public registration depends on O1.** If O1 stays at operator provisioning, the `/register` route does not ship and the public page offers Sign in alone.
3. **Route paths.** This map proposes flat paths in the current convention and keeps the existing components (`/hr-dashboard`, `/superadmin-dashboard`, `/manage-staff`, `/settings`). If the team prefers grouped paths (`/hr/*`, `/admin/*`), that is a mechanical rename at implementation time.
4. **Off-days.** The PRD lists Off-days as a staff nav item. Off-days are computed from the `WorkCalendar` and its `CalendarException` rows, both of which stay in version one (O16). The screen is therefore a real view rather than an empty state.
5. **STAFF overview content.** PRD §7 lists today's status and the last punch as read-only facts. Confirm the overview shows them without any punch control, since the current screen has one.
6. **Kiosk deployment form.** PRD §10 leaves browser kiosk page versus dedicated application open. This map assumes a kiosk route in the same React app with the app chrome suppressed; a standalone application would reuse the same states and tokens.
