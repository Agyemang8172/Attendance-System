import { useState, useEffect, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import KpiCard, { KpiHero } from '../components/ui/KpiCard'
import AttendanceTable from '../components/ui/AttendanceTable'
import HoursChart from '../components/charts/HoursChart'
import SessionsChart from '../components/charts/SessionsChart'
import { BentoSkeleton, ChartSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import { FaClock, FaUserCheck, FaSearch } from 'react-icons/fa'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isLate = (clockInStr: string) => {
  const d = new Date(clockInStr)
  return d.getHours() > 6 || (d.getHours() === 6 && d.getMinutes() >= 30)
}

const isToday = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

const formatTodayLong = () =>
  new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// ─── Chart data builders ──────────────────────────────────────────────────────

// Bar chart: total org hours per day for last 7 days
const buildHoursChartData = (records: any[]) => {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const label = d.toLocaleDateString('en-GB', { weekday: 'short' })
    const dateStr = d.toDateString()
    const total = records
      .filter((r) => new Date(r.date).toDateString() === dateStr)
      .reduce((sum, r) => sum + (r.hoursWorked || 0), 0)
    days.push({ day: label, hours: parseFloat(total.toFixed(1)) })
  }
  return days
}

// Donut chart: open / closed / late counts for last 7 days
const buildSessionsChartData = (records: any[]) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const week = records.filter((r) => new Date(r.date) >= sevenDaysAgo)
  const closed = week.filter(
    (r) => r.sessionStatus === 'CLOSED' && !isLate(r.clockIn)
  ).length
  const late = week.filter(
    (r) => r.sessionStatus === 'CLOSED' && isLate(r.clockIn)
  ).length
  const open = week.filter((r) => r.sessionStatus === 'OPEN').length
  return [
    { name: 'CLOSED', value: closed },
    { name: 'LATE', value: late },
    { name: 'OPEN', value: open },
  ].filter((s) => s.value > 0)
}

// ─── HrDashboard ──────────────────────────────────────────────────────────────

function HrDashboard() {
  const user = getCurrentUser()

  const [records, setRecords] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchAllAttendance = async () => {
      try {
        const res = await api.get('/attendance/all-attendance')
        setRecords(res.data.data || [])
      } catch (_error) {
        toast.error('Failed to load attendance records.')
      } finally {
        setFetching(false)
      }
    }
    fetchAllAttendance()
  }, [])

  // ── KPIs — today only ──────────────────────────────────────────────────────

  const clockedInToday = records.filter(
    (r) => isToday(r.date) && r.sessionStatus === 'OPEN'
  ).length

  const lateToday = records.filter(
    (r) => isToday(r.date) && isLate(r.clockIn)
  ).length

  // Sessions left open on an earlier day — the "forgot to clock out" backlog.
  const notYetClockedOut = records.filter(
    (r) => r.sessionStatus === 'OPEN' && !isToday(r.date)
  ).length

  // ── Chart data ─────────────────────────────────────────────────────────────

  const hoursChartData = useMemo(() => buildHoursChartData(records), [records])
  const sessionsChartData = useMemo(() => buildSessionsChartData(records), [records])

  // ── Search filter — client-side, real-time ─────────────────────────────────

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records
    const q = searchQuery.toLowerCase()
    return records.filter((r) => {
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
      return (
        name.includes(q) ||
        dept.includes(q) ||
        date.includes(q) ||
        status.includes(q)
      )
    })
  }, [records, searchQuery])

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="mb-8">
        <p className="text-ink-muted text-caption font-mono mb-1">
          {formatTodayLong()}
        </p>
        <h1 className="text-display-sm text-ink font-serif leading-tight">
          Welcome, {user?.firstName}.
        </h1>
        <p className="text-ink-muted text-body-sm mt-1">
          Full attendance overview — all staff, exceptions first.
        </p>
        <div className="mt-3 h-px w-12 bg-accent opacity-40" />
      </header>

      {/* ── KPI Bento — hero + two dense metrics (R10, §11) ─────────────── */}
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

      {/* ── Weekly Overview — Charts ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-body-sm font-medium text-ink">Weekly Overview</h2>
          <div className="mt-2 h-0.5 w-10 bg-accent opacity-40" />
        </div>

        {fetching ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar chart — org hours per day, last 7 days */}
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />
              <p className="text-caption text-ink-muted mb-4">
                Org hours / day — last 7 days
              </p>
              <HoursChart data={hoursChartData} />
            </div>

            {/* Donut chart — session breakdown this week */}
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

      {/* ── All Attendance ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-body-sm font-medium text-ink">All Attendance</h2>
          <div className="mt-2 h-0.5 w-10 bg-accent opacity-40" />
        </div>

        {/* Search input */}
        <div className="relative mb-4">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle text-xs pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, department, date or status…"
            className="input"
          />
        </div>

        {/* No results state */}
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