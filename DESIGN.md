# DESIGN.md — AttendPro Design System

> Stage 2 deliverable of the Dev-OS design gate, produced by the UI Designer, revised after three QA rounds, and approved by the Owner on 2026-10-06.
> Section 7 findings 1-14 are open defects to remediate, not an approved clean state. Frontend work may now proceed under the gate rules in section 8.
> Companion to `docs/PROJECT_REQUIREMENTS.md`.

**Audit status:** QA returned `CHANGES REQUESTED` twice. Round 1 raised 22 issues (1 CRITICAL, 7 HIGH, 9 MEDIUM, 5 LOW); round 2 left 15 (1 HIGH, 8 MEDIUM, 6 LOW). Every finding was verified by re-grepping the source and recomputing the arithmetic before being accepted, and all are corrected below. Open defects remain recorded in section 7.

## 1. Design Archetype

**Operations Console.** A high-density B2B back-office tool, not a marketing surface.

The archetype follows from the product. Attendance is a punctuality product: people open a dashboard to answer "who is here, who is late, how many hours." That argues for a dark navigation chrome that recedes, a light page beneath it, and a single warm accent that means *look here now*.

The accent is amber because the domain owns it. A clock, a late mark, an attention badge — amber already means "time-related" in control rooms and dashboards. It is not chosen for decoration, and it is deliberately not the indigo-to-violet gradient that marks generated interfaces.

### Surfaces as they actually are

The earlier draft of this table described surfaces the code does not use. Every row below was re-checked against the source.

| Surface | Token | Where it really appears |
|---|---|---|
| Page | `slate-50` | `body` background in `src/index.css` |
| Chrome | `slate-900` | Sidebar root, chart cards, both attendance tables |
| Raised chrome | `slate-800` | Table header rows, form inputs on dark panels |
| Light card | `white` | `KpiCard` root, the status pill at `Dashboard.tsx:184`, the loading empty-state card at `Dashboard.tsx:272` |
| Tinted light card | `blue-50`, `green-50`, `yellow-50`, `red-50` | `KpiCard` wells (`KpiCard.jsx:10-13`, default scheme is gold), the error bar `Login.tsx:164`, red notices `Dashboard.tsx:201` and `ManageStaff.jsx:227`, and gold hover states `ManageStaff.jsx:160,174` |
| Auth page | `stone-50` | `Login.tsx:125`, `SetPassword.jsx:172`, `ErrorBoundary.jsx:33` |
| Auth input | `stone-100` | `Login.tsx:208,238`, `SetPassword.jsx:38` |

`stone-50` (`#fafaf9`) and `stone-100` (`#f5f5f4`) are neither `--canvas` (`#f8fafc`) nor `--surface`. The auth screens run their own neutral, so every ratio in section 2 that touches them is measured against `stone`, not `slate`.

Three consequences. First, "working canvas" is **not** where tables and forms live — both tables are `bg-slate-900` cards and inputs are `bg-slate-800` on dark panels. Second, the split is not light-against-dark by feature: the profile and settings *cards* are `bg-slate-900` (`Profile.tsx:225,275`, `Settings.jsx:146,178`) sitting on a `slate-50` page, so "identity surfaces are light" is false and every pair in section 2 must be checked against the card, not the page. Third, light surfaces do exist and must be measured separately: KPI cards, the status pill, the tinted wells, and the auth screens.

Density is high on purpose. Rows are compact, metadata sits beside its value, and space is spent separating groups rather than padding inside them.

## 2. Colour Palette & Contrast Tokens

### Core palette

| Token | Hex | Role |
|---|---|---|
| `--canvas` | `#f8fafc` | Light page background |
| `--surface` | `#ffffff` | Light cards and pills |
| `--chrome` | `#0f172a` | Sidebar, chart cards, data tables, profile and settings panels |
| `--chrome-raised` | `#1e293b` | Inputs and header rows on chrome |
| `--ink` | `#0f172a` | Primary text on light |
| `--ink-muted` | `#64748b` | Secondary text on light |
| `--ink-invert` | `#94a3b8` | Secondary text on chrome |
| `--border` | `#64748b` | Interactive borders on light, needs 3:1 |
| `--border-invert` | `#334155` | Borders on chrome |
| `--auth-canvas` | `#fafaf9` (`stone-50`) | Auth and error pages: `Login.tsx:125`, `SetPassword.jsx:172`, `ErrorBoundary.jsx:33` |
| `--auth-input` | `#f5f5f4` (`stone-100`) | Auth inputs: `Login.tsx:208,238`, `SetPassword.jsx:38` |

The auth pair is deliberately `stone`, not `slate`. The two are near-identical in luminance but not in temperature: `stone-50` (250,249,249) is warm and `slate-50` (248,250,252) cool, differing mainly in the blue channel by 3 points. `ink` on `stone-50` measures 16.99:1 against 17.06:1 on `slate-50` — a 0.07 difference, so the contrast outcome barely moves. Separate tokens are justified by provenance, not by ratio: swapping one for the other silently changes the background every auth measurement was taken against.

Tokens are declared here first, then in code (rule 7). `src/index.css` declares each token as a `:root` custom property and `tailwind.config.js` maps every one of them to a Tailwind colour, so `bg-canvas`, `text-ink`, `text-accent-strong`, and `border-border` resolve as utilities against the values above. Mechanism added 2026-10-06 to satisfy section 8 rule 5.

### Accent — the two-surface rule

Yellow reads differently against dark and light, so each surface gets its own token. Using the dark accent on a light surface is the most common contrast failure in this codebase.

| Token | Hex | Surface | Measured | Verdict |
|---|---|---|---|---|
| `--accent` | `#eab308` (`yellow-500`) | on `chrome` | 9.31:1 | AA pass |
| `--accent-strong` | `#b45309` (`amber-700`) | on `canvas` | 4.80:1 | AA pass |
| `--accent-strong` | `#b45309` (`amber-700`) | on `surface` | 5.02:1 | AA pass |

`yellow-500` on `slate-50` measures 1.83:1 and `yellow-600` measures 2.81:1. Both fail. On light surfaces the accent colour is `amber-700`. The one exception is destructive text, which uses `red-700` rather than an amber tint — see the semantic states table below.

The rule has a third case, found in round 2. `amber-700` on `slate-900` measures **3.56:1** and on `slate-800` **2.91:1** — both below 4.5:1. Because the profile and settings cards are `slate-900`, accent text there cannot simply become `amber-700`. The complete rule is: on `chrome` and on `slate-900`/`slate-800` cards use `yellow-500` (9.31:1 on `slate-900`); on `--canvas`, `--surface`, and the tinted wells use `amber-700`; on `--auth-canvas` and `--auth-input` use `amber-700` or `red-700`, measured against `stone`.

`amber-700` has zero occurrences in the codebase today. Introducing it is remediation for finding 2, not a record of current state.

### Semantic states

The first column is measured against its real background in shipping code. The second is the target for the surface where the token is specified but not yet correct.

| State | Measured where it ships | | Target pairing | |
|---|---|---|---|---|
| | Pair | Ratio | Pair | Ratio |
| Success | `green-500` on `green-50` (KPI well) | **2.18:1 FAIL** | `green-700` on `green-50` | 4.79:1 pass |
| Success | `green-500` dot on `white` (Dashboard) | **2.28:1 FAIL** | `green-700` on `white` | pass |
| Warning | `yellow-500` on `slate-900` | 9.31:1 pass | `amber-700` on `slate-900` | **prohibited — see accent rule below** (3.56:1) |
| Warning | `yellow-500` on `yellow-50` (KPI gold well, the default scheme) | **1.85:1 FAIL** | `amber-700` on `yellow-50` | pass |
| Warning | `yellow-600` on `yellow-50` hover (ManageStaff) | **2.84:1 FAIL** | `amber-700` on `yellow-50` | pass |
| Destructive | `red-500` on `red-50` (KPI well) | 3.44:1 pass (graphic) | `red-700` on `red-50` | 5.91:1 |
| Destructive | `red-700` on `red-50` (Login error bar, `Login.tsx:164-165`) | 5.91:1 pass | — | — |
| Destructive | `red-400` dot on `white` (status pill, `Dashboard.tsx:186`) | **2.77:1 FAIL** | `red-700` on `white` | 6.47:1 |
| Destructive | `red-700` on `--canvas` / on `--surface` | 6.18:1 / 6.47:1 pass | — | — |
| Info | `blue-500` on `blue-50` (KPI well) | 3.38:1 pass (graphic) | `blue-700` on `blue-50` | 6.16:1 |

Round 1 recorded the Login error as `red-700` on `stone-100` at 5.93:1. The bar is `bg-red-50`, not `stone-100`; the corrected pair measures 5.91:1. The gold well and the red dot were missing entirely from round 1 — both fail, and both ship by default.

The earlier claim that the target column had "zero occurrences" was wrong: `text-red-700` exists at `Login.tsx:165`. It is also wrong to call the first column chrome-only — `green-500`, `blue-500`, and `red-500` ship on *light tinted* surfaces, not on chrome.

### Focus indicators — measured for the first time

Focus rings were absent from the original audit. They are the most-used interactive affordance in the product and they currently fail.

| Pair | Ratio | Required | Verdict |
|---|---|---|---|
| `focus-visible:ring-yellow-500` on `stone-100` (Login, SetPassword inputs) | 1.76:1 | 3:1 | **Fail** |
| `focus-visible:ring-yellow-500` on `stone-50` | 1.84:1 | 3:1 | **Fail** |
| Ring on chrome (`yellow-500` on `slate-900`) | 9.31:1 | 3:1 | Pass |

Rule: ring colour is `amber-700` on light surfaces and `yellow-500` on chrome. The current single-ruleset approach cannot satisfy both.

### Measured contrast against the live codebase

| Pair | Ratio | Verdict |
|---|---|---|
| Body `slate-900` on `slate-50` | 17.06:1 | Pass |
| Muted `slate-500` on `slate-50` | 4.55:1 | Pass, at the floor |
| Muted `slate-400` on `slate-900` | 6.96:1 | Pass |
| Muted `slate-400` on `slate-800` | 5.71:1 | Pass |
| Accent `yellow-500` on `slate-900` | 9.31:1 | Pass |
| Button `slate-900` on `yellow-500` | 9.31:1 | Pass |
| Hover `slate-900` on `yellow-400` | 11.66:1 | Pass |
| Destructive `red-400` on `slate-900` | 6.45:1 | Pass |
| Success `green-500` on `slate-900` | 7.83:1 | Pass |
| Info `blue-500` on `slate-900` | 4.85:1 | Pass |
| `slate-400` on `slate-50` | 2.45:1 | **Fail** |
| `slate-400` on `white` | 2.56:1 | **Fail** |
| `yellow-500` on `slate-50` | 1.83:1 | **Fail** |
| `yellow-600` on `slate-50` | 2.81:1 | **Fail** |
| `slate-300` border on `slate-50` | 1.42:1 | **Fail**, borders need 3:1 |
| Focus ring `yellow-500` on `stone-100` | 1.76:1 | **Fail**, needs 3:1 |
| `red-400` dot on `white` status pill | 2.77:1 | **Fail**, graphics need 3:1 |
| `yellow-500` on `yellow-50` gold well | 1.85:1 | **Fail**, graphics need 3:1 |

Method: relative luminance per WCAG, channels linearised with `c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`, then `0.2126R + 0.7152G + 0.0722B`, ratio `(L1+0.05)/(L2+0.05)`. Thresholds: 4.5:1 for body text, 3:1 for large text and for UI components including borders and focus rings.

## 3. Typography System

| Role | Family | Source | Used for |
|---|---|---|---|
| Display | Fraunces | Google Fonts | Wordmark, page titles, empty-state headlines |
| Body | General Sans | Fontshare | Everything readable |
| Data | IBM Plex Mono | Google Fonts | Employee codes, timestamps, hours, IDs |

Loaded in `index.html`. The pairing is deliberate: Fraunces gives the wordmark a printed-ledger character that suits attendance records, General Sans stays neutral under long tables, IBM Plex Mono keeps numeric columns aligned.

**Size scale.** These are Tailwind's defaults, and the step ratios vary between 1.11 and 1.33 rather than a fixed 1.20 — an earlier claim of a uniform ratio was incorrect. The widest step is `4xl` (2.25rem) to `5xl` (3rem) at 1.33.

| Step | Size | Line height | Live use |
|---|---|---|---|
| `xs` | 0.75rem | 1rem | Timestamps, badges, table meta |
| `sm` | 0.875rem | 1.25rem | Table cells, secondary labels |
| `base` | 1rem | 1.5rem | Body copy, inputs |
| `lg` | 1.125rem | 1.75rem | Section headings |
| `xl` | 1.25rem | 1.75rem | Card titles |
| `2xl` | 1.5rem | 2rem | Page titles |
| `3xl` | 1.875rem | 2.25rem | Secondary KPI values |
| `4xl` | 2.25rem | 2.5rem | `KpiCard` value |
| `5xl` | 3rem | 1 | Empty-state headline (`Dashboard.tsx:172`) |
| `6xl` | 3.75rem | 1 | Empty-state headline |

Live code uses `text-4xl`, `text-5xl`, and `text-6xl`, so those steps are declared rather than left outside the system: `4xl` for `KpiCard` values, `5xl` and `6xl` for empty-state headlines (`Dashboard.tsx:172`).

**Weights:** 400 body, 500 labels and buttons, 600 emphasis, 700 headings only. Four is the ceiling; a fifth weight means the hierarchy is unclear.

Loaded today: Fraunces at 400/600/700, General Sans at 400/500/600/700, IBM Plex Mono at **400/500 only**. An earlier draft claimed these matched usage; they do not. Four elements combine `font-bold` with `font-mono` — `KpiCard.jsx:37` and `SuperAdminDashboard.jsx:446,456,469` — and ask Plex Mono for 700, which is not in the stylesheet, so the browser synthesises a faux bold. Either add `700` to the Plex Mono URL or cap those four at 500. Capping is the better fit: mono is a data face, and a synthesised bold in a numeric column is exactly the sort of thing that makes a table look cheap.

**Case rules.** Uppercase with wide tracking is reserved for eyebrow labels above a value. The codebase currently uses `tracking-widest` 47 times and `tracking-wider` 7 times, across 65 `uppercase` usages — including export buttons in `SuperAdminDashboard.jsx` that this rule would forbid. Existing usages are exempt until their file is touched; new work uses `tracking-wider`.

## 4. Spacing & Layout

**Target:** a 4px rhythm, with 8px as the default step between related things.

**Current:** 21 fractional utilities break it — `py-2.5` ×6, `py-1.5` ×3, `py-0.5` ×3, `mt-0.5` ×3, `px-2.5` ×2, `gap-1.5` ×2, plus `p-1.5` and `space-y-1.5`. The rhythm is a target, not a description of what ships.

| Token | Value | Use |
|---|---|---|
| `1` | 0.25rem | Icon to label, badge inset |
| `2` | 0.5rem | Label to its control |
| `4` | 1rem | Default gap inside a group |
| `6` | 1.5rem | Card padding, standard gutter |
| `8` | 2rem | Between cards |
| `10` | 2.5rem | Between page sections, wide gutter |

**Shell.** Fixed sidebar at `w-64` (256px), content area to its right. The gutter is a single responsive class, `p-6 lg:p-10` at `Layout.tsx:40`, switching on **breakpoint**. An earlier draft claimed the split was by view type (`px-6 py-6` for tables, `p-10` for forms); that does not exist. Modals use `p-8`, Settings panels `p-6`. Below `lg` the sidebar translates off-canvas behind a `black/50` scrim.

**Container widths**, restated against real usage:

| Width | Actually used by |
|---|---|
| `max-w-sm` | `Login.tsx:144`, `SetPassword.jsx:188` — auth forms. Not toasts; `react-hot-toast` is unconstrained. |
| `max-w-md` | `ManageStaff.jsx:189` deactivate confirm dialog (`fixed inset-0` modal), `ErrorBoundary.jsx:34` |
| `max-w-lg` | Both employee modals, `Profile` panel |

**Grid.** KPI rows use an explicit ladder: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5`. An auto-fit grid was considered and rejected; the ladder keeps card heights identical across a row, which matters when every card holds a number.

## 5. Component Signatures

### Radius

Actual Tailwind values, read from `node_modules/tailwindcss/defaultTheme.js`:

| Token | Value | Applies to |
|---|---|---|
| `rounded-sm` (corner-only: `rounded-tr/br/bl-sm`) | 0.125rem | Decorative corner brackets |
| `rounded-md` | 0.375rem | Badges, tags, inputs inside a table |
| `rounded-lg` | 0.5rem | Buttons, inputs, nav items |
| `rounded-xl` | 0.75rem | Cards, modals, panels |
| `rounded-2xl` | 1rem | `KpiCard` root, current default |

The codebase uses five distinct values: `2xl` ×31, `lg` ×29, `xl` ×13, `full` ×6, `md` ×2 — though they do not map onto the table above, which lists the four *target* radii plus the corner-only `sm` (unused as a standalone class; the 17 corner brackets use its `tr`/`br`/`bl` forms). `rounded-full` has no row because it is a terminal shape for badges and dots, inventoried at the end of this section rather than part of the radius scale. The target is `md` / `lg` / `xl`. `KpiCard` ships `rounded-2xl` today and moves to `rounded-xl` when its file is next touched.

**Corner-only radii** are used 17 times across 9 files — `rounded-tr-sm` ×12, `rounded-bl-sm` ×4, `rounded-br-sm` ×1. They are decorative corner brackets (`KpiCard.jsx:22` labels one "MERIDIAN signature"), not a sidebar indicator. The sidebar's active state uses `border-l-2 border-yellow-500` with **no** radius at all. An earlier draft had both halves of this wrong. Corner brackets are a signature element and are kept; `rounded-br-sm` joins the scale.

`rounded-full` ships six uses with no avatars anywhere: a status dot (`Sidebar.tsx:203`), role and status badges (`StaffTable.jsx:29`, `StatBadge.jsx:48`), a pill (`Dashboard.tsx:184`), and two decorative blur blobs (`Login.tsx:84`, `SetPassword.jsx:146`). Badges keep it. The blur blobs are unrelated to radius and stay.

### Elevation

Hierarchy comes from surface colour, not shadow. Shadows appear only where a layer floats.

| Level | Token | Use |
|---|---|---|
| 0 | none | Resting cards |
| 1 | `shadow-sm` | Dropdowns, hover lifts |
| 2 | `shadow-md` | Modals, popovers |

`KpiCard` ships `shadow-sm hover:shadow-md`, which is level 1 with a level-2 hover. That is a documented exception, not a violation.

**`shadow-<colour>` is a bug.** Five instances exist (`shadow-yellow-500/20`), listed as finding 7.

### Buttons

| State | Treatment |
|---|---|
| Default, on chrome | `bg-yellow-500 text-slate-900` — 9.31:1, ships today |
| Default, on light | `bg-amber-700 text-white` — 5.02:1, **not yet in code** |
| Hover, on chrome | `yellow-400`, 11.66:1 — brighter than `yellow-500`, correct direction |
| Hover, on light | `amber-800` — **darker** than `amber-700`, not brighter. White on `amber-800` is 7.09:1, so the contrast holds; state the direction honestly rather than calling it brighter. |
| Active | `active:scale-[0.98]` over 75ms — **zero occurrences today** |
| Focus | `focus-visible:ring-2`, `amber-700` on light and `yellow-500` on chrome |
| Disabled | Opacity 50%, cursor not-allowed, no ring |

### Focus

`focus:outline-none` is legal only when paired with a `focus-visible:` ring on the same element. All 15 live usages follow that pattern, and `ui-taste-check` enforces the pairing. What is *not* legal is any other `focus:` variant, and the ring colour must match the surface rule above — which today it does not.

### Motion

| Rule | Value |
|---|---|
| Colour transition | 150ms |
| Transform transition | 200ms |
| Easing | `ease-out` in, `ease-in-out` for loops |
| Scope | `transition-colors` by default; `transition-all` is banned |

Three live violations, now recorded as finding 8: `transition-all` ×2 (`Sidebar.tsx:143,189`), the off-canvas sidebar uses `duration-300` against the 200ms transform rule, and `KpiCard` uses `transition-shadow`.

## 6. Iconography

**react-icons, `^5.6.0`.** The only icon library installed. **14 imports across five sets**: `fa` ×8, `fa6` ×2 (`Sidebar.tsx:6,8`), `ci` ×2, `bs` ×1, `sl` ×1. An earlier draft said twelve across four sets; the omission of `fa6` mattered because set count drives the consolidation decision.

Lucide is **not** installed. Standardising on it would mean a new dependency and rewriting every import, so it is not a gate.

**Hard rules**

- Zero emoji as icons. Runtime scan finds five: `🔥 ⚡ 💎 🏆` in `src/pages/Profile.tsx` (lines 31, 51, 66, 87) and `⚠️` in `src/pages/Dashboard.tsx:63`.
- No sparkle or wand icons on AI-adjacent, upgrade, or "new" affordances.
- No generic profile pill of avatar plus truncated email plus a naked logout door.
- Icon-only controls carry an `aria-label`; colour is never the only signal.
- New work picks one set per surface. The current sidebar mixes Font Awesome filled glyphs with Simple Line strokes.

The anti-ai-ui standard asks for a single cohesive library. Owner-approved exception: react-icons stays, one set per surface, and cross-set mixing inside a single component is the checkable form of that rule.

## 7. Anti-AI Taste Audit

`.agents/scripts/ui-taste-check.sh` previously reported **24 files clean**. That pass was partly false: the emoji rule ran through `python3`, and on this host `python3` is the Windows Store stub which exits 49 and writes to stderr. The command substitution captured an empty string, so the scan never executed while reporting success. The scanner now uses `grep -P` as its primary path and correctly reports **2 files with violations**.

The python3 fallback needed a second repair after the first fix. Its regex had been written as `\u2600-\u26FF` and `\u2700-\u27BF`, but the escape sequences were flattened in transit to the literal characters `☀-☀㊙-㊙` — a degenerate range matching one code point. It is now assembled from `chr(0x1F300)`, `chr(0x2600)`, `chr(0x2700)` and friends, so no literal Unicode can be mangled on the way into the file. Both paths were checked to give the same answer: 5 hits across `Dashboard.tsx` and `Profile.tsx`, with no false positive from the Dingbats range (`U+2700–U+27BF` covers `✓` at `U+2713`, which matches the original pattern's intent and appears nowhere in `src/`).

Gate rule 3 cannot be trusted until the emoji findings below are cleared.

### Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | Focus rings fail 3:1 on light surfaces | `ring-yellow-500` on `stone-100` = 1.76:1, `Login.tsx:213,243,257` and three `SetPassword` inputs | **Critical** |
| 2 | Accent on light canvas at 1.83:1 | 35 `text-yellow-500` occurrences; wrong only where the background is light | High |
| 3 | `slate-400` on light surfaces at 2.45–2.56:1 | Light-surface files: `KpiCard`, `Dashboard`, `HrDashboard`, `ManageStaff`, `Login`, `SetPassword`. Charts and `ErrorBoundary` are on `slate-900` at 6.96:1 and are **compliant** — earlier evidence misattributed them | High |
| 4 | Semantic colours fail on tinted light wells | `green-500` on `green-50` 2.18:1, `green-500` dot on `white` 2.28:1, `yellow-600` hover on `yellow-50` 2.84:1 | High |
| 4a | Gold KPI well fails; it is the default scheme | `yellow-500` on `yellow-50` = 1.85:1, `KpiCard.jsx:11`, used at `Dashboard.tsx:244`, `HrDashboard.tsx:172`, `SuperAdminDashboard.jsx:341` | High |
| 4b | Red status dot fails on the clock pill | `red-400` on `white` = 2.77:1, `Dashboard.tsx:184-186`, needs 3:1 | High |
| 4c | Accent rule has a third surface it does not cover | `amber-700` on `slate-900` = 3.56:1, on `slate-800` = 2.91:1; profile and settings cards are `slate-900` | High |
| 5 | Emoji used as icons | `Profile.tsx` ×4, `Dashboard.tsx` ×1; gate now detects them | Medium |
| 6 | No active press state anywhere | `active:scale` count is 0 | Medium |
| 7 | `shadow-yellow-500/20` ×5, contradicting "shadow colour is a bug" | `AddEmployeeModal.jsx:154` and 4 more | Medium |
| 8 | `transition-all` ×2 and sidebar `duration-300` | `Sidebar.tsx:143,189` | Medium |
| 9 | Borders at 1.42:1 | 4 `border-slate-300` | Medium |
| 10 | Radius sprawl, five values | `2xl` ×31, `lg` ×29, `xl` ×13, `full` ×6, `md` ×2 | Low |
| 11 | 21 fractional spacing utilities | Listed in section 4 | Low |
| 12 | Four icon sets mixed, `shadow-sm` on resting cards, missing `cursor-pointer` on clickables | `fa`+`sl` in one sidebar; anti-ai-ui anti-pattern 16 | Low |
| 13 | Plex Mono 700 requested but not loaded | 4 uses of `font-bold font-mono`: `KpiCard.jsx:37`, `SuperAdminDashboard.jsx:446,456,469`; `index.html:8` loads 400/500 only | Low |
| 14 | Auth screens use `stone`, outside the `slate` palette | `stone-50` `Login.tsx:125`, `SetPassword.jsx:172`, `ErrorBoundary.jsx:33`; `stone-100` `Login.tsx:208,238`, `SetPassword.jsx:38` | Low |

Findings 2, 3, and 4 need instance-by-instance triage. Yellow and `slate-400` are correct on chrome and wrong on the canvas, so a global find-and-replace would break working UI.

## 8. Gate Rules

1. The approval precondition on this document was met on 2026-10-06. From that date, no **new or modified** frontend component or page may be authored except under these rules. The 24 existing files predate the gate; they are remediated, not grandfathered.
2. Every colour pair must be measured against section 2 before it ships, and the measurement must name its actual background — a ratio against `slate-50` says nothing about a card that is `slate-900`. Section 2 does not yet cover every pair in use: the `stone` auth surfaces (finding 14) are named but not measured. Findings 4, 4a, 4b, and 4c are *measured but failing* — they are already in section 2. Section 2 is complete only once all five are cleared: the auth pairs measured, and the four failures remediated.
3. `ui-taste-check.sh` passes before any commit containing frontend files. It currently **fails**, on finding 5.
4. Focus rings use `amber-700` on light surfaces and `yellow-500` on chrome. No ring may ship below 3:1 against its background.
5. Design tokens gain a code mechanism — CSS custom properties in `src/index.css`, Tailwind theme colours, or both — before section 2 is referenced from implementation. Until then, token names are documentation only.
6. QA audits this document for contrast, accessibility, feasibility, and anti-AI compliance, and records the result.
7. Changes to tokens are updated here first, then in code.

---
*Approved by the Owner on 2026-10-06*
