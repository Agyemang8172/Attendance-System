import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import KpiCard from '../components/ui/KpiCard'
import AttendanceTable from '../components/ui/AttendanceTable'
import { FaClock, FaFire, FaChartLine, FaExclamationTriangle } from 'react-icons/fa'
import { BsCircleFill } from 'react-icons/bs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isLate = (clockInStr: string) => {
  const d = new Date(clockInStr)
  return d.getHours() > 6 || (d.getHours() === 6 && d.getMinutes() >= 30)
}

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const formatTodayLong = () =>
  new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const user = getCurrentUser()

  const [records, setRecords] = useState([])
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [clockLoading, setClockLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  // ── Fetch attendance + derive clock state ──────────────────────────────────
  const fetchAttendance = useCallback(async () => {
    try {
      const res = await api.get('/attendance/my-attendance')
      const data = res.data.data || []
      setRecords(data)

      const openSession = data.find((r) => r.sessionStatus === 'OPEN')
      setIsClockedIn(!!openSession)

      // Auto clock-out alert
      const stale = data.filter(
        (r) => r.autoClosedOut === true && r.alertDismissed === false
      )
      stale.forEach(async (r) => {
        const date = new Date(r.date).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
        toast(
          `You forgot to clock out on ${date}. The system clocked you out at 11:59 PM. Please review your record.`,
          { icon: <FaExclamationTriangle aria-hidden="true" />, duration: 7000 }
        )
        try { await api.patch(`/attendance/${r.id}/dismiss-alert`) } catch (_) {}
      })
    } catch {
      toast.error('Failed to load attendance records.')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  // ── Clock In ───────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setClockLoading(true)
    try {
      await api.post('/attendance/clock-in')
      toast.success('Clocked in successfully.')
      await fetchAttendance()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Clock in failed.')
    } finally {
      setClockLoading(false)
    }
  }

  // ── Clock Out ──────────────────────────────────────────────────────────────
  const handleClockOut = async () => {
    setClockLoading(true)
    try {
      await api.post('/attendance/clock-out')
      toast.success('Clocked out successfully.')
      await fetchAttendance()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Clock out failed.')
    } finally {
      setClockLoading(false)
    }
  }

  // ── KPI calculations ───────────────────────────────────────────────────────

  // 1. Weekly Hours — sum hoursWorked for the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const weeklyHours = records
    .filter((r) => new Date(r.date) >= sevenDaysAgo)
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0)
    .toFixed(1)

  // 2. Streak — consecutive closed sessions going backwards from today
  const sortedClosed = [...records]
    .filter((r) => r.sessionStatus === 'CLOSED')
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  let streak = 0
  let prevDate: Date | null = null
  for (const r of sortedClosed) {
    const d = new Date(r.date)
    d.setHours(0, 0, 0, 0)
    if (!prevDate) {
      streak = 1
      prevDate = d
    } else {
      const diff = (prevDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
      if (diff === 1) {
        streak++
        prevDate = d
      } else {
        break
      }
    }
  }

  // 3. Attendance Rate — closed sessions this calendar month / 22 working days
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const closedThisMonth = records.filter(
    (r) => r.sessionStatus === 'CLOSED' && new Date(r.date) >= startOfMonth
  ).length
  const attendanceRate =
    closedThisMonth > 0
      ? Math.min(Math.round((closedThisMonth / 22) * 100), 100)
      : 0

  // 4. Late Arrivals — records this month where clockIn >= 06:30
  const lateArrivals = records.filter(
    (r) => new Date(r.date) >= startOfMonth && isLate(r.clockIn)
  ).length

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">

        {/* Left — date eyebrow + big greeting */}
        <div>
          <p className="text-ink-muted text-xs font-mono uppercase tracking-widest mb-4">
            {formatTodayLong()}
          </p>
          <h1 className="text-display-xl text-ink font-serif leading-none tracking-tight">
            {getGreeting()},<br />
            {user?.firstName}.
          </h1>
          {/* Accent divider */}
          <div className="mt-5 h-0.5 w-20 bg-accent" />
        </div>

        {/* Right — clock status pill + action button */}
        <div className="flex items-center gap-4 sm:mb-1">

          {/* Status indicator */}
          <div className="flex items-center gap-2 bg-surface-1 border border-hairline rounded-full px-3 py-1.5">
            <BsCircleFill
              className={`text-[8px] ${isClockedIn ? 'text-success' : 'text-error'}`}
            />
            <span className="text-ink-muted text-xs font-mono">
              {isClockedIn ? 'Clocked In' : 'Clocked Out'}
            </span>
          </div>

          {/* Primary CTA — accent when clocking in, soft red when out */}
          {isClockedIn ? (
            <button
              onClick={handleClockOut}
              disabled={clockLoading}
              className="btn-secondary"
            >
              {clockLoading ? 'Processing…' : 'Clock Out'}
            </button>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={clockLoading}
              className="btn-primary"
            >
              {clockLoading ? 'Processing…' : 'Clock In'}
            </button>
          )}
        </div>
      </header>

      {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <KpiCard
          icon={<FaClock />}
          label="Weekly Hours"
          value={weeklyHours}
          subtext="/ 40 hrs target"
          colorScheme="blue"
        />
        <KpiCard
          icon={<FaFire />}
          label="Streak"
          value={streak}
          subtext="days on time"
          colorScheme="gold"
        />
        <KpiCard
          icon={<FaChartLine />}
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          subtext="this month"
          colorScheme="green"
        />
        <KpiCard
          icon={<FaExclamationTriangle />}
          label="Late Arrivals"
          value={lateArrivals}
          subtext="this month"
          colorScheme="red"
        />
      </div>

      {/* ── Attendance History ────────────────────────────────────────────── */}
      <section>
        <div className="mb-5">
          <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">
            Attendance History
          </p>
          <div className="mt-2 h-0.5 w-10 bg-accent/60" />
        </div>

        {fetching ? (
          <div className="card flex items-center justify-center">
            <p className="text-ink-muted text-sm font-sans animate-pulse">
              Loading records…
            </p>
          </div>
        ) : (
          <AttendanceTable records={records} showEmployee={false} />
        )}
      </section>

    </Layout>
  )
}

export default Dashboard