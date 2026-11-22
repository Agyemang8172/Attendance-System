import { readHelpList, readHelpRequest, type HelpRequest, type HelpStatus } from './staff-help-requests'

export const HR_HELP_PAGE_SIZE = 12
export const HR_HELP_QUEUE = '/hr-help-requests'

export type ReviewStatus = Exclude<HelpStatus, 'OPEN'>

export const reviewActions: Record<HelpStatus, readonly ReviewStatus[]> = {
  OPEN: ['IN_REVIEW', 'RESOLVED', 'CLOSED'],
  IN_REVIEW: ['RESOLVED', 'CLOSED'],
  RESOLVED: [],
  CLOSED: [],
}

export const reviewLabels: Record<ReviewStatus, string> = {
  IN_REVIEW: 'Start review',
  RESOLVED: 'Resolve',
  CLOSED: 'Close',
}

export interface HrHelpRequest extends HelpRequest {
  requester: { name: string | null; email: string | null }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unconfirmed response')
  return value as Record<string, unknown>
}

const optionalText = (value: unknown) => typeof value === 'string' && value.trim() ? value : null

function readRequester(value: unknown): HrHelpRequest['requester'] {
  const row = objectValue(value)
  const requester = row.requester == null ? {} : objectValue(row.requester)
  const name = [optionalText(requester.firstName), optionalText(requester.lastName)].filter(Boolean).join(' ')
  return { name: name || null, email: optionalText(requester.email) }
}

export function readBusinessHelpList(value: unknown, page: number) {
  const response = objectValue(value)
  const metadata = readHelpList(response)
  if (metadata.page !== page || metadata.totalPages !== Math.ceil(metadata.total / HR_HELP_PAGE_SIZE)
    || metadata.requests.length > HR_HELP_PAGE_SIZE || metadata.requests.length > metadata.total) {
    throw new Error('Unconfirmed pagination')
  }
  const rows = response.data as unknown[]
  const requests = metadata.requests.map((request, index) => ({ ...request, requester: readRequester(rows[index]) }))
  return { ...metadata, requests }
}

export function readBusinessHelpDetail(value: unknown, id: string) {
  const response = objectValue(value)
  if (response.success !== true) throw new Error('Unconfirmed response')
  const request = readHelpRequest(response.data)
  if (request.id !== id) throw new Error('Unconfirmed request')
  return { ...request, requester: readRequester(response.data) }
}

export function confirmHelpTransition(value: unknown, id: string, status: ReviewStatus) {
  const response = objectValue(value)
  const row = objectValue(response.data)
  if (response.success !== true || row.id !== id || row.status !== status) throw new Error('Unconfirmed update')
}
