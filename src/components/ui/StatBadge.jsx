// StatBadge — Linear styled status pill
// Receives one prop: status ("OPEN" | "CLOSED" | "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "ON_LEAVE")

const statusConfig = {
  open: {
    label: 'Open',
    classes: 'bg-accent/15 text-accent border-accent/20',
  },
  closed: {
    label: 'Closed',
    classes: 'bg-success/15 text-success border-success/20',
  },
  present: {
    label: 'Present',
    classes: 'bg-success/15 text-success border-success/20',
  },
  late: {
    label: 'Late',
    classes: 'bg-warning/15 text-warning border-warning/20',
  },
  absent: {
    label: 'Absent',
    classes: 'bg-error/15 text-error border-error/20',
  },
  half_day: {
    label: 'Half Day',
    classes: 'bg-warning/15 text-warning border-warning/20',
  },
  on_leave: {
    label: 'On Leave',
    classes: 'bg-accent/15 text-accent border-accent/20',
  },
}

const StatBadge = ({ status }) => {
  // Normalise to lowercase for lookup (backend returns uppercase enums)
  const key = (status || '').toLowerCase()
  const config = statusConfig[key] || {
    label: status || 'Unknown',
    classes: 'bg-ink-subtle/15 text-ink-subtle border-ink-subtle/20',
  }

  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-[2px]
        rounded-full
        border
        text-caption font-medium font-mono
        ${config.classes}
      `}
    >
      {config.label}
    </span>
  )
}

export default StatBadge