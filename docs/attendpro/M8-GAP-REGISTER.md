# AttendPro M8 Gap Register — design system, responsive behaviour, accessibility

- Created: 2026-10-17, from the read-only design inspection (source survey per cited lines).
- Purpose: every existing inconsistency, responsive defect, and accessibility defect that M8 must
  close. Each row carries its evidence so the fix work can be verified row by row.
- Feed: rows marked "gate" feed the responsive/a11y acceptance gate; the design-system rows feed
  Phase 0 consolidation.

---

## A. Design-system gaps (consolidation work)

| # | Gap | Evidence | Fix direction |
|---|-----|----------|---------------|
| A1 | Raw Tailwind sizes bypass the named type scale (`text-xs/sm/2xl/3xl/4xl` in modals, login, sidebar, profile) while the token scale exists | AddEmployeeModal.jsx:41,187; Login.tsx:91,142; Sidebar.tsx:189; Profile.tsx:117 | Phase 0: touched components move onto the token scale; every file M8 rewrites uses tokens only |
| A2 | Two competing "eyebrow" implementations (token `text-eyebrow` vs hand-typed `text-xs font-mono uppercase tracking-widest`) | ManageStaff dialogs vs ui/ modals | One eyebrow usage rule on the token — PARTIALLY CLOSED (Phase 0): the token grammar ships in the shared PageHeader / ModalShell / ConfirmDialog; the surviving hand-typed copies migrate as their screens are rewritten, no callers re-pointed this phase |
| A3 | Fonts loaded but never wired: Fraunces, General Sans, IBM Plex Mono load in `index.html:6–8`; tokens map serif→Georgia, sans→system-ui | tailwind.config.js:45–52 | Owner decision (listed in the plan): wire the webfonts into the tokens, or remove the three requests — CLOSED (Phase 0): the three requests removed per M8-R13 (zero visual change — nothing referenced them; tokens keep Georgia serif + system-ui) |
| A4 | Three pill/badge implementations with different class grammar | ui/StatBadge.jsx; StaffTable.jsx:27–40,138–141; Profile.tsx:239; Settings.jsx:152 | One shared `Pill` primitive; `StatBadge` deprecated or wrapped |
| A5 | Two dialog systems: dark chrome modals (ui/) vs paper confirm dialogs inline in ManageStaff | ManageStaff.jsx:268–309,313–359 vs ui/*Modal | One `ModalShell` + `ConfirmDialog`; focus trap + focus return added (see B-roes) |
| A6 | Duplicated page logic re-typed per screen (`isLate`, `isToday`, `formatTodayLong`, chart data builders, search filter) | HrDashboard.tsx:15–73 vs SuperAdminDashboard.jsx:22–99; Profile/Schedule `isLate` | Extract `src/lib/attendance-format`; dashboards compose, not copy |
| A7 | Missing shared primitives: PageHeader (typed ~8×), SectionHeader (~10×), SearchInput, one Pagination, ModalShell | HrDashboard.tsx:235–244; SuperAdminDashboard.jsx:507–516; ManageStaff.jsx:242–264 | Phase 0 builds them once in `src/components/ui/` — CLOSED (Phase 0): all primitives built and unit-tested (PageHeader, SectionHeader h2 at display-sm, Pill, SearchInput, Pagination with aria-live, ModalShell + ConfirmDialog with focus trap/return, FilterBar, plus `src/lib/attendance-format`); contributors consume them from Phase 1 onward, animated call-site migration |
| A8 | Arbitrary-value drift: `max-h-[560px]`, `min-w-[88px]`, `w-[45%]`, `text-[9px]/[10px]`, `bg-canvas/80` scrim vs token `overlay-scrim` | AttendanceTable.jsx:226,309; Login.tsx:68; Schedule.jsx:137,146; index.css:229 | Named constants/tokens replace arbitrary values; one scrim token |
| A9 | Radius drift: token scale tops at 12px but `rounded-2xl` (16px) used in three places | ErrorBoundary.jsx:34; AddEmployeeModal.jsx:176; Profile.tsx:104 | Pick one: extend the token scale to 16px named `2xl`, or move those spots to `xl` |
| A10 | PDF/print window styles bypass every token with hardcoded slate hexes; the print window will be retired in the SA dashboard rework regardless | SuperAdminDashboard.jsx:273–280 | Removed with the client-side export path (O9 rule: exports go through the server's injection-guarded CSV) |

## B. Responsive + accessibility defects (per page)

| Where | Defect | Evidence | Gate |
|-------|--------|----------|------|
| Layout/Sidebar | Nav items are `div onClick`, not keyboard reachable; no `aria-current`; mobile drawer has no focus containment | Sidebar.tsx:204–209 | a11y gate — CLOSED (Phase 0, nav items): real `<button>` semantics with the global focus ring and `aria-current="page"`; mobile-drawer focus containment still open, rides the mobile-layout rework |
| Layout | Content never caps width — at 1440px+ tables/charts stretch full-bleed | Layout.tsx:35–42 | responsive gate (add a container max-width) — CLOSED (Phase 0): content capped at `max-w-7xl` (1280px) + `mx-auto` inside the padded canvas |
| Login/SetPassword | Error bar not announced (no `role="alert"`/`aria-live`); `w-[45%]` arbitrary split | Login.tsx:155–181,68 | a11y gate — CLOSED (Phase 0, Login half): the error bar carries `role="alert"` and renders copy from the typed error map (`src/api/errorCopy`), never the raw body; `w-[45%]` replaced with the named fraction `w-5/12`. SetPassword unchanged, rides its rework |
| Staff dashboard | Auto clock-out toast lacks live-region announce; dead clock buttons (already removed in M8 scope); no fetch-failure error/retry state | Dashboard.tsx:95–99,113–134 | BOTH |
| HR dashboard | Search input missing `aria-label`; no error/retry on initial fetch; 375px: 7-column table pans with no visible scroll affordance | HrDashboard.tsx:237–243 | BOTH |
| SA dashboard | Month select unlabelled; duplicated chart code from HR dashboard; hardcoded print CSS | SuperAdminDashboard.jsx:398–408,273–290 | a11y + A6/A10 |
| ManageStaff | Deactivate dialog missing `role="dialog"`/`aria-modal` (its sibling has them); text "Loading employees…" instead of the shared skeleton; tablist without arrow keys; text-link row actions have narrow touch targets, hover-only affordance; `colSpan={99}` | ManageStaff.jsx:268–309,177–226,198–216; StaffTable.jsx:51,147–183 | a11y gate |
| Tables (both) | Every cell `whitespace-nowrap` + `min-w-max` — always pans on mobile; no scroll affordance or compact card variant; no `aria-live` page change; sortable headers exist in one table but not the other | AttendanceTable.jsx:113–117,227; StaffTable.jsx:94 | responsive gate (compact record cards where appropriate) — PARTIALLY CLOSED (Phase 0, pagination aria): the shared `Pagination` primitive ships with `aria-live="polite"` page announcements and labelled controls; `AttendanceTable` migrates onto it in its rework, table strategy still open |
| Role/colour encoding | Role and schedule status conveyed by colour alone (colour-only legend, tinted day cells with no text status) | StaffTable.jsx:22–25; Schedule.jsx:108–115,317–323 | a11y gate (text label in addition to colour) |
| Profile | Hint text uses `text-ink-tertiary` (2.41:1) — token is disabled/decorative-only; no fetch error/retry | Profile.tsx:146,179–191 | contrast gate |
| Schedule | Day cells not focusable/interactive; no empty state; at 375px text drops to 9px | Schedule.jsx:137,146 | responsive + a11y gate |
| Settings | Eye toggle `tabIndex={-1}`; inline error not `role="alert"`; no skeleton | Settings.jsx:28,199 | a11y gate |
| All ui/ modals | Escape works but no focus trap/return; labels missing on one dialog | AddEmployeeModal.jsx:108–114 | a11y gate |
| Donut chart | Redundant double labelling (slice labels + right legend); slice % text risks contrast on light fills | SessionsChart.jsx:43,54–61 | a11y + polish |
| Kiosk | **No kiosk UI exists at all** — backend lanes complete (identify / verify-pin / clock-in / clock-out), zero frontend routes or screens; designed flow + silent-lockout rules documented since M1 | src routes (zero kiosk hits); M1-SCREEN-DESIGNS.md:87,412–431 | scope decision in plan (kiosk phase) |
| Tests | vitest + Testing Library + jsdom installed; `vite.config.ts` has no test block so setup is unregistered; no browser e2e runner exists | package.json; vite.config.ts | tooling decision in plan (test wiring; Playwright install needs approval) — CLOSED (Phase 0, vitest half): `test` block registered (jsdom, `./src/test/setup.ts`, globals off — suites import from `vitest` explicitly); **10 files / 89 tests green as of Phase 0**; the F1 43-error gate is closed, `npm run typecheck` = 0 errors. Playwright e2e runner deferred to its approved phase (M8-R12) |
