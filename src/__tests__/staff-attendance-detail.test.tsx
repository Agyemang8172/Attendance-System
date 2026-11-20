import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
// @ts-expect-error The mounted legacy App.jsx has no declaration; its real role guards are exercised intentionally.
import App from '../App'
import StaffAttendance from '../pages/StaffAttendance'
import StaffAttendanceDetail from '../pages/StaffAttendanceDetail'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: {
  get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn(),
} }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

const id = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const account = { id: 'staff-account', email: 'staff@example.test', firstName: 'Ama', lastName: 'Mensah', role: 'STAFF', mustChangePassword: false }
const record = {
  id, userId: account.id, date: '2026-11-01T00:00:00.000Z',
  clockIn: '2026-11-01T07:00:00.000Z', clockOut: '2026-11-01T15:00:00.000Z',
  hoursWorked: 8, status: 'ON_TIME', sessionStatus: 'CLOSED', closureReason: null,
  requiresReviewReason: null, remarks: 'Recorded attendance evidence',
  shiftId: 'historical-shift', shiftNameSnapshot: 'Morning coverage',
  shiftStartMinuteSnapshot: 960, shiftEndMinuteSnapshot: 0, shiftCrossesMidnightSnapshot: true,
  timezoneSnapshot: 'Asia/Tokyo', graceEarlyMinutesSnapshot: 0, graceLateMinutesSnapshot: 5,
  policyVersionId: 'historical-policy', policySnapshot: { versionNumber: 2, graceEarlyMinutes: 0, graceLateMinutes: 5 },
  checkInLat: 0, checkInLng: 0,
  user: { id: account.id, employeeCode: 'EMP-0021', firstName: 'Ama', lastName: 'Mensah' },
  createdByKiosk: { id: 'terminal-record', label: 'Reception terminal', publicId: 'KT-EXAMPLE' },
  createdAt: '2026-11-01T07:00:00.000Z', updatedAt: '2026-11-01T15:00:00.000Z',
}
const get = vi.mocked(api.get)
const detailPath = (query = '') => `/staff/attendance/${id}${query}`
function success(data: Record<string, unknown> = record) { return { data: { success: true, data } } }
function seed(role = 'STAFF') {
  localStorage.setItem('token', 'isolated-fixture-session')
  localStorage.setItem('user', JSON.stringify({ ...account, role }))
}
function view(path = detailPath()) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/staff/attendance/:id" element={<><StaffAttendanceDetail /><Link to={`/staff/attendance/${secondId}`}>Open another fixture</Link></>} />
    <Route path="/staff/attendance" element={<StaffAttendance />} />
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
  seed()
  window.history.replaceState({}, '', detailPath())
  get.mockResolvedValue(success())
})

describe('Staff direct attendance detail', () => {
  it('loads the record directly without requesting the attendance list', async () => {
    view()
    expect(await screen.findByText('Morning coverage')).toBeInTheDocument()
    expect(get.mock.calls[0][0]).toBe(`/attendance/${id}`)
    expect(get.mock.calls.some(([url]) => String(url).includes('my-attendance'))).toBe(false)
    expect(screen.queryByRole('button', { name: /^Clock (?:in|out)$/i })).not.toBeInTheDocument()
  })

  it.each([
    ['missing body', undefined],
    ['different record', { ...record, id: secondId }],
    ['different owner', { ...record, userId: 'another-account' }],
  ])('refuses an unconfirmed detail response with %s', async (_name, data) => {
    get.mockResolvedValue({ data: { success: true, data } })
    view()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be confirmed/i)
    expect(screen.queryByText('Recorded attendance evidence')).not.toBeInTheDocument()
    expect(screen.queryByText('Morning coverage')).not.toBeInTheDocument()
  })

  it.each([
    ['EARLY', 'Early'], ['ON_TIME', 'On time'], ['LATE', 'Late'], ['OPEN_SESSION', 'Open session'],
    ['CLOCK_OUT_MISSING', 'Clock-out missing'], ['AUTO_CLOSED', 'Automatically closed'],
    ['ABSENT', 'Absent'], ['REQUIRES_REVIEW', 'Requires review'],
  ])('shows server classification %s independently of session state', async (status, label) => {
    get.mockResolvedValue(success({ ...record, status }))
    view()
    expect(await screen.findByText(label, { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Closed', { exact: true })).toBeInTheDocument()
  })

  it('uses historical timezone and shift snapshots rather than current configuration', async () => {
    view()
    await screen.findByText('Morning coverage')
    expect(screen.getAllByText(/16:00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Asia\/Tokyo/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/01 Nov 2026/).length).toBeGreaterThan(0)
    expect(get.mock.calls.some(([url]) => /settings|schedule|policies/.test(String(url)))).toBe(false)
  })

  it('preserves zero completed hours and zero coordinates without inventing a verdict', async () => {
    get.mockResolvedValue(success({ ...record, hoursWorked: 0 }))
    view()
    expect(await screen.findByText('0.00 hrs')).toBeInTheDocument()
    expect(screen.queryByText(/^Inside$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Outside$/i)).not.toBeInTheDocument()
    expect(screen.getByText('Reception terminal')).toBeInTheDocument()
    expect(screen.getAllByText(/^0(?:\.0+)?(?:,\s*0(?:\.0+)?)?$/).length).toBeGreaterThan(0)
  })

  it('does not present an open session as completed recorded hours', async () => {
    get.mockResolvedValue(success({ ...record, sessionStatus: 'OPEN', clockOut: null, hoursWorked: 0 }))
    view()
    expect(await screen.findByText('Not final while session is open')).toBeInTheDocument()
    expect(screen.queryByText('0.00 hrs')).not.toBeInTheDocument()
  })

  it('keeps missing historical/source evidence unavailable without current-value fallbacks', async () => {
    get.mockResolvedValue(success({ ...record, shiftNameSnapshot: null, shiftStartMinuteSnapshot: null,
      shiftEndMinuteSnapshot: null, shiftCrossesMidnightSnapshot: null, policySnapshot: null,
      graceEarlyMinutesSnapshot: null, graceLateMinutesSnapshot: null, checkInLat: null, checkInLng: null,
      createdByKiosk: null, user: null, closureReason: null }))
    view()
    await screen.findByRole('heading', { name: /Attendance detail/i })
    await waitFor(() => expect(screen.getAllByText(/Not recorded|Unavailable/i).length).toBeGreaterThan(0))
    expect(screen.queryByText(/Manual clock-out|Inside|Outside/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Morning coverage')).not.toBeInTheDocument()
  })

  it.each([null, 'not-a-timezone'])('shows raw timestamps when recorded timezone is %s', async timezoneSnapshot => {
    get.mockResolvedValue(success({ ...record, timezoneSnapshot }))
    view()
    expect(await screen.findByText(record.clockIn)).toBeInTheDocument()
    expect(screen.getByText(/Recorded timezone unavailable/i)).toBeInTheDocument()
  })

  it('shows loading and waits for the detail response', async () => {
    const pending = deferred<ReturnType<typeof success>>()
    get.mockReturnValue(pending.promise)
    view()
    expect(screen.getByText(/Loading attendance/i)).toBeInTheDocument()
    expect(screen.queryByText('Morning coverage')).not.toBeInTheDocument()
    await act(async () => pending.resolve(success()))
    expect(await screen.findByText('Morning coverage')).toBeInTheDocument()
  })

  it.each([403, 404])('shows a resource-specific refusal for HTTP %s', async status => {
    get.mockRejectedValue({ response: { status } })
    view()
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 403 ? /permission|access/i : /not found|not available/i)
    expect(screen.queryByText('Morning coverage')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Attendance/i })).toBeInTheDocument()
  })

  it('retries a failed read without replacing it with an empty successful record', async () => {
    get.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValue(success())
    view()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Try again|Retry/i }))
    expect(await screen.findByText('Morning coverage')).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('ignores a late response after navigating to a different record', async () => {
    const older = deferred<ReturnType<typeof success>>()
    get.mockReturnValueOnce(older.promise).mockResolvedValue(success({ ...record, id: secondId, remarks: 'Second record evidence' }))
    view()
    await userEvent.click(screen.getByRole('link', { name: 'Open another fixture' }))
    expect(await screen.findByText('Second record evidence')).toBeInTheDocument()
    await act(async () => older.resolve(success()))
    expect(screen.queryByText('Recorded attendance evidence')).not.toBeInTheDocument()
    expect(screen.getByText('Second record evidence')).toBeInTheDocument()
  })

  it('does not reveal a completed response after the originating session changes', async () => {
    const pending = deferred<ReturnType<typeof success>>()
    get.mockReturnValue(pending.promise)
    view()
    localStorage.setItem('token', 'different-fixture-session')
    await act(async () => pending.resolve(success()))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Recorded attendance evidence')).not.toBeInTheDocument()
    expect(screen.queryByText('Morning coverage')).not.toBeInTheDocument()
  })

  it('retains known list filters/page in a local return link and ignores arbitrary redirects', async () => {
    view(detailPath('?search=late&status=LATE&sessionStatus=CLOSED&page=3&returnTo=https%3A%2F%2Funtrusted.example'))
    await screen.findByText('Morning coverage')
    const target = new URL(screen.getByRole('link', { name: /Back to Attendance/i }).getAttribute('href')!, 'http://localhost')
    expect(target.pathname).toBe('/staff/attendance')
    expect(target.searchParams.get('search')).toBe('late')
    expect(target.searchParams.get('status')).toBe('LATE')
    expect(target.searchParams.get('sessionStatus')).toBe('CLOSED')
    expect(target.searchParams.get('page')).toBe('3')
    expect(target.searchParams.has('returnTo')).toBe(false)
  })

  it('enters detail from Attendance and restores its visible filters and page', async () => {
    get.mockImplementation(async url => String(url).includes('my-attendance')
      ? { data: { success: true, data: [record], total: 40 } }
      : success())
    view('/staff/attendance?search=late&status=LATE&sessionStatus=CLOSED&page=2')
    const row = await screen.findByRole('row', { name: /View details for/i })
    fireEvent.keyDown(row, { key: 'Enter' })
    await screen.findByRole('heading', { name: /Attendance detail/i })
    await userEvent.click(screen.getByRole('link', { name: /Back to Attendance/i }))
    expect(await screen.findByLabelText(/Search attendance/i)).toHaveValue('late')
    expect(screen.getByRole('combobox', { name: 'Attendance status' })).toHaveValue('LATE')
    expect(screen.getByRole('combobox', { name: 'Session status' })).toHaveValue('CLOSED')
    await waitFor(() => expect(get.mock.calls.some(([url]) => String(url).includes('my-attendance') && new URL(String(url), 'http://localhost').searchParams.get('page') === '2')).toBe(true))
  })
})

describe('mounted Staff attendance detail permissions', () => {
  it.each(['HR', 'SUPERADMIN'])('does not mount the Staff detail for %s', async role => {
    seed(role)
    get.mockImplementation(() => new Promise(() => {}))
    render(<App />)
    await waitFor(() => expect(window.location.pathname).not.toContain('/staff/attendance/'))
    expect(get.mock.calls.some(([url]) => String(url) === `/attendance/${id}`)).toBe(false)
  })

  it('redirects a signed-out direct visitor to login', async () => {
    localStorage.clear()
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(get.mock.calls.some(([url]) => String(url) === `/attendance/${id}`)).toBe(false)
  })
})
