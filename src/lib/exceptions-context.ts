export const EXCEPTIONS_PAGE_SIZE = 12
export interface ExceptionsContext { startDate: string; endDate: string; page: number }

export function exceptionDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : ''
}
export function exceptionsRangeError(startDate: string, endDate: string) {
  if (!exceptionDate(startDate) || !exceptionDate(endDate)) return 'Choose valid From and To dates.'
  if (endDate < startDate) return 'The To date must be on or after the From date.'
  const days = (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000
  return days > 190 ? 'Choose a range with no more than 190 days between its dates.' : ''
}
export function readExceptionsContext(search: string | URLSearchParams): ExceptionsContext {
  const params = new URLSearchParams(search)
  const page = Number(params.get('page'))
  return {
    startDate: exceptionDate(params.get('startDate')), endDate: exceptionDate(params.get('endDate')),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}
export function exceptionsQuery(context: ExceptionsContext) {
  if (exceptionsRangeError(context.startDate, context.endDate)) return ''
  const params = new URLSearchParams({ startDate: context.startDate, endDate: context.endDate })
  if (Number.isSafeInteger(context.page) && context.page > 1) params.set('page', String(context.page))
  return `?${params}`
}
export function exceptionsRequest(context: ExceptionsContext) {
  const params = new URLSearchParams(exceptionsQuery(context).slice(1))
  params.set('page', String(context.page)); params.set('limit', String(EXCEPTIONS_PAGE_SIZE))
  return `/reports/exceptions?${params}`
}
export function exceptionAttendancePath(id: string, context: ExceptionsContext) {
  const params = new URLSearchParams(exceptionsQuery(context).slice(1))
  params.set('origin', 'exceptions')
  return `/hr-attendance/${encodeURIComponent(id)}?${params}`
}
export function exceptionsReturnPath(search: string) {
  const params = new URLSearchParams(search)
  const context = readExceptionsContext(params)
  return params.get('origin') === 'exceptions' && !exceptionsRangeError(context.startDate, context.endDate)
    ? `/hr-exceptions${exceptionsQuery(context)}` : null
}
