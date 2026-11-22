import type { StaffAttendanceRecord } from './staff-attendance-detail'
import { HR_PAGE_SIZE } from './hr-attendance-context'

export type OperationalAttendance = StaffAttendanceRecord & { user?: { firstName?: string; lastName?: string; employeeCode?: string; department?: string } | null }
type JsonRow = Record<string, unknown>
function row(value: unknown): JsonRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid attendance response')
  return value as JsonRow
}
const text = (value: unknown) => typeof value === 'string' ? value : null
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
function policy(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as JsonRow
  const safe: JsonRow = {}
  for (const key of ['versionNumber', 'graceEarlyMinutes', 'graceLateMinutes', 'autoClockOutBufferMinutes', 'autoClockOutMaxOpenMinutes', 'correctionWindowDays']) safe[key] = number(source[key])
  safe.effectiveFrom = text(source.effectiveFrom)
  safe.autoClockOutEnabled = typeof source.autoClockOutEnabled === 'boolean' ? source.autoClockOutEnabled : null
  return safe
}
export function readOperationalAttendance(value: unknown): OperationalAttendance {
  const source = row(value)
  if (typeof source.id !== 'string' || !source.id || typeof source.userId !== 'string' || !source.userId) throw new Error('Unconfirmed attendance record')
  const safe: OperationalAttendance = { id: source.id, userId: source.userId }
  for (const key of ['date', 'clockIn', 'clockOut', 'status', 'sessionStatus', 'closureReason', 'requiresReviewReason', 'remarks', 'shiftNameSnapshot', 'timezoneSnapshot'] as const) safe[key] = text(source[key])
  for (const key of ['hoursWorked', 'shiftStartMinuteSnapshot', 'shiftEndMinuteSnapshot', 'graceEarlyMinutesSnapshot', 'graceLateMinutesSnapshot', 'checkInLat', 'checkInLng'] as const) safe[key] = number(source[key])
  safe.shiftCrossesMidnightSnapshot = typeof source.shiftCrossesMidnightSnapshot === 'boolean' ? source.shiftCrossesMidnightSnapshot : null
  safe.policySnapshot = policy(source.policySnapshot)
  if (source.user && typeof source.user === 'object' && !Array.isArray(source.user)) {
    const user = source.user as JsonRow
    safe.user = { firstName: text(user.firstName) || undefined, lastName: text(user.lastName) || undefined, employeeCode: text(user.employeeCode) || undefined, department: text(user.department) || undefined }
  }
  if (source.createdByKiosk && typeof source.createdByKiosk === 'object' && !Array.isArray(source.createdByKiosk)) safe.createdByKiosk = { label: text((source.createdByKiosk as JsonRow).label) || undefined }
  return safe
}
export function readOperationalList(value: unknown, requestedPage: number) {
  const source = row(value)
  if (source.success !== true || !Array.isArray(source.data) || !Number.isSafeInteger(source.total) || (source.total as number) < 0 || source.page !== requestedPage || source.count !== source.data.length) throw new Error('Unconfirmed attendance list')
  const records = source.data.map(readOperationalAttendance)
  if (records.length > HR_PAGE_SIZE || records.length > (source.total as number)) throw new Error('Inconsistent attendance count')
  return { records, total: source.total as number, page: requestedPage, totalPages: Math.max(1, Math.ceil((source.total as number) / HR_PAGE_SIZE)) }
}
export function readOperationalDetail(value: unknown, id: string) {
  const source = row(value)
  if (source.success !== true) throw new Error('Unconfirmed attendance record')
  const record = readOperationalAttendance(source.data)
  if (record.id !== id) throw new Error('Unconfirmed attendance record')
  return record
}
export const employeeName = (record: OperationalAttendance) => [record.user?.firstName, record.user?.lastName].filter(Boolean).join(' ') || 'Employee name unavailable'

export const operationalStatusTone = (status?: string | null) => status === 'ABSENT' ? 'error' : ['EARLY', 'ON_TIME'].includes(status || '') ? 'success' : ['LATE', 'CLOCK_OUT_MISSING', 'REQUIRES_REVIEW'].includes(status || '') ? 'warning' : 'neutral'
