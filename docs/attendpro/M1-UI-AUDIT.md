# AttendPro M1 — Stage 1: Existing UI Audit

- **Date:** 2026-10-16
- **Stage:** 1 of 6 in the product-owner UI/UX workflow
- **Baseline commit:** `f87ce1d` (M0), code state as of `c4ee602`
- **Milestone:** M1, pending owner approval
- **Owner:** UI Designer Agent
- **Companions:** `docs/attendpro/M1-ROLE-EXPERIENCES.md` (Stage 2), `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md`, `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md`, `docs/attendpro/DECISION-REGISTER.md`, `docs/DESIGN_PROPOSAL.md`, `DESIGN.md`
- **Status:** read-only audit. No file under `src/`, `backend/`, `public/`, or any configuration file is created, modified, or deleted by this document.

---

## 0. Scope and method

The product owner asked for an audit that goes further than "does it render." This document therefore asks four questions of every existing surface: does it work, does it look like a credible commercial product, is it complete against the requirements, and is it usable by the person whose job it supports.

Every claim below names a file and, where the claim is specific, a line number or a symbol. Claims about what the code does come from reading the code. Claims about what the product should do come from `docs/ATTENDPRO_PRD.md` and the confirmed decisions `O1`–`O18` in `docs/attendpro/DECISION-REGISTER.md`. Where the two disagree, the disagreement is reported rather than resolved, because the resolution belongs to the product owner in Stage 3 and Stage 6.

The audit covers the nine page modules, the layout and navigation shell, the shared UI component set, the token layer, and the type layer. It does not cover the backend except where a frontend assumption contradicts a confirmed decision.

---

## 1. What exists

### 1.1 Stack

| Layer | Version and choice | Evidence |
|---|---|---|
| Build | Vite 7.2.4 | `package.json` |
| UI | React 19.2.0 | `package.json` |
| Routing | React Router 7.15.0 | `package.json` |
| Language | TypeScript 7.0.2 declared | `package.json` |
| Styling | Tailwind CSS 3.4.19 | `tailwind.config.js`, `src/index.css` |
| Icons | `react-icons/fa6` | `src/components/Sidebar.tsx`, `src/components/ui/AttendanceTable.jsx` |
| Charts | `recharts` | `src/pages/HrDashboard.tsx`, `src/pages/SuperAdminDashboard.jsx` |
| Notifications | `react-hot-toast` | `src/App.jsx`, all pages |
| HTTP | `axios` with a token interceptor | `src/api/axios.ts` |
| Auth storage | `localStorage` for token and user object | `src/utils/auth.ts` |

The frontend sits at the repository root in `src/`, with the backend in `backend/`. There is no `frontend/` directory.

### 1.2 Route table

Ten routes are declared in `src/App.jsx`, with a wildcard that sends anything unmatched to `/login`.

| Path | Guard | Page module | File language |
|---|---|---|---|
| `/login` | none | `Login` | `.tsx` |
| `/dashboard` | `StaffRoute` | `Dashboard` | `.tsx` |
| `/schedule` | `StaffRoute` | `Schedule` | `.jsx` |
| `/profile` | `ProtectedRoute` | `Profile` | `.tsx` |
| `/settings` | `ProtectedRoute` | `Settings` | `.jsx` |
| `/set-password` | `SetPasswordRoute` | `SetPassword` | `.jsx` |
| `/hr-dashboard` | `AdminRoute` | `HrDashboard` | `.tsx` |
| `/superadmin-dashboard` | `SuperAdminRoute` | `SuperAdminDashboard` | `.jsx` |
| `/manage-staff` | `AdminRoute` | `ManageStaff` | `.jsx` |
| `/` | `AuthenticatedHome` | redirects only | `.jsx` |

The guards live in `src/utils/auth.ts` and `src/App.jsx`. `AuthenticatedHome` sends a signed-in visitor to the role home and everyone else to `/login`. There is no public screen anywhere in the application.

### 1.3 Shared components

Nine files under `src/components/`.

| Component | Used by | Notes |
|---|---|---|
| `Layout.tsx` | every authenticated page | wraps `Sidebar` and the page in a content container |
| `Sidebar.tsx` | `Layout` | role-filtered nav, account popover, status line |
| `ErrorBoundary.jsx` | root of `App.jsx` | renders a fallback on render error |
| `ui/StatBadge.jsx` | `AttendanceTable`, dashboards | status pill |
| `ui/AttendanceTable.jsx` | `Dashboard`, `HrDashboard`, `SuperAdminDashboard` | sortable, paginated |
| `ui/BentoSkeleton.tsx` | `Dashboard` | loading placeholder |
| `ui/KpiHero.tsx`, `ui/KpiCard.tsx` | `Dashboard` | metric tiles |
| `ui/ChartCard.tsx` | dashboards | recharts wrapper |
| `ui/PageHeader.tsx` | some pages | page title block |

### 1.4 Token layer

`src/index.css` defines CSS custom properties for surfaces, hairlines, ink, a single brass accent, success, error, warning, and a dark chrome polarity used by the sidebar and the login brand panel. Tailwind maps these into utility classes, and `@layer components` declares button primitives (`.btn-primary`, `.btn-secondary`, `.btn-tertiary`, `.btn-inverse`) plus text roles (`text-display-xl`, `text-caption`, `text-button`).

The token layer is internally consistent and contrast-measured. Each colour carries its ratio in a comment. That is real craft, and it is the strongest foundation in the current frontend.

---

## 2. Finding A: two governing design documents disagree

This is the single most consequential finding in the audit, and it has to be settled before Stage 3 can produce anything reviewable.

`src/index.css` opens by stating that every value in it is measured against section 5 of `docs/DESIGN_PROPOSAL.md`. That file describes "AttendPro Design System v2", and its own header line reads:

> Status: PROPOSED — NOT APPROVED. Does not replace root `DESIGN.md`.

Root `DESIGN.md` is a different system entirely. Its archetype section names an Operations Console with a near-black canvas of `#010102`, light gray ink of `#f7f8f8`, and a single lavender-blue accent of `#5e6ad2`. Section 11 of that file, added on 2026-10-15 during M1, describes surfaces using the paper and brass vocabulary.

The three artefacts do not agree.

| Artefact | Palette | Approval state |
|---|---|---|
| `DESIGN.md` sections 1 to 5 | near-black canvas, lavender-blue accent | owner-signed 2026-10-06 |
| `DESIGN.md` section 11 | paper and brass | added 2026-10-15, describes the same surfaces as `src/index.css` |
| `docs/DESIGN_PROPOSAL.md` | warm stone paper, brass accent | header says NOT APPROVED |
| `src/index.css` | warm stone paper, brass accent | shipped in every page |

A count of the terms confirms the split. "Paper" and "brass" appear 37 times in `docs/DESIGN_PROPOSAL.md` and 18 times in `src/index.css`. They appear zero times in root `DESIGN.md`.

So the shipped frontend implements a palette whose own source document says it was never approved, while the document that was approved describes a different product's look, and a later section of that approved document has been quietly edited to describe what was shipped. The result is that no reader can currently answer "which design system governs AttendPro" from the repository alone.

The audit does not recommend a palette here. Stage 3 compares the two against the product's needs and the owner chooses. What this audit establishes is that the choice is currently unmade, and that section 11 of `DESIGN.md` should not remain in its present half-reconciled state.

**Action for the owner:** decide in Stage 3 which system governs, then either approve `docs/DESIGN_PROPOSAL.md` and fold it into `DESIGN.md`, or revert `DESIGN.md` section 11 to match the signed archetype and restyle the frontend. Leaving both is what produced the current ambiguity.

---

## 3. Finding B: the navigation is thin, and the requirement is broad

The product owner described the sidebar as empty. The evidence supports the description, but the cause is not that nobody added menu items. The cause is that most of the product's screens do not exist yet.

`src/components/Sidebar.tsx` holds six nav entries. For a signed-in STAFF user it offers Dashboard, My Profile, My Schedule, and Settings. For HR it offers HR Dashboard, My Profile, Manage Staff, and Settings. For SUPERADMIN it offers HR Dashboard, My Profile, Manage Staff, and Settings.

Against the confirmed M1 navigation map in `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md`, which enumerates roughly forty-five screens across the public site, the staff portal, the HR portal, the super admin area, and the kiosk, the current sidebar exposes six destinations and the router serves nine pages. The gap is not a styling problem.

Three specific structural problems are visible in the sidebar itself.

First, the item list is a flat array with a `roles` field, so grouping has no representation. There is no way to render the sections the owner asked for without changing the data shape.

Second, MY PROFILE and SETTINGS appear as top-level sidebar items and again inside the account popover at lines 150 and 151. Two entries for the same destination, both always visible, is the duplication the owner flagged.

Third, HR Dashboard is granted to SUPERADMIN as well as HR (`src/components/Sidebar.tsx` line 44). SUPERADMIN has its own dashboard at `/superadmin-dashboard`, so the SUPERADMIN sidebar offers both. Whether that is intended depends on how the owner wants the two roles separated, which is a Stage 2 question rather than a bug.

---

## 4. Finding C: the staff dashboard breaks a hard product rule

PRD section 7 states a hard rule: the staff portal contains no clock-in and no clock-out button, because attendance is recorded at an authorised kiosk. The current staff dashboard ignores this.

`src/pages/Dashboard.tsx` lines 112 to 136 define `handleClockIn` and `handleClockOut`, which call `POST /attendance/clock-in` and `POST /attendance/clock-out`. Lines 225 to 234 render the two buttons. A signed-in staff member can therefore punch from a browser.

The confirmed decisions reinforce this. `O2` and `O6` establish QR plus PIN at the kiosk as the identification method, and the navigation document carries the rule in bold. Kiosk-first attendance is the product's central design constraint, because it is what makes a punch attributable and geofence-checked. A browser punch bypasses both.

This is not a cosmetic disagreement. It changes what the attendance record means, so it needs an owner decision rather than a silent fix: either the buttons come out and the dashboard becomes read-only, or the rule is relaxed for a named circumstance such as remote staff, which would then need its own decision entry.

---

## 5. Finding D: the frontend encodes superseded states

The status vocabulary in the code is older than the status vocabulary in the data model.

`src/types/index.ts` line 8 declares `AttendanceStatus` as `PRESENT | LATE | ABSENT | HALF_DAY | ON_LEAVE`. The reconciled data model in `docs/attendpro/M1-DATA-MODEL.md` uses eight values for a closed session, `ON_TIME`, `EARLY`, `LATE`, `ABSENT_NO_SHOW`, `ABSENT_UNPLANNED`, `AUTO_CLOSED`, `REQUIRES_REVIEW`, and `HALF_DAY`, plus the open-session pair `OPEN` and `CLOSED`.

`src/components/ui/StatBadge.jsx` carries the same older set. Its comment lists `OPEN`, `CLOSED`, `PRESENT`, `LATE`, `ABSENT`, `HALF_DAY`, `ON_LEAVE`, and its lookup object handles those seven. The new values fall through to a fallback that renders the raw enum string, so `ON_TIME` would display as the text "ON_TIME" and `AUTO_CLOSED` as "AUTO_CLOSED". Two of them, `HALF_DAY` and `ON_LEAVE`, are correct, and `ON_LEAVE` in particular should not appear at all in v1 because leave was removed from scope by `O16`.

`DESIGN.md` section 5.4 already defines the eight-state badge palette with measured contrast, including a deliberate violet for `REQUIRES_REVIEW` and a neutral ground for `AUTO_CLOSED`. The design decision exists. The component was never updated to match it.

---

## 6. Finding E: hardcoded values that contradict confirmed decisions

Three values are literal constants where the confirmed decisions require computed ones.

| Location | Literal | Problem |
|---|---|---|
| `src/pages/Dashboard.tsx` line 96 | "The system clocked you out at 11:59 PM" | Meta-decision `D` in the decision register forbids a universal 23:59. Auto close runs every fifteen minutes against shift end plus a buffer (`O8`), so the actual time varies and the message can be wrong. |
| `src/pages/Dashboard.tsx` line 184 | `closedThisMonth / 22` | Attendance rate divides by an assumed twenty-two working days. The confirmed model computes working days from `WorkCalendar` and `CalendarException`. Twenty-two is wrong for any business with holidays or a six-day week. |
| `src/pages/SuperAdminDashboard.jsx` line 232 | `lateCount / totalSessions` | Late rate is computed over sessions rather than scheduled shifts, so an employee with two punches in a day counts twice. |

These are exactly the "hardcoded statistics and buttons that do nothing" the owner asked to avoid. They are also cheap to fix once the data model is live, which is why they belong in the Stage 5 mapping rather than being patched now.

---

## 7. Finding F: engineering health of the frontend

Four engineering facts bear on how much redesign can be absorbed in one milestone.

The TypeScript compiler reports 43 errors across `src/`, and `package.json` has no `typecheck` script, so nothing catches them in the normal workflow. Mixed `.jsx` and `.tsx` page modules explain part of it: `.jsx` files receive no checking at all, which is why `SuperAdminDashboard.jsx` and `ManageStaff.jsx` can call endpoints that do not exist in the contract without complaint.

`ui-taste-check.sh` passes on all 26 frontend files. That scanner checks for anti-patterns such as emoji icons, sparkle decorations, and generic card grids. The current UI passes it, which means its weaknesses are structural and typographic rather than slop. That is a reasonable starting position.

`Layout.tsx` and `Sidebar.tsx` carry a decorative corner-bracket motif and a "System Online v1.0" status line with a pulsing green dot. The motif is part of the paper-and-brass identity and can stay if that identity is approved. The status line is decorative chrome that asserts a system fact the page cannot verify, so it should go or become real.

---

## 8. Screen-by-screen verdict

The owner asked that the earlier KEEP labels be treated as preliminary. They are restated here with the reasoning that supports each, and with the parts that need work named explicitly. These are recommendations for Stage 4, not approvals.

| Screen | Route | Verdict | Reasoning |
|---|---|---|---|
| Public landing | `/` | **Create** | No public screen exists. `AuthenticatedHome` sends every visitor to login, so a prospect evaluating the product hits a sign-in form. This is the first screen a buyer sees. |
| Login | `/login` | **Improve, then reposition** | Visually the most finished screen, with a chrome brand panel and a paper form panel. Its brand panel carries the landing page's job, which moves out. The form itself is correct and should survive mostly intact. |
| Account recovery | `/account/recovery` | **Create** | `O6` replaces SMS OTP with an emailed single-use code that sets a first PIN. Without this screen an employee who never had a PIN has no route in. |
| Staff dashboard | `/dashboard` | **Improve substantially** | Punch buttons must go under the hard rule in section 4. The KPI bento is denser than the role needs. What a staff member actually wants on arrival is today's status, the next shift, and anything awaiting their attention. The auto clock-out banner is valuable and should stay, with a corrected message. |
| Staff schedule | `/schedule` | **Improve** | The closest screen to genuinely useful. It should surface the assigned shift, the working days, and the off-days computed from the calendar, because off-days are a real derived view under `O16` and not an empty state. |
| Profile | `/profile` | **Split** | Currently a generic account page. It needs three distinct regions: identity and contact, password, and PIN. The PIN region is a new requirement (`O6`, `O2`) with no home today, and `POST /api/staff/profile/change-pin` has no screen. |
| HR dashboard | `/hr-dashboard` | **Improve, possibly split** | Operationally sensible but chart-led. An HR user's first question each morning is what went wrong, not what the trend line looks like. The exception list should lead and the charts should follow. Whether this screen and the proposed attendance operations screen stay separate or merge is a Stage 4 question. |
| Super admin dashboard | `/superadmin-dashboard` | **Improve** | Reports the business broadly but says nothing about configuration health: how many sites have geofences, how many kiosks are paired and when they last checked in, whether any policy is unset. A super admin's dashboard should tell them what they have not finished setting up. |
| Manage staff | `/manage-staff` | **Keep, extend** | The most complete screen in the product, with a real table and working modals. It becomes the employee management surface for both admin roles, gains a detail view, and gains the audited PIN reset that HR needs. |
| Settings | `/settings` | **Split** | Currently one screen for all roles. Personal preferences belong to every role; business profile, shifts, policies, calendar, sites, and devices belong to the super admin. One screen cannot serve both without hiding most of itself. |
| Set password | `/set-password` | **Keep** | Correct forced-change flow, clean execution, no reason to alter it beyond adopting the shared form components in Stage 3. |
| Devices | `/devices` | **Create** | `O3` requires pairing codes and 30-day device tokens with revocation. No screen exists and no sidebar entry exists. |
| Sites | `/sites` | **Create** | `O4` requires per-site geo-fences. No screen exists. HR needs read access; the super admin needs full control. |
| Help and corrections | staff and admin variants | **Create** | `O17` sets a seven-day correction window with no self-approval. Neither the staff submission flow nor the HR decision queue has a screen, though both have API areas in the contract. |
| Reports, audit log, policies, calendar | admin variants | **Create** | Named in PRD sections 8 and 9 and in the M1 navigation map. None exist. |

Of the fourteen verdicts above, five are improvements to existing screens, three are keep-as-is or keep-with-extension, and six are screens that do not exist.

---

## 9. Accessibility and responsiveness

The token layer does the hard part well. Status colours are measured against paper and carry ratios in comments, focus rings are declared on the button primitives, and the layout uses responsive grid classes throughout. `ui-taste-check.sh` passes.

Three gaps are visible without running an audit tool. Focus management is not handled in the modal implementations in `ManageStaff.jsx`, so keyboard users can tab out of an open dialog into the page behind it. The sidebar is fixed and has no collapsed state, which means the mobile experience for a signed-in user is not designed yet, and the owner raised it as an open question. Table headers in `AttendanceTable.jsx` are clickable for sorting but are not announced as buttons, so a screen reader hears plain text where a control exists.

None of these is severe. All three are the kind of thing that becomes expensive once forty screens are built on the same primitives, which is the argument for settling them in Stage 3.

---

## 10. Summary verdict

The existing frontend is a competent small application with a genuinely well-made token layer and one strong operational screen in Manage Staff. Its weaknesses are not cosmetic. They are that the product is roughly a fifth of the size the requirements describe, that a hard product rule is being broken on the staff dashboard, that the status vocabulary has drifted from the data model, that two design documents contradict each other about what the product looks like, and that several numbers shown to users are invented rather than computed.

None of that is a reason to discard the work. The login screen, the token layer, the table component, and the Manage Staff screen are worth building on. The direction proposed in Stage 2 assumes that base and changes what sits on top of it.

---

## 11. Questions the owner must answer before Stage 4

1. Which design system governs AttendPro: the signed Operations Console in `DESIGN.md`, or the paper-and-brass system that is actually shipped? This blocks Stage 3.
2. Should the staff portal keep any punch capability at all, or does the kiosk-only rule apply without exception?
3. Should SUPERADMIN see the HR dashboard as well as its own, or should the two roles be strictly separated?
4. Is the split between `/settings` (personal) and a business settings area the right cut, or should there be one settings shell with role-scoped sections?
5. Should `DESIGN.md` section 11 be reconciled to whichever system wins, or retired?

The full list of role and navigation decisions continues in `docs/attendpro/M1-ROLE-EXPERIENCES.md`.
