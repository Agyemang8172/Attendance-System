// StatBadge — colored pill showing attendance status
// Receives one prop: status ("open" | "closed" | "late" | "absent")

const statusConfig = {
  open: {
    label: 'Open',
    classes: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  closed: {
    label: 'Closed',
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
}

const StatBadge = ({ status }) => {
  // Fallback for unknown or missing status
  const config = statusConfig[status] || {
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