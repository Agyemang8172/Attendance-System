import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HrAudit from '../pages/HrAudit'
import HrCorrectionTrail from '../pages/HrCorrectionTrail'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

const get = vi.mocked(api.get)
const attendanceId = '11111111-1111-4111-8111-111111111111'
const auditId = '33333333-3333-4333-8333-333333333333'

const auditRow = {
  id: auditId,
  action: 'correction.decided',
  entityType: 'correction',
  entityId: null,
  actorType: 'USER',
  actor: { id: 'reader-1', firstName: 'Ama', lastName: 'Boateng', email: 'ama@example.test', role: 'HR' },
  before: { status: 'SUBMITTED' },
  after: { status: 'APPROVED' },
  reason: 'Approved after review',
  createdAt: '2026-11-06T10:00:00.000Z',
}

const correction = {
  id: '22222222-2222-4222-8222-222222222222',
  reason: 'The recorded punch was late.',
  requestedAt: '2026-11-06T08:15:00.000Z',
  reviewTier: 'SAME_DAY',
  proposedClockIn: '2026-11-06T07:55:00.000Z',
  proposedClockOut: null,
  originalValues: { clockIn: '2026-11-06T08:00:00.000Z' },
  approvedValues: { clockIn: '2026-11-06T07:56:00.000Z' },
  status: 'APPROVED',
  decisionNote: 'Confirmed against the site log.',
  decidedAt: '2026-11-06T09:00:00.000Z',
  requestedBy: { firstName: 'Ama', lastName: 'Boateng' },
  reviewedBy: { firstName: 'Kojo', lastName: 'Mensah' },
  attendance: { id: attendanceId, date: '2026-11-06T00:00:00.000Z', user: { firstName: 'Ama', lastName: 'Boateng' } },
  attendanceCorrectionRevisions: [{
    id: 'revision-1', revisionNo: 1, action: 'PROPOSED', reason: 'Initial request',
    valuesBefore: { clockIn: '2026-11-06T08:00:00.000Z' }, valuesAfter: { clockIn: '2026-11-06T07:55:00.000Z' },
    createdAt: '2026-11-06T08:15:00.000Z', actor: { firstName: 'Ama', lastName: 'Boateng' },
  }],
  audits: [{
    id: auditId, action: 'correction.submitted', actorType: 'USER', reason: 'Employee submitted a correction',
    createdAt: '2026-11-06T08:15:00.000Z', actor: { firstName: 'Ama', lastName: 'Boateng' },
  }],
}

const page = (data = [auditRow], total = 1) => ({
  data: { success: true, data, pagination: { currentPage: 1, totalPages: Math.ceil(total / 12), totalRecords: total } },
})
const trail = (data: unknown[] = [correction]) => ({ data: { success: true, data } })

const signIn = (role = 'HR') => {
  localStorage.setItem('token', 'isolated-session')
  localStorage.setItem('user', JSON.stringify({ id: 'reader-1', role, mustChangePassword: false }))
}

const renderAudit = () => render(<MemoryRouter><HrAudit /></MemoryRouter>)
const renderTrail = () => render(
  <MemoryRouter initialEntries={['/hr-audit/corrections/' + attendanceId]}>
    <Routes>
      <Route path="/hr-audit/corrections/:id" element={<HrCorrectionTrail />} />
    </Routes>
  </MemoryRouter>,
)

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  signIn()
  get.mockImplementation(async path => String(path).includes('/audit/corrections/') ? trail() : page())
})

describe('HrAudit', () => {
  it('renders real actor names, a nullable entity id and the reason', async () => {
    renderAudit()
    expect(await screen.findByText('correction.decided')).toBeInTheDocument()
    expect(screen.getByText(/Ama Boateng/)).toBeInTheDocument()
    expect(screen.queryByText(/\{entry\.actor/)).not.toBeInTheDocument()
    expect(screen.getByText(/06 Nov 2026/)).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: /view/i }))
    expect(await screen.findByRole('dialog', { name: /audit entry detail/i })).toBeInTheDocument()
    expect(screen.getByText('Approved after review')).toBeInTheDocument()
    expect(screen.getAllByText('Correction decided').length).toBeGreaterThan(0)
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
  })

  it('sends the date inputs as inclusive UTC instants', async () => {
    renderAudit()
    await screen.findByText('correction.decided')
    get.mockClear()
    get.mockResolvedValue(page())

    fireEvent.change(screen.getByLabelText(/from \(utc\)/i), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText(/to \(utc\)/i), { target: { value: '2026-11-07' } })

    await waitFor(() => expect(get).toHaveBeenCalled())
    const params = get.mock.calls[get.mock.calls.length - 1]?.[1]?.params
    expect(params).toMatchObject({
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-07T23:59:59.999Z',
    })
  })

  it('refuses a reversed date range without calling the API', async () => {
    renderAudit()
    await screen.findByText('correction.decided')

    fireEvent.change(screen.getByLabelText(/from \(utc\)/i), { target: { value: '2026-11-07' } })
    await waitFor(() => expect(get).toHaveBeenCalled())
    get.mockClear()

    fireEvent.change(screen.getByLabelText(/to \(utc\)/i), { target: { value: '2026-11-01' } })

    expect(await screen.findByText(/from must be on or before to/i)).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })

  it('shows an inline failure with a retry instead of a toast', async () => {
    get.mockRejectedValueOnce(new Error('offline'))
    renderAudit()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not load audit history/i)

    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText('correction.decided')).toBeInTheDocument()
  })

  it('scopes the action choices to the signed-in role', async () => {
    renderAudit()
    await screen.findByText('correction.decided')
    const select = screen.getByLabelText(/action/i)
    expect(screen.getByRole('option', { name: 'Correction decided' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'User updated' })).not.toBeInTheDocument()
    expect(select).toBeInTheDocument()
  })
})

describe('HrCorrectionTrail', () => {
  it('renders status, tier, approved evidence and the record return link', async () => {
    renderTrail()
    expect(await screen.findByRole('heading', { name: /correction trail/i })).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText(/Same day/)).toBeInTheDocument()
    expect(screen.getByText('Approved values')).toBeInTheDocument()
    expect(screen.getAllByText('Clock in').length).toBeGreaterThan(0)
    expect(screen.getByText(/Confirmed against the site log/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to record/i })).toHaveAttribute(
      'href', '/hr-attendance/' + attendanceId
    )
    expect(screen.getByText('PROPOSED · #1')).toBeInTheDocument()
    expect(screen.getByText('correction.submitted')).toBeInTheDocument()
    expect(screen.getByText(/Kojo Mensah/)).toBeInTheDocument()
  })

  it('labels a withdrawn request as withdrawn, never decided', async () => {
    get.mockResolvedValue(trail([{ ...correction, status: 'WITHDRAWN', approvedValues: null, decisionNote: null, decidedAt: '2026-11-06T09:00:00.000Z' }]))
    renderTrail()
    expect(await screen.findByText(/withdrawn by the requester/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Decided/)).not.toBeInTheDocument()
  })

  it('distinguishes a missing record and retries', async () => {
    get.mockRejectedValueOnce({ response: { status: 404 } })
    renderTrail()
    expect(await screen.findByText(/not found or is not available/i)).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText(/the recorded punch was late/i)).toBeInTheDocument()
  })

  it('shows an empty history without claiming an error', async () => {
    get.mockResolvedValue(trail([]))
    renderTrail()
    expect(await screen.findByText(/no correction requests were filed/i)).toBeInTheDocument()
  })
})
