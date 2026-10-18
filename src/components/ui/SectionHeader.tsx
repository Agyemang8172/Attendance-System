// SectionHeader — the h2 + small brass rule pattern, typed ~10× across the
// dashboards and Profile (e.g. Dashboard.tsx:257–260, HrDashboard.tsx:194–197).
//
// Size choice: the hand-typed copies used `text-body-sm` (14px) — the same size
// as table cells and body copy, so a section heading read as neither. This
// primitive renders h2 at `text-display-sm` (22px / weight 500), in the serif.
//
// Rationale (per the Phase 0 brief): display-sm is the scale's working-section
// step; it sits clearly under a display-lg page title and matches the
// dialog-title grammar already shipping (ResetPasswordModal, the ManageStaff
// confirms), so section titles and dialog titles share one step of the scale.
// display-md stays reserved for the page-title step — a section at page-title
// size would flatten the hierarchy.
//
// `actions` holds the right-side slot (e.g. the "3/4 earned" counter on
// Profile).

import type { ReactNode } from 'react'

export interface SectionHeaderProps {
  title: ReactNode
  actions?: ReactNode
}

const SectionHeader = ({ title, actions }: SectionHeaderProps) => (
  <div className="mb-4 flex items-center justify-between">
    <div>
      <h2 className="text-display-sm font-medium text-ink font-serif leading-tight">
        {title}
      </h2>
      <div className="mt-2 h-0.5 w-10 bg-accent opacity-40" />
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    )}
  </div>
)

export default SectionHeader
