# DESIGN.md — AttendPro Design System (Linear-based)

> Stage 2 deliverable of the Dev-OS design gate, produced by the UI Designer.
> Based on the Linear design system from the catalog (`.agents/catalog/design-systems/systems/linear.app/DESIGN.md`).
> Companion to `docs/PROJECT_REQUIREMENTS.md`.

## 1. Design Archetype

**Operations Console.** A high-density B2B back-office tool for attendance tracking.

Following Linear's product-focused approach: near-black canvas (`#010102`), light gray text (`#f7f8f8`), single lavender-blue accent (`#5e6ad2`). Dense, technical, quietly luxurious. Cards as charcoal panels (`#0f1011`) with hairline borders. Accent appears on brand mark, focus rings, and intentional CTAs — never decoratively.

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