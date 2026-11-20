import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HrCorrections from '../pages/HrCorrections'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

const id = '11111111-1111-4111-8111-111111111111'
const attendanceId = '22222222-2222-4222-8222-222222222222'
const row = {
  id, attendanceId, reason: 'The kiosk recorded my start late.', status: 'SUBMITTED',
  reviewTier: 'SAME_DAY', requestedAt: '2026-11-04T10:00:00Z', createdAt: '2026-11-04T10:00:00Z',
  originalValues: { clockIn: '2026-11-03T08:00:00Z', clockOut: '2026-11-03T16:00:00Z', status: 'LATE' },
  proposedClockIn: '2026-11-03T07:55:00Z', proposedClockOut: null,
  approvedValues: null as null | Record<string, unknown>, decidedAt: null as null | string,
  decisionNote: null as null | string,
  requestedBy: { id: 'test-requester', firstName: 'Ama', lastName: 'Mensah', email: 'ama@example.test' },
  attendance: { id: attendanceId, date: '2026-11-03T00:00:00Z', user: { firstName: 'Kojo', lastName: 'Mensah' } },
}
const base = '/hr-corrections'
const context = '?status=SUBMITTED&reviewTier=ESCALATED&page=2'
const get = vi.mocked(api.get)
const patch = vi.mocked(api.patch)
const detail = (data = row) => ({ data: { success: true, data } })
const list = (data = [row], total = 1, currentPage = 1) => ({
  data: { success: true, data, pagination: { total, totalPages: Math.ceil(total / 12), currentPage } },
})
const auth = (role = 'HR', userId = 'test-reviewer') => {
  localStorage.setItem('token', 'isolated-session')
  localStorage.setItem('user', JSON.stringify({ id: userId, role, firstName: 'Esi', lastName: 'Owusu', mustChangePassword: false }))
}
const renderView = (path = `${base}/${id}`) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path={base} element={<HrCorrections />} />
      <Route path={`${base}/:id`} element={<HrCorrections />} />
    </Routes>
  </MemoryRouter>,
)
const open = async (name = 'Approve') => {
  await userEvent.click(await screen.findByRole('button', { name }))
  return within(await screen.findByRole('dialog'))
}
const note = (dialog: ReturnType<typeof within>, text = '  Confirmed with the shift lead.  ') =>
  fireEvent.change(dialog.getByRole('textbox', { name: /decision note/i }), { target: { value: text } })
const asUrl = ([path, config]: Parameters<typeof api.get>) => {
  const url = new URL(path, 'http://local.test')
  for (const [key, value] of Object.entries(config?.params ?? {})) url.searchParams.set(key, String(value))
  return url
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  auth()
  get.mockImplementation(async path => String(path).includes(`/corrections/${id}`) ? detail() : list())
})

describe('reviewer correction reads', () => {
  it('uses actual nested fields and pagination and preserves supported queue context only', async () => {
    const escalated = { ...row, reviewTier: 'ESCALATED' }
    get.mockImplementation(async path => String(path).includes(`/corrections/${id}`) ? detail(escalated) : list([escalated], 13, 2))
    renderView(`${base}${context}&search=ignored`)
    expect(await screen.findByText('Requester: Ama Mensah')).toBeInTheDocument()
    expect(screen.getByText('Kojo Mensah')).toBeInTheDocument()
    expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument()
    expect(Object.fromEntries(asUrl(get.mock.calls[0]).searchParams)).toEqual({
      status: 'SUBMITTED', reviewTier: 'ESCALATED', page: '2', limit: '12',
    })
    const link = screen.getAllByRole('link').find(item => item.getAttribute('href')?.startsWith(`${base}/${id}`))!
    await userEvent.click(link)
    expect(await screen.findByText(row.reason)).toBeInTheDocument()
    const back = screen.getByRole('link', { name: /back to queue/i })
    const target = new URL(back.getAttribute('href')!, 'http://local.test')
    expect(target.pathname).toBe(base)
    expect(Object.fromEntries(target.searchParams)).toEqual({ status: 'SUBMITTED', reviewTier: 'ESCALATED', page: '2' })
  })

  it('loads the direct correction without loading the queue and shows persisted evidence', async () => {
    get.mockResolvedValue(detail({
      ...row, status: 'APPROVED', approvedValues: { clockIn: '2026-11-03T07:56:00Z' },
      decisionNote: 'Recorded final decision.',
    }))
    renderView()
    expect(await screen.findByText('Recorded final decision.')).toBeInTheDocument()
    for (const heading of ['Original', 'Proposed', 'Approved']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText(/07:56/)).toBeInTheDocument()
    expect(screen.getByText("Unchanged")).toBeInTheDocument()
    expect(get.mock.calls.map(call => asUrl(call).pathname)).toEqual([`/hr/corrections/${id}`])
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it.each(['APPROVED', 'REJECTED', 'WITHDRAWN'])('shows no reviewer actions in %s', async status => {
    get.mockResolvedValue(detail({ ...row, status }))
    renderView()
    await screen.findByText(row.reason)
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument()
  })

  it('shows no self-decision actions even to Superadmin', async () => {
    auth('SUPERADMIN', row.requestedBy.id)
    renderView()
    await screen.findByText(row.reason)
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument()
  })

  it('offers the own-corrections link to HR', async () => {
    renderView(base)
    expect(await screen.findByRole('link', { name: /my corrections/i })).toHaveAttribute('href', '/hr-corrections/mine')
  })

  it('hides the own-corrections link from Superadmin', async () => {
    auth('SUPERADMIN')
    renderView(base)
    await screen.findByRole('heading', { name: 'Corrections' })
    expect(screen.queryByRole('link', { name: /my corrections/i })).not.toBeInTheDocument()
  })
})

describe('reviewer correction decision', () => {
  it('requires a trimmed decision note and sends no backstop fields for HR', async () => {
    get.mockResolvedValue(detail({ ...row, reviewTier: 'ESCALATED' }))
    patch.mockImplementation(async () => {
      get.mockResolvedValue(detail({ ...row, status: 'APPROVED' }))
      return { data: { success: true, data: { correction: { id, status: 'APPROVED' } } } }
    })
    renderView()
    const dialog = await open()
    expect(dialog.queryByLabelText(/backstop condition/i)).not.toBeInTheDocument()
    const confirm = dialog.getByRole('button', { name: /^Confirm/ })
    expect(confirm).toBeDisabled()
    note(dialog)
    await userEvent.click(confirm)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch.mock.calls[0].slice(0, 2)).toEqual([
      `/hr/corrections/${id}/decision`, { decision: 'APPROVED', note: 'Confirmed with the shift lead.' },
    ])
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('requires a paired attestation for an escalated Superadmin decision', async () => {
    auth('SUPERADMIN')
    get.mockResolvedValue(detail({ ...row, reviewTier: 'ESCALATED' }))
    patch.mockImplementation(async () => {
      get.mockResolvedValue(detail({ ...row, status: 'REJECTED' }))
      return { data: { success: true, data: { correction: { id, status: 'REJECTED' } } } }
    })
    renderView()
    const dialog = await open('Decline')
    const confirm = dialog.getByRole('button', { name: /^Confirm/ })
    note(dialog)
    expect(confirm).toBeDisabled()
    await userEvent.selectOptions(dialog.getByLabelText(/backstop condition/i), 'EXPLICIT_HANDOFF')
    expect(confirm).toBeDisabled()
    fireEvent.change(dialog.getByRole('textbox', { name: /backstop reason/i }), { target: { value: '  Explicit handoff.  ' } })
    await userEvent.click(confirm)
    expect(patch.mock.calls[0].slice(0, 2)).toEqual([
      `/hr/corrections/${id}/decision`, {
        decision: 'REJECTED', note: 'Confirmed with the shift lead.',
        backstopCondition: 'EXPLICIT_HANDOFF', backstopReason: 'Explicit handoff.',
      },
    ])
  })

  it('rereads a 409 without replaying the decision', async () => {
    patch.mockImplementation(async () => {
      get.mockResolvedValue(detail({ ...row, status: 'REJECTED', decisionNote: 'Decision from another reviewer.' }))
      throw { response: { status: 409, data: { message: 'private diagnostic' } } }
    })
    renderView()
    const dialog = await open()
    note(dialog)
    await userEvent.click(dialog.getByRole('button', { name: /^Confirm/ }))
    expect(await screen.findByText('Decision from another reviewer.')).toBeInTheDocument()
    expect(screen.queryByText('private diagnostic')).not.toBeInTheDocument()
    expect(patch).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('hides old detail and mutation outcome when a pending decision settles after a session change', async () => {
    let settle!: (result: unknown) => void
    patch.mockImplementation(() => new Promise(resolve => { settle = resolve }))
    renderView()
    const dialog = await open()
    note(dialog)
    await userEvent.click(dialog.getByRole('button', { name: /^Confirm/ }))
    auth('HR', 'different-reviewer')
    await act(async () => { settle({ data: { success: true, data: { correction: { id, status: 'APPROVED' } } } }) })
    await waitFor(() => expect(screen.queryByText(row.reason)).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(1)
  })
})
