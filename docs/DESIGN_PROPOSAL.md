# DESIGN_PROPOSAL.md — AttendPro Design System v2

> **Status: PROPOSED — NOT APPROVED. Does not replace root `DESIGN.md`.**
> Produced by the UI Designer agent for the Orchestrator's review, 2026-10-08.
> Branch `checkpoint-rebuild` @ `a700123`. No component, token, or file in `src/` was modified.
> Root `DESIGN.md` (Linear, Owner-signed 2026-10-06) remains the governing spec until the Owner approves this document.

---

## 0. The Mandate

The Owner's instruction:

> *Reshuffle and make a decision before choosing from the catalogue. The colour system should match our Login page. Every page should stand on the UI of Login to spread out.*

This proposal therefore treats **`src/pages/Login.tsx` as the anchor**, not as a defect to be re-absorbed. Every token below is derived from what Login already does, measured against WCAG, and extended into the application interior.

---

## 1. Why an Attendance System Looks Like This

Before choosing colours, the domain has to be understood. Four truths drive every decision here:

**1. Time is the material.** Hours, minutes, clock-in and clock-out, shifts, streaks, lateness. Every number on screen is a measurement of a person's day. The interface must render figures with the authority of an instrument, not the casualness of a marketing stat.

**2. Records are contractual.** Attendance feeds payroll and disciplinary action. Whatever a user reads here, they may have to defend later. The UI must read as a **system of record** — ledger-precise, dated, unambiguous.

**3. It is opened every working day, often several times.** This is not a page anyone visits once. Spectacle fatigues; density without hierarchy fatigues faster. The correct register is **calm, quiet, and immediately legible**.

**4. Three audiences read the same data at three different speeds:**

| Audience | Reading mode | Question they are answering |
|---|---|---|
| Employee (STAFF) | 5-second glance + one action | *"Am I in or out? Where am I this week?"* |
| HR | Exception scanning across a dense table | *"Who is late? Who never clocked out?"* |
| Super Admin | Monthly aggregation, export, headcount | *"Is the operation healthy, and can I prove it?"* |

**The resulting archetype: a time ledger.** Not a "dashboard." A record book kept in a working office — a warm paper page under a dark instrument housing, marked with brass. The physical referents are the **punch card, the brass time clock, and the bound attendance ledger**: engraved serif headings, stamped monospaced figures, a gold nameplate.

This is not a decorative metaphor. It is what the code is already trying to become — see §3.

---

## 2. Catalogue Selection

Per the mandate, the decision is made *before* adopting a system, and colour is then forced to Login. The catalogue (`.agents/catalog/design-systems/`, 74 systems) was filtered on four criteria:

- (a) does its **polarity** match Login's dark-chrome / light-working-surface split?
- (b) does it use **serif display type**, as Login does?
- (c) is its temperature **warm**, not the cool blue-violet default?
- (d) can it carry **dense operational tables**, not just marketing pages?

### Finalists

| System | (a) Polarity | (b) Serif | (c) Warm | (d) Dense ops | Verdict |
|---|---|---|---|---|---|
| **claude** | ✅ cream canvas + `#181715` dark product surfaces | ✅ Copernicus/Tiempos display, 400 weight | ✅ `canvas #faf9f5`, terracotta `#cc785c`, amber `#e8a55a` | ⚠️ adequate | **SELECTED — structural base** |
| **mastercard** | ✅ `#F3F0EE` cream + `#141413` ink | ❌ geometric sans only | ✅ genuinely warm | ⚠️ adequate | Rejected: 40–1000px pill-radius language fights Login's `rounded-lg`; signal orange `#CF4500` ≠ gold |
| **notion** | ❌ white canvas | ⚠️ claims serif, ships Inter everywhere | ⚠️ pastel tints | ✅ | Rejected: `primary #5645d4` is the banned purple family (anti-ai-ui §4) |
| **stripe** | ⚠️ white + dark shell | ❌ thin sans | ❌ indigo `#533afd` | ✅ best-in-class | Rejected: cool indigo — the exact palette anti-ai-ui §4 names as the AI tell |
| **linear.app** (current) | ❌ all-dark | ❌ system-ui only | ❌ `#5e6ad2` lavender | ✅ | Rejected: inverts Login's polarity; accent is one step from `indigo-500` |
| **sentry** | ❌ violet + lime | ❌ | ❌ | ✅ | Rejected: wrong temperature entirely |

### Decision

> **Adopt `claude` as the structural base — its composition, surface hierarchy and serif display voice — then discard its colour entirely and substitute the Login palette.**

Claude is the only catalogue system whose *structure* already agrees with Login: a tinted cream working canvas sitting against dark product surfaces, with serif display headlines carrying the brand. Recolouring it from coral to slate-and-gold costs nothing structurally and satisfies the mandate exactly.

**This is a structural adoption, not a brand transplant.** AttendPro keeps AttendPro's gold; it borrows Claude's proportions.

---

## 3. What the Code Is Already Telling Us

The single most important finding of this review: **the codebase has already chosen this identity. `DESIGN.md` just documented a different one.**

Measured across all 23 frontend files:

| Signal | Evidence |
|---|---|
| **Serif is already the display face** | `font-serif` appears in **14 of 23 files** — Login, Sidebar, Layout, Dashboard, HrDashboard, SuperAdminDashboard, Profile, Schedule, Settings, ManageStaff, SetPassword, ErrorBoundary, both modals. `DESIGN.md` §8 rule 6 mandates *"single font family (system stack)"* — already violated app-wide, deliberately, by every page. |
| **Mono is already the data face** | `font-mono` on every clock-in/out time, every date, every hour total, every KPI value, every status pill, every table action link, the sidebar status line. |
| **Gold is already the accent** | 22× `yellow-500`, 3× `yellow-400` — Login, both modals, KpiCard's default `colorScheme="gold"`. |
| **The corner-bracket motif is already the signature** | Sidebar (2), KpiCard, AttendanceTable, StaffTable, both EmptyStates, Login (2), both modals. Nine instances. |
| **The modals already pre-date Linear** | `AddEmployeeModal` and `EditEmployeeModal` are `slate-900`/`slate-800` + `yellow-500`. They were never migrated. |

**Consequence:** adopting this system is not a rewrite of intent. It is *finishing* what three-quarters of the codebase already started, and bringing `DESIGN.md` into agreement with the code instead of against it.

---

## 4. The Three-Language Problem (Inconsistency Map)

Every file in `src/` was scanned for palette signatures. Three mutually exclusive design languages are live simultaneously:

| Language | Palette | Files | Count |
|---|---|---|---|
| **A — "Brass & Slate" (Login-anchored)** | `slate-900/800`, `stone-50/100/300`, `yellow-500`, serif | `Login.tsx` (23 slate/stone, 10 yellow, **0 tokens**), `AddEmployeeModal.jsx` (18/7/0), `EditEmployeeModal.jsx` (16/5/0) | 3 |
| **B — "Linear Dark" (governing spec)** | `--canvas #010102`, `--accent #5e6ad2` lavender | 16 files: all dashboards, tables, sidebar, layout, charts, KPI, Profile, Schedule, Settings, ManageStaff | 16 |
| **C — "Auth Light" (unused third)** | `--auth-canvas #fff`, lavender accent | `SetPassword.jsx` (20 auth-* tokens), `ErrorBoundary.jsx` (8) | 2 |

**The user-visible failure:** a person signs in on a slate-and-gold serif page, and lands on a near-black page with lavender accents — then, if their password must be reset, immediately sees a white page with lavender accents. Three identities in one authentication flow.

`Login.tsx` carries **zero design tokens**. It is the only screen in the application that the governing spec does not describe at all.

---

## 5. Colour System (derived from Login, measured)

### 5.1 The polarity flip

Login splits horizontally: **dark brand panel left, warm paper form right.** The application today is uniformly near-black. The proposal extends Login by making that split *vertical and permanent*:

> **The Login left-hand brand panel becomes the Sidebar. The Login right-hand paper form becomes the working surface. The whole application is the Login page, unrolled.**

| Layer | Role | Value | Derived from |
|---|---|---|---|
| **Chrome** — sidebar, brand panel, modal shells, top bar | the instrument housing | `#0f172a` | Login `bg-slate-900` |
| **Chrome elevated** — modal body, hover on chrome | `#1e293b` | Login modal `bg-slate-800` |
| **Chrome line** | `#334155` | Login `border-slate-700` |
| **Paper** — page canvas | the ledger page | `#fafaf9` | Login `bg-stone-50` |
| **Paper raised** — cards | laid paper | `#ffffff` | — |
| **Paper sunken** — table headers, inputs | indented paper | `#f5f5f4` | Login `bg-stone-100` |
| **Paper line** | hairline | `#e7e5e4` | — |
| **Paper line strong** | input borders, rules | `#d6d3d1` | Login `border-stone-300` |

### 5.2 Ink

| Token | Value | Ratio on Paper | Need | Use |
|---|---|---|---|---|
| `--ink` | `#0f172a` | **17.09:1** | 4.5 | Headings, primary body |
| `--ink-muted` | `#44403c` | **9.84:1** | 4.5 | Secondary body, table cells |
| `--ink-subtle` | `#78716c` | **4.59:1** | 4.5 | Labels, timestamps, placeholders |
| `--ink-tertiary` | `#a8a29e` | 2.41:1 | — | **Decorative / disabled only. Never carries information.** (WCAG 1.4.3 exempts disabled controls.) |

### 5.3 Brass — the dual-polarity accent

Login's gold is `yellow-500 #eab308`. It is **excellent on dark and unusable on light** — measured `1.84:1` against the paper canvas, where a focus ring needs `3:1`. A single accent value cannot serve both surfaces, so the accent splits by polarity:

| Token | Value | Context | Ratio | Need |
|---|---|---|---|---|
| `--brass` | `#eab308` | on chrome `#0f172a` | **9.31:1** | 4.5 |
| `--brass` | `#eab308` | focus ring on chrome | **9.31:1** | 3.0 |
| `--brass-ink` | `#b45309` | text/links on paper `#fafaf9` | **4.81:1** | 4.5 |
| `--brass-ink` | `#b45309` | focus ring on paper | **4.81:1** | 3.0 |
| `--brass-ink` | `#b45309` | on input bg `#f5f5f4` | **4.60:1** | 3.0 |
| `#0f172a` | on brass button fill | **9.31:1** | 4.5 |

> **Rule: `#eab308` never touches a light surface; `#b45309` never touches chrome.**

Note: the Task Board already records this exact rule informally — *"focus rings: `amber-700` on light, `yellow-500` on chrome"* (DESIGN.md gate rule 4, TASK-404). This proposal promotes it from a task note to a measured, permanent token rule.

### 5.4 Status colours — and how they avoid colliding with brass

Brass and "late/warning" are both amber-family. Disambiguated structurally:

- **Brand brass** appears only as *solid fills, 2px rules, focus rings, and the active-nav indicator*. It is never a badge background.
- **Status badges** always use *tinted backgrounds with strong text*, so they read as status, never as brand.

| Status | Tint | Text | Ratio |
|---|---|---|---|
| `PRESENT` / `CLOSED` / success | `#dcfce7` | `#166534` | **6.49:1** |
| `LATE` / `HALF_DAY` / warning | `#fef3c7` | `#92400e` | **6.37:1** |
| `ABSENT` / error | `#fee2e2` | `#991b1b` | **6.80:1** |
| `OPEN` / `ON_LEAVE` / neutral | `#e7e5e4` | `#44403c` | **8.18:1** |

Flat status text on paper: `success #15803d` **4.80:1** · `error #b91c1c` **6.19:1** · `warning #c2410c` **4.96:1**.

### 5.5 Chrome ink (on the dark sidebar / modals)

| Token | Value | Ratio | Note |
|---|---|---|---|
| `--chrome-ink` | `#f5f5f4` | **16.36:1** | |
| `--chrome-ink-muted` | `#94a3b8` | **6.96:1** | |
| `--chrome-ink-subtle` | `#94a3b8` | **6.96:1** | *(promoted from `#64748b` = 3.75:1, which fails)* |
| `--chrome-line` | `#334155` | 1.72:1 | borders only |

---

## 6. Typography — three tiers, already in use

Login establishes serif for display and sans for body. The code has added mono for data unprompted. Make it official.

| Tier | Stack | Role | Locked to |
|---|---|---|---|
| **Display** | `Georgia, 'Times New Roman', ui-serif, serif` | Brand wordmark, page titles, greetings, section openers | Login's `font-serif`. Weight 400–600, tight tracking (`-0.5px` to `-1.5px` at display sizes) |
| **Text** | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | Body, labels, buttons, navigation | Neutral, invisible, correct |
| **Data** | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | **All** times, dates, durations, hour totals, employee codes, KPI values, status pills, IDs | Already true. Tabular by nature — clocks and ledgers need column-aligned figures. |

### Scale (4px rhythm, retained from v1)

| Token | Size / LH / Tracking / Weight |
|---|---|
| `display-xl` | 48px / 1.05 / -1.5px / 600 |
| `display-lg` | 36px / 1.10 / -1.0px / 600 |
| `display-md` | 28px / 1.15 / -0.5px / 600 |
| `display-sm` | 22px / 1.25 / -0.3px / 500 |
| `body-lg` | 18px / 1.50 / -0.05px / 400 |
| `body` | 16px / 1.50 / 0 / 400 |
| `body-sm` | 14px / 1.50 / 0 / 400 |
| `caption` | 12px / 1.40 / 0 / 400 |
| `button` | 14px / 1.20 / 0 / 500 |
| `eyebrow` | 13px / 1.30 / +0.4px / 500, uppercase — **restricted, see §10.1** |
| `mono` | 13px / 1.50 / 0 / 400 |

**Max 4 weights.** Serif display is the one deviation from v1's "single font family" rule — and it is the deviation that makes this system recognisable.

---

## 7. Spacing, Radius, Elevation (retained unchanged)

The v1 token layer is well-built and is **kept verbatim**: 4px base rhythm, 8px default step; `xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · xxl 48 · section 96`; radius `xs 4 · sm 6 · md 8 · lg 12 · xl 16 · xxl 24 · pill 9999`.

Elevation is restated for the light canvas (anti-ai-ui §5 requires a real 3-tier system):

| Tier | Surface | Treatment |
|---|---|---|
| Base | `#fafaf9` paper | no shadow, `#e7e5e4` hairline |
| Raised (cards) | `#ffffff` | `0 1px 2px rgba(15,23,42,.06)`, `#e7e5e4` hairline |
| Overlay (modals) | chrome `#1e293b` on paper | `0 24px 48px -12px rgba(15,23,42,.28)`, `#334155` line, backdrop `rgba(15,23,42,.55)` |

No `shadow-<colour>` anywhere. No glassmorphism.

---

## 8. Component Specification

### 8.1 Buttons
- **Primary:** `--brass-ink #b45309` fill, `#fafaf9` label, `md` radius, `8px 14px`, `active:scale-[0.98] active:brightness-95`
- **Primary on chrome:** `--brass #eab308` fill, `#0f172a` label
- **Secondary:** paper-raised fill, `--ink` label, `#d6d3d1` border, hover `#f5f5f4`
- **Tertiary:** transparent, `--ink-muted`, hover paper-sunken
- **Inverse (chrome only):** `#0f172a` fill, `#fafaf9` label, hover `--brass` fill + `#0f172a` label ← **Login's current submit-button behaviour, preserved**
- **All:** `focus-visible:ring-2` in the polarity-correct brass + `ring-offset-2` in the local surface

### 8.2 Cards
`#ffffff` raised, `lg` radius, `24px` padding, `#e7e5e4` hairline, no corner tint. **Asymmetric by role** — see §10.2.

### 8.3 Inputs
Paper-sunken `#f5f5f4` fill, `#d6d3d1` border, `md` radius, `10px 12px`. Focus: `#b45309` border + `ring-2 #b45309` + `ring-offset-2 #fafaf9`. Placeholder `#78716c` (4.59:1). **On chrome:** `#1e293b` fill, `#334155` border, focus `#eab308`, ring offset `#0f172a`.

### 8.4 Tables — the ledger's centre of gravity
Retain: row hover, zebra by elevation, `whitespace-nowrap` cells, horizontal scroll wrapper, mono for all time/number cells, brass corner bracket.

Add (anti-ai-ui §11 — currently all three are missing):
- **Sticky header** — `position: sticky; top: 0` on `<thead>` with paper-sunken background
- **Sort indicators** on sortable columns (`ArrowUpDown` / `ArrowUp` / `ArrowDown`), with `aria-sort`
- **Pagination** — "Showing 1–25 of 142 records" + page controls, total count visible

### 8.5 Status badge
Tinted background per §5.4, `pill` radius, `2px 8px`, `caption` weight 500, **mono** for the value, sentence case (`Late`, not `LATE`).

### 8.6 Navigation
Retain: role-filtered `allNavItems`, brass active indicator, corner brackets, mobile drawer.

Rework per anti-ai-ui §3: the bottom block is currently *square initials tile → name → role → naked logout row*, which is the cookie-cutter profile pill in a different shape. Replace with an **integrated account menu**: one `button` with `ChevronsUpDown` chevron, name + role badge, opening an accessible popover (`Profile`, `Settings`, `Sign out`) with keyboard navigation and `aria-expanded`.

### 8.7 Icons
**Consolidate 5 families → 1.** Today: `react-icons/fa` (8), `fa6` (2), `ci` (2), `bs` (1), `sl` (1). v1's own §9 already mandates *"fa6 only, one set per surface"* — five families is a violation of the signed spec. Standardise on **`react-icons/fa6`**, uniform stroke weight, `aria-hidden="true"` on decorative marks. (Icons stay SVG-only — anti-ai-ui §1 is already satisfied.)

---

## 9. Login Experience — how it works

**Retained exactly (this is the anchor; it is not being redesigned):**
- 45% dark brand panel / 55% paper form split, `md:` breakpoint, brand header collapsing inline on mobile
- Serif "AttendPro" wordmark in gold, uppercase micro-tagline
- Corner-bracket frame + gold hairline rules
- Uppercase micro-labels above fields
- Error bar with inline SVG warning, red-50/red-200/red-700
- Show/hide password toggle, loading spinner, disabled states
- Submit button: dark fill → gold hover inversion with arrow icon
- Footer line

**Corrected (measured failures, §5):**

| Issue | Measured | Fix |
|---|---|---|
| Focus ring `ring-yellow-500` on paper | **1.84:1** (needs 3.0) | → `ring-[#b45309]` = **4.81:1** |
| Focus ring on `stone-100` input | **1.76:1** (needs 3.0) | → `#b45309` = **4.60:1** |
| `text-slate-400` subtext on paper | **2.46:1** (needs 4.5) | → `#78716c` = **4.59:1** |
| `placeholder-slate-400` on `stone-100` | **2.35:1** (needs 4.5) | → `#78716c` |
| `bg-yellow-500 opacity-5 blur-3xl` radial glow | anti-ai-ui §14 | Replace with a fine 1px brass grid pattern or drop entirely |

**Added for continuity:**
- `SetPassword.jsx` and `ErrorBoundary.jsx` lose their separate `auth-*` light theme and adopt the unified system, so the entire authentication flow is one identity.
- **After sign-in, the sidebar visually continues the brand panel.** Same `#0f172a`, same serif wordmark, same gold brackets. The transition from Login → app should feel like a door opening, not a different building.

---

## 10. What Is Retained / Redesigned / Inconsistent

### 10.1 Retained (do not touch)

1. **Login's split-screen composition and all its interactions** — the best-built screen in the app.
2. **The serif + mono + sans three-tier type system** — already emergent in 14/23 files.
3. **The 4px spacing rhythm, radius scale, and type scale** — clean, complete, correct.
4. **The `@layer components` primitive architecture** (`.btn-*`, `.card*`, `.input*`, `.badge*`) — the right way to do this; only the values change.
5. **`font-mono` on every time, date, hour, code and KPI value** — correct for a ledger, already consistent.
6. **KPI metric choices** — Weekly Hours / Streak / Attendance Rate / Late Arrivals are genuinely domain-specific, not the generic "Total Revenue / Active Users" set (anti-ai-ui §8 avoided).
7. **`StatBadge` semantic mapping** to the real backend enums.
8. **Table row hover + zebra + guided empty-state copy** ("Records will appear here once attendance is logged").
9. **Role-filtered sidebar navigation** — functionally correct and worth keeping.
10. **The corner-bracket motif** (9 instances) — a real, self-consistent signature. Keep it as the system's decorative grammar, restricted to panel corners and empty states.
11. **SVG-only icons, zero emoji** — anti-ai-ui §1 already passes.
12. **Focus-visible rings present on every interactive element** — the *presence* is right; only the colour was wrong on Login.
13. **The two employee modals' slate+gold treatment** — now correct by construction.

### 10.2 Redesigned

| # | Item | Why |
|---|---|---|
| R1 | **Polarity flip** — working surface `#010102` → `#fafaf9` paper; chrome stays dark | Extends Login into the app (the mandate) |
| R2 | **Accent** — lavender `#5e6ad2` → dual brass `#eab308` / `#b45309` | Login's colour; also leaves the banned indigo family (anti-ai-ui §4) |
| R3 | **Sidebar** — dark-on-dark lavender → the Login brand-panel language | Continuity after sign-in |
| R4 | **`SetPassword` + `ErrorBoundary`** — kill the third `auth-*` light theme | Three languages → one |
| R5 | **Tables** — add sticky headers, sort indicators, pagination | anti-ai-ui §11 (all three absent today) |
| R6 | **Empty states** — add a concrete next action | anti-ai-ui §12 |
| R7 | **Sidebar account menu** — replace profile-pill + naked logout with an accessible popover | anti-ai-ui §3 |
| R8 | **Buttons** — add `active:scale-[0.98]` | anti-ai-ui §9 (zero occurrences today) |
| R9 | **Icons** — 5 families → `fa6` only | Violates signed v1 §9 right now |
| R10 | **KPI grid** — break 4 identical cards into an asymmetric bento: one hero card spanning 2 columns carrying the day's primary figure + clock action, two secondary dense metric cards | anti-ai-ui §6/§8 |
| R11 | **Login focus/subtext contrast** | §9 measured failures |
| R12 | **Role landing routes** — `/` and wrong-role redirects resolve to the role's own home, not `/login` | Correctness (P2, from the current-state review) |

### 10.3 Inconsistent (must be resolved by the migration)

1. **Three live design languages** across 21 files (§4) — the primary defect.
2. **`uppercase tracking-widest` appears 49 times across 17 files** — table headers, section titles, KPI eyebrows, sidebar subtitle, page eyebrows, chart titles. Anti-ai-ui §15 names this exact habit. **Restrict to:** status micro-indicators, employee codes, and the brand tagline. Everything else → title case or sentence case. *(Login's three uses on field labels are the exception worth debating — see §12 Q3.)*
3. **`DESIGN.md` §8 rule 6 ("single font family") contradicts 14 files.** The spec is wrong, not the code.
4. **`DESIGN.md` §7 claims `--accent on --canvas = 4.8:1`; measured `4.44:1`.** The signed document contains an inflated measurement.
5. **v1 §9 says "fa6 only"; 5 families are in use.**
6. **`AddEmployeeModal`/`EditEmployeeModal` were never migrated to Linear** — they now happen to be correct.
7. **Status pill casing** is inconsistent (`Open`/`Present` sentence case in `StatBadge`, but `uppercase` treatment elsewhere).
8. **Seed data uses placeholder people** (`John Doe`, `Jane Smith`, `Mike Johnson`, `Sarah Williams`, `David Brown`) — anti-ai-ui §13. Backend-only so `ui-taste-check` never sees it, but it is what HR sees in the live table.

---

## 11. Role-Based Experience

Same palette, same components, same chrome. **Differentiated by density, hierarchy, and the primary action** — not by separate themes. Separate per-role themes would double QA cost and fracture the identity.

| | **Employee (STAFF)** | **HR** | **Super Admin** |
|---|---|---|---|
| **Home** | `/dashboard` | `/hr-dashboard` | `/superadmin-dashboard` |
| **Question answered** | *Am I in? Where am I this week?* | *Who needs attention right now?* | *Is the operation healthy, and can I prove it?* |
| **Density** | Airy — one hero, 3 metrics max | Medium — exception-forward | Dense — table-first, report-first |
| **Primary action** | **Clock In / Clock Out**, visually dominant, top-right, always visible | Scan + dismiss exceptions | Filter, review, **export** |
| **Signature element** | Live clock-state pill (pulsing dot + monospaced time) | Exception row highlight — late/unrecorded rows get a brass left-border | Monthly report block + Excel export |
| **KPI weight** | Personal: Weekly Hours (hero, 2-col), Streak, Attendance Rate | Operational: Clocked In Today, Late Today, Not Yet Clocked Out | System: headcount, month totals, unique days, avg hrs/day, late % |
| **Tables** | Own records only, 5 columns, read-only | All records, 7 columns, exception-sorted default | All records + staff CRUD, search, month filter, export |
| **Charts** | None — charts are noise on a personal screen | Weekly hours bar + session donut | Same + month-over-month |
| **Chrome** | Identical sidebar, `STAFF` badge | Identical, `HR` badge | Identical, `SUPERADMIN` badge |

**Nav differs by role only through item visibility** (already implemented correctly in `allNavItems`). No visual theming per role.

---

## 12. Anti-AI UI Compliance Plan

| anti-ai-ui | Status today | Plan |
|---|---|---|
| §1 Emojis as icons | ✅ pass | Keep |
| §2 Sparkle cliché | ✅ pass | Keep |
| §3 Sidebar profile pill | ❌ fails | R7 — accessible account popover |
| §4 Indigo-purple gradient | ⚠️ no gradient, but lavender `#5e6ad2` is in the banned family | R2 — brass accent |
| §5 Pitch-black glassmorphism | ⚠️ app is uniformly `#010102` with no elevation hierarchy | R1 — 3-tier paper elevation (§7) |
| §6 Holy-Trinity card grid | ⚠️ 4 identical KPI cards | R10 — asymmetric bento |
| §7 SaaS hero banner | ✅ n/a | — |
| §8 Generic metric cards | ✅ metrics are domain-specific | Keep content, vary weight |
| §9 No `:active` press | ❌ zero occurrences | R8 |
| §10 Focus rings | ⚠️ present, wrong colour on Login | R11 |
| §11 Static dead tables | ❌ no sort, no sticky, no pagination | R5 |
| §12 Vacuous empty state | ⚠️ explanatory but no action | R6 |
| §13 Placeholder entities | ⚠️ seed uses "John Doe" et al | §12 Q4 |
| §14 Floating radial blobs | ⚠️ Login glow | §9 |
| §15 All-caps overkill | ❌ **49 occurrences / 17 files** | §10.3 item 2 |
| §16 `cursor-pointer` | ✅ present on nav/actions | Keep |
| §17 Skeleton loaders | ❌ `Loading records…` text with `animate-pulse` | Add geometry-matched skeletons |
| §18 Center-aligned body copy | ✅ left-aligned throughout | Keep |
| §19 Inconsistent icon weight | ❌ **5 icon families** | R9 |
| §20 Floating pill chips | ✅ pass | Keep |

---

## 13. Updated Gate Rules

1. Only tokens defined in this document may appear in `src/`. **No raw `slate-*`/`stone-*`/`yellow-*` utility classes** outside `index.css` token definitions — this is what allowed the three-language split to grow.
2. Every colour pair measured against §5 before shipping; ratios recorded here.
3. `ui-taste-check.sh` passes before any frontend commit.
4. **Focus rings: `#eab308` on chrome, `#b45309` on paper. Never crossed.** Minimum 3:1.
5. No `shadow-<colour>`; elevation only via the 3-tier surface system.
6. **Three type tiers** — serif display, sans text, mono data. Max 4 weights. Mono is mandatory for any time, date, duration, code, or currency value.
7. 4px rhythm enforced — no fractional spacing.
8. **One icon family: `react-icons/fa6`.** One stroke weight.
9. `uppercase tracking-widest` permitted **only** on status micro-indicators, employee codes, and the brand tagline.
10. All buttons carry `active:scale-[0.98]`.
11. Tables carry sticky headers, sort state, and pagination.

---

## 14. Proposed Migration Sequence (NOT started)

Each phase is independently reviewable and stops at a human checkpoint. Nothing below has been executed.

| Phase | Scope | Risk |
|---|---|---|
| **0** | Owner approves this document; root `DESIGN.md` replaced or rejected | none |
| **1** | Token layer only — `index.css` + `tailwind.config.js` revalued to §5–§7. No component touched. | Low: pure value swap |
| **2** | Layout shell — `Layout.tsx`, `Sidebar.tsx`, `App.jsx` route guards (includes R12) | Medium |
| **3** | Primitives — buttons, cards, inputs, badges, tables (R5, R8) | Medium |
| **4** | Pages, one at a time — Login (§9 fixes) → SetPassword → Dashboard → HrDashboard → SuperAdminDashboard → Profile → Schedule → Settings → ManageStaff | Medium, page-by-page |
| **5** | Modals + charts + account menu (R7, R10) | Low |
| **6** | Anti-AI UI sweep — R9 icons, §15 uppercase reduction, R6/R12 skeletons & empty states | Low |

Verification after each phase: `ui-taste-check.sh` → `eslint src` → `vitest run` (12 tests) → `vite build` → **human browser review**.

---

## 15. Open Questions for the Owner

1. **Catalogue decision.** Approve **Claude as structural base, recoloured to Login**? Or prefer a different finalist (Mastercard's warmth, or no catalogue base at all — formalising Login as a native system)?
2. **Polarity.** The flip from an all-dark app to paper-with-dark-chrome is the largest visual change here. Confirm you want this — it is what "every page stands on the UI of Login" implies.
3. **Uppercase field labels on Login.** Keep Login's `uppercase tracking-widest` labels (they are part of the anchor and read as engraved nameplates), or move to sentence case for consistency with §13 rule 9?
4. **Seed entities.** The 5 staff records are `John Doe`-class placeholders that HR sees in the live table. Replace with authentic domain names? *(This touches data, not schema — needs your explicit go-ahead separately.)*
5. **Root `DESIGN.md`.** On approval, does it get replaced outright, or does v1 stay as an archive with this document superseding it?
6. **Scope boundary.** This proposal is frontend-design only. The 47 `tsc` errors, the case-sensitive backend imports, and `db-check.sh`'s false pass remain open and untouched.

---

*No implementation has begun. No component, token, migration, or database object was modified in producing this document. Awaiting Owner approval.*
