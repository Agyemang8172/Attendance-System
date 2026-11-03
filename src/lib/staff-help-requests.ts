import type { PillTone } from '../components/ui/Pill'

export const helpStatuses = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'] as const
export type HelpStatus = typeof helpStatuses[number]
export interface HelpRequest {
  id: string; category: string; subject: string; body: string; status: HelpStatus
  createdAt: string | null; updatedAt: string | null; resolutionNote: string | null; resolvedAt: string | null
}
export interface HelpList { requests: HelpRequest[]; page: number; totalPages: number; total: number }
export const helpLabels: Record<HelpStatus, string> = { OPEN: 'Open', IN_REVIEW: 'In review', RESOLVED: 'Resolved', CLOSED: 'Closed' }
export const helpTones: Record<HelpStatus, PillTone> = { OPEN: 'warning', IN_REVIEW: 'accent', RESOLVED: 'success', CLOSED: 'neutral' }
const categories: Record<string, string> = { pin: 'PIN Issue', kiosk: 'Kiosk Problem', profile: 'Profile Issue', access: 'Access Problem', other: 'Other' }
export const helpCategory = (category: string) => categories[category] || 'Category unavailable'

export function readHelpContext(search: string) {
  const params = new URLSearchParams(search)
  const value = params.get('status') || ''
  const status = helpStatuses.includes(value as HelpStatus) ? value as HelpStatus : ''
  const candidate = Number(params.get('page'))
  return { status, page: Number.isSafeInteger(candidate) && candidate > 0 ? candidate : 1 }
}
export function helpQuery(status: string, page: number) {
  const params = new URLSearchParams()
  if (helpStatuses.includes(status as HelpStatus)) params.set('status', status)
  if (Number.isSafeInteger(page) && page > 1) params.set('page', String(page))
  return params.toString() ? `?${params}` : ''
}
export function helpReturnPath(search: string) {
  const { status, page } = readHelpContext(search)
  return `/staff/help-requests${helpQuery(status, page)}`
}
function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unconfirmed response')
  return value as Record<string, unknown>
}
const optionalText = (value: unknown) => typeof value === 'string' && value ? value : null
export function readHelpRequest(value: unknown): HelpRequest {
  const row = objectValue(value)
  if (typeof row.id !== 'string' || !row.id || typeof row.subject !== 'string' || typeof row.body !== 'string'
    || typeof row.category !== 'string' || !helpStatuses.includes(row.status as HelpStatus)) throw new Error('Unconfirmed response')
  return { id: row.id, category: row.category, subject: row.subject, body: row.body, status: row.status as HelpStatus,
    createdAt: optionalText(row.createdAt), updatedAt: optionalText(row.updatedAt),
    resolutionNote: optionalText(row.resolutionNote), resolvedAt: optionalText(row.resolvedAt) }
}
export function readOwnHelpRequest(value: unknown, id: string, ownerId: string) {
  const response = objectValue(value)
  const row = objectValue(response.data)
  if (response.success !== true || row.id !== id || row.requesterId !== ownerId) throw new Error('Unconfirmed response')
  return readHelpRequest(row)
}
export function readHelpList(value: unknown): HelpList {
  const response = objectValue(value)
  const pagination = objectValue(response.pagination)
  const { currentPage, totalPages, total } = pagination
  if (response.success !== true || !Array.isArray(response.data) || typeof currentPage !== 'number'
    || !Number.isSafeInteger(currentPage) || currentPage < 1 || typeof totalPages !== 'number'
    || !Number.isSafeInteger(totalPages) || totalPages < 0 || typeof total !== 'number'
    || !Number.isSafeInteger(total) || total < 0) throw new Error('Unconfirmed response')
  return { requests: response.data.map(readHelpRequest), page: currentPage, totalPages, total }
}
export function helpTimestamp(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(date)
}
