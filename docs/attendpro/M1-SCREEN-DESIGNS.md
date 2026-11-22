# AttendPro M1 — Stage 4: Screen Designs and Navigation Flows

- **Date:** 2026-10-16
- **Stage:** 4 of 6 in the product-owner UI/UX workflow
- **Baseline commit:** `f87ce1d` (M0), code state as of `c4ee602`
- **Milestone:** M1, pending owner approval
- **Owner:** UI Designer Agent
- **Companions:** `docs/attendpro/M1-UI-AUDIT.md` (Stage 1), `docs/attendpro/M1-ROLE-EXPERIENCES.md` (Stage 2), `docs/attendpro/M1-VISUAL-DESIGN-SYSTEM.md` (Stage 3), `docs/attendpro/previews/design-comparison.html`, `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md`, `docs/attendpro/M1-API-CONTRACTS.md`
- **Status:** design only. No file under `src/` or `backend/` is modified.

---

## 0. The basis this stage is drawn on

The visual system is not settled. The owner's decision `O19` set the Operations Console as the baseline for comparison and left the final colour values open until the Stage 3 mockups are reviewed. Stage 4 therefore draws every screen on **Paper and Brass, the system recommended in Stage 3**, and treats those token values as provisional. If the owner changes the palette after reviewing the mockups, the layouts, hierarchy, and component structure in this document survive, because none of them depend on a hue. Only the token layer changes.

The colours shown in the wireframes below are indicative. The measured palette is in `M1-VISUAL-DESIGN-SYSTEM.md` section 3.

Two decisions from the second owner review are applied throughout: the staff streak is gone (`O24`), and the Profile Achievements section is gone (`O24`). No screen in this document contains a gamification element.

---

## 1. Dispositions

Every current screen and every proposed screen is assigned exactly one disposition. The owner asked for keep, improve, combine, replace, or remove, and create is added for screens that do not exist.

| Disposition | Meaning |
|---|---|
| **KEEP** | Correct as it stands. No design change beyond adopting the shared components. |
| **IMPROVE** | Right screen, wrong hierarchy, density, or completeness. |
| **COMBINE** | Two or more surfaces that should be one. |
| **REPLACE** | The screen exists but its purpose is better served by a different screen. |
| **REMOVE** | The screen or section should not exist in version one. |
| **CREATE** | The screen does not exist and the requirements call for it. |

The Stage 1 verdicts are restated here as dispositions, and the changes from the earlier preliminary labels are named.

---

## 2. Existing screens

| Screen | Route | Disposition | Change from Stage 1 label |
|---|---|---|---|
| Login | `/login` | **IMPROVE** | unchanged |
| Set password | `/set-password` | **KEEP** | unchanged |
| Staff dashboard | `/dashboard` | **REPLACE** | Stage 1 said IMPROVE. The punch buttons come out under `O20`, the streak comes out under `O24`, and the KPI bento reorders around today rather than the month. That is a redesign of the screen's purpose, so REPLACE is the honest label. |
| Staff schedule | `/schedule` | **IMPROVE** | unchanged |
| Profile | `/profile` | **IMPROVE** | Stage 1 said SPLIT. The Achievements section is removed under `O24` and the PIN region is added, so the screen is improved in place rather than split; password and PIN already have their own routes. |
| Settings | `/settings` | **COMBINE** | Stage 1 said SPLIT. Reconsidered: one settings shell with role-scoped sections combines them without duplicating the shell, navigation, or save behaviour. |
| HR dashboard | `/hr-dashboard` | **REPLACE** | Stage 1 said IMPROVE. It becomes exception-led with the charts demoted, which changes what the screen is for. |
| Super admin dashboard | `/superadmin-dashboard` | **REPLACE** | Stage 1 said IMPROVE. It becomes a setup-health and readiness screen under `O22`, which is a different screen from the attendance-reporting one it is today. |
| Manage staff | `/manage-staff` | **IMPROVE** | Stage 1 said KEEP with extension. The extension (detail view, audited PIN reset) is large enough to call IMPROVE. |
| Sidebar and layout shell | — | **IMPROVE** | unchanged |
| Achievements section | `/profile` | **REMOVE** | new, under `O24` |
| Staff attendance streak | `/dashboard` | **REMOVE** | new, under `O24` |
| `BadgeGridSkeleton` | shared | **REMOVE** | new, dead once Achievements goes |
| `AuthenticatedHome` redirect at `/` | `/` | **REPLACE** | replaced by the public landing page for visitors |

---

## 3. New screens

| Screen | Route | Roles | Disposition |
|---|---|---|---|
| Public landing | `/` | public | CREATE |
| Account recovery | `/account/recovery` | public | CREATE |
| Change PIN | `/profile/change-pin` | all | CREATE |
| Staff attendance history | `/attendance` | STAFF | CREATE |
| Staff help requests | `/help-requests` | STAFF | CREATE |
| Staff corrections | `/corrections` | STAFF | CREATE |
| HR attendance | `/hr-attendance` | HR, SUPERADMIN read | CREATE |
| HR exceptions | `/hr-exceptions` | HR, SUPERADMIN read | CREATE |
| HR help requests | `/hr-help-requests` | HR | CREATE |
| HR corrections | `/hr-corrections` | HR | CREATE |
| Correction detail and decision | `/hr-corrections/:id` | HR, SUPERADMIN backstop | CREATE |
| Reports | `/reports` | HR, SUPERADMIN | CREATE |
| Sites | `/sites` | SUPERADMIN write, HR read | CREATE |
| Devices | `/devices` | SUPERADMIN | CREATE |
| Shifts | `/shift-management` | SUPERADMIN | CREATE |
| Schedules | `/scheduling` | SUPERADMIN | CREATE |
| Calendar | `/calendar-settings` | SUPERADMIN | CREATE |
| Attendance policies | `/attendance-policies` | SUPERADMIN | CREATE |
| Audit log | `/audit-log` | SUPERADMIN | CREATE |
| Employee detail | `/manage-staff/:id` | HR, SUPERADMIN | CREATE |
| PIN reset | `/manage-staff/:id/reset-pin` | HR, SUPERADMIN | CREATE |
| 403 forbidden | `/403` | all | CREATE |
| Kiosk | `/kiosk` | unauthenticated device | CREATE |

Twenty-three new screens. That number is the honest size of the gap found in Stage 1, and it is the reason the sidebar looks empty today.

---

## 4. Screen designs

Each design below states what the screen is for, what it shows, what it does, and the states it must handle. Wireframes are structural; they show hierarchy and information, not final spacing.

### 4.1 Public landing — `/`

**Purpose.** Explain the attendance problem and show the product before asking anyone to sign in. This replaces `AuthenticatedHome` for visitors, which today sends a stranger to a login form.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ▣ AttendPro        Product   How it works   Pricing         [Sign in]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Know who is on site,              ┌───────────────────────────────┐   │
│   the moment they arrive.           │  Today · 12 of 14 in          │   │
│                                     │  ┌────────┐ ┌────────┐       │   │
│   Attendance recorded at a kiosk    │  │ On time│ │ Late   │       │   │
│   with a QR badge and a PIN,        │  │   9    │ │   2    │       │   │
│   checked against the site.         │  └────────┘ └────────┘       │   │
│                                     │  ┌────────┐ ┌────────┐       │   │
│   [ Start free trial ]  [ See demo] │  │ Absent │ │Review  │       │   │
│                                     │  │   1    │ │   2    │       │   │
│                                     │  └────────┘ └────────┘       │   │
│                                     │  ─────────────────────────    │   │
│                                     │  Kwabena   05:55  On time     │   │
│                                     │  Akosua    06:00  On time     │   │
│                                     │  Yaw       06:18  Late        │   │
│                                     │  ── sample data ──            │   │
│                                     └───────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  ● Clock-in at the door   ● Exceptions, not guesswork   ● Immutable log │
├─────────────────────────────────────────────────────────────────────────┤
│  © AttendPro · Privacy · Terms · Contact                                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Shows.** A headline, three supporting facts, a compact dashboard preview with three statistics and a four-row sample table, and a footer. Every figure is marked as sample data.

**Does.** Sign-in and the account links. The three feature strip items are text, not links, until those pages exist.

**States.** Loading, error, success. The preview is static, so no loading state is needed for it; the copy is server-rendered text.

**Rule.** No live tenant data, per the owner's instruction. The preview uses the fictional names already used in `M1-NAVIGATION-AND-SCREENS.md`.

---

### 4.2 Login — `/login`

**IMPROVE.** The screen stays, and its brand panel keeps the job of setting the identity. What changes is that it is no longer the product's front door, so it gains a link back to the landing page and a link to account recovery.

```
┌───────────────────────────┬─────────────────────────────────────────────┐
│  CHROME (dark)            │  PAPER                                      │
│                           │                                             │
│  ▣ AttendPro              │   Sign in                                   │
│                           │   Use the account your business gave you.   │
│  Attendance you can       │                                             │
│  stand behind.            │   Work email                                │
│                           │   [_____________________________________]   │
│  ● Kiosk-verified         │                                             │
│  ● Location-checked       │   Password                                  │
│  ● Fully audited          │   [_____________________________________]   │
│                           │                                             │
│                           │   [ Sign in ]                               │
│                           │                                             │
│                           │   Cannot sign in? Recover your account →    │
│                           │   ← Back to AttendPro                       │
└───────────────────────────┴─────────────────────────────────────────────┘
```

**States.** Loading (button in flight, disabled), error (field-level and form-level from the typed error contract), success (redirect to role home), unauthorized (wrong role or expired session returns here).

---

### 4.3 Account recovery — `/account/recovery`

**CREATE.** Replaces SMS recovery with an emailed single-use code under `O6`. Three steps in one screen, with the step visible.

```
┌─────────────────────────────────────────────────────────────────────────┐
│   AttendPro                                            ← Back to sign in │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Recover your account                                                  │
│   ● ① Email          ○ ② Code          ○ ③ Set your PIN                 │
│                                                                         │
│   Enter the work email your business registered for you.                │
│   If it matches an account, we will send a six-digit code.              │
│                                                                         │
│   [_______________________________________]                             │
│   [ Send code ]                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Shows.** The current step, and only the fields that step needs. Step 2 accepts the six-digit code with a 60-second resend control. Step 3 sets a first PIN.

**Rule.** The same message appears whether or not the email matches an account, so the screen never enumerates accounts. The PIN policy is the one in `M1-KIOSK-SECURITY.md`. The screen sends nothing by text message.

---

### 4.4 Staff overview — `/dashboard`

**REPLACE.** Today it is a greeting, a four-tile bento, and two punch buttons that should not exist. The replacement answers one question first: is today's attendance correct, and is anything waiting on me.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Good morning, Kwabena.                              Fri 16 Oct 2026    │
│  ──────                                                                 │
├───────────────────────────────┬─────────────────────────────────────────┤
│  TODAY                        │  NEEDS YOU                              │
│  ┌─────────────────────────┐  │  ┌───────────────────────────────────┐  │
│  │ Clocked in   05:55 AM   │  │  │ ⚠ Forgot to clock out on 12 Oct   │  │
│  │ Status       On time ✓  │  │  │   Closed automatically at 02:14 PM│  │
│  │ Site         Head Office│  │  │   [ Request a correction ]        │  │
│  │ Shift        Morning    │  │  └───────────────────────────────────┘  │
│  │ Clock-out    —          │  │                                         │
│  └─────────────────────────┘  │  ┌───────────────────────────────────┐  │
│                               │  │ Correction under review (1)       │  │
│  Recorded at the kiosk.       │  │   Submitted 14 Oct · with HR      │  │
│  Something wrong?             │  └───────────────────────────────────┘  │
│  [ Request a correction ]     │                                         │
├───────────────────────────────┴─────────────────────────────────────────┤
│  THIS WEEK                                                              │
│  Hours 38.5   ·   Present 4   ·   Late 0   ·   Off today: no            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Mon 6:00–2:00  Tue 6:00–2:00  Wed 6:00–2:12  Thu 6:00–2:00  Fri …│  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Shows.** Today's record as the primary block, with the site name (from `O4`), the assigned shift, and the clock-in and clock-out as read-only facts. A "needs you" column carries the auto clock-out notice and any open correction. The weekly strip follows.

**Does.** Links to a correction request and to the full attendance history. **There is no clock-in and no clock-out control** (`O20`). The auto clock-out notice reports the actual close time from `O8`, never a literal 11:59 PM.

**Removed.** The streak (`O24`), the punch buttons (`O20`), and the attendance-rate tile whose denominator was a hardcoded 22.

**States.** Loading (skeleton in the two columns), empty (first day: "No attendance yet. Your first punch at the kiosk will appear here."), error, success.

---

### 4.5 Staff attendance history — `/attendance`

**CREATE.** The record the overview only summarises.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  My attendance                        [ 1 Oct – 16 Oct ▾ ]  [ Export ]  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┬──────────┬──────────┬──────────┬──────────┬─────────┐  │
│  │ Date        │ Shift    │ Clock-in │ Clock-out│ Hours    │ Status  │  │
│  ├─────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤  │
│  │ Fri 16 Oct  │ Morning  │ 05:55 AM │    —     │    —     │ Open    │  │
│  │ Thu 15 Oct  │ Morning  │ 06:00 AM │ 02:01 PM │   8.0    │ On time │  │
│  │ Wed 14 Oct  │ Morning  │ 06:00 AM │ 02:12 PM │   8.2    │ On time │  │
│  │ Tue 13 Oct  │ Morning  │ 06:18 AM │ 02:00 PM │   7.7    │ Late    │  │
│  │ Mon 12 Oct  │ Morning  │ 05:58 AM │    —     │    —     │ Auto-cl │  │
│  │ Sat 11 Oct  │ — off —  │          │          │          │         │  │
│  └─────────────┴──────────┴──────────┴──────────┴──────────┴─────────┘  │
│  Showing 1–6 of 12                          [ Previous ]  [ Next ]      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Shows.** One employee's records with the status vocabulary from the data model, off-days shown as off-days rather than empty rows, and a per-row route to a correction.

**States.** L, E (no records in range), Err, U.

---

### 4.6 HR attendance — `/hr-attendance`

**CREATE.** The operational table. Design shown in full in the Stage 3 mockup; the structure is repeated here for completeness.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Attendance                              16 Oct ▾ · All sites ▾  [CSV]  │
│  [ Exceptions 7 ]  All 46   No clock-out 2   Outside fence 2   Absent 3 │
├───────┬───────────┬────────┬─────────┬─────────┬──────────┬────────────┤
│Employee│ Site     │ Shift  │Clock-in │Clock-out│ Status   │ Exception  │
├───────┼───────────┼────────┼─────────┼─────────┼──────────┼────────────┤
│ Yaw O. │ Tema Whse │ After. │02:04 PM │   —     │ Requires │ 410 m out  │
│ Abena A│ Head Off. │ Morning│05:58 AM │   —     │ Missing  │ past window│
│ Kwabena│ Tema Whse │ Morning│05:55 AM │02:12 PM │ On time  │     —      │
└───────┴───────────┴────────┴─────────┴─────────┴──────────┴────────────┘
```

**Does.** Filters, search, and pagination only. **HR never edits a cell**; the action column opens a review or correction workflow. The default filter is Exceptions, so the screen opens on work rather than on all rows.

**States.** L, E (no exceptions today: "Nothing needs attention today."), Err, U.

---

### 4.7 Super admin overview — `/superadmin-dashboard`

**REPLACE**, per `O22`. The screen changes from an attendance report to a readiness check. It answers: what is unfinished, what is unhealthy, what is waiting.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Setup is 6 of 8 complete                        [ Export ] [ Finish ]  │
│  Two items are unfinished. Kiosk punches cannot be verified against a   │
│  shift until Devices and Attendance Policies are set.                   │
├──────────────────┬──────────────────┬──────────────────┬────────────────┤
│ Clocked in today │ Late today       │ Needs review     │ Devices online │
│   38 of 46       │      5           │      4           │     2 / 3      │
├──────────────────┴──────────────────┴──────────────────┴────────────────┤
│  NEEDS ATTENTION                    │  SETUP CHECKLIST                   │
│  Yaw Owusu    · outside fence · 5h  │  ✓ Business profile                │
│  Abena Asante · no clock-out  · 4h  │  ✓ Shifts                          │
│  Kwabena M.   · correction    · 1d  │  ✓ Assignments        46 of 46     │
│  Esi Amankwah · help request  · 2d  │  ✓ Working calendar                │
│                                     │  ✓ Sites and geo-fences  [Review]  │
│                                     │  ✓ Kiosk pairing         [Manage]  │
│                                     │  ○ Attendance policies   [Set →]   │
│                                     │  ○ Third device          [Pair →]  │
└─────────────────────────────────────┴────────────────────────────────────┘
```

**Shows.** The completion headline, four operational KPIs, the exception queue, and the checklist. The checklist is the part with no equivalent today.

**States.** L, E (a fresh business: the checklist is the whole screen and the queue shows "Nothing waiting."), Err, U.

---

### 4.8 Sites — `/sites`

**CREATE**, under `O4`. HR reads this and cannot change it.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Sites                                             [ + Add site ]       │
│  HR can view sites. Only a super admin can change them.                 │
├──────────────────────────┬────────────┬───────────┬────────┬───────────┤
│ Name                     │ Geo-fence  │ Employees │ Devices│ Status    │
├──────────────────────────┼────────────┼───────────┼────────┼───────────┤
│ Sakumono Head Office     │ 150 m set  │    22     │   1    │ Active    │
│ Tema Warehouse           │ 200 m set  │    18     │   2    │ Active    │
│ Spintex Depot            │ not set    │     6     │   0    │ Attention │
└──────────────────────────┴────────────┴───────────┴────────┴───────────┘
```

**Does.** Super admin adds a site with a centre point and radius, and sees a plain warning when a site has no fence because every punch there will record "location unknown".

**States.** L, E (no sites: prompt to add the first), Err, U, S.

---

### 4.9 Devices — `/devices`

**CREATE**, under `O3`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Devices                                    [ Generate pairing code ]   │
├──────────────────────────┬────────────┬────────────┬──────────┬─────────┤
│ Device                   │ Site       │ Last seen  │ Token    │         │
├──────────────────────────┼────────────┼────────────┼──────────┼─────────┤
│ Kiosk · reception            │ Head Office│ 2 min ago  │ 24d left │ [Revoke]│
│ Kiosk · loading bay          │ Tema Whse  │ 12 min ago │ 71d left │ [Revoke]│
│ Kiosk · (not paired)         │ —          │ never      │ —        │ [Pair]  │
└──────────────────────────┴────────────┴────────────┴──────────┴─────────┘
```

**Does.** Generates a one-time pairing code that expires in 10 minutes, shows token age against the 30-day renewal and 90-day cap, and revokes a device. Revoking is a confirmation dialog that names the site and the consequence.

**States.** L, E (no devices), Err, U, S.

---

### 4.10 Corrections and the decision screen — `/hr-corrections/:id`

**CREATE**, covering `O17` and the backstop from `O21`. This is the screen where the escalation rules become visible.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Correction · Kwabena Mensah · 14 Oct 2026        [ Escalate to super ] │
│  Requested 14 Oct 09:12 by Kwabena Mensah                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ORIGINAL              PROPOSED                 RESULT                  │
│  Clock-out —           Clock-out 02:00 PM       → 7.9 hours             │
│  Reason: "Badge did not read at the door."                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Decision                                                               │
│  (•) Approve    ( ) Decline                                             │
│  Reason *  [______________________________________________]              │
│                                                                         │
│  ⚠ You requested this correction. You cannot decide it.                 │
│    HR unavailable 24h. Super admin may decide.        [ Decide ]        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Rule.** The self-approval block is shown as a fact on the screen, not only enforced on submit. The backstop message states which condition applies and how long the item has waited. A super admin decision requires the reason field.

**States.** L, E, Err, U, success (decision recorded, audit entry written).

---

### 4.11 Audit log — `/audit-log`

**CREATE.** Read-only, append-only, filterable.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Audit log          [ All events ▾ ]  [ 1–16 Oct ▾ ]  [ Actor ▾ ]      │
├──────────────┬──────────────┬───────────────────────┬───────────────────┤
│ Time         │ Actor        │ Action                │ Target            │
├──────────────┼──────────────┼───────────────────────┼───────────────────┤
│ 16 Oct 09:20 │ Kofi (SUPER) │ Correction approved ★ │ Kwabena · 14 Oct  │
│              │              │ backstop: HR unavail. │                   │
│ 16 Oct 08:02 │ Akosua (HR)  │ PIN reset             │ Esi Amankwah      │
│ 16 Oct 07:41 │ system       │ Auto clock-out        │ Abena Asante      │
└──────────────┴──────────────┴───────────────────────┴───────────────────┘
```

**Rule.** Backstop decisions are marked (★) so a reviewer can filter them. Entries cannot be edited or deleted from this screen.

**States.** L, E, Err, U.

---

### 4.12 Kiosk — `/kiosk`

**CREATE.** Public-facing, dark surface, unauthenticated device.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ┌─────────────────────────┐                      │
│                        │   Scan your badge       │                      │
│                        │      [ QR frame ]       │                      │
│                        └─────────────────────────┘                      │
│                                                                         │
│   After a good scan:  "Kwabena, enter your PIN"  [ _ _ _ _ ]            │
│   Success:            "Kwabena — clocked in · On time"   (clears 6s)    │
│   Failure:            "That PIN is not correct. Try again." (clears 8s) │
└─────────────────────────────────────────────────────────────────────────┘
```

**Rule.** The kiosk never shows an attempt countdown, never reveals whether a badge exists elsewhere, and never shows the location result. It records the location assessment silently; an outside or unknown result is flagged for review, not shown here. Full behaviour is in `M1-KIOSK-SECURITY.md` §10.

The kiosk is the one screen where the Stage 3 comparison argued a dark ground has a functional reason rather than a stylistic one, so it should be mocked in both systems before the palette is settled.

---

## 5. Navigation flows

### 5.1 First-run for a super admin

```
login → /superadmin-dashboard (setup 0 of 8)
             │ checklist drives every step
             ├─ Business profile ─► /settings
             ├─ Shifts ──────────► /shift-management
             ├─ Assignments ─────► /manage-staff → /manage-staff/:id
             ├─ Calendar ────────► /calendar-settings
             ├─ Sites ───────────► /sites → add site → set geo-fence
             ├─ Kiosk pairing ───► /devices → generate code → kiosk redeems
             └─ Policies ────────► /attendance-policies
        checklist reaches 8 of 8 → overview leads with the exception queue
```

### 5.2 A staff correction

```
/dashboard (needs you: forgot to clock out)
   └─► /corrections/new → reason → submit
          └─► /corrections (status: with HR)
                 └─ HR: /hr-corrections/:id → decide → audit written
                        └─► /corrections (status: approved) + /attendance updated
```

### 5.3 A kiosk punch that flags location

```
/kiosk → scan badge → enter PIN → punch recorded
   └─ location assessment = OUTSIDE
        ├─ kiosk shows "clocked in · On time" (no location shown)
        └─ HR: /hr-exceptions → "410 m outside the fence" → review
                 ├─ plausible → approve, note kept
                 └─ not plausible → send to correction
```

### 5.4 The correction backstop (`O21`)

```
/hr-corrections/:id
   ├─ HR active, not the requester ──► HR decides
   ├─ HR is the requester ────────────► blocked (shown on screen)
   │        └─ escalated to super admin, or another HR approver
   ├─ unclaimed 24h ──────────────────► super admin offered "Decide"
   └─ explicit handoff by HR ─────────► super admin decides
              every backstop path writes a marked audit entry with a reason
```

---

## 6. State coverage

Every screen must handle four states. This table is the contract for Stage 5 and the test plan in Stage 6.

| State | Requirement |
|---|---|
| Loading (L) | A skeleton that matches the final layout, never a spinner on a blank page. |
| Empty (E) | Names what would appear and offers the action that fills it. Off-days are not an empty state; they are a computed view. |
| Error (Err) | Uses the safe message from the typed error contract. Never shows a raw backend message, which is the leak found in `attendanceController` at M0. |
| Unauthorized (U) | Guards in `src/App.jsx` redirect unauthenticated users to `/login` and wrong-role sessions to their own home. A valid session without a specific permission reaches `/403`, never a blank page. |
| Success (S) | Names what changed. Destructive actions confirm first, in a dialog that restates the consequence. |

---

## 7. Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| ≥ 1280px | Sidebar expanded, tables show all columns, two-column dashboards. |
| 1024–1279px | Sidebar expanded, tables drop the least important column, dashboards keep two columns. |
| 768–1023px | Sidebar collapses to icons with a tooltip, tables drop to the priority columns, dashboards stack. |
| < 768px | Sidebar becomes a drawer opened from a top bar, tables become a stacked card list, filters collapse behind one control. |

The current sidebar has no collapsed state, which is the gap the owner raised. The collapse behaviour above is the fix.

---

## 8. Components to build

The screens above need a shared component set so that forty screens do not become forty implementations. These are additions to what exists in `src/components/ui/`.

| Component | Replaces or extends | Used by |
|---|---|---|
| `AppShell` | extends `Layout` | every authenticated screen |
| `Sidebar` with groups and collapse | replaces flat `Sidebar` | every authenticated screen |
| `DataTable` | extends `AttendanceTable` | attendance, employees, sites, devices, audit, reports |
| `FilterBar` | new | every table screen |
| `StatusBadge` | replaces `StatBadge`, eight states, specified ground | every screen with a status |
| `PageHeader` | extends existing | every screen |
| `ConfirmDialog` | new, with focus trap | every destructive action |
| `FormField`, `FormError` | new | every form |
| `EmptyState` | new | every collection |
| `Skeleton` family | trim to used variants, drop `BadgeGridSkeleton` | every loading state |
| `Toast` | keep `react-hot-toast` | global feedback |
| `KpiCard`, `KpiHero` | keep, restyle | dashboards |
| `ChartCard` | keep, demote on HR dashboards | reporting screens |

`ConfirmDialog` must trap focus, which the current modals in `ManageStaff.jsx` do not, and `DataTable` headers must announce sort as a control, which `AttendanceTable.jsx` does not today.

---

## 9. What Stage 4 needs before Stage 5 confirms it

1. The owner's colour decision from Stage 3, which settles the tokens these layouts render in.
2. Confirmation that the disposition of Settings as COMBINE rather than SPLIT is right.
3. The kiosk mock in both systems, per the Stage 3 argument.
4. Approval of the correction-escalation rules, which the decision screen in section 4.10 depends on.

Stage 5 maps every screen and action above to the endpoints in `M1-API-CONTRACTS.md` and the tables in `M1-DATA-MODEL.md`, and reports any screen that has no backing API or record.
