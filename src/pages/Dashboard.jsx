import { useState, useEffect } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import KpiCard from '../components/ui/KpiCard'
import AttendanceTable from '../components/ui/AttendanceTable'
import { FaClock, FaFire, FaChartLine, FaExclamationTriangle } from 'react-icons/fa'
import { BsCircleFill } from 'react-icons/bs'

// ─── Late threshold helper ────────────────────────────────────────────────────
// On time = clock in before 06:30. At or after = late.
const isLate = (clockInStr) => {
  const d = new Date(clockInStr)
  return d.getHours() > 6 || (d.getHours() === 6 && d.getMinutes() >= 30)
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
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

  useEffect(() => {
    fetchAttendance()
  }, [])

  // ── Fetch + derive clock state + check auto-clockout alert ─────────────────
  const fetchAttendance = async () => {
    try {
      const res = await api.get('/attendance/my-attendance')
      const data = res.data.data || []
      setRecords(data)

      // Clock state — any open session means currently clocked in
      const openSession = data.find((r) => r.sessionStatus === 'open')
      setIsClockedIn(!!openSession)

      // Auto clock-out alert — fires when backend adds these fields
      // Safe to run now: if fields don't exist yet, filter returns []
      const stale = data.filter(
        (r) => r.autoClosedOut === true && r.alertDismissed === false
      )
      stale.forEach(async (r) => {
        const date = new Date(r.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        toast(
          `You forgot to clock out on ${date}. The system clocked you out at 11:59 PM. Please review your record.`,
          { icon: '⚠️', duration: 7000 }
        )
        // Dismiss so it never shows again — fails silently if backend not ready
        try {
          await api.patch(`/attendance/${r._id}/dismiss-alert`)
        } catch (_) {}
      })
    } catch (error) {
      toast.error('Failed to load attendance records.')
    } finally {
      setFetching(false)
    }
  }

  // ── Clock In ───────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setClockLoading(true)
    try {
      await api.post('/attendance/clock-in')
      toast.success('Clocked in successfully.')
      fetchAttendance()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Clock in failed.')
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
      fetchAttendance()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Clock out failed.')
    } finally {
      setClockLoading(false)
    }
  }

  // ── KPI Calculations ───────────────────────────────────────────────────────

  // 1. Weekly Hours — sum hoursWorked for records in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weeklyHours = records
    .filter((r) => new Date(r.date) >= sevenDaysAgo)
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0)
    .toFixed(1)

  // 2. Punctuality Streak — consecutive on-time closed sessions from most recent
  // Records come sorted desc from API. Walk forward, break on first late/open.
  const streak = (() => {
    let count = 0
    for (const r of records) {
      if (r.sessionStatus !== 'closed') break
      if (isLate(r.clockIn)) break
      count++
    }
    return count
  })()

  // 3. Attendance Rate — closed sessions this calendar month / 22 working days
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const closedThisMonth = records.filter(
    (r) => r.sessionStatus === 'closed' && new Date(r.date) >= startOfMonth
  ).length
  const attendanceRate =
    closedThisMonth > 0
      ? Math.min(Math.round((closedThisMonth / 22) * 100), 100)
      : 0

  // 4. Late Arrivals — records this month where clockIn >= 06:30
  const lateArrivals = records.filter(
    (r) => new Date(r.date) >= startOfMonth && isLate(r.clockIn)
  ).length

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">

        {/* Left — greeting + date */}
        <div>
          <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-1">
            {formatTodayLong()}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 font-serif leading-tight">
            {getGreeting()}, {user?.firstName}.
          </h1>
          {/* Gold divider — MERIDIAN signature */}
          <div className="mt-3 h-px w-12 bg-yellow-500/40" />
        </div>

        {/* Right — clock status + action button */}
        <div className="flex items-center gap-3 sm:mt-1">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <BsCircleFill
              className={`text-[8px] ${
                isClockedIn ? 'text-green-500' : 'text-red-500'
              }`}
            />
            <span className="text-slate-500 text-xs font-mono">
              {isClockedIn ? 'Clocked In' : 'Clocked Out'}
            </span>
          </div>

          {/* Clock button */}
          {isClockedIn ? (
            <button
              onClick={handleClockOut}
              disabled={clockLoading}
              className="
                px-5 py-2 rounded-lg text-sm font-medium font-sans
                border border-red-500/40
                text-red-400
                bg-red-500/10
                hover:bg-red-500/20
                transition-colors duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {clockLoading ? 'Processing…' : 'Clock Out'}
            </button>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={clockLoading}
              className="
                px-5 py-2 rounded-lg text-sm font-medium font-sans
                border border-yellow-500/40
                text-yellow-500
                bg-yellow-500/10
                hover:bg-yellow-500/20
                transition-colors duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {clockLoading ? 'Processing…' : 'Clock In'}
            </button>
          )}
        </div>
      </header>

      {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={<FaClock />}
          label="Weekly Hours"
          value={weeklyHours}
          subtext="/ 40 hrs"
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
        {/* Section label */}
        <div className="mb-4">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
            Attendance History
          </p>
          <div className="mt-2 h-px w-10 bg-yellow-500/40" />
        </div>

        {fetching ? (
          // Loading state — never blank
          <div className="bg-slate-900 rounded-2xl p-8 flex items-center justify-center">
            <p className="text-slate-500 text-sm font-sans animate-pulse">
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