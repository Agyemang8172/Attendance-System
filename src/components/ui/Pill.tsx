// Pill — the one status/role pill primitive (M8-GAP-REGISTER A4).
//
// Three implementations shipped side by side, each with its own variant map:
//   ui/StatBadge.jsx        attendance session status, `/15` alpha tints that
//                           Tailwind silently drops on var() colours
//   StaffTable RolePill     role chips with the same broken `bg-x/15` grammar
//   Profile role chip       an inline re-typing of the role map
//
// Pill carries the one variant map instead, on the ground the soft-tint
// utilities in index.css already build with color-mix (bg-*-soft /
// border-*-soft) — the measured grounds the §5.4 status palette was designed
// against, and the ones that survive every surface (paper cards, sunken
// headers, chrome modals, the kiosk) instead of a transparent 12% tint that
// changes with whatever sits underneath (M1 §4.2, defect F8).
//
// This phase builds Pill only — StatBadge/RolePill callers migrate as each
// phase rewrites them (no callers re-pointed here, so touched screens stay
// visually identical).
//
// Statuses and roles still come from the backend; tone is presentation only.
// The status → tone mapping for attendance sessions, for when callers migrate:
//   OPEN → accent · CLOSED → success · LATE → warning · ABSENT → error
//   PRESENT → success · HALF_DAY → warning · ON_LEAVE → accent
// And roles: STAFF → neutral · HR → accent · SUPERADMIN → warning.

import type { ReactNode, ReactElement } from 'react'

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error'

export interface PillProps {
  /** Colour family. Defaults to the plain paper chip (no status claimed). */
  tone?: PillTone
  /** Mono caption text — the badge grammar shared by all three old pills. */
  mono?: boolean
  children: ReactNode
}

const toneClasses: Record<PillTone, string> = {
  neutral: 'bg-surface-2 border-hairline text-ink-muted',
  accent: 'bg-accent-soft border-accent-soft text-accent',
  success: 'bg-success-soft border-success-soft text-success',
  warning: 'bg-warning-soft border-warning-soft text-warning',
  error: 'bg-error-soft border-error-soft text-error',
}

const isStaticElement = (child: ReactNode): child is ReactElement =>
  typeof child === 'object' && child !== null && 'type' in child

// react-icons elements carry aria-hidden="true" themselves; a plain string
// needs no modelling. Both render inline as-is.
const Pill = ({ tone = 'neutral', mono = true, children }: PillProps) => (
  <span
    className={[
      'inline-flex items-center gap-1 px-2 py-[2px] rounded-full border',
      'text-caption font-medium',
      isStaticElement(children) && typeof children.type !== 'string'
        ? ''
        : mono
          ? 'font-mono'
          : 'font-sans',
      toneClasses[tone],
    ]
      .join(' ')
      .trim()}
  >
    {children}
  </span>
)

export default Pill
