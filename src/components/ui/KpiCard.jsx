// KpiCard — white card with colored icon, MERIDIAN styled
// Props:
//   icon        → icon element, e.g. <FaClock />
//   label       → uppercase label, e.g. "Weekly Hours"
//   value       → the main number/string, e.g. "32.5"
//   subtext     → small text below value, e.g. "/ 40 hrs"
//   colorScheme → icon tint: "blue" | "gold" | "green" | "red"

const colorSchemes = {
  blue:  'bg-blue-50 border-blue-100 text-blue-500',
  gold:  'bg-yellow-50 border-yellow-100 text-yellow-500',
  green: 'bg-green-50 border-green-100 text-green-500',
  red:   'bg-red-50 border-red-100 text-red-500',
}

const KpiCard = ({ icon, label, value, subtext, colorScheme = 'gold' }) => {
  const iconClasses = colorSchemes[colorScheme] || colorSchemes.gold

  return (
    <div className="relative bg-white rounded-2xl p-6 flex flex-col gap-4 overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 group">

      {/* Corner bracket accent — MERIDIAN signature */}
      <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-yellow-500/40 rounded-tr-sm pointer-events-none" />

      {/* Icon box */}
      <div className={`p-3 rounded-xl border w-fit ${iconClasses}`}>
        <span className="text-xl block">{icon}</span>
      </div>

      {/* Label */}
      <div>
        <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-2">
          {label}
        </p>

        {/* Value — the hero of the card */}
        <p className="text-4xl font-bold text-slate-900 font-mono leading-none">
          {value}
        </p>

        {/* Subtext */}
        {subtext && (
          <p className="text-slate-400 text-xs font-sans mt-2">
            {subtext}
          </p>
        )}
      </div>

    </div>
  )
}

export default KpiCardimport { useState } from 'react'
import Sidebar from './Sidebar'
import { CiMenuBurger } from 'react-icons/ci'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile topbar — only visible below lg */}
      <div className="lg:hidden bg-slate-900 px-4 py-3 flex items-center gap-4 border-b border-slate-800">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-slate-400 hover:text-yellow-500 transition-colors text-xl"
        >
          <CiMenuBurger />
        </button>
        <span className="text-slate-100 text-sm font-bold font-serif tracking-wide">
          AttendPro
        </span>
      </div>

      {/* Page content — offset for sidebar on desktop */}
      <main className="lg:ml-64 min-h-screen flex flex-col">

        {/* MERIDIAN gold strip — runs across the top of every authenticated page */}
        <div className="h-0.5 w-full bg-gradient-to-r from-yellow-500 via-yellow-400/60 to-transparent" />

        <div className="flex-1 p-6 lg:p-10">
          {children}
        </div>

      </main>
    </div>
  )
}

export default Layout