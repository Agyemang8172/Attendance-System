import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import HrExceptions from '../pages/HrExceptions'
import HrAttendance from '../pages/HrAttendance'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
const attendanceId = '11111111-1111-4111-8111-111111111111'
const attemptId = '22222222-2222-4222-8222-222222222222'
const context = 'startDate=2026-11-01&endDate=2026-11-04'
const account = { id: 'operator-fixture', role: 'HR', firstName: 'Esi', lastName: 'Owusu', mustChangePassword: false }
const attendance = { kind: 'ATTENDANCE', id: attendanceId, date: '2026-11-03T00:00:00.000Z', employee: { id: 'private-employee', firstName: 'Ama', lastName: 'Mensah', employeeCode: 'EMP-042' }, status: 'CLOCK_OUT_MISSING', sessionStatus: 'OPEN', reason: 'Open session needs review.' }
const attempt = { kind: 'ATTEMPT', id: attemptId, date: '2026-11-03T08:00:00.000Z', employee: null, action: 'CLOCK_IN', outcome: 'REJECTED', step: 'LOCATION', kiosk: 'Front terminal', site: 'Reception', locationResult: 'UNKNOWN', reason: 'Location could not be assessed.' }
const get = vi.mocked(api.get)
const listing = (rows: object[] = [attendance, attempt], total = rows.length, page = 1) => ({ data: { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / 12), total } } })
function urlOf(call: unknown[]) {
  const url = new URL(String(call[0]), 'http://fixture.test')
  const params = (call[1] as { params?: Record<string, string> } | undefined)?.params
  if (params) Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return url
}
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
function tree(path = `/hr-exceptions?${context}`) {
  return <MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/hr-exceptions" element={<><HrExceptions /><Link to={`/hr-exceptions?${context}&page=2`}>Other fixture page</Link></>} />
    <Route path="/hr-attendance/:id" element={<HrAttendance />} />
    <Route path="/hr-attendance" element={<p>Attendance register fixture</p>} />
  </Routes></MemoryRouter>
}
const view = (path?: string) => render(tree(path))
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  localStorage.setItem('token', 'isolated-test-session'); localStorage.setItem('user', JSON.stringify(account))
  get.mockImplementation(async (...args) => String(args[0]).includes('/reports/exceptions') ? listing(undefined, 25, Number(urlOf(args).searchParams.get('page')) || 1) : { data: { success: true, data: { id: attendanceId, userId: 'private-employee', date: attendance.date, status: attendance.status, sessionStatus: attendance.sessionStatus, user: attendance.employee } } })
})

describe('Exceptions contract and factual rows', () => {
  it('requires a chosen range without fetching or inventing today', () => {
    view('/hr-exceptions')
    expect(get).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^From/i)).toHaveValue(''); expect(screen.getByLabelText(/^To/i)).toHaveValue('')
    expect(screen.getByText(/choose.*date.*range|select.*date.*range/i)).toBeInTheDocument()
  })
  it('uses only supported date/page/limit query and actual pagination total', async () => {
    get.mockResolvedValue(listing([attempt], 13, 2)); view(`/hr-exceptions?${context}&page=2&search=ignored&type=OUTSIDE`)
    expect(await screen.findByText(/13.*(?:rows|exceptions)/i)).toBeInTheDocument()
    expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument()
    const params = urlOf(get.mock.calls[0]).searchParams
    expect(params.get('startDate')).toBe('2026-11-01'); expect(params.get('endDate')).toBe('2026-11-04'); expect(params.get('page')).toBe('2'); expect(params.get('limit')).toBe('12')
    expect(params.has('search')).toBe(false); expect(params.has('type')).toBe(false)
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
  it('keeps draft dates separate until Apply and resets the page', async () => {
    get.mockResolvedValue(listing([attempt], 13, 2)); view(`/hr-exceptions?${context}&page=2`)
    await screen.findByText('Front terminal'); const before = get.mock.calls.length
    fireEvent.change(screen.getByLabelText(/^From/i), { target: { value: '2026-11-02' } })
    expect(get).toHaveBeenCalledTimes(before)
    get.mockResolvedValue(listing()); await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    await waitFor(() => expect(urlOf(get.mock.calls[get.mock.calls.length - 1]).searchParams.get('startDate')).toBe('2026-11-02'))
    expect(urlOf(get.mock.calls[get.mock.calls.length - 1]).searchParams.get('page')).toBe('1')
  })
  it.each([['2026-11-04','2026-11-01'], ['2026-01-01','2026-11-04']])('refuses invalid order/span %s to %s', async (from, to) => {
    view('/hr-exceptions'); fireEvent.change(screen.getByLabelText(/^From/i), { target: { value: from } }); fireEvent.change(screen.getByLabelText(/^To/i), { target: { value: to } })
    await userEvent.click(screen.getByRole('button', { name: /apply/i })); expect(get).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
  it('does not fetch an impossible URL date', () => {
    view('/hr-exceptions?startDate=2026-02-31&endDate=2026-03-02'); expect(get).not.toHaveBeenCalled()
  })
  it('separates attendance from unidentified UNKNOWN attempt and removes fake dismissal', async () => {
    view(); await screen.findByText('Ama Mensah')
    expect(screen.getByText('EMP-042')).toBeInTheDocument(); expect(screen.getByText('Front terminal')).toBeInTheDocument(); expect(screen.getByText('Reception')).toBeInTheDocument()
    expect(screen.getByText(/unidentified|employee.*unavailable|not identified/i)).toBeInTheDocument()
    expect(screen.getByText('UNKNOWN', { exact: true })).toBeInTheDocument(); expect(screen.queryByText('OUTSIDE', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText(/clock.out missing/i)).toBeInTheDocument(); expect(screen.getByText('Open', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument(); expect(api.patch).not.toHaveBeenCalled()
    const detailLinks = screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/hr-attendance/'))
    expect(detailLinks).toHaveLength(1); expect(detailLinks[0].getAttribute('href')).toContain(attendanceId)
    expect(document.body.textContent).not.toContain('Former Employee')
    expect(screen.queryByText(/private-employee/)).not.toBeInTheDocument()
  })
  it('preserves OUTSIDE as distinct recorded evidence', async () => {
    get.mockResolvedValue(listing([{ ...attempt, locationResult: 'OUTSIDE' }])); view()
    expect(await screen.findByText('OUTSIDE', { exact: true })).toBeInTheDocument(); expect(screen.queryByText('UNKNOWN', { exact: true })).not.toBeInTheDocument()
  })
  it('displays recorded reasons safely as text', async () => {
    get.mockResolvedValue(listing([{ ...attempt, reason: '<img src=x onerror=alert(1)>' }])); view()
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument(); expect(document.querySelector('img')).toBeNull()
  })
  it('distinguishes a successful empty range', async () => {
    get.mockResolvedValue(listing([], 0)); view()
    expect(await screen.findByRole('heading', { name: /no exceptions in this range/i })).toBeInTheDocument(); expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('shows an out-of-range page without claiming no exceptions exist', async () => {
    get.mockResolvedValue(listing([], 2, 5)); view(`/hr-exceptions?${context}&page=5`)
    expect(await screen.findByText(/no rows.*page|no.*exceptions.*page|page.*outside|no records.*page/i)).toBeInTheDocument()
  })
  it('shows inline failures without a zero count and permits retry', async () => {
    get.mockRejectedValueOnce(new Error('private-stack')); view()
    await screen.findByRole('alert'); expect(screen.queryByText(/private-stack|0.*(?:rows|exceptions)/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i })); expect(await screen.findByText('Ama Mensah')).toBeInTheDocument()
  })
  it('rejects a malformed successful response', async () => {
    get.mockResolvedValue({ data: { success: true, data: [] } }); view()
    expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.queryByText(/no exceptions/i)).not.toBeInTheDocument()
  })
  it('ignores a stale page response', async () => {
    const old = deferred<ReturnType<typeof listing>>(); get.mockReturnValueOnce(old.promise); view()
    await userEvent.click(screen.getByRole('link', { name: 'Other fixture page' })); await screen.findByText('Ama Mensah')
    await act(async () => old.resolve(listing([{ ...attendance, employee: { ...attendance.employee, firstName: 'Obsolete' } }])))
    expect(screen.queryByText('Obsolete Mensah')).not.toBeInTheDocument()
  })
  it('rejects a pending read after token replacement', async () => {
    const pending = deferred<ReturnType<typeof listing>>(); get.mockReturnValue(pending.promise); view(); localStorage.setItem('token', 'replacement-fixture')
    await act(async () => pending.resolve(listing())); expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument(); expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
  it('hides loaded results when the account changes and the screen rerenders', async () => {
    const path = `/hr-exceptions?${context}`; const mounted = view(path); await screen.findByText('Ama Mensah')
    localStorage.setItem('user', JSON.stringify({ ...account, id: 'other-operator' })); mounted.rerender(tree(path))
    expect(screen.queryByText('Ama Mensah')).not.toBeInTheDocument(); expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
  it.each(['STAFF','SUPERADMIN'])('retains role boundary for %s', async role => {
    localStorage.setItem('user', JSON.stringify({ ...account, role })); view()
    if (role === 'STAFF') { expect(get).not.toHaveBeenCalled(); expect(await screen.findByRole('alert')).toBeInTheDocument() }
    else expect(await screen.findByText('Ama Mensah')).toBeInTheDocument()
  })
})

describe('Attendance drill-down return to Exceptions', () => {
  it('returns to the originating range/page via the fixed Exceptions origin', async () => {
    get.mockResolvedValueOnce(listing([attendance], 13, 2)); view(`/hr-exceptions?${context}&page=2`)
    const link = await screen.findByRole('link', { name: /view attendance/i })
    await userEvent.click(link); await screen.findByRole('heading', { name: /^Attendance detail$/ })
    const back = screen.getByRole('link', { name: /back to exceptions/i }); const target = new URL(back.getAttribute('href')!, 'http://fixture.test')
    expect(target.pathname).toBe('/hr-exceptions'); expect(target.searchParams.get('startDate')).toBe('2026-11-01'); expect(target.searchParams.get('endDate')).toBe('2026-11-04'); expect(target.searchParams.get('page')).toBe('2')
  })
  it('never honors arbitrary return URLs', async () => {
    view(`/hr-attendance/${attendanceId}?origin=https://outside.example&returnTo=https://outside.example`)
    expect(await screen.findByRole('link', { name: /back to attendance/i })).toHaveAttribute('href', '/hr-attendance')
  })
})
