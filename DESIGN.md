# DESIGN.md — AttendPro Design System

> Stage 2 deliverable of the Dev-OS design gate, produced by the UI Designer.
> Frontend work stays blocked until the Owner approves this document and QA audits it.
> Companion to `docs/PROJECT_REQUIREMENTS.md`.

## 1. Design Archetype

**Operations Console.** A high-density B2B back-office tool, not a marketing surface.

The archetype follows from the product. Attendance is a punctuality product: people scan a dashboard to answer "who is here, who is late, how many hours." That argues for a dark navigation chrome that recedes, a light working canvas that carries the data, and a single warm accent that means *look here now*.

The accent is amber because the domain owns it. A clock, a late mark, an attention badge — amber already means "time-related" in every control room and dashboard. It is not chosen for decoration, and it is deliberately not the indigo-to-violet gradient that marks generated interfaces.

Three surfaces do the work:

| Surface | Token | Role |
|---|---|---|
| Navigation chrome | `slate-900` | Sidebar and top bar; recedes so data dominates |
| Data cards on dark | `slate-800` | KPI tiles and charts inside the chrome |
| Working canvas | `slate-50` | Tables, forms, and anything the user types into |

Density is high on purpose. Rows are compact, metadata sits beside its value, and empty space is spent on separation between groups rather than padding inside them.

## 2. Colour Palette & Contrast Tokens

### Core palette

| Token | Hex | Role |
|---|---|---|
| `--canvas` | `#f8fafc` | Light working background |
| `--surface` | `#ffffff` | Cards, inputs, and tables on the canvas |
| `--chrome` | `#0f172a` | Sidebar and top bar |
| `--chrome-raised` | `#1e293b` | Cards and menus inside the chrome |
| `--ink` | `#0f172a` | Primary text on light |
| `--ink-muted` | `#64748b` | Secondary text on light |
| `--ink-invert` | `#94a3b8` | Secondary text on chrome |
| `--border` | `#64748b` | Interactive and structural borders on light |
| `--border-invert` | `#334155` | Borders on chrome |

### Accent — the two-surface rule

Yellow reads differently against dark and light, so each surface gets its own token. Using the dark accent on a light surface is the single most common contrast failure in this codebase.

| Token | Hex | Surface | Measured | Verdict |
|---|---|---|---|---|
| `--accent` | `#eab308` (`yellow-500`) | on `chrome` | 9.31:1 | AA pass |
| `--accent-strong` | `#b45309` (`amber-700`) | on `canvas` | 4.80:1 | AA pass |
| `--accent-strong` | `#b45309` (`amber-700`) | on `surface` | 5.02:1 | AA pass |

`yellow-500` on the light canvas measures 1.83:1 and `yellow-600` measures 2.81:1. Both fail. On light surfaces the accent is `amber-700`, always.

`amber-700` does not appear in the codebase yet — zero occurrences. Introducing it is part of remediating finding 1 in section 7, not a record of the current state.

### Semantic states

The `On chrome` column is what the code ships today and has been measured against the live files. The `On canvas` column is the spec for light surfaces and is not yet implemented; those tokens also have zero occurrences today.

| State | On chrome | Measured | On canvas | Measured |
|---|---|---|---|---|
| Success | `#22c55e` | 7.83:1 | `#15803d` | 4.76:1 |
| Warning | `#eab308` | 9.31:1 | `#b45309` | 4.80:1 |
| Destructive | `#f87171` | 6.45:1 | `#b91c1c` | 6.19:1 |
| Info | `#3b82f6` | 4.85:1 | `#1d4ed8` | 6.34:1 |

### Measured contrast against the live codebase

| Pair | Ratio | Verdict |
|---|---|---|
| Body text `slate-900` on `slate-50` | 17.06:1 | Pass |
| Muted `slate-500` on `slate-50` | 4.55:1 | Pass, at the floor |
| Muted `slate-400` on `slate-900` | 6.96:1 | Pass |
| Accent `yellow-500` on `slate-900` | 9.31:1 | Pass |
| Button text `slate-900` on `yellow-500` | 9.31:1 | Pass |
| Destructive `red-400` on `slate-900` | 6.45:1 | Pass |
| `slate-400` on `slate-50` | 2.45:1 | **Fail** |
| `yellow-500` on `slate-50` | 1.83:1 | **Fail** |
| `yellow-600` on `slate-50` | 2.81:1 | **Fail** |
| `slate-300` border on `slate-50` | 1.42:1 | **Fail**, borders need 3:1 |

## 3. Typography System

| Role | Family | Source | Used for |
|---|---|---|---|
| Display | Fraunces | Google Fonts | Wordmark, page titles, empty-state headlines |
| Body | General Sans | Fontshare | Everything readable |
| Data | IBM Plex Mono | Google Fonts | Employee codes, timestamps, hours, IDs |

The trio is loaded in `index.html`. The pairing is deliberate: Fraunces gives the wordmark a printed-ledger character that suits attendance records, General Sans stays neutral under long tables, and IBM Plex Mono keeps numeric columns aligned without a tabular-figure hack.

**Modular scale** (1.20 ratio, rem):

| Step | Size | Line height | Use |
|---|---|---|---|
| `xs` | 0.75rem | 1rem | Timestamps, badges, table meta |
| `sm` | 0.875rem | 1.25rem | Table cells, secondary labels |
| `base` | 1rem | 1.5rem | Body copy, inputs |
| `lg` | 1.125rem | 1.75rem | Section headings |
| `xl` | 1.25rem | 1.75rem | Card titles |
| `2xl` | 1.5rem | 2rem | Page titles |
| `3xl` | 1.875rem | 2.25rem | KPI values |

**Weights in use:** 400 body, 500 labels and buttons, 600 emphasis, 700 headings only. Four is the ceiling; a fifth weight is a sign the hierarchy is unclear.

**Case rules.** Uppercase with `tracking-wider` is reserved for eyebrow labels above a value (`HOURS THIS WEEK`). Never for a sentence, a button, or a nav item.

## 4. Spacing & Layout

Built on a 4px rhythm. Every spacing value is a multiple of 4; 8px is the default step between related things.

| Token | Value | Use |
|---|---|---|
| `1` | 0.25rem | Icon to label, badge inset |
| `2` | 0.5rem | Between a label and its control |
| `4` | 1rem | Default gap inside a group |
| `6` | 1.5rem | Card padding, current page gutter |
| `8` | 2rem | Between cards |
| `10` | 2.5rem | Between page sections, current dense-page gutter |

**Shell.** Fixed sidebar at `w-64` (256px), content area to its right with `px-6 py-6` for dense views and `p-10` for forms and empty states. Both gutters exist today and the split is intentional: tables get less air, forms get more. On screens below `lg` the sidebar translates off-canvas behind a `black/50` scrim.

**Container widths.** `max-w-md` for compact dialogs, `max-w-lg` for forms, `max-w-sm` for toasts and confirmations. Page-level content is fluid rather than boxed, because tables should use the width they are given.

**Grid.** KPI rows use an explicit breakpoint ladder: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5`. Four steps at `lg` and above, two at `sm`, one below. An auto-fit grid was considered and rejected; the ladder keeps card heights identical across a row, which matters when every card holds a number.

## 5. Component Signatures

### Radius

The codebase currently uses five radii (`2xl` ×31, `lg` ×29, `xl` ×13, `full` ×6, `md` ×2). That is one too many. The scale tightens to three:

| Token | Value | Applies to |
|---|---|---|
| `--radius-sm` | 0.375rem (`rounded-md`) | Badges, tags, inputs inside a table |
| `--radius-md` | 0.625rem (`rounded-lg`) | Buttons, inputs, nav items |
| `--radius-lg` | 1rem (`rounded-xl`) | Cards, modals, panels |

`rounded-2xl` retires in favour of `rounded-xl` for cards, and `rounded-full` stays only for avatars and status dots. Corner-only radii (`rounded-tr`, `rounded-bl`) are used exclusively on the sidebar's active indicator.

### Elevation

The chrome is flat by intent: hierarchy comes from surface colour, not shadow. Shadows appear only where a layer floats above content.

| Level | Token | Use |
|---|---|---|
| 0 | none | Cards resting on the canvas |
| 1 | `shadow-sm` | Dropdowns, hover lifts |
| 2 | `shadow-md` | Modals, popovers |

Any `shadow-<colour>` utility is a bug. Shadow colour is always neutral.

### Buttons

| State | Treatment |
|---|---|
| Default, on chrome | `bg-yellow-500 text-slate-900` — 9.31:1, ships today |
| Default, on canvas | `bg-amber-700 text-white` — 5.02:1, **not yet in code** |
| Hover | One step brighter: `yellow-400` (11.66:1) or `amber-800` |
| Active | `active:scale-[0.98]` over 75ms — **currently missing across the codebase** |
| Focus | `focus-visible:ring-2 ring-offset-2` in the surface accent |
| Disabled | Opacity 50%, cursor not-allowed, no ring |

### Focus

`focus:outline-none` is only ever legal when paired with a `focus-visible:` ring on the same element. 49 `focus-visible` occurrences already exist across 8 files and the `ui-taste-check` gate enforces the pairing. `focus-visible` and never `focus`, so a mouse click does not leave a ring behind.

### Motion

| Rule | Value |
|---|---|
| Duration | 150ms for colour, 200ms for transform |
| Easing | `ease-out` in, `ease-in-out` for loops |
| Scope | `transition-colors` by default; `transition-all` is banned |

Table rows, nav items, and buttons all change on hover today. The missing piece is the active press state.

## 6. Iconography

**react-icons, at version `^5.6.0`.** It is the only icon library in the project; twelve imports span four of its sets — `fa` (Font Awesome) ×8, `ci` (CoreUI) ×2, `bs` (Bootstrap) ×1, `sl` (Simple Line) ×1. Lucide is *not* installed. Standardising on it would mean adding a dependency and rewriting every import, so new work stays on `react-icons` and picks one set per surface rather than mixing four.

**Hard rules**

- Zero emoji as icons. Runtime scan found five: `🔥 ⚡ 💎 🏆` in `src/pages/Profile.tsx` and `⚠️` in `src/pages/Dashboard.tsx`.
- No sparkle or wand icons on AI-adjacent, upgrade, or "new" affordances.
- No generic profile pill of avatar plus truncated email plus a naked logout door.
- Icon-only controls carry an `aria-label`, never colour alone as the signal.
- Consolidating the four icon sets down to one is tracked as maintenance, not a gate.

**Domain entities.** Streaks, punctuality, and hour counts are real concepts and get real names. Placeholder names (`John Doe`, `Acme Inc`) are banned; seed data already uses realistic departments and job titles.

## 7. Anti-AI Taste Audit

`.agents/scripts/ui-taste-check.sh` result: **pass, 24 frontend files clean**.

The gate covers `focus:outline-none` without a `focus-visible` partner. It does not yet cover everything in this document, which is why the findings below are tracked rather than assumed.

### Findings to remediate

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | Accent used on the light canvas at 1.83:1 | 35 `text-yellow-500` occurrences | High |
| 2 | `slate-400` on light surfaces at 2.45:1 | 74 occurrences, charts and error states | High |
| 3 | Emoji used as icons | `Profile.tsx` ×4, `Dashboard.tsx` ×1 | Medium |
| 4 | No active press state anywhere | `active:scale` count is 0 | Medium |
| 5 | Borders at 1.42:1 | 4 `border-slate-300` | Medium |
| 6 | Radius sprawl, five values | `2xl` ×31, `lg` ×29, `xl` ×13, `full` ×6, `md` ×2 | Low |

Findings 1 and 2 need instance-by-instance triage, because yellow and `slate-400` are both correct on the chrome and wrong on the canvas. The fix is contextual, not a global find-and-replace.

## 8. Gate Rules

1. No frontend component or page is authored before this document is approved.
2. Every colour pair must be measured before it ships; the table in section 2 is the reference.
3. `ui-taste-check.sh` passes before any commit containing frontend files.
4. QA audits this document for contrast, accessibility, feasibility, and anti-AI compliance, and records the result.
5. Changes to tokens require an update here first, then in code.

---
*Approved by [Human Name] on [Date]*
