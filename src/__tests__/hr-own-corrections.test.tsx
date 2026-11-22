import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HrOwnCorrections from '../pages/HrOwnCorrections'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

const id = '11111111-1111-4111-8111-111111111111'
const attendanceId = '22222222-2222-4222-8222-222222222222'
const base = '/hr-corrections/mine'
const endpoint = '/attendance/corrections'
const row = {
  id, attendanceId, status: 'APPROVED', reviewTier: 'SAME_DAY',
  reason: 'The recorded punch was late.', requestedAt: '2026-11-04T10:00:00Z', createdAt: '2026-11-04T10:00:00Z',
  proposedClockIn: '2026-11-03T07:55:00Z', proposedClockOut: null,
  decidedAt: '2026-11-04T11:00:00Z', decisionNote: 'Confirmed.',
}
const detailRow = {
  ...row, attendance: { id: attendanceId, date: '2026-11-03T00:00:00Z' },
  originalValues: { clockIn: '2026-11-03T08:00:00Z' },
  approvedValues: { clockIn: '2026-11-03T07:56:00Z' },
}
const get = vi.mocked(api.get)
const list = (data = [row], total = 1, currentPage = 1) => ({
  data: { success: true, data, pagination: { total, currentPage, totalPages: Math.ceil(total / 12) } },
})
const detail = () => ({ data: { success: true, data: detailRow } })
const renderView = (path = base) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path={base} element={<HrOwnCorrections />} />
      <Route path={base + '/:id'} element={<HrOwnCorrections />} />
    </Routes>
  </MemoryRouter>,
)
const asUrl = ([path, config]: Parameters<typeof api.get>) => {
  const url = new URL(path, 'http://local.test')
  for (const [key, value] of Object.entries(config?.params ?? {})) url.searchParams.set(key, String(value))
  return url
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  localStorage.setItem('token', 'isolated-session')
  localStorage.setItem('user', JSON.stringify({ id: 'hr-requester', role: 'HR', mustChangePassword: false }))
  get.mockImplementation(async path => String(path).includes(endpoint + '/' + id) ? detail() : list())
})

describe('HR own correction tracking', () => {
  it('loads the own lane only and retains valid status and page when returning from detail', async () => {
    get.mockImplementation(async path => String(path).includes(endpoint + '/' + id) ? detail() : list([row], 13, 2))
    renderView(base + '?status=APPROVED&page=2&requestedById=another&reviewTier=ESCALATED')
    await screen.findByRole('heading', { name: /my corrections/i })
    const link = await waitFor(() => {
      const match = screen.getAllByRole('link').find(item => item.getAttribute('href')?.startsWith(base + '/' + id))
      expect(match).toBeDefined()
      return match!
    })
    expect(asUrl(get.mock.calls[0]).pathname).toBe(endpoint)
    expect(Object.fromEntries(asUrl(get.mock.calls[0]).searchParams)).toEqual({ status: 'APPROVED', page: '2', limit: '12' })
    await userEvent.click(link)
    expect(await screen.findByText('Confirmed.')).toBeInTheDocument()
    const back = screen.getByRole('link', { name: /back to my corrections/i })
    expect(back).toHaveAttribute('href', expect.stringMatching(/mine\?.*status=APPROVED.*page=2/))
    await userEvent.click(back)
    expect(await screen.findByRole('heading', { name: /my corrections/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveValue('APPROVED')
    expect(get.mock.calls.map(call => asUrl(call).pathname)).toEqual([endpoint, endpoint + '/' + id, endpoint])
  })

  it('resets page when choosing a status and supports withdrawn as a final status', async () => {
    get.mockResolvedValueOnce(list([row], 13, 2)).mockResolvedValue(list([], 0))
    renderView(base + '?page=2')
    const filter = await screen.findByRole('combobox', { name: /status/i })
    fireEvent.change(filter, { target: { value: 'WITHDRAWN' } })
    await waitFor(() => expect(Object.fromEntries(asUrl(get.mock.calls[1]).searchParams)).toEqual({
      status: 'WITHDRAWN', page: '1', limit: '12',
    }))
    expect(await screen.findByText(/no corrections|no requests|no correction requests/i)).toBeInTheDocument()
  })

  it('supports direct detail and displays actual evidence without action controls or writes', async () => {
    renderView(base + '/' + id)
    expect(await screen.findByText('Confirmed.')).toBeInTheDocument()
    for (const label of ['Original', 'Proposed', 'Approved']) {
      expect(screen.getByRole('heading', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
    expect(screen.getByText(/07:56/)).toBeInTheDocument()
    expect(get.mock.calls.map(call => asUrl(call).pathname)).toEqual([endpoint + '/' + id])
    expect(screen.queryByRole('button', { name: /submit|approve|reject|decline|withdraw|edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    expect(api.patch).not.toHaveBeenCalled()
  })

  it.each([403, 404, 500])('shows a safe failure for a %s detail response', async status => {
    get.mockRejectedValue({ response: { status, data: { message: 'Private diagnostic fixture' } } })
    renderView(base + '/' + id)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Private diagnostic fixture')).not.toBeInTheDocument()
    expect(screen.queryByText(row.reason)).not.toBeInTheDocument()
  })

  it('does not paint a pending detail after the session changes', async () => {
    let settle!: (value: ReturnType<typeof detail>) => void
    get.mockImplementation(() => new Promise(resolve => { settle = resolve }))
    renderView(base + '/' + id)
    await waitFor(() => expect(get).toHaveBeenCalledOnce())
    localStorage.setItem('token', 'replacement-session')
    await act(async () => { settle(detail()) })
    expect(screen.queryByText('Confirmed.')).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('recovers from a page beyond the available range', async () => {
    get.mockResolvedValueOnce(list([row], 1, 9)).mockResolvedValueOnce(list([row], 1, 1))
    renderView(base + '?page=9')
    expect(await screen.findByText(/this page is no longer available/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /go to first page/i }))
    await waitFor(() => expect(asUrl(get.mock.calls[1]).searchParams.get('page')).toBe('1'))
    expect(await screen.findByText(row.reason)).toBeInTheDocument()
  })
})
