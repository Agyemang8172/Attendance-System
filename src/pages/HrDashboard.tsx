import { useState, useEffect, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import KpiCard, { KpiHero } from '../components/ui/KpiCard'
import AttendanceTable from '../components/ui/AttendanceTable.tsx'
import HoursChart from '../components/charts/HoursChart'
import SessionsChart from '../components/charts/SessionsChart'
import { BentoSkeleton, ChartSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import Pill from '../components/ui/Pill'
import SearchInput from '../components/ui/SearchInput'
import { buildHoursChartData, buildSessionsChartData, formatTodayLong, isToday } from '../lib/attendance-format'
import type { AttendanceRecord } from '../types'
import { FaClock, FaUserCheck, FaTriangleExclamation, FaChevronRight } from 'react-icons/fa6'

// ─── HrDashboard ──────────────────────────────────────────────────────────────
// Exception-first dashboard composed from real report endpoints:
//   GET /api/reports/punctuality-summary?groupBy=day
//   GET /api/reports/exceptions
// Replaces heuristic KPIs (6:30 hardcoded) with server-authoritative data.

function HrDashboard() {
  const user = getCurrentUser()

  const [punctualityData, setPunctualityData] = useState<any[]>([])
  const [exceptionsData, setExceptionsData] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [punctualityRes, exceptionsRes, attendanceRes] = await Promise.all([
          api.get('/reports/punctuality-summary', { params: { groupBy: 'day' } }),
          api.get('/reports/exceptions'),
          api.get('/attendance/all-attendance'),
        ])
        setPunctualityData(punctualityRes.data.data || [])
        setExceptionsData(exceptionsRes.data.data || [])
        setAttendanceRecords(attendanceRes.data.data || [])
      } catch (_error) {
        toast.error('Failed to load dashboard data.')
      } finally {
        setFetching(false)
      }
    }
    fetchDashboardData()
  }, [])

  // ── KPIs — today only from real statuses ────────────────────────────────────
  const clockedInToday = attendanceRecords.filter(
    (r) => isToday(r.date) && r.sessionStatus === 'OPEN'
  ).length

  const lateToday = punctualityData
    .find((d) => isToday(d.date))?.late || 0

  const notYetClockedOut = attendanceRecords.filter(
    (r) => r.sessionStatus === 'OPEN' && !isToday(r.date)
  ).length

  // ── Exception strip counts ──────────────────────────────────────────────────
  const lateCount = exceptionsData.filter((e) => e.status === 'LATE').length
  const absentCount = exceptionsData.filter((e) => e.status === 'ABSENT').length
  const flaggedCount = exceptionsData.filter(
    (e) => e.status === 'REQUIRES_REVIEW' || e.locationFlag === 'OUTSIDE' || e.locationFlag === 'UNKNOWN'
  ).length

  // ── Chart data ──────────────────────────────────────────────────────────────
  const hoursChartData = useMemo(() => buildHoursChartData(attendanceRecords), [attendanceRecords])
  const sessionsChartData = useMemo(() => buildSessionsChartData(attendanceRecords), [attendanceRecords])

  // ── Search filter — client-side, real-time ──────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return attendanceRecords
    const q = searchQuery.toLowerCase()
    return attendanceRecords.filter((r) => {
      const name = r.user
        ? `${r.user.firstName} ${r.user.lastName}`.toLowerCase()
        : 'former employee'
      const dept = (r.user?.department || '').toLowerCase()
      const date = new Date(r.date)
        .toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        .toLowerCase()
      const status = (r.sessionStatus || '').toLowerCase()
      return name.includes(q) || dept.includes(q) || date.includes(q) || status.includes(q)
    })
  }, [attendanceRecords, searchQuery])

  // ── Recent exceptions (5 rows) ──────────────────────────────────────────────
  const recentExceptions = useMemo(
    () => exceptionsData.slice(0, 5),
    [exceptionsData]
  )

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow={formatTodayLong()}
        title={<>Welcome, {user?.firstName}.</>}
      />

      {/* ── Exception Strip (O9) ──────────────────────────────────────────── */}
      {!fetching && (
        <SectionHeader
          title="Exceptions Requiring Attention"
          actions={
            <div className="flex items-center gap-4 text-caption font-mono">
              <Pill tone="warning" mono>Late: {lateCount}</Pill>
              <Pill tone="error" mono>Absent: {absentCount}</Pill>
              <Pill tone="accent" mono>Flagged: {flaggedCount}</Pill>
            </div>
          }
        />
      )}

      {/* ── KPI Bento — hero + two dense metrics ───────────────────────────── */}
      {fetching ? (
        <BentoSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiHero
            eyebrow="Clocked In Today"
            value={clockedInToday}
            unit="staff"
            subtext="signed in right now"
          />
          <KpiCard
            icon={<FaClock aria-hidden="true" />}
            label="Late Today"
            value={lateToday}
            subtext="late arrivals"
            scheme="warning"
          />
          <KpiCard
            icon={<FaUserCheck aria-hidden="true" />}
            label="Not Yet Clocked Out"
            value={notYetClockedOut}
            subtext="sessions left open"
            scheme="error"
          />
        </div>
      )}

      {/* ── Weekly Overview — Charts ──────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader title="Weekly Overview" />
        {fetching ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />
              <p className="text-caption text-ink-muted mb-4">
                Org hours / day — last 7 days
              </p>
              <HoursChart data={hoursChartData} />
            </div>
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />
              <p className="text-caption text-ink-muted mb-4">
                Session breakdown — this week
              </p>
              <SessionsChart data={sessionsChartData} />
            </div>
          </div>
        )}
      </section>

      {/* ── Recent Exceptions (5 rows) ─────────────────────────────────────── */}
      {!fetching && (
        <section className="mb-8">
          <SectionHeader
            title="Recent Exceptions"
            actions={
              <a
                href="/hr-exceptions"
                className="inline-flex items-center gap-1.5 text-caption font-mono text-accent hover:text-accent-hover transition-colors"
              >
                View all
                <FaChevronRight className="text-xs" aria-hidden="true" />
              </a>
            }
          />
          <div className="card-elevated relative overflow-hidden">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
            {exceptionsData.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No exceptions to review.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                    {recentExceptions.map((ex, index) => (
                      <tr
                        key={ex.id || index}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                          {ex.user ? `${ex.user.firstName} ${ex.user.lastName}` : 'Former Employee'}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {new Date(ex.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill
                            tone={
                              ex.status === 'LATE' ? 'warning' :
                              ex.status === 'ABSENT' ? 'error' :
                              'accent'
                            }
                            mono
                          >
                            {ex.status}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap text-ink-muted max-w-xs truncate">
                          {ex.reason || ex.locationFlag || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <a
                            href={`/hr-exceptions/${ex.id}`}
                            className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── All Attendance ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="All Attendance" />
        <SearchInput
          label="Search attendance"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, department, date or status…"
        />
        {!fetching && searchQuery && filteredRecords.length === 0 && (
          <div className="card-elevated px-6 py-10 text-center mb-4">
            <p className="text-ink-muted text-body-sm">
              No results for <span className="text-ink font-mono">"{searchQuery}"</span>
            </p>
            <p className="text-ink-subtle text-caption mt-1">
              Try a different name, department, date or status.
            </p>
          </div>
        )}
        {fetching ? (
          <TableSkeleton showEmployee />
        ) : (
          (!searchQuery || filteredRecords.length > 0) && (
            <AttendanceTable
              records={filteredRecords}
              showEmployee={true}
              exceptionsFirst={true}
            />
          )
        )}
      </section>
    </Layout>
  )
}

export default HrDashboard