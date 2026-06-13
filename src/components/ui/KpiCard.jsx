// KpiCard — navy metric card with colored icon, MERIDIAN styled
// Props:
//   icon        → icon element, e.g. <FaClock />
//   label       → uppercase label, e.g. "Weekly Hours"
//   value       → the main number/string, e.g. "32.5"
//   subtext     → small text after value, e.g. "/ 40 hrs"
//   colorScheme → icon tint: "blue" | "gold" | "green" | "red"

const colorSchemes = {
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  gold: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
  green: 'bg-green-500/10 border-green-500/20 text-green-400',
  red: 'bg-red-500/10 border-red-500/20 text-red-400',
}

const KpiCard = ({ icon, label, value, subtext, colorScheme = 'gold' }) => {
  const iconClasses = colorSchemes[colorScheme] || colorSchemes.gold

  return (
    <div className="relative bg-slate-900 rounded-2xl p-6 flex items-center gap-4 overflow-hidden">

      {/* Corner bracket accent — MERIDIAN signature */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-yellow-500 opacity-30 rounded-tr-sm pointer-events-none" />

      {/* Icon box — tinted per colorScheme */}
      <div className={`p-3 rounded-xl border shrink-0 ${iconClasses}`}>
        <span className="text-xl block">{icon}</span>
      </div>

      {/* Label + value */}
      <div className="min-w-0">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider font-sans">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-100 font-mono mt-0.5">
          {value}
          {subtext && (
            <span className="text-sm font-normal text-slate-500 ml-1 font-sans">
              {subtext}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default KpiCard