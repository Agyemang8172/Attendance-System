import { EXCEPTIONS_PAGE_SIZE } from './exceptions-context'

interface ExceptionEmployee { firstName: string | null; lastName: string | null; employeeCode: string | null }
interface ExceptionBase { id: string; date: string | null; employee: ExceptionEmployee | null; reason: string | null }
export interface AttendanceException extends ExceptionBase { kind: 'ATTENDANCE'; status: string | null; sessionStatus: string | null }
export interface AttemptException extends ExceptionBase {
  kind: 'ATTEMPT'; action: string | null; outcome: string | null; step: string | null
  kiosk: string | null; site: string | null; locationResult: string | null
}
export type ExceptionRecord = AttendanceException | AttemptException
type JsonRow = Record<string, unknown>
function row(value: unknown): JsonRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unconfirmed exceptions response')
  return value as JsonRow
}
const text = (value: unknown) => typeof value === 'string' ? value : null
function employee(value: unknown): ExceptionEmployee | null {
  if (value == null) return null
  const source = row(value)
  return { firstName: text(source.firstName), lastName: text(source.lastName), employeeCode: text(source.employeeCode) }
}
function readException(value: unknown): ExceptionRecord {
  const source = row(value)
  if (typeof source.id !== 'string' || !source.id) throw new Error('Unconfirmed exception identity')
  const base = { id: source.id, date: text(source.date), employee: employee(source.employee), reason: text(source.reason) }
  if (source.kind === 'ATTENDANCE') return { ...base, kind: 'ATTENDANCE', status: text(source.status), sessionStatus: text(source.sessionStatus) }
  if (source.kind !== 'ATTEMPT') throw new Error('Unconfirmed exception kind')
  return {
    ...base, kind: 'ATTEMPT', action: text(source.action), outcome: text(source.outcome), step: text(source.step),
    kiosk: text(source.kiosk), site: text(source.site), locationResult: text(source.locationResult),
  }
}
export function readExceptions(value: unknown, requestedPage: number) {
  const source = row(value)
  const pagination = row(source.pagination)
  if (source.success !== true || !Array.isArray(source.data) || !Number.isSafeInteger(pagination.total) || (pagination.total as number) < 0 || pagination.currentPage !== requestedPage) throw new Error('Unconfirmed exceptions page')
  const total = pagination.total as number
  const totalPages = Math.ceil(total / EXCEPTIONS_PAGE_SIZE)
  if (pagination.totalPages !== totalPages || source.data.length > EXCEPTIONS_PAGE_SIZE || source.data.length > total) throw new Error('Inconsistent exceptions count')
  return { records: source.data.map(readException), total, page: requestedPage, totalPages: Math.max(1, totalPages) }
}
export const exceptionEmployeeName = (record: ExceptionRecord) =>
  [record.employee?.firstName, record.employee?.lastName].filter(Boolean).join(' ') || 'Unidentified employee'

export const attemptAction = (value: string | null) => value === 'CLOCK_IN' ? 'Clock in' : value === 'CLOCK_OUT' ? 'Clock out' : value ? 'Unavailable' : 'Not recorded'
export const attemptOutcome = (value: string | null) => value === 'SUCCESS' ? 'Successful attempt' : value === 'REJECTED' ? 'Rejected' : 'Unavailable'
export const attemptStep = (value: string | null) => value ? value.replace(/_/g, ' ') : 'Not recorded'
