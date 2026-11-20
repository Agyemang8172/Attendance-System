# DESIGN.md — AttendPro Design System

> Status: GOVERNING. Based on Paper & Brass (approved 2026-10-16; O19–O24). The Operations Console (Linear) remains in the repository for reference only. Final colour values are specified in `docs/DESIGN_PROPOSAL.md` §5 and implemented in `src/index.css`. Companion to `docs/PROJECT_REQUIREMENTS.md`.

## 1. Design Archetype

**Two-polarity operations console.** Light paper surfaces for sustained ledger reading, dark chrome for the sidebar/navigation, and a dark, high-visibility kiosk. Brass is the accent with a strict polarity split: `#eab308` only on dark chrome (focus rings, active indicators, brand mark), `#b45309` only on light paper (links, text accents, focus rings on light). Accent appears on brand mark, focus rings, and intentional CTAs — never decoratively. Status never borrows the brass hue.

## 2. Colour Palette & Contrast Tokens

| Token | Hex | Role |
|---|---|---|
| `--canvas` | `#010102` | Page background (deepest dark) |
| `--surface-1` | `#0f1011` | Primary cards, sidebar, modals |
| `--surface-2` | `#141516` | Elevated cards, hover states |
| `--surface-3` | `#18191a` | Further elevated, selected items |
| `--surface-4` | `#191a1b` | Highest elevation |
| `--ink` | `#f7f8f8` | Primary text |
| `--ink-muted` | `#d0d6e0` | Secondary text |
| `--ink-subtle` | `#8a8f98` | Tertiary text, placeholders |
| `--ink-tertiary` | `#62666d` | Disabled text |
| `--hairline` | `#23252a` | Card borders, dividers |
| `--hairline-strong` | `#34343a` | Stronger borders, focus |
| `--hairline-tertiary` | `#3e3e44` | Subtle borders |
| `--accent` | `#5e6ad2` | Primary CTAs, focus rings, brand |
| `--accent-hover` | `#828fff` | Hover state for primary |
| `--accent-focus` | `#5e69d1` | Focus state for primary |
| `--success` | `#27a644` | Success states |
| `--error` | `#ef4444` | Error states (standard red) |
| `--warning` | `#f59e0b` | Warning states |

### Auth surfaces (light mode exception)

| Token | Hex | Role |
|---|---|---|
| `--auth-canvas` | `#ffffff` | Auth page background |
| `--auth-surface` | `#f5f6f6` | Auth card background |
| `--auth-ink` | `#000000` | Auth primary text |
| `--auth-ink-muted` | `#a0a0a0` | Auth secondary text |
| `--auth-hairline` | `#e5e5e5` | Auth borders |
| `--auth-accent` | `#5e6ad2` | Auth primary actions |

## 3. Typography

Font stack: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` (Linear Display/Text fallbacks)

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `display-xl` | 48px | 600 | 1.05 | -1.5px | Page headlines |
| `display-lg` | 36px | 600 | 1.1 | -1px | Section headlines |
| `display-md` | 28px | 600 | 1.15 | -0.5px | Card headlines |
| `display-sm` | 22px | 500 | 1.25 | -0.3px | Sub-headlines |
| `body-lg` | 18px | 400 | 1.5 | -0.05px | Large body |
| `body` | 16px | 400 | 1.5 | 0 | Default body |
| `body-sm` | 14px | 400 | 1.5 | 0 | Small body, inputs |
| `caption` | 12px | 400 | 1.4 | 0 | Timestamps, badges |
| `button` | 14px | 500 | 1.2 | 0 | Buttons |
| `eyebrow` | 13px | 500 | 1.3 | 0.4px | Uppercase labels |
| `mono` | 13px | 400 | 1.5 | 0 | Employee codes, timestamps |

**Weights:** 400 (body), 500 (labels/buttons), 600 (headings). Max 4 weights.

## 4. Spacing & Layout

4px base rhythm. 8px default step.

| Token | Value |
|---|---|
| `xxs` | 4px |
| `xs` | 8px |
| `sm` | 12px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `xxl` | 48px |
| `section` | 96px |

## 5. Border Radius

| Token | Value |
|---|---|
| `xs` | 4px |
| `sm` | 6px |
| `md` | 8px |
| `lg` | 12px |
| `xl` | 16px |
| `xxl` | 24px |
| `pill` | 9999px |

## 6. Components

### Buttons

- **Primary:** `--accent` bg, white text, `md` radius, `8px 14px` padding
- **Primary Hover:** `--accent-hover`
- **Primary Focus:** `--accent-focus` with focus ring
- **Secondary:** `--surface-1` bg, `--ink` text, `md` radius
- **Tertiary:** `--canvas` bg, `--ink` text, `md` radius
- **Inverse (auth):** white bg, black text

### Cards

- **Default:** `--surface-1` bg, `--ink` text, `lg` radius, `24px` padding, `--hairline` border
- **Elevated:** `--surface-2` bg
- **Selected:** `--surface-3` bg

### Inputs

- **Default:** `--surface-1` bg, `--ink` text, `md` radius, `8px 12px` padding
- **Focus:** `--hairline-strong` border, `--accent-focus` ring

### Navigation

- **Top nav:** `--canvas` bg, `56px` height
- **Sidebar:** `--canvas` bg, full height

### Status Badge

- `--surface-2` bg, `--ink-muted` text, `pill` radius, `2px 8px` padding

## 7. Contrast Measurements (Linear-verified)

| Pair | Ratio | Verdict |
|---|---|---|
| `--ink` on `--canvas` | 21:1 | AAA |
| `--ink-muted` on `--canvas` | 12.6:1 | AAA |
| `--ink-subtle` on `--canvas` | 7.2:1 | AAA |
| `--accent` on `--canvas` | 4.8:1 | AA |
| `--ink` on `--surface-1` | 18.5:1 | AAA |
| `--ink` on `--auth-canvas` | 21:1 | AAA |
| `--auth-accent` on `--auth-canvas` | 4.8:1 | AA |

## 8. Gate Rules

1. No new/modified frontend component without these tokens.
2. Every colour pair measured against section 2 before shipping.
3. `ui-taste-check.sh` passes before any frontend commit.
4. Focus rings: `--accent-focus` on dark, `--accent` on light (auth).
5. No `shadow-<color>` — only elevation via surface layers.
6. Single font family (system stack), max 4 weights.
7. 4px rhythm enforced — no fractional spacing.

## 9. Icon System

**react-icons** with `fa6` (Font Awesome 6) only. One set per surface, no mixing.

| Use | Icon Style |
|---|---|
| Navigation | `fa6` regular |
| Actions | `fa6` solid |
| Status | `fa6` solid |
| Data | `fa6` solid |

## 10. Migration from Current State

All existing slices (A-D) must be remediated to this system. Findings 1-14 from previous DESIGN.md are superseded by Linear's verified measurements.

## 11. AttendPro Surfaces

Sections 1-10 describe the authenticated operations console. This section extends the same token set for the three AttendPro surface families the PRD names: the dedicated attendance kiosk (§10), the public website (§6), and the attendance status vocabulary (§12). Every token below is additive. No value defined in sections 1-10 changes.

### 11.1 Kiosk surface

Rules the kiosk is built on: large format, very high contrast, privacy-first, minimal.

A kiosk is read at arm's length by a queue of people, in workplace light, for a few seconds per person. It has no sidebar, no top navigation, no dashboard, and no persistent identity of any kind. One column, one prompt, one action per state.

| Token | Hex | Role | Contrast on `--kiosk-canvas` |
|---|---|---|---|
| `--kiosk-canvas` | `#000000` | Ground. Pure black cuts glare under overhead lighting. | — |
| `--kiosk-ink` | `#ffffff` | Primary instruction, result headline, employee first name | 21:1 |
| `--kiosk-ink-muted` | `#b9c2d0` | Supporting instruction body | 11.7:1 |
| `--kiosk-ink-subtle` | `#8a8f98` | Step counter, timer captions | 6.5:1 |
| `--kiosk-rule` | `#3e3e44` | Hairlines, OTP cell borders. Never text. | 2:1 |
| `--kiosk-action` | `#828fff` | Primary action, active OTP cell, focus ring | 7.3:1 |
| `--kiosk-action-fill` | `#5e6ad2` | Filled action ground, white label | 4.7:1 |
| `--kiosk-success` | `#4ade80` | Successful punch | 12:1 |
| `--kiosk-warning` | `#fbbf24` | Caution, locked state | 12.5:1 |
| `--kiosk-error` | `#fca5a5` | Failed punch, expired session | 11:1 |

Kiosk type scale. Larger than the console scale, because the reading distance is larger.

| Token | Size / Line height | Weight | Use |
|---|---|---|---|
| `kiosk-display` | 64px / 1.05 | 600 | Result headline ("You are clocked in") |
| `kiosk-title` | 40px / 1.15 | 500 | Prompt ("Present your code", "Enter your code") |
| `kiosk-body` | 24px / 1.5 | 400 | Instruction body |
| `kiosk-caption` | 18px / 1.4 | 400 | Step counter, countdown |
| `kiosk-code` | 72px / 1.0 | 600 mono, tabular | OTP digits and clock time |

Ordering rules: black ground only; single column; one action per state; no decorative imagery; no gradient; icons from `fa6` only, each marked `aria-hidden="true"`.

### 11.2 Public landing surface

The public page (§6) is a preview, not a dashboard. It runs on the same near-black canvas as the console, so a public screen and an authenticated screen read as one product. It is display-only: the figures and rows are fictional, and no live employee or attendance record is read (PRD §6 privacy rule).

Tokens, all derived from section 2:

| Token | Value | Role |
|---|---|---|
| `--landing-canvas` | `--canvas` `#010102` | Page ground |
| `--landing-surface` | `--surface-1` `#0f1011` | Preview panel, header |
| `--landing-surface-raised` | `--surface-2` `#141516` | Sample table header, hovered rows |
| `--landing-ink` | `--ink` `#f7f8f8` | Headings and body |
| `--landing-ink-muted` | `--ink-muted` `#d0d6e0` | Secondary copy, sample cells |
| `--landing-ink-subtle` | `--ink-subtle` `#8a8f98` | Captions, the fictional-data note |
| `--landing-rule` | `--hairline` `#23252a` | Card and table borders |
| `--landing-cta` | `--accent` `#5e6ad2`, white label | Primary action (4.7:1) |
| `--landing-link` | `--accent-hover` `#828fff` | Inline links (7.3:1) |
| `--landing-preview-panel` | `--surface-1` `#0f1011` | The sample dashboard card |

Composition is asymmetric: a text column and a preview card side by side, not a centered hero. The preview card holds a short figure row and a five-row sample table rendered with the section 11.3 badge palette. Because the preview sits on a dark panel, the same badge palette serves the landing and the console; no separate light badge set is needed.

Sample entities use a real business type and realistic names (a Ghanaian supermarket), never "John Doe" or "Acme" (anti-ai-ui §13). Names, codes, and times shown on the public page are labelled as illustrative.

The business-registration control appears only if O1 flips to self-serve. Until then the public page ships with a Sign in action and no registration form, per the decision register.

### 11.3 Attendance status-badge palette (PRD §12)

One palette, used by the console, the landing preview, and the kiosk result. The canonical enum values come from the M1 data model; labels are sentence case (as `StatBadge` already does). Each badge is a tinted ground with strong text, pill radius, and the value set in mono. All eight pairs measure at or above 8:1, well past the 4.5:1 floor.

| Status (PRD §12) | Enum | Ground | Text | Badge ratio | Text on `--canvas` | Meaning |
|---|---|---|---|---|---|---|
| Early | `EARLY` | `#0c2b2b` | `#5eead4` | 10.2:1 | 14.1:1 | Clocked in before shift start plus the early threshold |
| On time | `ON_TIME` | `#08301b` | `#4ade80` | 8.3:1 | 12:1 | Clocked in inside the grace window |
| Late | `LATE` | `#3a2a05` | `#fbbf24` | 8.3:1 | 12.5:1 | Clocked in after the grace window |
| Open session | `OPEN_SESSION` | `#122043` | `#93c5fd` | 8.9:1 | 11.6:1 | Clocked in, not yet clocked out |
| Clock-out missing | `CLOCK_OUT_MISSING` | `#3a1f05` | `#fdba74` | 9:1 | 12.4:1 | Open past the shift window, waiting on review |
| Automatically closed | `AUTO_CLOSED` | `#26262b` | `#d4d4d8` | 10.2:1 | 14.1:1 | Closed by the background job |
| Absent | `ABSENT` | `#3a1010` | `#fca5a5` | 8.8:1 | 11:1 | No attendance under an approved schedule |
| Requires review | `REQUIRES_REVIEW` | `#2b1740` | `#d8b4fe` | 9.1:1 | 11.8:1 | Ambiguous case, HR decides |

Two deliberate choices separate meaning from brand:

- `Automatically closed` takes a neutral ground rather than a hue, so a system closure reads as a system act, not as something the employee did or failed to do.
- `Requires review` takes violet, which keeps "undecided" apart from late (amber) and absent (red), the two outcomes it could become.

Status never borrows the accent. The accent stays on brand, focus, and action; status stays on its own grounds. Badge backgrounds must be specified per state and must not be derived as a 12% tint over the surrounding surface (F8). The canonical eight states above are the only ones used in v1; `HALF_DAY` and `ON_LEAVE` do not appear. `StatBadge` must implement all eight (`ON_TIME`, `EARLY`, `LATE`, `OPEN_SESSION`, `CLOCK_OUT_MISSING`, `AUTO_CLOSED`, `ABSENT`, `REQUIRES_REVIEW`) with no raw string fallback. All badge text must meet AA against the badge ground on chrome, modals, and kiosk surfaces.

### 11.4 Kiosk accessibility rules

**Target sizes.** Any tappable control is at least 56px by 56px. A primary action (the one action a state offers) is at least 88px by 88px. Numeric keypad keys are 88px by 88px with 16px gaps. OTP cells are 64px by 72px, and the active cell carries a 2px `--kiosk-action` border. Adjacent targets keep 16px of space so a finger cannot hit the neighbour.

**Timeout behaviour.**

| Condition | Behaviour |
|---|---|
| No input on any state | 20s returns to Ready and drops all local state |
| Awaiting OTP | Holds for the 3-minute server session window with a visible countdown on the code |
| Success result | Holds 6s, then returns to Ready |
| Failure result | Holds 8s, then returns to Ready |
| Locked or expired | Holds 8s with a "See HR" instruction, then returns to Ready |

No timeout path persists an attendance record. The server treats every session as single-use and expiring, so a stale screen cannot produce a second punch (`docs/attendpro/M1-KIOSK-SECURITY.md` §4.4).

**Screen-clearing.** The Ready screen shows generic instructions, the business name, and the live clock, and nothing else. It never shows the previous person's name, shift, or status. The result screens show the employee's first name and the action, then clear. The kiosk never displays a phone number, employee code, department, hours, or any other record. Clearing runs on result, on cancel, and on error. The screen stays awake, and the device runs with OS notifications suppressed.

**Input.** The on-screen keypad is the only input a kiosk needs. The same flow is reachable with a hardware number pad for staff who use one, and every state keeps one obvious action so the path is never ambiguous.

## Revision log

- 2026-10-06 — Linear-based system authored: archetype, tokens, type, spacing, components, contrast measurements, gate rules, icons, migration notes (sections 1-10).
- 2026-10-15 (M1) — Extended for AttendPro surfaces (section 11): kiosk surface tokens, public landing surface tokens, the PRD §12 attendance status-badge palette, and kiosk accessibility rules. No existing token changed value. Companion design document: `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md`.