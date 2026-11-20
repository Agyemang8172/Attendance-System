import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import StaffHelpRequests from '../pages/StaffHelpRequests'
import StaffHelpRequestDetail from '../pages/StaffHelpRequestDetail'
import StaffHelpRequestNew from '../pages/StaffHelpRequestNew'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

const id = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const owner = { id: 'staff-owner', email: 'staff@example.test', firstName: 'Ama', lastName: 'Mensah', role: 'STAFF', mustChangePassword: false }
const item = {
  id, requesterId: owner.id, businessId: 'own-business', category: 'kiosk',
  subject: 'Terminal scanner assistance', body: 'The terminal camera needs attention.',
  status: 'OPEN', resolutionNote: null, resolvedAt: null,
  assignedToId: 'internal-assignee', createdAt: '2026-11-03T08:15:00.000Z', updatedAt: '2026-11-03T08:15:00.000Z',
}
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const detail = (data: Record<string, unknown> = item) => ({ data: { success: true, data } })
const listing = (data: Record<string, unknown>[] = [item], total = 25, page = 1) => ({
  data: { success: true, data, pagination: { currentPage: page, totalPages: Math.ceil(total / 12), total } },
})
function view(path = '/staff/help-requests') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/staff/help-requests" element={<StaffHelpRequests />} />
    <Route path="/staff/help-requests/new" element={<StaffHelpRequestNew />} />
    <Route path="/staff/help-requests/:id" element={<><StaffHelpRequestDetail /><Link to={`/staff/help-requests/${otherId}`}>Another fixture request</Link></>} />
  </Routes></MemoryRouter>)
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('token', 'isolated-session')
  localStorage.setItem('user', JSON.stringify(owner))
  get.mockImplementation(async url => String(url).includes(`/help-requests/${id}`) ? detail() : listing())
})

describe('Staff Help list contract', () => {
  it('uses pagination.total, retains the supported status/page and never sends unsupported search', async () => {
    get.mockResolvedValue(listing([item], 25, 2))
    view('/staff/help-requests?status=IN_REVIEW&page=2&search=ignored')
    expect(await screen.findByText(item.subject)).toBeInTheDocument()
    expect(screen.getByText(/25 requests/i)).toBeInTheDocument()
    expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Filter by status/i)).toHaveValue('IN_REVIEW')
    const url = new URL(String(get.mock.calls[0][0]), 'http://local.test')
    expect(url.searchParams.get('status')).toBe('IN_REVIEW')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.has('search')).toBe(false)
    expect(screen.queryByRole('textbox', { name: /search requests/i })).not.toBeInTheDocument()
  })
  it('pages with the same supported status and resets to page one when status changes', async () => {
    get.mockImplementation(async url => listing([item], 25, Number(new URL(String(url), 'http://local.test').searchParams.get('page')) || 1))
    view('/staff/help-requests?status=OPEN&page=2')
    await screen.findByText(item.subject)
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(get.mock.calls.some(([url]) => /page=3/.test(String(url)) && /status=OPEN/.test(String(url)))).toBe(true))
    await userEvent.selectOptions(screen.getByLabelText(/Filter by status/i), 'RESOLVED')
    await waitFor(() => expect(get.mock.calls.some(([url]) => /page=1/.test(String(url)) && /status=RESOLVED/.test(String(url)))).toBe(true))
  })
  it('keeps list/detail return context across direct navigation and ignores arbitrary redirect keys', async () => {
    view(`/staff/help-requests/${id}?status=IN_REVIEW&page=2&returnTo=https://untrusted.example`)
    await screen.findByText(item.body)
    const back = screen.getByRole('link', { name: /Back to Help Requests/i })
    const target = new URL(back.getAttribute('href')!, 'http://local.test')
    expect(target.pathname).toBe('/staff/help-requests')
    expect(target.searchParams.get('status')).toBe('IN_REVIEW')
    expect(target.searchParams.get('page')).toBe('2')
    expect(target.searchParams.has('returnTo')).toBe(false)
    await userEvent.click(back)
    expect(await screen.findByLabelText(/Filter by status/i)).toHaveValue('IN_REVIEW')
  })
  it('uses real detail links and keeps New Request on the existing creation route', async () => {
    view()
    await screen.findByText(item.subject)
    expect(screen.getByRole('link', { name: `View help request: ${item.subject}` })).toHaveAttribute('href', expect.stringContaining(`/staff/help-requests/${id}`))
    expect(screen.getByRole('link', { name: /New Request/i })).toHaveAttribute('href', '/staff/help-requests/new')
  })
  it('distinguishes successful filtered-empty results from a first-request empty state', async () => {
    get.mockResolvedValue(listing([], 0))
    view('/staff/help-requests?status=CLOSED')
    expect(await screen.findByText(/no .*match/i)).toBeInTheDocument()
    expect(screen.queryByText(/no help requests yet/i)).not.toBeInTheDocument()
  })
  it('shows a genuine empty queue after a successful read', async () => {
    get.mockResolvedValue(listing([], 0))
    view()
    expect(await screen.findByText(/no help requests yet/i)).toBeInTheDocument()
  })
  it('shows an inline list failure and retries without claiming an empty queue', async () => {
    get.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(listing())
    view()
    await screen.findByRole('alert')
    expect(screen.queryByText(/no help requests yet/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Try again/i }))
    expect(await screen.findByText(item.subject)).toBeInTheDocument()
  })
  it('does not present an incomplete pagination response as a successful zero total', async () => {
    get.mockResolvedValue({ data: { success: true, data: [item] } })
    view()
    await screen.findByRole('alert')
    expect(screen.queryByText(/0 requests/i)).not.toBeInTheDocument()
  })
  it('ignores a late list result after changing the status filter', async () => {
    const pending = deferred<ReturnType<typeof listing>>()
    get.mockReturnValueOnce(pending.promise).mockResolvedValue(listing([{ ...item, subject: 'Current review request', status: 'IN_REVIEW' }]))
    view()
    await userEvent.selectOptions(screen.getByLabelText(/Filter by status/i), 'IN_REVIEW')
    expect(await screen.findByText('Current review request')).toBeInTheDocument()
    await act(async () => { pending.resolve(listing([{ ...item, subject: 'Stale open request' }])) })
    expect(screen.queryByText('Stale open request')).not.toBeInTheDocument()
  })
})

describe('Staff Help detail evidence', () => {
  it.each([['OPEN', 'Open'], ['IN_REVIEW', 'In review'], ['RESOLVED', 'Resolved'], ['CLOSED', 'Closed']])('displays factual %s state without invented history', async (status, label) => {
    get.mockResolvedValue(detail({ ...item, status }))
    view(`/staff/help-requests/${id}`)
    expect(await screen.findByText(item.body)).toBeInTheDocument()
    expect(screen.getAllByText(label, { exact: true }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Resolution Timeline/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Resolved By/i)).not.toBeInTheDocument()
    expect(screen.queryByText(item.assignedToId)).not.toBeInTheDocument()
  })
  it('shows the actual flat resolution note and timestamp', async () => {
    get.mockResolvedValue(detail({ ...item, status: 'RESOLVED', resolutionNote: 'Scanner settings checked.', resolvedAt: '2026-11-03T09:20:00.000Z' }))
    view(`/staff/help-requests/${id}`)
    expect(await screen.findByText('Scanner settings checked.')).toBeInTheDocument()
    expect(screen.getAllByText(/UTC/).length).toBeGreaterThan(0)
  })
  it('does not fabricate resolution evidence for a closed request with no note/time', async () => {
    get.mockResolvedValue(detail({ ...item, status: 'CLOSED' }))
    view(`/staff/help-requests/${id}`)
    await screen.findByText(item.body)
    expect(screen.queryByText(/Resolved By|Resolution Timeline|Updates will appear/i)).not.toBeInTheDocument()
  })
  it('renders user-supplied content as text', async () => {
    const content = '<img src=x onerror=alert(1)>'
    get.mockResolvedValue(detail({ ...item, body: content }))
    view(`/staff/help-requests/${id}`)
    expect(await screen.findByText(content)).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })
  it('loads detail directly without fetching the list first', async () => {
    view(`/staff/help-requests/${id}`)
    await screen.findByText(item.body)
    expect(get.mock.calls[0][0]).toBe(`/staff/help-requests/${id}`)
    expect(get.mock.calls.some(([url]) => String(url).includes('?'))).toBe(false)
  })
  it.each([403, 404])('shows the detail refusal for HTTP %s', async status => {
    get.mockRejectedValue({ response: { status } })
    view(`/staff/help-requests/${id}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 403 ? /permission|access/i : /not found/i)
  })
  it('shows loading then retries a failed detail read', async () => {
    const pending = deferred<ReturnType<typeof detail>>()
    get.mockReturnValueOnce(pending.promise).mockResolvedValue(detail())
    view(`/staff/help-requests/${id}`)
    expect(screen.getByRole('status')).toHaveTextContent(/Loading/i)
    await act(async () => { pending.resolve(Promise.reject(new Error('offline')) as never) })
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: /Try again/i }))
    expect(await screen.findByText(item.body)).toBeInTheDocument()
  })
  it('ignores a late response after opening another request', async () => {
    const pending = deferred<ReturnType<typeof detail>>()
    get.mockReturnValueOnce(pending.promise).mockResolvedValue(detail({ ...item, id: otherId, body: 'New request content' }))
    view(`/staff/help-requests/${id}`)
    await userEvent.click(screen.getByRole('link', { name: 'Another fixture request' }))
    expect(await screen.findByText('New request content')).toBeInTheDocument()
    await act(async () => { pending.resolve(detail({ ...item, body: 'Old request content' })) })
    expect(screen.queryByText('Old request content')).not.toBeInTheDocument()
  })
  it('does not reuse a completed detail response after the session changes', async () => {
    const pending = deferred<ReturnType<typeof detail>>()
    get.mockReturnValue(pending.promise)
    view(`/staff/help-requests/${id}`)
    localStorage.setItem('token', 'different-session')
    await act(async () => { pending.resolve(detail()) })
    expect(screen.queryByText(item.body)).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(/session/i)
  })
  it.each([{ ...item, id: otherId }, { ...item, requesterId: 'another-owner' }, null])('refuses mismatched or missing detail payloads', async data => {
    get.mockResolvedValue({ data: { success: true, data } })
    view(`/staff/help-requests/${id}`)
    await screen.findByRole('alert')
    expect(screen.queryByText(item.body)).not.toBeInTheDocument()
  })
  it('preserves the existing create payload and arrival at its new detail', async () => {
    post.mockResolvedValue({ data: { success: true, data: { id } } })
    get.mockResolvedValue(detail())
    view('/staff/help-requests/new')
    fireEvent.change(screen.getByLabelText(/Subject/i), { target: { value: item.subject } })
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: item.body } })
    await userEvent.click(screen.getByRole('button', { name: /Submit Request/i }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/staff/help-requests', { category: 'other', subject: item.subject, body: item.body }))
    expect(await screen.findByText(item.body)).toBeInTheDocument()
  })
})
