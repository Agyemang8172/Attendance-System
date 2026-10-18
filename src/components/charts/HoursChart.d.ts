// Type declaration for HoursChart.jsx — the org-hours bar chart.
import type { ChartDataPoint } from '../../types'

export interface HoursChartProps {
  data: ChartDataPoint[]
}

declare const HoursChart: import('react').FC<HoursChartProps>

export default HoursChart
