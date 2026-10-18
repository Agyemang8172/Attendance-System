import { useState, useEffect, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import KpiCard, { KpiHero } from '../components/ui/KpiCard'
import HoursChart from '../components/charts/HoursChart'
import SessionsChart from '../components/charts/SessionsChart'
import { BentoSkeleton, ChartSkeleton } from '../components/ui/Skeleton'
import Pill from '../components/ui/Pill'
import { buildHoursChartData, buildSessionsChartData, formatTodayLong, formatShortDate, formatTimeOfDay } from '../lib/attendance-format'
import { FaUsers, FaClock, FaCircleCheck, FaTriangleExclamation, FaGear, FaDatabase, FaClock as FaClockIcon, FaPlug, FaServer, FaLink } from 'react-icons/fa6'

// ─── SuperAdminDashboard ──────────────────────────────────────────────────────
// Distinct from HR dashboard (O22): Setup Health checklist + jobs status KPIs
// No HR-style attendance table — links to Attendance, Reports, Audit Log, Settings

function SuperAdminDashboard() {
  const user = getCurrentUser()

  const [healthChecks, setHealthChecks] = useState<Record<string, boolean>>({})
  const [jobsStatus, setJobsStatus] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [punctualityData, setPunctualityData] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [healthRes, jobsRes, punctualityRes, attendanceRes] = await Promise.all([
          api.get('/business/settings'), // For timezone, shift, site, device checks
          api.get('/jobs/status'),
          api.get('/reports/punctuality-summary', { params: { groupBy: 'day' } }),
          api.get('/attendance/all-attendance'),
        ])

        const settings = healthRes.data.data
        setHealthChecks({
          timezone: !!settings.timezone,
          activeShift: false, // Will check from shifts list
          activeSite: false, // Will check from sites list
          pairedDevice: false, // Will check from devices list
          jobsHealthy: jobsRes.data.data?.every((j: any) => j.status === 'healthy') || false,
        })

        // Fetch additional health checks
        const [shiftsRes, sitesRes, devicesRes] = await Promise.all([
          api.get('/business/shifts', { params: { isActive: 'true', limit: 1 } }),
          api.get('/sites', { params: { isActive: 'true', limit: 1 } }),
          api.get('/kiosk/devices', { params: { state: 'ACTIVE', limit: 1 } }),
        ])

        setHealthChecks(prev => ({
          ...prev,
          activeShift: (shiftsRes.data.data?.length || 0) > 0,
          activeSite: (sitesRes.data.data?.length || 0) > 0,
          pairedDevice: (devicesRes.data.data?.length || 0) > 0,
        }))

        setJobsStatus(jobsRes.data.data || [])
        setPunctualityData(punctualityRes.data.data || [])
        setAttendanceRecords(attendanceRes.data.data || [])
      } catch (_error) {
        toast.error('Failed to load dashboard data.')
      } finally {
        setFetching(false)
      }
    }
    fetchDashboardData()
  }, [])

  // ── KPIs from real data ─────────────────────────────────────────────────────
  const clockedInToday = attendanceRecords.filter(
    (r) => formatShortDate(r.date) === formatShortDate(new Date().toISOString()) && r.sessionStatus === 'OPEN'
  ).length

  const lateToday = punctualityData.find((d) => formatShortDate(d.date) === formatShortDate(new Date().toISOString()))?.late || 0

  const healthyJobs = jobsStatus.filter((j) => j.status === 'healthy').length
  const totalJobs = jobsStatus.length

  // ── Chart data ──────────────────────────────────────────────────────────────
  const hoursChartData = useMemo(() => buildHoursChartData(attendanceRecords), [attendanceRecords])
  const sessionsChartData = useMemo(() => buildSessionsChartData(attendanceRecords), [attendanceRecords])

  const allHealthy = Object.values(healthChecks).every(v => v)

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow={formatTodayLong()}
        title={<>Welcome, {user?.firstName}.</>}
      />

      {/* ── Setup Health Checklist ────────────────────────────────────────── */}
      {!fetching && (
        <SectionHeader
          title="Setup Health"
          actions={
            <Pill tone={allHealthy ? 'success' : 'warning'} mono>
              {allHealthy ? 'All Checks Pass' : 'Issues Detected'}
            </Pill>
          }
        />
      )}

      {!fetching && (
        <div className="card-elevated relative overflow-hidden mb-8">
          <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { key: 'timezone', label: 'Timezone Set', icon: <FaClockIcon />, check: healthChecks.timezone },
                { key: 'activeShift', label: 'Active Shift', icon: <FaUsers />, check: healthChecks.activeShift },
                { key: 'activeSite', label: 'Active Site', icon: <FaDatabase />, check: healthChecks.activeSite },
                { key: 'pairedDevice', label: 'Paired Device', icon: <FaPlug />, check: healthChecks.pairedDevice },
                { key: 'jobsHealthy', label: 'Jobs Healthy', icon: <FaServer />, check: healthChecks.jobsHealthy },
              ].map((item) => (
                <div
                  key={item.key}
                  className={`flex items-center gap-3 p-4 rounded-lg border ${
                    item.check
                      ? 'bg-success-soft border-success-soft'
                      : 'bg-warning-soft border-warning-soft'
                  }`}
                >
                  <span className={`p-2 rounded-lg ${item.check ? 'bg-success' : 'bg-warning'} text-ink`}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-body-sm font-medium text-chrome-ink">{item.label}</p>
                    <p className="text-caption text-chrome-ink-muted">
                      {item.check ? 'Configured' : 'Missing'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Jobs Status KPIs ────────────────────────────────────────────────── */}
      {!fetching && (
        <SectionHeader title="Background Jobs" />
      )}

      {!fetching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiHero
            eyebrow="Background Jobs"
            value={healthyJobs}
            unit={`of ${totalJobs}`}
            subtext={healthyJobs === totalJobs ? 'All jobs healthy' : `${totalJobs - healthyJobs} unhealthy`}
          >
            <Pill tone={healthyJobs === totalJobs ? 'success' : 'error'} mono>
              {healthyJobs === totalJobs ? 'Healthy' : 'Degraded'}
            </Pill>
          </KpiHero>
          <KpiCard
            icon={<FaClock aria-hidden="true" />}
            label="Auto Clock-Out"
            value={jobsStatus.find((j) => j.name === 'autoClockOut')?.lastRun ? 'Running' : 'Idle'}
            subtext={"Last run: " + (jobsStatus.find((j) => j.name === 'autoClockOut')?.lastRun || 'Never')}
            scheme="accent"
          />
          <KpiCard
            icon={<FaUsers aria-hidden="true" />}
            label="Clocked In Today"
            value={clockedInToday}
            subtext="active sessions"
            scheme="success"
          />
          <KpiCard
            icon={<FaTriangleExclamation aria-hidden="true" />}
            label="Late Today"
            value={lateToday}
            subtext="late arrivals"
            scheme="warning"
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

      {/* ── Quick Links ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Quick Links" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <a href="/admin-attendance" className="card-elevated relative overflow-hidden p-6 hover:border-accent transition-colors group">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
            <FaUsers className="text-3xl text-accent mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-body font-medium text-ink mb-1">Attendance</h3>
            <p className="text-caption text-ink-muted">Business-wide attendance register</p>
          </a>
          <a href="/reports" className="card-elevated relative overflow-hidden p-6 hover:border-accent transition-colors group">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
            <FaGear className="text-3xl text-accent mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-body font-medium text-ink mb-1">Reports</h3>
            <p className="text-caption text-ink-muted">Punctuality, exceptions, CSV export</p>
          </a>
          <a href="/audit-log" className="card-elevated relative overflow-hidden p-6 hover:border-accent transition-colors group">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
            <FaDatabase className="text-3xl text-accent mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-body font-medium text-ink mb-1">Audit Log</h3>
            <p className="text-caption text-ink-muted">Full business audit history</p>
          </a>
          <a href="/settings" className="card-elevated relative overflow-hidden p-6 hover:border-accent transition-colors group">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
            <FaLink className="text-3xl text-accent mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="text-body font-medium text-ink mb-1">Settings</h3>
            <p className="text-caption text-ink-muted">Business profile, timezone, retention</p>
          </a>
        </div>
      </section>
    </Layout>
  )
}

export default SuperAdminDashboard