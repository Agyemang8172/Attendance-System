# Implementation Plan: AttendPro M8 — Staff Portal, HR Portal, Public Landing Page

- **Date:** 2026-10-17
- **Milestone:** M8 (frontend milestone: the screens employees and HR actually live in)
- **DependsOn:** M7 (committed `e73b8c1` — the backend these portals consume is complete)
- **Status:** Approved by owner 2026-10-17, with the four M8 rulings recorded in `DECISION-REGISTER.md` §E (M8-R1..R4) after the read-only design-reconciliation audit returned no security or architecture blockers
- **Target:** AttendPro v1 frontend (React 19 + Vite at repo root; backend untouched except where a screen exposes an already-built endpoint)
- **Authority:** `M1-NAVIGATION-AND-SCREENS.md` §2–§4, §7 (screen scopes), `M1-VISUAL-DESIGN-SYSTEM.md` ("Paper and Brass" tokens — already wired in `src/index.css` + `tailwind.config.js`), PRD §7 hard rule (staff never clock from their own screen), O1 (no self-registration), O16 (leave deferred to v2), carried issue F1 (43 tsc errors block completion)

---

## Overview

The backend is done; M8 is the visible milestone. Three deliverables:

1. **Public landing page** — real content at `/` (product story, fictional sample figures, sign-in path; registration hidden per O1).
2. **Staff portal** — overview (facts, NO clock buttons), my attendance, my schedule, help requests, corrections (submit + track), profile + change PIN.
3. **HR portal** — exception-first overview, attendance, exceptions, employees + detail + audited PIN reset, help queue, corrections with the decision panel (before/after diff; the 403 matrix shown as real UI), revision history, reports with CSV download, audit trail view.

Design language already exists in code (Paper and Brass tokens); no new colors, no UI library — hand-rolled components per the current convention. The shared primitives the design spec names (`StatusBadge`, `FilterBar`, `Pagination`, `EmptyState`, `DetailDrawer`, `CorrectionForm`, `KpiHero`) get built once in `src/components/ui/` and reused across screens.

**Honest scope note (as amended by the audit and the owner's rulings):** some navigation doc endpoints have no backend twin. The owner ruled on all four gaps (M8-R1..R4 in `DECISION-REGISTER.md` §E): three small additive backend endpoints now ship inside M8 — `POST /api/staff/profile/change-pin` (current PIN required, new 4-digit PIN, audited), staff-scoped reads for own schedule and off-days, and a generic tenant-scoped audit listing — all with **zero database changes**. Where the design demands data beyond what these cover, the screen ships with the honest safer shape (omit the slice) and it is reported back, never faked. Email recovery stays deferred (O6); no recovery link anywhere.

## Phases (each phase = one agent, sequential)

### Phase 0 — Housekeeping first (the F1 gate)
- Add `"typecheck": "tsc --noEmit"` to root `package.json`.
- Remediate all **43 tsc errors** (Dashboard.tsx 17, Profile.tsx 18, HrDashboard.tsx 4, axios/Layout/Sidebar/Login 1 each — per `M0-REALITY-CHECK.md` §8) as part of the reworks in later phases; anything not owned by an M8 screen gets fixed in place now, typed like-for-like.
- Convert the components/files M8 touches from `.jsx` to `.tsx` (dashboard pages + the new ui primitives); untouched files stay as they are.
- Extend the axios error interceptor (`handleApiError`) for the new API codes the M7 lanes can return (plain-language 409/403 messaging consistent with the M1 UX audit).
- One backend safe-errors repair riding in Phase 0 (audit finding): the delete-user 500 at `backend/controllers/userController.ts` (~line 541) still leaks `error.message` in the body — align it with the hardened catch convention.

### Phase 1 — Public landing page
- `/` becomes the display-only product page: brand header, product summary, the fictional sample figure row, five-row sample table with `StatusBadge`, footer — per `M1-NAVIGATION-AND-SCREENS.md` §2/§7.1.
- Static fictional sample data rendered as constants (zero backend calls); `GET /api/public/preview` is NOT built in M8 unless the owner says otherwise — the page must not risk tenant data by design.
- `/register` stays out (O1); "Sign in" links to `/login`; a "Forgot access?" path to account recovery appears only if the recovery endpoints already exist (the agent verifies `backend/routes/authRoutes.ts`), otherwise the link is omitted with a note back.

### Phase 2 — Staff portal
- `/dashboard` rework: overview facts only — **removing the Clock In/Clock Out buttons is a hard rule** (PRD §7; attendance is kiosk-only). Punch history snapshot + own status badge instead. Also remove the streak card here and the Achievements block on `/profile` (no-gamification rule), and move Profile/Settings out of the side navigation into the user popover (O23).
- Staff screens get their missing data first, per the owner's rulings: build `POST /api/staff/profile/change-pin` (M8-R1: verifies the current PIN, sets a 4-digit new PIN per R5, audited, kiosk PIN hash stays authoritative) and the staff-scoped own-schedule + own-off-days reads (M8-R2) before wiring the screens that consume them. Route owner for the staff prefix follows the Phase 0 (M7) precedent (`staffHelpRoutes.ts` pattern or a dedicated `staffProfileRoutes.ts` where cleaner).
- `/staff/attendance` (my attendance, filters + pagination via the real read aliases), `/schedule` (real assignments, M8-R2 endpoint), help requests, corrections, `/profile` + change password, `/profile/change-pin` (M8-R1).
- All staff screens move onto the real lanes the backend owns (self-scoping enforced by `requesterId` on the server; the UI never sends identity fields).

### Phase 3 — HR portal
- `/hr-dashboard` rework (exception-first, composed from the real report endpoints), `/hr-attendance`, `/hr-exceptions`, `/manage-staff` + employee detail `/manage-staff/:id` + audited PIN reset (reason required — the backend 400s otherwise; wire that), `/hr-help-requests` + status transitions, `/hr-corrections` (before/after diff, decision panel with the backstop flow: second-HR vs SUPERADMIN-with-condition-and-reason, self-approval refused with the plain message), `/hr-attendance/:id` revision history via the per-record audit trail, `/hr-reports` (register/summary/exceptions + CSV download honoring the O9 filename), and the HR audit-history screen wired to the **new generic audit listing endpoint (M8-R4)**.
- Build the M8-R4 listing: `GET /api/audit` per the designed contract rows — tenant-scoped, paginated, filterable (action/entity/pagination), extending `backend/routes/auditRoutes.ts` + `backend/controllers/auditController.ts`; read-only, no new audit writes.
- SUPERADMIN's `/superadmin-dashboard` + `/settings` connect where they already have real endpoints (business settings GET/PATCH per M7); `/settings` moves under the `SuperAdminRoute` guard (today any role can open it while the server 403s writes). The wider SUPERADMIN admin area (shifts/policies/calendars/sites/devices) is **its own future work, not M8** — link stubs only, clearly labeled. The SA audit-log screen wires to the same M8-R4 listing.

### Phase 4 — Orchestrated verification (same loop)
- Review agent: correctness of wiring (no fake data, no legacy-dead endpoints called), design-token compliance, `ui-taste` script result, `typecheck` = 0 errors, localStorage/auth-flow edge cases, the F1 gate.
- Docs agent: testing-guide scenarios for the landing page, staff portal, HR portal incl. the decision panel walkthrough (humanize-clean).
- Fixes applied; all gates re-run. Owner sees the review summary → commit via `.agents/scripts/commit.sh`. Nothing pushed.

---

## Owner decisions — CONFIRMED (2026-10-17, register §E M8-R3)

| # | Item | Confirmed |
|---|------|-----------|
| 1 | Landing page data source | Static fictional constants in the page (no `/api/public/preview` backend endpoint in M8) |
| 2 | `/manage-staff` data lane | Migrate to the real `/api/hr/employees` lane (drop the legacy `/api/users` calls) |
| 3 | Account recovery ("forgot access") on the landing | Omitted — the O6 recovery endpoints were never built; link returns only when they do |
| 4 | SUPERADMIN admin area (shifts/policies/calendars/sites/devices screens) | NOT in M8 — link-stubs only, clearly labeled (closes in a follow-up milestone with its own plan) |

Plus the gap rulings: M8-R1 (staff change-PIN endpoint built), M8-R2 (staff schedule/off-day reads built), M8-R4 (generic audit listing built).

## Constraints
- Zero database/schema changes in M8 — the three ruled endpoint additions (M8-R1/R2/R4) are additive routes + validators only; any discovered gap beyond them is reported, and the screen ships with the honest shape instead.
- The 43-error gate: `npm run typecheck` must pass with **zero errors** before M8 review closes (F1 board rule).
- `ui-taste` script must pass; new screens reuse Paper and Brass tokens only.
- History preservation holds: commit via the script, no push without the owner's word.

---

# Addendum — UI design system + responsive acceptance (owner directive, 2026-10-17)

The owner set the standard for this milestone: preserve and standardize the approved HR/Staff
dashboard visual direction across Public, Staff, HR, Super Admin and Kiosk experiences, with
verified desktop, tablet and mobile behaviour. No new UI library; no template replacement; the
strategy is consolidation of what exists plus gap closure. The full defect list lives in
`docs/attendpro/M8-GAP-REGISTER.md` (rows A1–A10, B-rows); the plan references it instead of
repeating it.

## Design-system consolidation (Phase 0 scope, expanded)

- Tokens stay as they are (they are clean) — consolidation happens with them, not around them.
- Shared primitives built once in `src/components/ui/`: `PageHeader`, `SectionHeader`, `Pill`,
  `SearchInput`, one `Pagination`, `ModalShell` + `ConfirmDialog` (with focus trap and focus
  return), `FilterBar`; extract `src/lib/attendance-format` (shared helpers + chart builders).
- Deprecate/replace: `StatBadge`, `StaffTable.RolePill`, inline confirm dialogs, duplicated
  search fields, the client-side CSV/Excel/PDF export path on the SA dashboard (exports must go
  through the server's O9-injection-guarded CSV endpoint).
- Token-scale discipline on every file M8 rewrote; arbitrary values from the register (A8)
  replaced with named constants wherever touched.

## Responsive + accessibility gate (acceptance criteria, every in-scope screen)

- Each screen verified at 375px, 768px, 1440px: no unintended horizontal overflow; navigation
  usable; KPI cards reflow; charts/labels/legends legible; tables have a deliberate strategy
  (horizontal scroll with visible affordance, compact record cards where appropriate); filters,
  dialogs, forms and menus fit smaller screens and stay keyboard accessible; touch targets,
  focus indicators and text contrast hold at every size — including the intro note that
  `text-ink-tertiary` is decorative-only (Profile defect) and colour-only encodings get a
  text/label twin.
- Loading, empty, error and permission-denied states remain usable at every viewport: every
  data screen gets an error/retry state (today a failed fetch leaves a finished skeleton —
  register B rows) and the two shared 403/404 panels are built (nav §7.6).
- Viewport evidence recorded per screen in the gap register (before/after where practical).

## New phases added to the sequence

- **Kiosk UI phase:** no kiosk frontend exists today while every backend lane is done. Build
  `/kiosk` per `M1-SCREEN-DESIGNS.md` §4.12: device landing (badge scan/identify) → four-digit
  PIN pad with keypad primitive → confirmation screen ("clocked in · on time") → explicit
  retry/failure/livelock-out states (silent lockout, no countdown, no enumeration), chrome-dark
  surface, fixed landscape ≥768px, large touch targets — included in the kiosk acceptance gate.
- **Super Admin admin screens:** the owner directive lists shifts, working calendars,
  grace/auto-clock-out policies, sites, kiosk registration/pairing/revocation and QR management
  "as supported by approved backend contracts" — all of those endpoints already exist and are
  verified, zero-migration. **Confirmed by the owner (M8-R11, register §E.2):** the M8-R3 labelled
  stubs are upgraded to REAL screens wired to the verified endpoints; QR issue/revoke rides
  employee detail. What remains stubbed in M8 is nothing in the admin list — the follow-up
  milestone inherits only pieces with no contract row at all.
- **Quality gate for browser behaviour:** wire the existing vitest setup (`test` block) and add
  component tests for the new primitives and the kiosk PIN-pad flow; browser evidence by
  viewport screenshot through `@playwright/test`, **approved by the owner (M8-R12)** — the one
  new devDependency; screenshots + interaction checks at 375/768/1440 are enforced evidence.
- **Typography (M8-R13):** remove the three unused font requests from index.html; tokens keep
  Georgia serif + system-ui — zero visual change, faster loads.

## Deferred-as-is (unchanged from the walkthrough rulings)

- Staff profile stays read-only this milestone (M8-B3 answer); corrections-only fix story (no
  HR-assisted override); "expected today" and client-side "Attendance Rate" dropped; the
  deactivation lane stays on the audited legacy endpoint.

## Post-approval addendum (2026-10-21)

The owner approved the design-reconciliation direction with conditions. This plan is historical.
It remains the approved implementation plan for the M8 portals, but the landing page is now
governed by `docs/attendpro/LANDING-PAGE-SPEC.md` and root `DESIGN.md`.

Where this plan conflicts with the landing specification, the landing specification wins. The
current differences are:

- The landing page is paper, not the dark Linear surface.
- The sample organisation is `Example Organisation`, not `Finest Supermarket, Accra`.
- The landing copy is general-purpose, not shift-business or Ghana-specific.
- The landing keeps one Sign in action. Registration, recovery, pricing, trial, demo, and
  dashboard links are removed or deferred as recorded in the landing specification.
- The eight-state status palette is required. The five-tone mapping is not acceptable.
- The `/#preview` anchor and the corner-bracket frame are required.
- Visual verification must cover 375, 390, 768, 1280, and 1440 widths.

No landing restyle or colour-token change is authorised until the owner reviews the reconciled
documents and the proposed status palette. This addendum is documentation only.

