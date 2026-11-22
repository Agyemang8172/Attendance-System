import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import KpiCard, { KpiHero } from '../components/ui/KpiCard'
import HoursChart from '../components/charts/HoursChart'
import SessionsChart from '../components/charts/SessionsChart'
import { BentoSkeleton } from '../components/ui/Skeleton'
import Pill from '../components/ui/Pill'
import {
  buildHoursChartData,
  buildSessionsChartData,
  formatHoursValue,
  formatShortDate,
  formatTodayLong,
} from '../lib/attendance-format'
import { attendanceLabels } from '../lib/staff-attendance-detail'
import { operationalStatusTone } from '../lib/hr-attendance-data'
import { FaClock, FaTriangleExclamation, FaChevronRight } from 'react-icons/fa6'

// ─── HrDashboard ──────────────────────────────────────────────────────────────
// P09 triage view. It reads only the supported dated report and queue contracts:
//   GET /api/reports/punctuality-summary?groupBy=day&startDate&endDate
//   GET /api/reports/exceptions?startDate&endDate&page&limit
//   GET /api/reports/attendance-register?startDate&endDate&page&limit
//   GET /api/hr/help-requests?status&page&limit
//   GET /api/hr/corrections?status&page&limit
//
// The dashboard does not duplicate the full register or the queues. It shows
// counts with drill-through links, a five-row exception preview and a five-row
// attendance preview. The 7-day window uses this device's date; business-time
// handling is explicitly pending P17, so no timezone calculation is invented
// here.

interface PunctualityRow {
  group: string
  early: number
  onTime: number
  late: number
  openSession: number
  autoClosed: number
  missing: number
  absent: number
  requiresReview: number
  total: number
}

interface Employee {
  id: string
  employeeCode?: string | null
  firstName: string
  lastName: string
}

interface RegisterRow {
  id: string
  date: string
  clockIn: string | null
  clockOut: string | null
  hoursWorked: number | null
  status: string | null
  sessionStatus: string | null
  employee: Employee | null
}

interface ExceptionRow {
  kind: 'ATTENDANCE' | 'ATTEMPT'
  id: string
  date: string
  employee: Employee | null
  status?: string | null
  sessionStatus?: string | null
  reason?: string | null
  action?: string | null
  outcome?: string | null
  step?: string | null
  locationResult?: string | null
}

interface DashboardData {
  rows: PunctualityRow[]
  exceptions: ExceptionRow[]
  exceptionsTotal: number
  register: RegisterRow[]
  registerTotal: number
  helpOpen: number
  helpInReview: number
  correctionsSubmitted: number
}

const pad = (value: number) => String(value).padStart(2, '0')

/** The dashboard window follows the device date, as flagged in the page note. */
const deviceDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const deviceRange = () => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - 6)
  return { startDate: deviceDate(start), endDate: deviceDate(end) }
}

const readTotal = (response: { data?: { pagination?: { total?: unknown } } }): number => {
  const total = response.data?.pagination?.total
  if (!Number.isSafeInteger(total) || (total as number) < 0) {
    throw new Error('Unconfirmed pagination')
  }
  return total as number
}

const employeeName = (employee: Employee | null | undefined): string =>
  employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown employee'

const sessionLabel = (sessionStatus: string | null | undefined): string =>
  sessionStatus === 'OPEN' ? 'Open' : sessionStatus === 'CLOSED' ? 'Closed' : 'Unavailable'

const exceptionType = (row: ExceptionRow): { label: string; tone: 'error' | 'success' | 'warning' | 'neutral' } => {
  if (row.kind === 'ATTENDANCE') {
    return {
      label: attendanceLabels[row.status || ''] || row.status || 'Exception',
      tone: operationalStatusTone(row.status),
    }
  }
  return {
    label: row.locationResult ? `Location ${row.locationResult.toLowerCase()}` : row.outcome || 'Attempt',
    tone: 'warning',
  }
}

function HrDashboard() {
  const user = getCurrentUser()

  const [data, setData] = useState<DashboardData | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const [range, setRange] = useState(deviceRange)

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = deviceRange()
      setRange((current) => current.endDate === next.endDate ? current : next)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setFetching(true)
      setError('')
      try {
        const rangeParams = { startDate: range.startDate, endDate: range.endDate }
        const [
          punctualityRes,
          exceptionsRes,
          registerRes,
          helpOpenRes,
          helpInReviewRes,
          correctionsRes,
        ] = await Promise.all([
          api.get('/reports/punctuality-summary', { params: { ...rangeParams, groupBy: 'day' } }),
          api.get('/reports/exceptions', { params: { ...rangeParams, page: 1, limit: 5 } }),
          api.get('/reports/attendance-register', { params: { ...rangeParams, page: 1, limit: 100 } }),
          api.get('/hr/help-requests', { params: { status: 'OPEN', page: 1, limit: 1 } }),
          api.get('/hr/help-requests', { params: { status: 'IN_REVIEW', page: 1, limit: 1 } }),
          api.get('/hr/corrections', { params: { status: 'SUBMITTED', page: 1, limit: 1 } }),
        ])

        const rows = punctualityRes.data?.data?.rows
        const exceptions = exceptionsRes.data?.data
        const register = registerRes.data?.data
        if (!Array.isArray(rows) || !rows.some((row) => row?.group === range.endDate)
          || !Array.isArray(exceptions) || !Array.isArray(register)) {
          throw new Error('Unconfirmed report response')
        }

        if (!cancelled) {
          setData({
            rows,
            exceptions,
            exceptionsTotal: readTotal(exceptionsRes),
            register,
            registerTotal: readTotal(registerRes),
            helpOpen: readTotal(helpOpenRes),
            helpInReview: readTotal(helpInReviewRes),
            correctionsSubmitted: readTotal(correctionsRes),
          })
        }
      } catch {
        if (!cancelled) {
          setData(null)
          setError('Could not load dashboard data. Check the connection and try again.')
        }
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [range, attempt])

  const today = data?.rows.find((row) => row.group === range.endDate)
  const recordedToday = today ? Math.max(0, today.total - today.absent) : 0
  const lateToday = today?.late ?? 0
  const absentToday = today?.absent ?? 0
  const openToday = today?.openSession ?? 0

  const chartRecords = useMemo(
    () =>
      (data?.register ?? []).map((row) => ({
        date: row.date,
        hoursWorked: row.hoursWorked,
        status: row.status ?? undefined,
        sessionStatus: row.sessionStatus ?? undefined,
      })),
    [data]
  )
  const hoursChartData = useMemo(() => buildHoursChartData(chartRecords), [chartRecords])
  const sessionsChartData = useMemo(() => buildSessionsChartData(chartRecords), [chartRecords])

  const registerLink = `/hr-attendance?startDate=${range.startDate}&endDate=${range.endDate}`
  const exceptionsLink = `/hr-exceptions?startDate=${range.startDate}&endDate=${range.endDate}`
  const attendanceDetailLink = (id: string) =>
    `/hr-attendance/${encodeURIComponent(id)}?startDate=${range.startDate}&endDate=${range.endDate}`
  const exceptionAttendanceLink = (id: string) => `${attendanceDetailLink(id)}&origin=exceptions`
  const registerTruncated = Boolean(data && data.registerTotal > data.register.length)
  const exceptionsTruncated = Boolean(data && data.exceptionsTotal > data.exceptions.length)
  const chartCoverage = data && registerTruncated
    ? `first ${data.register.length} of ${data.registerTotal} records`
    : 'last 7 days'
  const recentRegister = data?.register.slice(0, 5) ?? []

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title={<>Welcome, {user?.firstName}.</>}
      />

      <p role="note" className="text-caption text-ink-muted mb-6">
        Today and the 7-day range use this device&apos;s date. Business-timezone handling is pending P17.
      </p>

      {fetching && <BentoSkeleton />}

      {!fetching && error && (
        <div role="alert" className="card p-6 border-error-soft">
          <p className="text-body text-error">{error}</p>
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!fetching && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiHero
              eyebrow="Recorded today"
              value={recordedToday}
              unit="records"
              subtext="active staff rows, not a live headcount"
            >
              <Pill tone="accent" mono>Open sessions: {openToday}</Pill>
            </KpiHero>
            <KpiCard
              icon={<FaClock aria-hidden="true" />}
              label="Late today"
              value={lateToday}
              subtext="late arrivals"
              scheme="warning"
            />
            <KpiCard
              icon={<FaTriangleExclamation aria-hidden="true" />}
              label="Absent today"
              value={absentToday}
              subtext="active staff without a record"
              scheme="error"
            />
          </div>

          <section className="mb-8">
            <SectionHeader title="Needs attention" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/hr-help-requests?status=OPEN"
                className="card p-5 cursor-pointer hover:border-accent active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <p className="text-caption text-ink-muted">Help requests · Open</p>
                <p className="mt-1 font-mono text-display-md text-ink leading-none">{data.helpOpen}</p>
                <p className="mt-1 text-caption text-ink-subtle">Open the queue</p>
              </Link>
              <Link
                to="/hr-help-requests?status=IN_REVIEW"
                className="card p-5 cursor-pointer hover:border-accent active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <p className="text-caption text-ink-muted">Help requests · In review</p>
                <p className="mt-1 font-mono text-display-md text-ink leading-none">{data.helpInReview}</p>
                <p className="mt-1 text-caption text-ink-subtle">Open the queue</p>
              </Link>
              <Link
                to="/hr-corrections?status=SUBMITTED"
                className="card p-5 cursor-pointer hover:border-accent active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <p className="text-caption text-ink-muted">Corrections · Awaiting decision</p>
                <p className="mt-1 font-mono text-display-md text-ink leading-none">{data.correctionsSubmitted}</p>
                <p className="mt-1 text-caption text-ink-subtle">Open the queue</p>
              </Link>
              <Link
                to={exceptionsLink}
                className="card p-5 cursor-pointer hover:border-accent active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <p className="text-caption text-ink-muted">Review exceptions · Last 7 days</p>
                <p className="mt-1 font-mono text-display-md text-ink leading-none">{data.exceptionsTotal}</p>
                <p className="mt-1 text-caption text-ink-subtle">Open the queue</p>
              </Link>
            </div>
          </section>

          <section className="mb-8">
            <SectionHeader title="Last 7 days" />
            {registerTruncated && (
              <p role="note" className="text-caption text-ink-muted mb-4">
                The register holds {data.registerTotal} records in this period. The charts use the
                {' '}most recent {data.register.length} of them; open the register for the full set.
              </p>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card-elevated relative overflow-hidden">
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />
                <p className="text-caption text-ink-muted mb-4">
                  Hours / day — {chartCoverage}
                </p>
                <HoursChart data={hoursChartData} />
              </div>
              <div className="card-elevated relative overflow-hidden">
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />
                <p className="text-caption text-ink-muted mb-4">
                  Session breakdown — {chartCoverage}
                </p>
                <SessionsChart data={sessionsChartData} />
              </div>
            </div>
          </section>

          <section className="mb-8">
            <SectionHeader
              title="Recent exceptions"
              actions={
                <Link
                  to={exceptionsLink}
                  className="inline-flex items-center gap-1.5 text-caption font-mono text-accent hover:text-accent-hover transition-colors"
                >
                  View all
                  <FaChevronRight className="text-xs" aria-hidden="true" />
                </Link>
              }
            />
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              {data.exceptions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-ink-muted text-body-sm">No exceptions in this period.</p>
                </div>
              ) : (
                <>
                  <div className="md:hidden divide-y divide-hairline">
                    {data.exceptions.map((row) => {
                      const type = exceptionType(row)
                      const href = row.kind === 'ATTENDANCE'
                        ? exceptionAttendanceLink(row.id)
                        : exceptionsLink
                      return (
                        <div key={`mobile-${row.kind}-${row.id}`} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-body-sm font-sans text-ink truncate">{employeeName(row.employee)}</p>
                              <p className="text-caption font-mono text-ink-subtle">{formatShortDate(row.date)}</p>
                            </div>
                            <Pill tone={type.tone} mono>{type.label}</Pill>
                          </div>
                          <p className="mt-2 text-caption text-ink-muted">{row.reason || '—'}</p>
                          <Link
                            to={href}
                            className="mt-2 inline-flex text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                          >
                            {row.kind === 'ATTENDANCE' ? 'View' : 'Open queue'}
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-max border-collapse">
                      <thead>
                        <tr className="border-b border-hairline">
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Employee</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Date</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Type</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Reason</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.exceptions.map((row, index) => {
                          const type = exceptionType(row)
                          return (
                            <tr
                              key={`${row.kind}-${row.id}`}
                              className={[
                                'border-b border-hairline last:border-b-0 transition-colors duration-150',
                                index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                              ].join(' ')}
                            >
                              <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                                {employeeName(row.employee)}
                              </td>
                              <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                                {formatShortDate(row.date)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Pill tone={type.tone} mono>{type.label}</Pill>
                              </td>
                              <td className="px-4 py-3 text-body-sm text-ink-muted max-w-xs truncate">
                                {row.reason || '—'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Link
                                  to={row.kind === 'ATTENDANCE'
                                    ? exceptionAttendanceLink(row.id)
                                    : exceptionsLink}
                                  className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                                >
                                  {row.kind === 'ATTENDANCE' ? 'View' : 'Open queue'}
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <p className="text-caption text-ink-muted mt-2">
              {exceptionsTruncated
                ? `Showing ${data.exceptions.length} of ${data.exceptionsTotal} in the last 7 days.`
                : `${data.exceptionsTotal} exception${data.exceptionsTotal === 1 ? '' : 's'} in the last 7 days.`}
            </p>
          </section>

          <section>
            <SectionHeader
              title="Recent attendance"
              actions={
                <Link
                  to={registerLink}
                  className="inline-flex items-center gap-1.5 text-caption font-mono text-accent hover:text-accent-hover transition-colors"
                >
                  View register
                  <FaChevronRight className="text-xs" aria-hidden="true" />
                </Link>
              }
            />
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              {recentRegister.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-ink-muted text-body-sm">No attendance records in this period.</p>
                </div>
              ) : (
                <>
                  <div className="md:hidden divide-y divide-hairline">
                    {recentRegister.map((row) => (
                      <div key={`mobile-${row.id}`} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-body-sm font-sans text-ink truncate">{employeeName(row.employee)}</p>
                            <p className="text-caption font-mono text-ink-subtle">{formatShortDate(row.date)}</p>
                          </div>
                          <Pill tone={operationalStatusTone(row.status)} mono>
                            {attendanceLabels[row.status || ''] || row.status || 'Unavailable'}
                          </Pill>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-caption text-ink-muted">
                          <Pill mono>{sessionLabel(row.sessionStatus)}</Pill>
                          <span className="font-mono">{formatHoursValue(row.hoursWorked)}</span>
                        </div>
                        <Link
                          to={attendanceDetailLink(row.id)}
                          className="mt-2 inline-flex text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                        >
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-max border-collapse">
                      <thead>
                        <tr className="border-b border-hairline">
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Employee</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Date</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Classification</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Session</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Hours</th>
                          <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentRegister.map((row, index) => (
                          <tr
                            key={row.id}
                            className={[
                              'border-b border-hairline last:border-b-0 transition-colors duration-150',
                              index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                            ].join(' ')}
                          >
                            <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                              {employeeName(row.employee)}
                            </td>
                            <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                              {formatShortDate(row.date)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Pill tone={operationalStatusTone(row.status)} mono>
                                {attendanceLabels[row.status || ''] || row.status || 'Unavailable'}
                              </Pill>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Pill mono>{sessionLabel(row.sessionStatus)}</Pill>
                            </td>
                            <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                              {formatHoursValue(row.hoursWorked)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Link
                                to={attendanceDetailLink(row.id)}
                                className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <p className="text-caption text-ink-muted mt-2">
              Showing {recentRegister.length} of {data.registerTotal} records in the last 7 days.
            </p>
          </section>
        </>
      )}
    </Layout>
  )
}

export default HrDashboard
