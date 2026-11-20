// attendance-format — the shared presentation layer of the dashboards
// (M8-GAP-REGISTER A6), extracted from the copies on the HR/SuperAdmin/
// staff screens of HrDashboard.tsx, Dashboard.tsx, AttendanceTable.jsx and
// Schedule.jsx.
//
// ─── What this lib MUST NOT do ────────────────────────────────────────────────
//
// Statuses come from the backend. This lib formats and summarises records the
// API already carries; it does NOT decide an employee's status. The old
// client-side heuristics — `isLate` flagging any clock-in ≥ 06:30, and the
// "Attendance Rate" dividing a month's closed sessions by a hardcoded 22
// working days — were client-side status inventions and stay OUT of this
// module. They return (server-computed, authoritative) with the later M8
// phases whenever a screen actually needs them.
//
// Everything here is presentation-safe: date/time/locale formatting and
// chart-data shapes the recharts components already consume.
//
// Timezone note (carried from the screens it comes from): records carry ISO
// timestamps; today-boundaries are computed in the viewer's local time, exactly
// as the screens did, until the M8 reworks move boundary questions to the API.

import type { ChartDataPoint, SessionChartPoint } from '../types'

// ─── Day helpers ──────────────────────────────────────────────────────────────

/** True when the record's date is today, in the viewer's local time. */
export const isToday = (dateStr: string): boolean => {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

/** "Friday, 17 October 2026" — the greeting/date line under every page eyebrow. */
export const formatTodayLong = (): string =>
  new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// ─── Record field formatting ─────────────────────────────────────────────────
//
// Input is intentionally structural: any record object from the API. The
// caller's own typed shape (AttendanceRecord, corrections rows, schedules)
// satisfies this by construction.

export interface TimeLike {
  date?: string
  clockIn?: string | null
  clockOut?: string | null
  hoursWorked?: number | null
}

/** "17 Oct 2026" — the ledger date cell. Empty input reads as "--". */
export const formatShortDate = (dateStr?: string | null): string => {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** "07:12" (or the locale's)-"" two-part time of day. Empty input reads as "--". */
export const formatTimeOfDay = (dateStr?: string | null): string => {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "7.25" / "7.50" as "7.25 hrs". Absent or zero reads as "--". */
export const formatHoursValue = (hours?: number | null): string => {
  if (hours == null || hours === 0) return '--'
  return `${Number(hours).toFixed(2)} hrs`
}

// ─── Chart builders ──────────────────────────────────────────────────────────
//
// Both build from data that already carries backend statuses. No client-side
// status heuristics live here (see the file header).
//
// Minimal structural types for a chart record.

export interface ChartRecord extends TimeLike {
  date: string
  hoursWorked?: number | null
  sessionStatus?: string
  status?: string
}

/**
 * Bar chart: org/staff hours per day over the trailing 7 days.
 * Shape matches `ChartDataPoint` (HoursChart).
 */
export const buildHoursChartData = (
  records: ChartRecord[]
): ChartDataPoint[] => {
  const days: ChartDataPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const label = d.toLocaleDateString('en-GB', { weekday: 'short' })
    const dateStr = d.toDateString()
    const total = records
      .filter((r) => new Date(r.date).toDateString() === dateStr)
      .reduce((sum, r) => sum + (r.hoursWorked || 0), 0)
    days.push({ day: label, hours: parseFloat(total.toFixed(1)) })
  }
  return days
}

/**
 * Donut chart: open / closed / late counts over the trailing 7 days.
 * Shape matches `SessionChartPoint` (SessionsChart).
 *
 * Reads the LATE state from `status` — the backend-authoritative attendance
 * status (see the file header). Records without one fall back to the session
 * status, so open rows still count while their day is unresolved.
 */
export const buildSessionsChartData = (
  records: ChartRecord[]
): SessionChartPoint[] => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const week = records.filter((r) => new Date(r.date) >= sevenDaysAgo)
  const isLateState = (r: ChartRecord): boolean =>
    (r.status || '').toUpperCase() === 'LATE'
  const closed = week.filter(
    (r) => r.sessionStatus === 'CLOSED' && !isLateState(r)
  ).length
  const late = week.filter(
    (r) => r.sessionStatus === 'CLOSED' && isLateState(r)
  ).length
  const open = week.filter((r) => r.sessionStatus === 'OPEN').length
  return [
    { name: 'CLOSED', value: closed },
    { name: 'LATE', value: late },
    { name: 'OPEN', value: open },
  ].filter((s) => s.value > 0)
}
