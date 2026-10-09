// StatBadge — §8.5 status pill.
// Tinted ground from the §5.4 status palette, pill radius, mono caption,
// sentence-case label ("Late", not "LATE").
// Receives status: "OPEN" | "CLOSED" | "PRESENT" | "LATE" | "ABSENT" |
//                 "HALF_DAY" | "ON_LEAVE"

const statusConfig = {
  open: {
    label: 'Open',
    classes: 'bg-accent-soft border-accent-soft text-accent',
  },
  closed: {
    label: 'Closed',
    classes: 'bg-success-soft border-success-soft text-success',
  },
  present: {
    label: 'Present',
    classes: 'bg-success-soft border-success-soft text-success',
  },
  late: {
    label: 'Late',
    classes: 'bg-warning-soft border-warning-soft text-warning',
  },
  absent: {
    label: 'Absent',
    classes: 'bg-error-soft border-error-soft text-error',
  },
  half_day: {
    label: 'Half Day',
    classes: 'bg-warning-soft border-warning-soft text-warning',
  },
  on_leave: {
    label: 'On Leave',
    classes: 'bg-accent-soft border-accent-soft text-accent',
  },
}

const StatBadge = ({ status }) => {
  // Normalise to lowercase for lookup (backend returns uppercase enums)
  const key = (status || '').toLowerCase()
  const config = statusConfig[key] || {
    label: status || 'Unknown',
    classes: 'bg-surface-2 border-hairline text-ink-muted',
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