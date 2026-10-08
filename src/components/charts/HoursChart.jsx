import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Custom tooltip — Linear styled
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-elevated border-accent/20 rounded-lg px-3 py-2">
        <p className="text-ink-muted text-xs font-sans mb-1">{label}</p>
        <p className="text-accent text-sm font-mono font-medium">
          {payload[0].value} hrs
        </p>
      </div>
    )
  }
  return null
}

// Expects records: array of attendance objects from getMyAttendance
// Each record has: clockInTime, clockOutTime, hoursWorked, sessionStatus
const HoursChart = ({ records = [] }) => {

  // Build last 7 days labels
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return {
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateStr: date.toISOString().split('T')[0],
    }
  })

  // Map records to days — match by date string
  const data = last7Days.map(({ label, dateStr }) => {
    const match = records.find((r) => {
      const recordDate = new Date(r.clockInTime).toISOString().split('T')[0]
      return recordDate === dateStr
    })
    return {
      day: label,
      hours: match?.hoursWorked
        ? parseFloat(match.hoursWorked.toFixed(1))
        : 0,
    }
  })

  return (
    <div className="relative card-elevated overflow-hidden border-accent/20">

      {/* Corner bracket */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />

      {/* Header */}
      <p className="text-ink-muted text-xs font-medium uppercase tracking-wider font-sans mb-4">
        Hours Worked — Last 7 Days
      </p>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={28}>
          <CartesianGrid
            strokeDasharray="33"
            stroke="var(--hairline)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--ink-subtle)', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--ink-subtle)', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            unit="h"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar
            dataKey="hours"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HoursChart