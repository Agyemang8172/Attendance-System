// PageHeader — the page-title pattern that was hand-typed on every screen.
//
// One eyebrow (token type scale), one serif display title, one brass hairline.
// Consolidates the eight hand-typed copies (Dashboard.tsx:195–201,
// Profile.tsx:208–219, HrDashboard.tsx:151–162, SuperAdminDashboard,
// ManageStaff …) into the single approved grammar of M1 §6 headers.
//
//   eyebrow  → token `text-eyebrow` (closes M8-GAP-REGISTER A2: the hand-typed
//              `text-xs font-mono uppercase tracking-widest` variants are
//              retired in favour of the one token).
//   title    → serif display. Two sizes: 'hero' (display-xl) for the emotional
//              staff landing; 'page' (display-sm, the default) for working
//              screens — both already exist in the shipped pages.
//   actions  → optional right-side slot (buttons, live pills), bottom-aligned
//              with the title just as the Dashboard header did by hand.

import type { ReactNode } from 'react'

export interface PageHeaderProps {
  eyebrow: ReactNode
  title: ReactNode
  actions?: ReactNode
  /** 'hero' → text-display-xl · 'page' (default) → text-display-sm */
  size?: 'hero' | 'page'
}

const titleSizes: Record<NonNullable<PageHeaderProps['size']>, string> = {
  hero: 'text-display-xl text-ink font-serif',
  page: 'text-display-sm text-ink font-serif',
}

const PageHeader = ({ eyebrow, title, actions, size = 'page' }: PageHeaderProps) => (
  <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
    <div>
      <p className="text-eyebrow text-ink-muted mb-2">{eyebrow}</p>
      <h1 className={titleSizes[size]}>{title}</h1>
      {/* Accent divider — the ledger signature under every page title */}
      <div className="mt-4 h-0.5 w-20 bg-accent" />
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    )}
  </header>
)

export default PageHeader
