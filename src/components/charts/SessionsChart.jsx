import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

// Custom tooltip — MERIDIAN styled
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-yellow-500/20 rounded-lg px-3 py-2">
        <p className="text-slate-400 text-xs font-sans mb-1">{label}</p>
        <p className="text-yellow-500 text-sm font-mono font-medium">
          {payload[0].value} sessions
        </p>
      </div>
    )
  }
  return null
}

// Color mapping for session statuses
const STATUS_COLORS = {
  OPEN: '#3b82f6',      // blue-500
  CLOSED: '#22c55e',    // green-500
  LATE: '#eab308',      // yellow-500
}

const SessionsChart = ({ data = [] }) => {
  // Ensure we have valid data
  const chartData = data.filter(d => d.value > 0)

  if (chartData.length === 0) {
    return (
      <div className="relative bg-slate-900 rounded-2xl p-6 overflow-hidden flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm font-sans">No session data for this period</p>
      </div>
    )
  }

  return (
    <div className="relative bg-slate-900 rounded-2xl p-6 overflow-hidden">

      {/* Corner bracket */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-yellow-500 opacity-30 rounded-tr-sm pointer-events-none" />

      {/* Header */}
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider font-sans mb-4">
        Session Breakdown — This Week
      </p>

      {/* Chart */}
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
              <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#64748b'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            formatter={(name) => name}
            wrapperStyle={{ paddingTop: 20 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SessionsChart