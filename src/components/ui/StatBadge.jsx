// StatBadge — colored pill showing attendance status
// Receives one prop: status ("OPEN" | "CLOSED" | "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "ON_LEAVE")

const statusConfig = {
  open: {
    label: 'Open',
    classes: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  closed: {
    label: 'Closed',
    classes: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  present: {
    label: 'Present',
    classes: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  late: {
    label: 'Late',
    classes: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  },
  absent: {
    label: 'Absent',
    classes: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  half_day: {
    label: 'Half Day',
    classes: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  },
  on_leave: {
    label: 'On Leave',
    classes: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
}

const StatBadge = ({ status }) => {
  // Normalise to lowercase for lookup (backend returns uppercase enums)
  const key = (status || '').toLowerCase()
  const config = statusConfig[key] || {
    label: status || 'Unknown',
    classes: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  }

  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        rounded-full
        border
        text-xs font-medium font-mono
        ${config.classes}
      `}
    >
      {config.label}
    </span>
  )
}

export default StatBadge