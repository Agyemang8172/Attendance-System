import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import HrAttendance from '../pages/HrAttendance'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
const id = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const account = { id: 'hr-fixture', role: 'HR', firstName: 'Esi', lastName: 'Owusu', email: 'hr@example.test', mustChangePassword: false }
const record = {
  id, userId: 'staff-fixture', date: '2026-11-02T00:00:00.000Z', clockIn: '2026-11-02T10:00:00.000Z', clockOut: '2026-11-02T18:00:00.000Z',
  hoursWorked: 8, status: 'ON_TIME', sessionStatus: 'CLOSED', closureReason: 'VERIFIED_CLOCK_OUT', requiresReviewReason: null, remarks: null,
  user: { id: 'staff-fixture', firstName: 'Ama', lastName: 'Mensah', employeeCode: 'EMP-042', department: 'Operations' },
  shiftNameSnapshot: 'Recorded day shift', shiftStartMinuteSnapshot: 600, shiftEndMinuteSnapshot: 1080, shiftCrossesMidnightSnapshot: false,
  timezoneSnapshot: 'Africa/Accra', graceEarlyMinutesSnapshot: 10, graceLateMinutesSnapshot: 5,
  policyVersionId: 'private-policy-id', policySnapshot: { versionNumber: 3, correctionWindowDays: 2, autoClockOutEnabled: true },
  checkInLat: 5.6037, checkInLng: -0.187, createdByKiosk: { id: 'internal-terminal-id', label: 'Reception terminal', publicId: 'public-terminal-id' },
}
const get = vi.mocked(api.get)
const list = (rows: object[] = [record], total = 25, page = 1) => ({ data: { success: true, count: rows.length, total, page, data: rows } })
const detail = (row: object = record) => ({ data: { success: true, data: row } })
function requestUrl(call: unknown[]) {
  const url = new URL(String(call[0]), 'http://local.test')
  const params = (call[1] as { params?: Record<string, string> } | undefined)?.params
  if (params) for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url
}
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
function attendanceTree(path = '/hr-attendance') {
  return <MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/hr-attendance" element={<HrAttendance />} />
    <Route path="/admin-attendance" element={<HrAttendance />} />
    <Route path="/hr-attendance/:id" element={<><HrAttendance /><Link to={`/hr-attendance/${otherId}`}>Other fixture record</Link></>} />
  </Routes></MemoryRouter>
}
function view(path = '/hr-attendance') { return render(attendanceTree(path)) }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  localStorage.setItem('token', 'isolated-test-session'); localStorage.setItem('user', JSON.stringify(account))
  get.mockImplementation(async url => String(url).includes('/all-attendance') ? list() : detail())
})

describe('Operational Attendance register contract', () => {
  it('reads flat totals and server page without unsupported search or local duplicate pagination', async () => {
    get.mockResolvedValue(list([record], 25, 2))
    view('/hr-attendance?status=ON_TIME&sessionStatus=CLOSED&page=2&search=ignored')
    expect(await screen.findByText(/25 records/i)).toBeInTheDocument()
    expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
    const url = requestUrl(get.mock.calls[0])
    expect(url.searchParams.get('status')).toBe('ON_TIME'); expect(url.searchParams.get('sessionStatus')).toBe('CLOSED')
    expect(url.searchParams.get('page')).toBe('2'); expect(url.searchParams.has('search')).toBe(false)
    expect(screen.getAllByRole('button', { name: /next page/i })).toHaveLength(1)
  })
  it('uses all eight real classifications and separate session filter', async () => {
    view(); await screen.findByText('Ama Mensah')
    const classification = screen.getByLabelText('Classification')
    for (const status of ['EARLY','ON_TIME','LATE','OPEN_SESSION','CLOCK_OUT_MISSING','AUTO_CLOSED','ABSENT','REQUIRES_REVIEW']) expect(classification.querySelector(`option[value="${status}"]`)).not.toBeNull()
    expect(screen.getByLabelText('Session state')).toBeInTheDocument()
  })
  it('converts date filters to explicit UTC clock-in instant boundaries', async () => {
    view(); await screen.findByText('Ama Mensah')
    fireEvent.change(screen.getByLabelText(/From.*UTC/i), { target: { value: '2026-10-31' } })
    fireEvent.change(screen.getByLabelText(/To.*UTC/i), { target: { value: '2026-11-02' } })
    await waitFor(() => expect(requestUrl(get.mock.calls[get.mock.calls.length - 1]).searchParams.get('endDate')).toBe('2026-11-02T23:59:59.999Z'))
    expect(requestUrl(get.mock.calls[get.mock.calls.length - 1]).searchParams.get('startDate')).toBe('2026-10-31T00:00:00.000Z')
    expect(screen.getByText(/not.*business.*day|business.*day.*not/i)).toBeInTheDocument()
  })
  it('pages while preserving supported filters and resets page for filter changes', async () => {
    get.mockImplementation(async (...args) => list([record], 25, Number(requestUrl(args).searchParams.get('page')) || 1))
    view('/hr-attendance?status=ON_TIME')
    await screen.findByText('Ama Mensah'); await userEvent.click(screen.getByRole('button', { name: /next page/i }))
    await waitFor(() => expect(requestUrl(get.mock.calls[get.mock.calls.length - 1]).searchParams.get('page')).toBe('2'))
    expect(requestUrl(get.mock.calls[get.mock.calls.length - 1]).searchParams.get('status')).toBe('ON_TIME')
    fireEvent.change(screen.getByLabelText('Classification'), { target: { value: 'LATE' } })
    await waitFor(() => expect(requestUrl(get.mock.calls[get.mock.calls.length - 1]).searchParams.get('status')).toBe('LATE'))
    expect(requestUrl(get.mock.calls[get.mock.calls.length - 1]).searchParams.get('page')).toBe('1')
  })
  it('renders real classification rather than inferring lateness from the clock', async () => {
    view(); await screen.findByText('Ama Mensah')
    expect(screen.getByText('On time', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Closed', { selector: 'span' })).toBeInTheDocument()
  })
  it.each([['/hr-attendance','No attendance'], ['/hr-attendance?status=LATE','No matching']])('distinguishes genuine empty %s', async (path, text) => {
    get.mockResolvedValue(list([], 0)); view(path)
    expect(await screen.findByText(new RegExp(text, 'i'))).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('shows out-of-range instead of claiming first-use empty', async () => {
    get.mockResolvedValue(list([], 2, 5)); view('/hr-attendance?page=5')
    expect(await screen.findByText(/no records.*page|page.*no records|outside.*range/i)).toBeInTheDocument()
  })
  it('does not turn failed reads into a zero count and supports retry', async () => {
    get.mockRejectedValueOnce(new Error('private-debug')); view()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/private-debug|0 records/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText('Ama Mensah')).toBeInTheDocument()
  })
  it('rejects malformed successful envelopes rather than displaying empty', async () => {
    get.mockResolvedValue({ data: { success: true, data: [] } }); view()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/0 records|No attendance records/i)).not.toBeInTheDocument()
  })
  it('ignores late results from an obsolete filter', async () => {
    const old = deferred<ReturnType<typeof list>>(); get.mockReturnValueOnce(old.promise)
    view(); fireEvent.change(screen.getByLabelText('Classification'), { target: { value: 'LATE' } })
    await screen.findByText('Ama Mensah')
    await act(async () => old.resolve(list([{ ...record, user: { ...record.user, firstName: 'Obsolete' } }])))
    expect(screen.queryByText('Obsolete Mensah')).not.toBeInTheDocument()
  })
  it('rejects a pending response after session account change', async () => {
    const pending = deferred<ReturnType<typeof list>>(); get.mockReturnValue(pending.promise); view()
    localStorage.setItem('user', JSON.stringify({ ...account, id: 'other-account' }))
    await act(async () => pending.resolve(list()))
    expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument(); expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
  it('retains the existing Superadmin compatibility list', async () => {
    localStorage.setItem('user', JSON.stringify({ ...account, role: 'SUPERADMIN' })); view('/admin-attendance')
    expect(await screen.findByText('Ama Mensah')).toBeInTheDocument()
  })
})

describe('Operational Attendance direct record', () => {
  it('loads direct ID independently of a first-page list and displays only recorded evidence', async () => {
    view(`/hr-attendance/${id}`)
    expect(await screen.findByText('Ama Mensah')).toBeInTheDocument()
    expect(get.mock.calls.every(call => !String(call[0]).includes('all-attendance'))).toBe(true)
    expect(screen.getByText('Recorded day shift')).toBeInTheDocument()
    expect(screen.getByText('Reception terminal')).toBeInTheDocument()
    expect(screen.queryByText(/private-policy-id|internal-terminal-id|public-terminal-id|Inside|Outside/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss|clock in|clock out/i })).not.toBeInTheDocument()
  })
  it('uses canonical linked drill-down and preserves filters/page on return', async () => {
    get.mockResolvedValueOnce(list([record], 25, 2))
    view('/hr-attendance?status=ON_TIME&sessionStatus=CLOSED&page=2')
    const link = await screen.findByRole('link', { name: /Ama Mensah/ }); await userEvent.click(link)
    await screen.findByText('Recorded day shift')
    await userEvent.click(screen.getByRole('link', { name: /back to attendance/i }))
    const location = screen.getByTestId('location').textContent || ''
    expect(location).toContain('/hr-attendance?'); expect(location).toContain('page=2'); expect(location).toContain('status=ON_TIME'); expect(location).toContain('sessionStatus=CLOSED')
  })
  it('shows unavailable historical evidence without filling current-policy or geofence values', async () => {
    get.mockResolvedValue(detail({ ...record, shiftNameSnapshot: null, shiftStartMinuteSnapshot: null, shiftEndMinuteSnapshot: null, timezoneSnapshot: null, policySnapshot: null, checkInLat: null, checkInLng: null, createdByKiosk: null }))
    view(`/hr-attendance/${id}`); await screen.findByText('Ama Mensah')
    expect(screen.getAllByText(/not recorded|unavailable/i).length).toBeGreaterThan(3)
    expect(screen.queryByText('Reception terminal')).not.toBeInTheDocument(); expect(screen.queryByText(/inside|outside|current policy/i)).not.toBeInTheDocument()
  })
  it.each([403,404])('handles %s without showing stale record or retrying forbidden evidence', async status => {
    get.mockRejectedValue({ response: { status } }); view(`/hr-attendance/${id}`)
    expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })
  it('retries a transient detail failure inline', async () => {
    get.mockRejectedValueOnce(new Error('database stack')); view(`/hr-attendance/${id}`)
    await screen.findByRole('alert'); expect(screen.queryByText('database stack')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i })); expect(await screen.findByText('Ama Mensah')).toBeInTheDocument()
  })
  it('rejects a mismatched direct record ID', async () => {
    get.mockResolvedValue(detail({ ...record, id: otherId })); view(`/hr-attendance/${id}`)
    expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument()
  })
  it('ignores an obsolete record after navigation to another direct ID', async () => {
    const old = deferred<ReturnType<typeof detail>>(); get.mockReturnValueOnce(old.promise)
    get.mockResolvedValue(detail({ ...record, id: otherId, user: { ...record.user, firstName: 'Kojo' } }))
    view(`/hr-attendance/${id}`); await userEvent.click(screen.getByRole('link', { name: 'Other fixture record' }))
    await screen.findByText('Kojo Mensah'); await act(async () => old.resolve(detail()))
    expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument()
  })
  it('rejects a pending detail after token replacement', async () => {
    const pending = deferred<ReturnType<typeof detail>>(); get.mockReturnValue(pending.promise); view(`/hr-attendance/${id}`)
    localStorage.setItem('token', 'replacement-test-session'); await act(async () => pending.resolve(detail()))
    expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument(); expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
  it('renders remarks as text instead of executable markup', async () => {
    get.mockResolvedValue(detail({ ...record, remarks: '<img src=x onerror=alert(1)>' })); view(`/hr-attendance/${id}`)
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument(); expect(document.querySelector('img')).toBeNull()
  })
})

describe('Operational Attendance unavailable and bounded context cases', () => {
  it('drops invalid or external return context from direct detail links', async () => {
    view(`/hr-attendance/${id}?page=-2&status=MADE_UP&sessionStatus=UNKNOWN&startDate=2026-02-31&returnTo=https://outside.example`)
    await screen.findByText('Ama Mensah')
    const back = screen.getByRole('link', { name: /back to attendance/i })
    expect(back.getAttribute('href')).toBe('/hr-attendance')
  })
  it('reports forbidden list access inline without manufacturing records', async () => {
    get.mockRejectedValue({ response: { status: 403 } }); view()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })
  it('rejects a successful detail envelope without a record', async () => {
    get.mockResolvedValue({ data: { success: true, data: null } }); view(`/hr-attendance/${id}`)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument()
  })
  it('does not report provisional hours as finalized for an open session', async () => {
    get.mockResolvedValue(detail({ ...record, sessionStatus: 'OPEN', clockOut: null, hoursWorked: 0, closureReason: null }))
    view(`/hr-attendance/${id}`); await screen.findByText('Ama Mensah')
    expect(screen.getByText(/not final while session is open/i)).toBeInTheDocument()
    expect(screen.queryByText('0.00 hrs')).not.toBeInTheDocument()
  })
})


describe('Operational Attendance loaded session isolation', () => {
  it.each(['/hr-attendance', `/hr-attendance/${id}`])('hides loaded evidence on the next render after session replacement: %s', async path => {
    const mounted = view(path)
    await screen.findByText('Ama Mensah')
    localStorage.setItem('token', 'replacement-test-session')
    get.mockReturnValue(new Promise(() => {}))
    mounted.rerender(attendanceTree(path))
    expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
