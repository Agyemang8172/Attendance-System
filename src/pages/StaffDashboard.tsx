import { useState, useEffect, useCallback, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill from '../components/ui/Pill'
import KpiCard, { KpiHero } from '../components/ui/KpiCard'
import AttendanceTable from '../components/ui/AttendanceTable.tsx'
import { BentoSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import HoursChart from '../components/charts/HoursChart'
import { buildHoursChartData } from '../lib/attendance-format'
import type { AttendanceRecord } from '../types'
import { FaTriangleExclamation } from 'react-icons/fa6'

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

// Status pill for today's state — derived from backend-authoritative statuses only
const TodayStatusPill = ({ isClockedIn, isOffDay, sessionStatus, autoClosedOut }: {
  isClockedIn: boolean
  isOffDay: boolean
  sessionStatus?: string
  autoClosedOut?: boolean
}) => {
  if (isOffDay) {
    return <Pill tone="neutral" mono>Off day</Pill>
  }
  if (isClockedIn) {
    return <Pill tone="accent" mono>Clocked in</Pill>
  }
  if (sessionStatus === 'CLOSED' && autoClosedOut) {
    return <Pill tone="warning" mono>Auto-closed</Pill>
  }
  if (sessionStatus === 'CLOSED') {
    return <Pill tone="success" mono>Clocked out</Pill>
  }
  return <Pill tone="neutral" mono>Open</Pill>
}

// ─── Staff Dashboard ──────────────────────────────────────────────────────────

function StaffDashboard() {
  const user = getCurrentUser()

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [schedule, setSchedule] = useState<Array<{
    date: string
    shiftName: string
    startMinute: number
    endMinute: number
  }>>([])
  const [offDays, setOffDays] = useState<Array<{ date: string; kind: string; note?: string }>>([])
  const [helpRequestsCount, setHelpRequestsCount] = useState(0)
  const [correctionsCount, setCorrectionsCount] = useState(0)
  const [fetching, setFetching] = useState(true)

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  // ── Fetch attendance ────────────────────────────────────────────────────────
  const fetchAttendance = useCallback(async () => {
    try {
      const res = await api.get('/attendance/my-attendance')
      const data: AttendanceRecord[] = res.data.data || []
      setRecords(data)
    } catch {
      toast.error('Failed to load attendance records.')
    }
  }, [])

  // ── Fetch schedule (M8-R2 endpoint) ─────────────────────────────────────────
  const fetchSchedule = useCallback(async () => {
    try {
      const res = await api.get('/api/staff/schedule')
      setSchedule(res.data.data || [])
    } catch {
      // Endpoint may not exist yet; fail silently
      setSchedule([])
    }
  }, [])

  // ── Fetch off-days (M8-R2 endpoint) ─────────────────────────────────────────
  const fetchOffDays = useCallback(async () => {
    try {
      const res = await api.get('/api/staff/off-days')
      setOffDays(res.data.data || [])
    } catch {
      // Endpoint may not exist yet; fail silently
      setOffDays([])
    }
  }, [])

  // ── Fetch pending counts ────────────────────────────────────────────────────
  const fetchHelpRequestsCount = useCallback(async () => {
    try {
      const res = await api.get('/api/staff/help-requests?status=PENDING&limit=1')
      setHelpRequestsCount(res.data.total || 0)
    } catch {
      setHelpRequestsCount(0)
    }
  }, [])

  const fetchCorrectionsCount = useCallback(async () => {
    try {
      const res = await api.get('/api/staff/corrections?status=SUBMITTED&limit=1')
      setCorrectionsCount(res.data.total || 0)
    } catch {
      setCorrectionsCount(0)
    }
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      setFetching(true)
      try {
        await Promise.all([
          fetchAttendance(),
          fetchSchedule(),
          fetchOffDays(),
          fetchHelpRequestsCount(),
          fetchCorrectionsCount(),
        ])
      } finally {
        setFetching(false)
      }
    }
    loadAll()
  }, [fetchAttendance, fetchSchedule, fetchOffDays, fetchHelpRequestsCount, fetchCorrectionsCount])

  // ── Derived state for Today section ────────────────────────────────────────
  const todayRecord = useMemo(() => records.find(r => r.date === todayStr), [records, todayStr])
  const openSession = useMemo(() => records.find(r => r.sessionStatus === 'OPEN'), [records])
  const isClockedIn = !!openSession
  const isOffDay = offDays.some(od => od.date === todayStr)
  const assignedShift = schedule.find(s => s.date === todayStr)

  // ── Weekly Hours chart data ────────────────────────────────────────────────
  const chartData = useMemo(() => buildHoursChartData(records), [records])
  const weeklyHours = chartData.reduce((sum, d) => sum + d.hours, 0).toFixed(1)

  // ── Last punch time ────────────────────────────────────────────────────────
  const lastPunch = useMemo(() => {
    const closed = records.filter(r => r.sessionStatus === 'CLOSED').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    return closed[0] || null
  }, [records])

  // ── Recent history (5 rows) ────────────────────────────────────────────────
  const recentRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [records]
  )

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow={formatTodayLong()}
        title={<>{getGreeting()},<br />{user?.firstName}.</>}
        size="hero"
      />

      {/* ── KPI Hero — Weekly Hours + live status ────────────────────────── */}
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
            <div className="flex flex-wrap items-center gap-3">
              <TodayStatusPill
                isClockedIn={isClockedIn}
                isOffDay={isOffDay}
                sessionStatus={todayRecord?.sessionStatus}
                autoClosedOut={todayRecord?.autoClosedOut}
              />
              {isOffDay && (
                <span className="text-body-sm text-ink-muted">
                  Today is an off day
                </span>
              )}
            </div>
          </KpiHero>

          {/* HoursChart in the hero's second column span */}
          <div className="lg:col-span-1 lg:col-start-3 card-elevated p-4">
            <HoursChart data={chartData} />
          </div>
        </div>
      )}

      {/* ── Today Section ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader title="Today" />
        <div className="card p-4 sm:p-6 space-y-4">
          {/* Assigned Shift */}
          <div>
            <p className="text-caption text-ink-muted mb-1">Assigned Shift</p>
            {assignedShift ? (
              <p className="text-body font-mono text-ink">
                {assignedShift.shiftName} —{' '}
                {String(Math.floor(assignedShift.startMinute / 60)).padStart(2, '0')}:{String(
                  assignedShift.startMinute % 60
                ).padStart(2, '0')}–{' '}
                {String(Math.floor(assignedShift.endMinute / 60)).padStart(2, '0')}:{String(
                  assignedShift.endMinute % 60
                ).padStart(2, '0')}
              </p>
            ) : isOffDay ? (
              <p className="text-body text-ink-muted">Off day — no shift assigned</p>
            ) : (
              <p className="text-body text-ink-muted">No shift assigned today</p>
            )}
          </div>

          {/* Last Punch */}
          <div>
            <p className="text-caption text-ink-muted mb-1">Last Punch</p>
            {lastPunch ? (
              <>
                <p className="text-body font-mono text-ink">
                  {lastPunch.clockIn && `In: ${new Date(lastPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  {lastPunch.clockOut && ` · Out: ${new Date(lastPunch.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </p>
                <p className="text-caption text-ink-muted mt-1">
                  {new Date(lastPunch.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </>
            ) : (
              <p className="text-body text-ink-muted">No punches recorded yet</p>
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-caption text-ink-muted mb-1">Current Status</p>
            <TodayStatusPill
              isClockedIn={isClockedIn}
              isOffDay={isOffDay}
              sessionStatus={todayRecord?.sessionStatus}
              autoClosedOut={todayRecord?.autoClosedOut}
            />
          </div>

          {/* Off-day note */}
          {isOffDay && (
            <div className="p-3 bg-accent-soft border border-accent-soft rounded-lg">
              <p className="text-body-sm text-accent font-sans">
                Today is an off day ({offDays.find(od => od.date === todayStr)?.kind || 'holiday'})
                {offDays.find(od => od.date === todayStr)?.note && ` — ${offDays.find(od => od.date === todayStr)?.note}`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Recent History ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader title="Recent History" />
        {fetching ? (
          <TableSkeleton showEmployee={false} />
        ) : (
          <AttendanceTable records={recentRecords} showEmployee={false} exceptionsFirst={false} />
        )}
      </section>

      {/* ── Pending Requests ───────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Pending Requests"
          actions={
            <div className="flex items-center gap-4 text-caption font-mono text-ink-muted">
              <Pill tone={helpRequestsCount > 0 ? 'warning' : 'neutral'} mono>
                Help: {helpRequestsCount}
              </Pill>
              <Pill tone={correctionsCount > 0 ? 'warning' : 'neutral'} mono>
                Corrections: {correctionsCount}
              </Pill>
            </div>
          }
        />
        <div className="card p-4 sm:p-6 text-center text-ink-muted">
          <p className="text-body-sm">
            {helpRequestsCount === 0 && correctionsCount === 0
              ? 'No pending requests.'
              : 'Tap a category above to view details.'}
          </p>
        </div>
      </section>
    </Layout>
  )
}

export default StaffDashboard