import type { PillTone } from '../components/ui/Pill'

export const CORRECTION_QUEUE = '/hr-corrections'
export const CORRECTION_PAGE_SIZE = 12
export const correctionStatuses = ['SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const
export const reviewTiers = ['SAME_DAY', 'ESCALATED'] as const
export const backstopConditions = ['UNCLAIMED_24H', 'CONFLICT_OF_INTEREST', 'EXPLICIT_HANDOFF'] as const
export type CorrectionStatus = typeof correctionStatuses[number]
export type ReviewTier = typeof reviewTiers[number]
export type BackstopCondition = typeof backstopConditions[number]
export type Decision = 'APPROVED' | 'REJECTED'

export const statusLabels: Record<CorrectionStatus, string> = {
  SUBMITTED: 'Submitted', APPROVED: 'Approved', REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn',
}
export const statusTones: Record<CorrectionStatus, PillTone> = {
  SUBMITTED: 'accent', APPROVED: 'success', REJECTED: 'error', WITHDRAWN: 'neutral',
}
export const tierLabels: Record<ReviewTier, string> = { SAME_DAY: 'Same day', ESCALATED: 'Escalated' }
export const backstopLabels: Record<BackstopCondition, string> = {
  UNCLAIMED_24H: 'Unclaimed after 24 hours',
  CONFLICT_OF_INTEREST: 'Conflict of interest',
  EXPLICIT_HANDOFF: 'Explicit handoff',
}

type Json = Record<string, unknown>
type Person = { id: string | null; name: string | null }
export interface CorrectionSnapshot {
  clockIn: string | null
  clockOut: string | null
  status: string | null
  sessionStatus: string | null
  closureReason: string | null
  hoursWorked: number | null
}

export interface ReviewerCorrection {
  id: string
  requester: Person
  employee: Person
  date: string | null
  requestedAt: string | null
  reason: string | null
  status: CorrectionStatus
  reviewTier: ReviewTier
  original: CorrectionSnapshot | null
  proposedClockIn: string | null
  proposedClockOut: string | null
  approved: CorrectionSnapshot | null
  decisionNote: string | null
  decidedAt: string | null
}

export interface CorrectionContext { status: CorrectionStatus | ''; reviewTier: ReviewTier | ''; page: number }

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T)
}

export function readCorrectionContext(search: string): CorrectionContext {
  const params = new URLSearchParams(search)
  const status = params.get('status')
  const reviewTier = params.get('reviewTier')
  const page = Number(params.get('page'))
  return {
    status: isOneOf(correctionStatuses, status) ? status : '',
    reviewTier: isOneOf(reviewTiers, reviewTier) ? reviewTier : '',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

export function correctionQuery(context: CorrectionContext) {
  const params = new URLSearchParams()
  if (context.status) params.set('status', context.status)
  if (context.reviewTier) params.set('reviewTier', context.reviewTier)
  if (context.page > 1) params.set('page', String(context.page))
  return params.size ? '?' + params.toString() : ''
}

function objectValue(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unconfirmed response')
  return value as Json
}

const stringValue = (value: unknown) => typeof value === 'string' && value.trim() ? value : null

function person(value: unknown): Person {
  const row = value == null ? {} : objectValue(value)
  const name = [stringValue(row.firstName), stringValue(row.lastName)].filter(Boolean).join(' ')
  return { id: stringValue(row.id), name: name || null }
}

function snapshot(value: unknown): CorrectionSnapshot | null {
  if (value == null) return null
  const row = objectValue(value)
  return {
    clockIn: stringValue(row.clockIn), clockOut: stringValue(row.clockOut),
    status: stringValue(row.status), sessionStatus: stringValue(row.sessionStatus),
    closureReason: stringValue(row.closureReason),
    hoursWorked: typeof row.hoursWorked === 'number' && Number.isFinite(row.hoursWorked) ? row.hoursWorked : null,
  }
}

function readCorrection(value: unknown): ReviewerCorrection {
  const row = objectValue(value)
  const id = stringValue(row.id)
  if (!id || !isOneOf(correctionStatuses, row.status) || !isOneOf(reviewTiers, row.reviewTier)) {
    throw new Error('Unconfirmed correction')
  }
  const attendance = row.attendance == null ? {} : objectValue(row.attendance)
  return {
    id, status: row.status, reviewTier: row.reviewTier,
    requester: person(row.requestedBy), employee: person(attendance.user),
    date: stringValue(attendance.date), requestedAt: stringValue(row.requestedAt),
    reason: stringValue(row.reason), original: snapshot(row.originalValues),
    proposedClockIn: stringValue(row.proposedClockIn), proposedClockOut: stringValue(row.proposedClockOut),
    approved: snapshot(row.approvedValues), decisionNote: stringValue(row.decisionNote), decidedAt: stringValue(row.decidedAt),
  }
}

export function readCorrectionQueue(value: unknown, page: number) {
  const response = objectValue(value)
  const pagination = objectValue(response.pagination)
  const { total, totalPages, currentPage } = pagination
  if (response.success !== true || !Array.isArray(response.data) || currentPage !== page ||
    typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 ||
    totalPages !== Math.ceil(total / CORRECTION_PAGE_SIZE) ||
    response.data.length > Math.min(total, CORRECTION_PAGE_SIZE)) throw new Error('Unconfirmed queue')
  return { rows: response.data.map(readCorrection), total, totalPages, page }
}

export function readCorrectionDetail(value: unknown, id: string) {
  const response = objectValue(value)
  if (response.success !== true) throw new Error('Unconfirmed detail')
  const row = readCorrection(response.data)
  if (row.id !== id) throw new Error('Unconfirmed correction')
  return row
}

export function confirmCorrectionDecision(value: unknown, id: string, decision: Decision) {
  const response = objectValue(value)
  const row = objectValue(objectValue(response.data).correction)
  if (response.success !== true || row.id !== id || row.status !== decision) throw new Error('Unconfirmed decision')
}

export function readBackstopCondition(value: string): BackstopCondition | '' {
  return isOneOf(backstopConditions, value) ? value : ''
}

export function correctionDate(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date)
}

export const evidenceLabel = (value: string | null) => value ? value.replace(/_/g, ' ').toLowerCase() : 'Not recorded'
