// KPI bento primitives — §10.2 R10 of docs/DESIGN_PROPOSAL.md.
//
// The four-identical-card row becomes an asymmetric bento: one hero card
// spanning two columns carries the day's primary figure and its action
// (the clock), and two dense cards hold the secondary metrics.
//
// Exports:
//   KpiHero  → the 2-column hero. `children` slot for the action + live pill.
//   KpiCard  → dense secondary metric card.

const iconTints = {
  accent: 'bg-accent-soft border-accent-soft text-accent',
  success: 'bg-success-soft border-success-soft text-success',
  warning: 'bg-warning-soft border-warning-soft text-warning',
  error: 'bg-error-soft border-error-soft text-error',
}

export const KpiHero = ({ eyebrow, value, unit, subtext, children }) => (
  <div className="relative card-elevated overflow-hidden lg:col-span-2 flex flex-col sm:flex-row sm:items-center gap-6">
    {/* Corner bracket — ledger signature */}
    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />

    <div>
      <p className="text-caption text-ink-muted">{eyebrow}</p>
      <p className="mt-1 font-mono text-display-lg text-ink leading-none tracking-[-0.5px]">
        {value}
        {unit && <span className="ml-1.5 text-body-sm font-sans text-ink-muted">{unit}</span>}
      </p>
      {subtext && <p className="mt-1.5 text-body-sm text-ink-subtle">{subtext}</p>}
    </div>

    {children && <div className="sm:ml-auto flex flex-wrap items-center gap-3">{children}</div>}
  </div>
)

const KpiCard = ({ icon, label, value, subtext, scheme = 'accent' }) => {
  const tint = iconTints[scheme] || iconTints.accent
  const iconBox = (
    <span className={`flex items-center justify-center w-9 h-9 rounded-lg border ${tint}`}>
      {icon}
    </span>
  )

  return (
    <div className="card relative overflow-hidden flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-caption text-ink-muted truncate">{label}</p>
        <p className="mt-1 font-mono text-display-md text-ink leading-none tracking-[-0.5px]">
          {value}
        </p>
        {subtext && <p className="mt-1 text-caption text-ink-subtle truncate">{subtext}</p>}
      </div>
      {iconBox}
    </div>
  )
}

export default KpiCard