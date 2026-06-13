import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Custom tooltip — MERIDIAN styled
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-yellow-500/20 rounded-lg px-3 py-2">
        <p className="text-slate-400 text-xs font-sans mb-1">{label}</p>
        <p className="text-yellow-500 text-sm font-mono font-medium">
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
    <div className="relative bg-slate-900 rounded-2xl p-6 overflow-hidden">

      {/* Corner bracket */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-yellow-500 opacity-30 rounded-tr-sm pointer-events-none" />

      {/* Header */}
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider font-sans mb-4">
        Hours Worked — Last 7 Days
      </p>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={28}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1e293b"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            unit="h"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
          <Bar
            dataKey="hours"
            fill="#eab308"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HoursChart