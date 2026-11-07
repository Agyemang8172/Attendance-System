import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import HrDashboard from '../pages/HrDashboard'
import api from '../api/axios'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

const get = vi.mocked(api.get)

const pad = (value: number) => String(value).padStart(2, '0')
const deviceDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const end = new Date()
const start = new Date(end)
start.setDate(end.getDate() - 6)
const range = { startDate: deviceDate(start), endDate: deviceDate(end) }
const todayKey = range.endDate

const attendanceId = '11111111-1111-4111-8111-111111111111'
const registerId = '22222222-2222-4222-8222-222222222222'

const employee = (firstName: string, lastName: string) => ({
  id: firstName.toLowerCase(),
  employeeCode: 'EMP-1',
  firstName,
  lastName,
})

const punctuality = (overrides: Record<string, number> = {}) => ({
  data: {
    success: true,
    data: {
      groupBy: 'day',
      startDate: range.startDate,
      endDate: range.endDate,
      rows: [
        {
          group: todayKey,
          early: 4,
          onTime: 0,
          late: 1,
          openSession: 3,
          autoClosed: 0,
          missing: 0,
          absent: 2,
          requiresReview: 0,
          total: 10,
          ...overrides,
        },
        {
          group: range.startDate,
          early: 2,
          onTime: 1,
          late: 0,
          openSession: 0,
          autoClosed: 0,
          missing: 0,
          absent: 1,
          requiresReview: 0,
          total: 4,
        },
      ],
    },
  },
})

const exceptions = (rows = [
  {
    kind: 'ATTENDANCE',
    id: attendanceId,
    date: '2026-11-06T00:00:00.000Z',
    employee: employee('Ama', 'Boateng'),
    status: 'REQUIRES_REVIEW',
    sessionStatus: 'CLOSED',
    reason: 'The record needs a human decision.',
  },
  {
    kind: 'ATTEMPT',
    id: 'attempt-1',
    date: '2026-11-06T08:15:00.000Z',
    employee: employee('Kojo', 'Mensah'),
    action: 'CLOCK_IN',
    outcome: 'DENIED',
    step: 'LOCATION',
    locationResult: 'OUTSIDE',
    reason: 'Location assessment is outside the site.',
  },
], total = 7) => ({
  data: {
    success: true,
    data: rows,
    pagination: { currentPage: 1, totalPages: Math.ceil(total / 5), total },
  },
})

const register = (rows = [
  {
    id: registerId,
    date: '2026-11-06T00:00:00.000Z',
    clockIn: '2026-11-06T08:00:00.000Z',
    clockOut: '2026-11-06T17:00:00.000Z',
    hoursWorked: 9,
    status: 'ON_TIME',
    sessionStatus: 'CLOSED',
    employee: employee('Yaw', 'Osei'),
  },
], total = 120) => ({
  data: {
    success: true,
    data: rows,
    pagination: { currentPage: 1, totalPages: Math.ceil(total / 100), total },
  },
})

const queue = (total: number) => ({
  data: {
    success: true,
    data: [],
    pagination: { currentPage: 1, totalPages: 1, total },
  },
})

const requestStatus = (config: unknown): string | undefined =>
  (config as { params?: { status?: string } } | undefined)?.params?.status

const signIn = () => {
  localStorage.setItem('token', 'isolated-session')
  localStorage.setItem(
    'user',
    JSON.stringify({
      id: 'hr-1',
      role: 'HR',
      firstName: 'Ama',
      lastName: 'Boateng',
      mustChangePassword: false,
    })
  )
}

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <HrDashboard />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  signIn()
  get.mockImplementation(async (path, config) => {
    const url = String(path)
    const status = requestStatus(config)
    if (url.includes('/reports/punctuality-summary')) return punctuality()
    if (url.includes('/reports/exceptions')) return exceptions()
    if (url.includes('/reports/attendance-register')) return register()
    if (url.includes('/hr/help-requests')) return queue(status === 'OPEN' ? 3 : 2)
    if (url.includes('/hr/corrections')) return queue(4)
    throw new Error(`Unexpected request: ${url}`)
  })
})

describe('HrDashboard triage', () => {
  it('reads dated report and queue contracts and separates the daily concepts', async () => {
    renderDashboard()

    expect(await screen.findByText('Recorded today')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/reports/punctuality-summary', {
      params: { ...range, groupBy: 'day' },
    })
    expect(get).toHaveBeenCalledWith('/reports/exceptions', {
      params: { ...range, page: 1, limit: 5 },
    })
    expect(get).toHaveBeenCalledWith('/reports/attendance-register', {
      params: { ...range, page: 1, limit: 100 },
    })
    expect(get).toHaveBeenCalledWith('/hr/help-requests', {
      params: { status: 'OPEN', page: 1, limit: 1 },
    })
    expect(get).toHaveBeenCalledWith('/hr/help-requests', {
      params: { status: 'IN_REVIEW', page: 1, limit: 1 },
    })
    expect(get).toHaveBeenCalledWith('/hr/corrections', {
      params: { status: 'SUBMITTED', page: 1, limit: 1 },
    })

    const recorded = screen.getByText('Recorded today').parentElement as HTMLElement
    expect(within(recorded).getByText('8')).toBeInTheDocument()
    expect(within(recorded).getByText(/active staff rows, not a live headcount/)).toBeInTheDocument()
    const late = screen.getByText('Late today').parentElement as HTMLElement
    expect(within(late).getByText('1')).toBeInTheDocument()
    const absent = screen.getByText('Absent today').parentElement as HTMLElement
    expect(within(absent).getByText('2')).toBeInTheDocument()
    expect(within(absent).getByText(/active staff without a record/)).toBeInTheDocument()
    expect(screen.getByText('Open sessions: 3')).toBeInTheDocument()
    expect(
      screen.getByText(/Today and the 7-day range use this device's date\. Business-timezone handling is pending P17\./)
    ).toBeInTheDocument()
  })

  it('maps exception employees and statuses and links each kind to its owning screen', async () => {
    renderDashboard()

    expect((await screen.findAllByText('Ama Boateng')).length).toBe(2)
    expect(screen.getAllByText('Requires review')).toHaveLength(2)
    expect(screen.getAllByText('Kojo Mensah')).toHaveLength(2)
    expect(screen.getAllByText('Location outside')).toHaveLength(2)
    expect(screen.queryByText(/Former Employee/i)).not.toBeInTheDocument()

    const attendanceLink = screen
      .getAllByRole('link', { name: 'View' })
      .find(
        (link) =>
          link.getAttribute('href') ===
          `/hr-attendance/${attendanceId}?startDate=${range.startDate}&endDate=${range.endDate}&origin=exceptions`
      )
    expect(attendanceLink).toBeDefined()

    for (const attemptLink of screen.getAllByRole('link', { name: 'Open queue' })) {
      expect(attemptLink).toHaveAttribute(
        'href',
        `/hr-exceptions?startDate=${range.startDate}&endDate=${range.endDate}`
      )
    }
    expect(screen.getByText('Showing 2 of 7 in the last 7 days.')).toBeInTheDocument()
  })

  it('keeps help requests and corrections separately named with their queue context', async () => {
    renderDashboard()

    const helpOpen = await screen.findByRole('link', { name: /Help requests · Open/ })
    expect(within(helpOpen).getByText('3')).toBeInTheDocument()
    expect(helpOpen).toHaveAttribute('href', '/hr-help-requests?status=OPEN')

    const helpReview = screen.getByRole('link', { name: /Help requests · In review/ })
    expect(within(helpReview).getByText('2')).toBeInTheDocument()
    expect(helpReview).toHaveAttribute('href', '/hr-help-requests?status=IN_REVIEW')

    const corrections = screen.getByRole('link', { name: /Corrections · Awaiting decision/ })
    expect(within(corrections).getByText('4')).toBeInTheDocument()
    expect(corrections).toHaveAttribute('href', '/hr-corrections?status=SUBMITTED')

    const review = screen.getByRole('link', { name: /Review exceptions · Last 7 days/ })
    expect(within(review).getByText('7')).toBeInTheDocument()
    expect(review).toHaveAttribute(
      'href',
      `/hr-exceptions?startDate=${range.startDate}&endDate=${range.endDate}`
    )
  })

  it('replaces the full register with bounded previews and states chart coverage', async () => {
    renderDashboard()

    expect(await screen.findByText('Recent attendance')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^All Attendance$/i })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()

    expect(screen.getAllByText('Yaw Osei')).toHaveLength(2)
    const rowLink = screen
      .getAllByRole('link', { name: 'View' })
      .find(
        (link) =>
          link.getAttribute('href') ===
          `/hr-attendance/${registerId}?startDate=${range.startDate}&endDate=${range.endDate}`
      )
    expect(rowLink).toBeDefined()
    expect(screen.getByText(/Hours \/ day — first 1 of 120 records/)).toBeInTheDocument()
    expect(screen.getByText(/The register holds 120 records in this period/)).toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 120 records in the last 7 days.')).toBeInTheDocument()

    const registerLink = screen.getByRole('link', { name: /View register/ })
    expect(registerLink).toHaveAttribute(
      'href',
      `/hr-attendance?startDate=${range.startDate}&endDate=${range.endDate}`
    )
  })

  it('renders an explicit failure and retry instead of zero metrics', async () => {
    get.mockRejectedValueOnce(new Error('offline'))
    renderDashboard()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load dashboard data. Check the connection and try again.'
    )
    expect(screen.queryByText('Recorded today')).not.toBeInTheDocument()
    expect(screen.queryByText('Open sessions: 0')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Recorded today')).toBeInTheDocument()
  })

  it('renders a successful zero rather than treating it as a failure', async () => {
    get.mockImplementation(async (path, config) => {
      const url = String(path)
      const status = requestStatus(config)
      if (url.includes('/reports/punctuality-summary')) {
        return punctuality({ early: 0, late: 0, openSession: 0, absent: 0, total: 0 })
      }
      if (url.includes('/reports/exceptions')) return exceptions([], 0)
      if (url.includes('/reports/attendance-register')) return register([], 0)
      if (url.includes('/hr/help-requests')) return queue(status === 'OPEN' ? 0 : 0)
      if (url.includes('/hr/corrections')) return queue(0)
      throw new Error(`Unexpected request: ${url}`)
    })

    renderDashboard()

    expect(await screen.findByText('Recorded today')).toBeInTheDocument()
    const recorded = screen.getByText('Recorded today').parentElement as HTMLElement
    expect(within(recorded).getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Open sessions: 0')).toBeInTheDocument()
    expect(screen.getByText('No exceptions in this period.')).toBeInTheDocument()
    expect(screen.getByText('No attendance records in this period.')).toBeInTheDocument()
  })

  it('refuses a successful report without a bucket for today', async () => {
    get.mockImplementation(async (path, config) => {
      const url = String(path)
      if (url.includes('/reports/punctuality-summary')) {
        return { data: { success: true, data: { rows: [] } } }
      }
      if (url.includes('/reports/exceptions')) return exceptions([], 0)
      if (url.includes('/reports/attendance-register')) return register([], 0)
      if (url.includes('/hr/help-requests')) return queue(requestStatus(config) === 'OPEN' ? 0 : 0)
      if (url.includes('/hr/corrections')) return queue(0)
      throw new Error(`Unexpected request: ${url}`)
    })

    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load dashboard data')
    expect(screen.queryByText('Recorded today')).not.toBeInTheDocument()
  })

  it('refreshes the device-date range when the page remains open after midnight', async () => {
    get.mockImplementation(async (path, config) => {
      const url = String(path)
      if (url.includes('/reports/punctuality-summary')) {
        const day = (config as { params: { endDate: string } }).params.endDate
        const response = punctuality()
        response.data.data.rows[0] = { ...response.data.data.rows[0], group: day, late: day === todayKey ? 1 : 9 }
        return response
      }
      if (url.includes('/reports/exceptions')) return exceptions()
      if (url.includes('/reports/attendance-register')) return register()
      if (url.includes('/hr/help-requests')) return queue(requestStatus(config) === 'OPEN' ? 3 : 2)
      if (url.includes('/hr/corrections')) return queue(4)
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.useFakeTimers()
    const view = renderDashboard()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('Recorded today')).toBeInTheDocument()

    const nextDay = new Date()
    nextDay.setDate(nextDay.getDate() + 1)
    vi.setSystemTime(nextDay)
    const nextDate = deviceDate(nextDay)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(get).toHaveBeenCalledWith('/reports/punctuality-summary', {
      params: expect.objectContaining({ endDate: nextDate, groupBy: 'day' }),
    })
    const late = screen.getByText('Late today').parentElement as HTMLElement
    expect(within(late).getByText('9')).toBeInTheDocument()
    view.unmount()
    vi.useRealTimers()
  })
})
