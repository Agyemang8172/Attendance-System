const STATUSES = ['EARLY', 'ON_TIME', 'LATE', 'OPEN_SESSION', 'CLOCK_OUT_MISSING', 'AUTO_CLOSED', 'ABSENT', 'REQUIRES_REVIEW']

export interface AttendanceFilters {
  startDate: string
  endDate: string
  status: string
  sessionStatus: string
  search: string
}

export const emptyAttendanceFilters: AttendanceFilters = {
  startDate: '', endDate: '', status: '', sessionStatus: '', search: '',
}

const dateValue = (value: string | null): string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : ''
}

export const readAttendanceContext = (search: string | URLSearchParams) => {
  const params = new URLSearchParams(search)
  const page = Number(params.get('page'))
  const filters: AttendanceFilters = {
    startDate: dateValue(params.get('startDate')),
    endDate: dateValue(params.get('endDate')),
    status: STATUSES.includes(params.get('status') ?? '') ? params.get('status')! : '',
    sessionStatus: ['OPEN', 'CLOSED'].includes(params.get('sessionStatus') ?? '') ? params.get('sessionStatus')! : '',
    search: (params.get('search') ?? '').slice(0, 100),
  }
  return { filters, page: Number.isSafeInteger(page) && page > 0 ? page : 1 }
}

export const attendanceContextQuery = (filters: AttendanceFilters, page: number): string => {
  const raw = new URLSearchParams({ ...filters, page: String(page) })
  const safe = readAttendanceContext(raw)
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(safe.filters)) if (value) params.set(key, value)
  if (safe.page > 1) params.set('page', String(safe.page))
  return params.toString()
}

export const attendanceReturnPath = (search: string): string => {
  const { filters, page } = readAttendanceContext(search)
  const query = attendanceContextQuery(filters, page)
  return `/staff/attendance${query ? `?${query}` : ''}`
}
