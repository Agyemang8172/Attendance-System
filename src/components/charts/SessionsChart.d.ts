// Type declaration for SessionsChart.jsx — the session-breakdown donut.
import type { SessionChartPoint } from '../../types'

export interface SessionsChartProps {
  data: SessionChartPoint[]
}

declare const SessionsChart: import('react').FC<SessionsChartProps>

export default SessionsChart
