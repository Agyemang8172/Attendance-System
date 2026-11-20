# AttendPro M1 — Stage 2: Role Experiences and Navigation

- **Date:** 2026-10-16
- **Stage:** 2 of 6 in the product-owner UI/UX workflow
- **Baseline commit:** `f87ce1d` (M0), code state as of `c4ee602`
- **Milestone:** M1, pending owner approval
- **Owner:** UI Designer Agent
- **Companions:** `docs/attendpro/M1-UI-AUDIT.md` (Stage 1), `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md`, `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md`, `docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/DECISION-REGISTER.md`
- **Status:** design only. No component, route, or file under `src/` or `backend/` is modified by this document.

---

## 0. What this stage decides

Stage 1 established what the frontend currently does. This stage establishes what each role is actually trying to accomplish, and derives navigation from that rather than from the page list that happens to exist today.

The rule the product owner set is worth restating because it governs everything below: menu items are added because a role has a workflow that needs a home, not because a sidebar looks sparse. Where this document proposes an item, it names the workflow and the data behind it. Where it declines to propose one, it says so.

Three roles appear in the enum in `src/types/index.ts` and in the confirmed decision register: `STAFF`, `HR`, and `SUPERADMIN`. `O11` rules out a platform operator in v1, so there is no fourth console.

---

## 1. The separation that the current interface does not make

The single largest structural difference between the current application and the intended one is how HR and SUPERADMIN relate.

Today both roles share `/hr-dashboard` and `/manage-staff`, and the SUPERADMIN sidebar lists HR Dashboard as its first item. Effectively SUPERADMIN is a stronger HR. The permission matrix in `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md` draws the line differently, and that line is what the navigation must express.

HR runs the attendance operation for a business. HR sees today's exceptions, the attendance table, help requests, correction requests, and the employees in scope. HR reads sites and cannot change them. HR can reset an employee's PIN with a required reason and never sees the old or new value.

SUPERADMIN owns the business configuration that makes the operation possible. SUPERADMIN defines the business profile, shifts, assignments, the working calendar, attendance policies, sites and geo-fences, and kiosk devices, and reads the audit log. SUPERADMIN does not become an HR approver by virtue of the role. `O17` and PRD section 4.2 both forbid self-approval, and the matrix leaves correction decisions with HR.

The practical consequence for navigation is that a super admin who needs to work an exception queue should switch context deliberately, not find the HR queue sitting above their own overview. The proposal in section 4 reflects that: the two roles get different primary navigation, and the super admin reaches attendance operations through an explicit Attendance group rather than by inheriting the HR dashboard as their home.

This is a change from the current behaviour and the owner should confirm it, because it is the kind of difference that feels like a regression to anyone who is used to the existing sidebar.

---

## 2. Staff experience

### 2.1 What a staff member is trying to do

A staff member opens AttendPro in four situations. They want to know whether today's attendance is recorded and whether it looks right. They want to know when they next work and when they are off. They want to raise something that looks wrong. They want to change their password or PIN.

They do not punch from this interface. The hard rule in PRD section 7 stands, and the kiosk with QR and PIN under `O2`, `O3`, and `O6` is where attendance is recorded. The dashboard shows facts about attendance, never a clock-in control.

### 2.2 The arrival question

The staff dashboard's job is to answer one question above the fold: is my attendance for today correct, and if not, what do I do about it?

The current screen leads with a greeting in display serif, then a four-tile KPI bento covering weekly hours, present days, late days, and monthly attendance rate, then punch buttons. Of those, only the punch buttons are wrong by rule and only the rate is wrong by computation. The bento is not wrong, but it answers a question about the past month before it answers the question about today.

The proposed order is today's record first, then anything needing action, then history. The auto clock-out banner that already exists at `src/pages/Dashboard.tsx` lines 92 to 98 is the right instinct and stays, with its message corrected to report the time the system actually closed the session rather than a literal 11:59 PM, since `O8` closes sessions every fifteen minutes against shift end plus a buffer.

### 2.3 Staff navigation

```
STAFF
├─ Overview                         /dashboard
├─ My Schedule                      /schedule
├─ Attendance
│   └─ My Attendance                /attendance
├─ Help and Corrections
│   ├─ Help Requests                /help-requests
│   └─ Corrections                  /corrections
└─ (account popover)
    ├─ Profile and Security         /profile
    │   ├─ Change password          /set-password
    │   └─ Change PIN               /profile/change-pin
    ├─ Settings                     /settings
    └─ Sign out
```

Five top-level destinations plus an account menu. Profile and Settings move out of the sidebar into the account popover, which removes the duplication found in section 3 of the Stage 1 audit and frees the sidebar for workflows.

Two items deserve a note on why they are there. My Attendance at `/attendance` is a separate route from the overview because the overview answers today and the history answers a month, and the M1 navigation map already specifies `/attendance` with the PRD section 8 field set scoped to one employee. Corrections is its own destination rather than being folded into help because `O17` gives corrections a seven-day window, a decision record, and a rule against self-approval, while a help request is an open-ended question. They share a queue shape but not a lifecycle.

### 2.4 What staff navigation declines

No Clock In item. No business settings, sites, devices, or reports. No employee list. PRD section 7 is explicit that a staff member sees their own data.

---

## 3. HR experience

### 3.1 What an HR user is trying to do

An HR user opens AttendPro at the start of a shift period and works a queue. Who did not clock out. Who was flagged outside a geo-fence. Who is absent against an approved schedule. Which corrections are waiting on a decision. Which help requests are unanswered.

That is an operations console, and it means the HR home screen should be an exception list with the attendance table one click away, not a chart wall.

### 3.2 HR navigation

```
HR
├─ Overview                         /hr-dashboard
├─ Attendance Operations
│   ├─ Attendance                   /hr-attendance
│   ├─ Exceptions                   /hr-exceptions
│   └─ Absences                     /hr-exceptions?tab=absent
├─ People
│   └─ Employees                    /manage-staff
├─ Requests
│   ├─ Help Requests                /hr-help-requests
│   └─ Corrections                  /hr-corrections
├─ Reporting
│   └─ Reports                      /hr-reports
└─ (account popover)
    ├─ Profile and Security         /profile
    ├─ Settings                     /settings
    └─ Sign out
```

The grouping under Attendance Operations exists because those three views are the same table with different predicates. `/hr-exceptions` and the absences view are filtered states of `/hr-attendance`, not separate data sources, which is what keeps the count of real screens honest while still giving each queue a direct address.

HR reads Sites in the permission matrix but has no write access, so Sites does not appear as an HR nav item. If the owner wants HR to see the site list for reference, the right home is a read-only link from the Exceptions screen where an outside-geo-fence flag originates, not a permanent sidebar entry.

### 3.3 What HR navigation declines

No Sites editor, no Devices, no policies, no calendar editor, no shift management. Those are business configuration and belong to the super admin. HR does not approve a correction it submitted, which `O17` and PRD section 4.2 both require, and that rule is enforced in the decision screen rather than by hiding the item.

---

## 4. Super admin experience

### 4.1 What a super admin is trying to do

A super admin does two different jobs and the navigation should not confuse them. Early in a business's life, the job is setup: create the business, define shifts, assign people, set the working calendar, add sites with geo-fences, pair kiosks. After setup, the job is oversight: is attendance healthy, is any device offline, what does the audit log show.

The current `/superadmin-dashboard` reports the first job well enough and says nothing about the second. A dashboard that does not tell a super admin how many kiosks are paired or whether a site has no geo-fence is a dashboard that has to be supplemented with a phone call.

### 4.2 Super admin navigation

```
SUPERADMIN
├─ Overview                         /superadmin-dashboard
├─ Attendance
│   ├─ Attendance                   /admin-attendance
│   └─ Help and Corrections         /admin-help-corrections
├─ People
│   └─ Employees                    /manage-staff
├─ Scheduling
│   ├─ Shifts                       /shift-management
│   ├─ Schedules                    /scheduling
│   └─ Calendar                     /calendar-settings
├─ Operations
│   ├─ Sites                        /sites
│   ├─ Devices                      /devices
│   └─ Attendance Policies          /attendance-policies
├─ Reporting and Audit
│   ├─ Reports                      /reports
│   └─ Audit Log                    /audit-log
└─ (account popover)
    ├─ Profile and Security         /profile
    ├─ Business Settings            /settings
    └─ Sign out
```

Fourteen destinations, in the order PRD section 9 lists them, plus the Sites and Devices entries the decision register requires. The Scheduling and Operations groups carry most of the setup work, and grouping them means the super admin's first week and their fiftieth week use the same sidebar.

The Overview is where setup health belongs: sites without geo-fences, unpaired or stale kiosks, policies still at defaults, and the business profile still incomplete. Section 5.4 of `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md` already specifies the screens; this adds the requirement that the overview surfaces their completion state.

### 4.3 The super admin and attendance operations

The owner decided on 2026-10-16 that SUPERADMIN acts as a **correction-decision backstop** when HR is unavailable or has a conflict of interest (decision `O21`). That gives `/admin-attendance` and `/admin-help-corrections` a reason to exist as nav items rather than folding into Reports, and both stay.

The backstop is not a second approver sitting beside HR. HR decides every correction in its own scope as the normal path, and the super admin is reached only through one of three conditions: the item has been unclaimed for 24 hours, the correction concerns an HR user or every HR approver is excluded by the no-self-approval rule, or HR hands it over explicitly. The exclusion rule applies to the super admin without exception, so a super admin who submitted a correction can never decide it and the item routes to HR. Every backstop decision records the actor, the role held at the time, a required reason, and which condition justified it, and is marked distinctly in the audit log so a reviewer can filter for them.

The full rule table is in `docs/attendpro/M1-VISUAL-DESIGN-SYSTEM.md` §7 and needs approval before Stage 4 designs the decision screen, because the screen has to expose the waiting time and the reason field that the rules assume.

---

## 5. Screen ownership across roles

The owner asked that a screen serving multiple roles be justified rather than assumed. This table is that justification, and it replaces the current arrangement where HR Dashboard and Manage Staff are simply shared.

| Screen | STAFF | HR | SUPERADMIN | Why it is shared or not |
|---|---|---|---|---|
| Overview | own data only | business exceptions | business and setup health | Same route, different data scope and different leading question. Not shared in any way a user would notice. |
| My Attendance | yes | no | no | One employee's records. HR reaches the same rows through the business table. |
| Attendance | no | yes | read | HR operates the table; super admin reads. One component, two scopes. |
| Exceptions and Absences | no | yes | read | Filtered views of the same table. |
| Employees | no | yes, in scope | yes, full | Same screen, same component. The matrix scopes HR and gives super admin the elevated actions. This is the current `/manage-staff` arrangement, and it is correct. |
| Help Requests | own | queue | read | Different query, same list component. |
| Corrections | own submissions | decision queue | read | Same list component, but the decision action is HR-only and never available on a request the actor submitted. |
| Shifts, Schedules, Calendar | no | no | yes | Business configuration under PRD section 9. |
| Sites | no | read | yes | Matrix grants HR read for geo-fence context, write to super admin only. |
| Devices | no | no | yes | Pairing and revocation are super admin actions under `O3`. |
| Attendance Policies | no | no | yes | Business configuration. |
| Reports | no | yes | yes | Matrix grants both roles reporting access. Two destinations, one component, different scope. |
| Audit Log | no | no | yes | Audit is a super admin responsibility. |
| Profile, Settings | yes | yes | yes | Personal, and identical in content for every role. |

Nine shared surfaces, and in each case the sharing is a scope difference rather than an overlap in responsibility. The only genuinely duplicated behaviour today is the HR dashboard appearing in both admin sidebars, and section 1 explains why that changes.

---

## 6. Decisions this stage needed from the owner

All six were answered on 2026-10-16 in the second owner review.

| # | Question | Answer | Ref |
|---|---|---|---|
| 1 | Should SUPERADMIN inherit HR's correction-decision ability? | Backstop only, when HR is unavailable or has a conflict. No self-approval, every decision audited. Rules proposed in `M1-VISUAL-DESIGN-SYSTEM.md` §7 | `O21` |
| 2 | Should the SUPERADMIN overview lead with setup health or attendance trends? | Setup health, configuration and operational readiness | `O22` |
| 3 | Confirm SUPERADMIN's home is the overview, not the HR dashboard | Confirmed | `O22` |
| 4 | Confirm Profile and Settings move to the account popover | Confirmed, for all three roles | `O23` |
| 5 | Confirm staff punch capability is removed | Confirmed, kiosk-only is absolute | `O20` |
| 6 | Adopt grouped navigation sections, or keep the flat list? | Still open. The grouped form is what Stage 3 renders, and the owner has not yet chosen between them | — |

---

## 7. What this changes relative to today

| Area | Today | Proposed |
|---|---|---|
| Public entry | `/` redirects to login | public landing at `/` |
| Sidebar shape | flat array of six items | grouped sections, role-specific |
| Profile and Settings | sidebar items plus account popover entries | account popover only |
| Staff home | greeting, KPI bento, punch buttons | today's record, then actions, then history; no punch |
| HR home | chart-led | exception-led |
| SUPERADMIN home | HR dashboard copy plus its own dashboard | one overview covering attendance and setup health |
| Role separation | SUPERADMIN is a stronger HR | two distinct navigations with scoped overlap |
| Screens served | 9 | 5 staff, 7 HR, 14 super admin, 1 public, plus the kiosk |

Stage 3 takes whichever navigation is approved here and settles the visual system that renders it, which is where the open question about the two competing design documents has to be answered first.
