import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import KpiCard, { KpiHero } from '../components/ui/KpiCard'
import AttendanceTable from '../components/ui/AttendanceTable'
import { BentoSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import { FaFire, FaChartLine, FaTriangleExclamation } from 'react-icons/fa6'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Live clock pill — the staff signature element (§11) ─────────────────────
// Pulsing dot + monospaced time. Ticks independently so the rest of the page
// does not re-render every second.

const ClockPill = ({ isClockedIn }: { isClockedIn: boolean }) => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const time = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="inline-flex items-center gap-2 bg-surface-1 border border-hairline rounded-full px-3 py-1.5">
      <span className="relative flex w-2 h-2">
        <span
          className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${
            isClockedIn ? 'bg-success' : 'bg-error'
          }`}
        />
        <span
          className={`relative inline-flex w-2 h-2 rounded-full ${
            isClockedIn ? 'bg-success' : 'bg-error'
          }`}
        />
      </span>
      <span className="font-mono text-body-sm text-ink-muted tabular-nums">
        {time}
      </span>
    </div>
  )
}

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
          { icon: <FaTriangleExclamation aria-hidden="true" />, duration: 7000 }
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

  // Weekly Hours — sum hoursWorked for the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const weeklyHours = records
    .filter((r) => new Date(r.date) >= sevenDaysAgo)
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0)
    .toFixed(1)

  // Streak — consecutive closed sessions going backwards from today
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

  // Attendance Rate — closed sessions this calendar month / 22 working days
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const closedThisMonth = records.filter(
    (r) => r.sessionStatus === 'CLOSED' && new Date(r.date) >= startOfMonth
  ).length
  const attendanceRate =
    closedThisMonth > 0
      ? Math.min(Math.round((closedThisMonth / 22) * 100), 100)
      : 0

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
        <div>
          <p className="text-ink-muted text-caption font-mono mb-3">
            {formatTodayLong()}
          </p>
          <h1 className="text-display-xl text-ink font-serif leading-none tracking-tight">
            {getGreeting()},<br />
            {user?.firstName}.
          </h1>
          {/* Accent divider */}
          <div className="mt-4 h-0.5 w-20 bg-accent" />
        </div>
      </header>

      {/* ── KPI Bento — hero + two dense metrics (R10, §11) ─────────────── */}
      {fetching ? (
        <BentoSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiHero
            eyebrow="Weekly Hours — trailing 7 days"
            value={weeklyHours}
            unit="hrs"
            subtext="of a 40 hr target"
          >
            <ClockPill isClockedIn={isClockedIn} />
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
          </KpiHero>

          <KpiCard
            icon={<FaFire aria-hidden="true" />}
            label="Streak"
            value={streak}
            subtext="days on time"
            scheme="success"
          />
          <KpiCard
            icon={<FaChartLine aria-hidden="true" />}
            label="Attendance Rate"
            value={`${attendanceRate}%`}
            subtext="this month"
            scheme="accent"
          />
        </div>
      )}

      {/* ── Attendance History ────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-body-sm font-medium text-ink">Attendance History</h2>
          <div className="mt-2 h-0.5 w-10 bg-accent opacity-40" />
        </div>

        {fetching ? (
          <TableSkeleton />
        ) : (
          <AttendanceTable records={records} />
        )}
      </section>

    </Layout>
  )
}

export default Dashboard