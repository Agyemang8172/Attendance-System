// FilterBar — the composable filter container the portal screens will slot
// their date ranges and selects into (M1 §6 names `FilterBar` among the
// shared primitives; A7 closes the duplicate per-screen hand-typing).
//
// Minimal by design this phase: a named group around caller-provided children
// — each screen still owns its controls; owning the layout means the
// responsive gate can hold one grammar (wrapped row, one gap rhythm) instead
// of N private variants.

import type { ReactNode } from 'react'

export interface FilterBarProps {
  /** Announced by the group, e.g. "Attendance filters". */
  label: string
  children: ReactNode
  className?: string
}

const FilterBar = ({ label, children, className = '' }: FilterBarProps) => (
  <div
    role="group"
    aria-label={label}
    className={`flex flex-wrap items-end gap-3 mb-4 ${className ? className : ''}`}
  >
    {children}
  </div>
)

export default FilterBar
