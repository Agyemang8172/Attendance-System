import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

// Session status colours — §5.4 status palette. Open reads as "live" (accent),
// closed as on-track (success), late as attention (warning).
const STATUS_COLORS = {
  OPEN: 'var(--accent)',
  CLOSED: 'var(--success)',
  LATE: 'var(--warning)',
}

const SessionsChart = ({ data = [] }) => {
  const chartData = data.filter((d) => d.value > 0)

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 border border-dashed border-hairline-strong rounded-lg">
        <p className="text-ink-subtle text-body-sm font-sans">
          No session data for this period
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={STATUS_COLORS[entry.name] || 'var(--ink-subtle)'}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ paddingTop: 20 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-elevated rounded-lg px-3 py-2">
        <p className="text-caption text-ink-muted mb-1">{payload[0].name}</p>
        <p className="font-mono text-body-sm font-medium text-ink">
          {payload[0].value} sessions
        </p>
      </div>
    )
  }
  return null
}

export default SessionsChart