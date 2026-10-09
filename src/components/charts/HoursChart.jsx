import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Custom tooltip — ledger styled
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-elevated rounded-lg px-3 py-2">
        <p className="text-ink-muted text-caption mb-1">{label}</p>
        <p className="text-accent font-mono text-body-sm font-medium">
          {payload[0].value} hrs
        </p>
      </div>
    )
  }
  return null
}

// HoursChart — org hours per day.
// Expects `data`: [{ day: 'Mon', hours: 8.0 }, …] — the page builds the
// aggregation; this component only plots it.
const HoursChart = ({ data = [] }) => {
  return (
    <div className="relative">
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
          <Bar dataKey="hours" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HoursChart