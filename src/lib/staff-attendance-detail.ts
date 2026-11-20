export interface StaffAttendanceRecord {
  id: string
  userId: string
  date?: string | null
  clockIn?: string | null
  clockOut?: string | null
  hoursWorked?: number | null
  status?: string | null
  sessionStatus?: string | null
  closureReason?: string | null
  requiresReviewReason?: string | null
  remarks?: string | null
  shiftNameSnapshot?: string | null
  shiftStartMinuteSnapshot?: number | null
  shiftEndMinuteSnapshot?: number | null
  shiftCrossesMidnightSnapshot?: boolean | null
  timezoneSnapshot?: string | null
  graceEarlyMinutesSnapshot?: number | null
  graceLateMinutesSnapshot?: number | null
  policySnapshot?: Record<string, unknown> | null
  checkInLat?: number | null
  checkInLng?: number | null
  user?: { employeeCode?: string; firstName?: string; lastName?: string } | null
  createdByKiosk?: { label?: string; publicId?: string } | null
}

export const attendanceLabels: Record<string, string> = {
  EARLY: 'Early', ON_TIME: 'On time', LATE: 'Late', OPEN_SESSION: 'Open session',
  CLOCK_OUT_MISSING: 'Clock-out missing', AUTO_CLOSED: 'Automatically closed',
  ABSENT: 'Absent', REQUIRES_REVIEW: 'Requires review',
}

export const validRecordedTimezone = (zone?: string | null): string | undefined => {
  if (!zone) return undefined
  try { new Intl.DateTimeFormat('en-GB', { timeZone: zone }).format(); return zone } catch { return undefined }
}

export const recordedDate = (value?: string | null): string => {
  const key = value?.slice(0, 10)
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return 'Not recorded'
  const date = new Date(`${key}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) return 'Unavailable'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export const recordedTime = (value?: string | null, zone?: string): string => {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Unavailable'
  if (!zone) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone,
  }).format(date)
}

export const recordedMinute = (value?: number | null): string =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1440
    ? `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` : 'Not recorded'

export const recordedNumber = (value: unknown, suffix = ''): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${value}${suffix}` : 'Not recorded'

export const recordedHours = (record: StaffAttendanceRecord): string => {
  if (record.sessionStatus === 'OPEN') return 'Not final while session is open'
  return typeof record.hoursWorked === 'number' && Number.isFinite(record.hoursWorked)
    ? `${record.hoursWorked.toFixed(2)} hrs` : 'Not recorded'
}

export const closureLabel = (value?: string | null): string => {
  const labels: Record<string, string> = {
    VERIFIED_CLOCK_OUT: 'Verified clock-out', AUTO_CLOCK_OUT: 'Automatic clock-out',
    HR_ASSISTED: 'HR-assisted', CORRECTION: 'Correction', ABSENT_NO_SHOW: 'Recorded no-show',
  }
  return value ? labels[value] ?? 'Unavailable' : 'Not recorded'
}
