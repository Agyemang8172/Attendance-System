import { attendanceLabels } from './staff-attendance-detail'

export const HR_PAGE_SIZE = 12
export const hrClassifications = Object.keys(attendanceLabels)
export interface HrAttendanceContext { startDate: string; endDate: string; status: string; sessionStatus: string; page: number }
export const emptyHrContext: HrAttendanceContext = { startDate: '', endDate: '', status: '', sessionStatus: '', page: 1 }
function dateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : ''
}
export function readHrAttendanceContext(search: string | URLSearchParams): HrAttendanceContext {
  const params = new URLSearchParams(search)
  const page = Number(params.get('page'))
  return {
    startDate: dateKey(params.get('startDate')), endDate: dateKey(params.get('endDate')),
    status: hrClassifications.includes(params.get('status') || '') ? params.get('status')! : '',
    sessionStatus: ['OPEN', 'CLOSED'].includes(params.get('sessionStatus') || '') ? params.get('sessionStatus')! : '',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}
export function hrAttendanceQuery(context: HrAttendanceContext) {
  const safe = readHrAttendanceContext(new URLSearchParams(Object.entries(context).map(([key, value]) => [key, String(value)])))
  const params = new URLSearchParams()
  for (const key of ['startDate', 'endDate', 'status', 'sessionStatus'] as const) if (safe[key]) params.set(key, safe[key])
  if (safe.page > 1) params.set('page', String(safe.page))
  const query = params.toString()
  return query ? `?${query}` : ''
}
export function hrAttendanceParams(context: HrAttendanceContext) {
  const params = new URLSearchParams({ page: String(context.page), limit: String(HR_PAGE_SIZE) })
  if (context.startDate) params.set('startDate', `${context.startDate}T00:00:00.000Z`)
  if (context.endDate) params.set('endDate', `${context.endDate}T23:59:59.999Z`)
  if (context.status) params.set('status', context.status)
  if (context.sessionStatus) params.set('sessionStatus', context.sessionStatus)
  return params.toString()
}
export const hrAttendanceReturnPath = (search: string) => `/hr-attendance${hrAttendanceQuery(readHrAttendanceContext(search))}`
