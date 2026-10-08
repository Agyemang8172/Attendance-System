// KpiCard — Linear styled card for key metrics
// Props:
//   icon        → icon element, e.g. <FaClock />
//   label       → uppercase label, e.g. "Weekly Hours"
//   value       → the main number/string, e.g. "32.5"
//   subtext     → small text below value, e.g. "/ 40 hrs target"
//   colorScheme → accent color for icon: "blue" | "gold" | "green" | "red"

const colorSchemes = {
  blue:  { bg: 'bg-accent/10', border: 'border-accent/20', icon: 'text-accent' },
  gold:  { bg: 'bg-warning/10', border: 'border-warning/20', icon: 'text-warning' },
  green: { bg: 'bg-success/10', border: 'border-success/20', icon: 'text-success' },
  red:   { bg: 'bg-error/10', border: 'border-error/20', icon: 'text-error' },
}

const KpiCard = ({ icon, label, value, subtext, colorScheme = 'gold' }) => {
  const scheme = colorSchemes[colorScheme] || colorSchemes.gold

  return (
    <div className={`card relative overflow-hidden ${scheme.bg} ${scheme.border}`}>

      {/* Corner bracket — Linear signature */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />

      {/* Icon box */}
      <div className={`p-3 rounded-lg border w-fit bg-surface-2 ${scheme.icon} ${scheme.border}`}>
        <span className="text-xl block">{icon}</span>
      </div>

      {/* Label */}
      <div>
        <p className="text-eyebrow text-ink-muted mb-2">
          {label}
        </p>

        {/* Value — the hero of the card */}
        <p className="text-display-sm font-medium text-ink font-mono leading-none">
          {value}
        </p>

        {/* Subtext */}
        {subtext && (
          <p className="text-caption text-ink-muted font-sans mt-2">
            {subtext}
          </p>
        )}
      </div>

    </div>
  )
}

export default KpiCard