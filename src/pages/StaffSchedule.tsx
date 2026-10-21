import { useState, useEffect, useMemo, useCallback } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill from '../components/ui/Pill'
import { TableSkeleton } from '../components/ui/Skeleton'
import { formatShortDate, formatTimeOfDay, formatHoursValue } from '../lib/attendance-format'
import type { AttendanceRecord } from '../types'
import { FaChevronLeft, FaChevronRight, FaCalendar } from 'react-icons/fa6'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShiftAssignment {
  date: string
  shiftName: string
  startMinute: number
  endMinute: number
}

interface OffDay {
  date: string
  kind: string
  note?: string
}

interface ScheduleEntry {
  date: string
  type: 'shift' | 'off-day'
  shiftName?: string
  startMinute?: number
  endMinute?: number
  kind?: string
  note?: string
  attendanceRecord?: AttendanceRecord
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMinute = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

const getDayStatus = (entry: ScheduleEntry): { label: string; tone: 'neutral' | 'accent' | 'success' | 'warning' | 'error' } => {
  if (entry.type === 'off-day') {
    return { label: entry.kind || 'Off day', tone: 'neutral' }
  }
  if (entry.attendanceRecord) {
    const status = entry.attendanceRecord.status?.toUpperCase()
    const sessionStatus = entry.attendanceRecord.sessionStatus?.toUpperCase()
    if (sessionStatus === 'OPEN') return { label: 'Clocked in', tone: 'accent' }
    if (status === 'LATE') return { label: 'Late', tone: 'warning' }
    if (status === 'ABSENT') return { label: 'Absent', tone: 'error' }
    if (status === 'HALF_DAY') return { label: 'Half day', tone: 'warning' }
    if (status === 'ON_LEAVE') return { label: 'On leave', tone: 'accent' }
    if (sessionStatus === 'CLOSED') return { label: 'Completed', tone: 'success' }
  }
  // Future date with shift assigned
  const entryDate = new Date(entry.date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (entryDate > today) {
    return { label: 'Scheduled', tone: 'neutral' }
  }
  // Past date with shift but no attendance
  return { label: 'No record', tone: 'error' }
}

// ─── Day List Item ────────────────────────────────────────────────────────────

const DayListItem = ({ entry, isToday }: { entry: ScheduleEntry; isToday: boolean }) => {
  const status = getDayStatus(entry)

  return (
    <div
      className={[
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4',
        'card border-hairline',
        isToday ? 'ring-1 ring-accent bg-accent-soft/30' : 'hover:bg-surface-2 transition-colors',
      ].join(' ')}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex-shrink-0 w-14 sm:w-16 text-center">
          <p className="text-display-md font-mono font-bold text-ink">{new Date(entry.date).getDate()}</p>
          <p className="text-caption font-mono text-ink-muted uppercase">{new Date(entry.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short' })}</p>
        </div>
        <div className="min-w-0">
          {entry.type === 'shift' && (
            <>
              <p className="text-body font-semibold text-ink truncate">{entry.shiftName}</p>
              <p className="text-caption font-mono text-ink-muted">
                {formatMinute(entry.startMinute!)}–{formatMinute(entry.endMinute!)}
              </p>
            </>
          )}
          {entry.type === 'off-day' && (
            <p className="text-body font-semibold text-ink-muted truncate">Off day — {entry.kind}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:items-end sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
        <Pill tone={status.tone} mono>{status.label}</Pill>

        {entry.attendanceRecord && (
          <div className="flex items-center gap-4 text-caption font-mono text-ink-muted">
            {entry.attendanceRecord.clockIn && (
              <span>In: {formatTimeOfDay(entry.attendanceRecord.clockIn)}</span>
            )}
            {entry.attendanceRecord.clockOut && (
              <span>Out: {formatTimeOfDay(entry.attendanceRecord.clockOut)}</span>
            )}
            {entry.attendanceRecord.hoursWorked && (
              <span>{formatHoursValue(entry.attendanceRecord.hoursWorked)}</span>
            )}
          </div>
        )}

        {entry.type === 'off-day' && entry.note && (
          <span className="text-caption text-ink-muted sm:hidden">— {entry.note}</span>
        )}
      </div>

      {entry.type === 'off-day' && entry.note && (
        <div className="sm:flex sm:items-center sm:justify-end w-full sm:w-auto">
          <span className="text-caption text-ink-muted">— {entry.note}</span>
        </div>
      )}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ monthLabel }: { monthLabel: string }) => (
  <div className="card p-12 text-center">
    <FaCalendar className="text-ink-subtle text-4xl mx-auto mb-4" aria-hidden="true" />
    <p className="text-body-sm text-ink-muted mb-2">No shifts or off-days in {monthLabel}</p>
    <p className="text-caption text-ink-subtle">Your schedule will appear here once assignments are made.</p>
  </div>
)

// ─── Staff Schedule Page ──────────────────────────────────────────────────────

function StaffSchedule() {
  const user = getCurrentUser()

  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [fetching, setFetching] = useState(true)

  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setFetching(true)
    try {
      const [assignmentsRes, offDaysRes, attendanceRes] = await Promise.allSettled([
        api.get('/staff/schedule'),
        api.get('/staff/off-days'),
        api.get('/attendance/my-attendance'),
      ])

      if (assignmentsRes.status === 'fulfilled') {
        setAssignments(assignmentsRes.value.data.data || [])
      } else {
        setAssignments([])
      }

      if (offDaysRes.status === 'fulfilled') {
        setOffDays(offDaysRes.value.data.data || [])
      } else {
        setOffDays([])
      }

      if (attendanceRes.status === 'fulfilled') {
        setAttendanceRecords(attendanceRes.value.data.data || [])
      } else {
        setAttendanceRecords([])
      }
    } catch {
      toast.error('Failed to load schedule.')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Build combined schedule entries for the current month ──────────────────
  const monthStart = useMemo(() => new Date(viewYear, viewMonth, 1), [viewYear, viewMonth])
  const monthEnd = useMemo(() => new Date(viewYear, viewMonth + 1, 0), [viewYear, viewMonth])
  const monthLabel = useMemo(() => monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), [monthStart])

  const entries = useMemo((): ScheduleEntry[] => {
    const entriesMap = new Map<string, ScheduleEntry>()

    // Add shift assignments
    assignments.forEach(a => {
      const dateKey = a.date.split('T')[0]
      const entryDate = new Date(dateKey)
      if (entryDate >= monthStart && entryDate <= monthEnd) {
        entriesMap.set(dateKey, {
          date: dateKey,
          type: 'shift',
          shiftName: a.shiftName,
          startMinute: a.startMinute,
          endMinute: a.endMinute,
        })
      }
    })

    // Add off-days (override shifts if same date)
    offDays.forEach(o => {
      const dateKey = o.date.split('T')[0]
      const entryDate = new Date(dateKey)
      if (entryDate >= monthStart && entryDate <= monthEnd) {
        entriesMap.set(dateKey, {
          date: dateKey,
          type: 'off-day',
          kind: o.kind,
          note: o.note,
        })
      }
    })

    // Merge attendance records
    attendanceRecords.forEach(r => {
      const dateKey = r.date.split('T')[0]
      if (entriesMap.has(dateKey)) {
        entriesMap.get(dateKey)!.attendanceRecord = r
      } else if (new Date(dateKey) >= monthStart && new Date(dateKey) <= monthEnd) {
        entriesMap.set(dateKey, {
          date: dateKey,
          type: 'shift',
          attendanceRecord: r,
        })
      }
    })

    // Convert to sorted array (newest first for list view)
    return Array.from(entriesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [assignments, offDays, attendanceRecords, monthStart, monthEnd])

  // ── Navigation ──────────────────────────────────────────────────────────────
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  const goPrev = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }, [viewMonth])

  const goNext = useCallback(() => {
    if (isCurrentMonth) return
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }, [viewMonth, isCurrentMonth])

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="My Schedule"
        title="Assigned Shifts & Off-Days"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:text-accent hover:bg-surface-1 transition-colors text-xs"
              disabled={false}
            >
              <FaChevronLeft />
            </button>
            <span className="text-body font-medium font-sans text-ink min-w-[160px] text-center">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={isCurrentMonth}
              aria-label="Next month"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:text-accent hover:bg-surface-1 transition-colors text-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-subtle"
            >
              <FaChevronRight />
            </button>
          </div>
        }
      />

      {/* ── Schedule List ─────────────────────────────────────────────────── */}
      <SectionHeader title={`${entries.length} day${entries.length !== 1 ? 's' : ''} in ${monthLabel}`} />

      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : entries.length === 0 ? (
        <EmptyState monthLabel={monthLabel} />
      ) : (
        <div className="space-y-3" role="list" aria-label={`${monthLabel} schedule`}>
          {entries.map(entry => (
            <DayListItem
              key={entry.date}
              entry={entry}
              isToday={formatShortDate(entry.date) === formatShortDate(new Date().toISOString())}
            />
          ))}
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-hairline" aria-label="Status legend">
        <div className="flex items-center gap-2">
          <Pill tone="success" mono>Completed</Pill>
          <span className="text-caption text-ink-muted">Clocked out on time</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="warning" mono>Late</Pill>
          <span className="text-caption text-ink-muted">Late arrival</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="error" mono>Absent</Pill>
          <span className="text-caption text-ink-muted">No punch recorded</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="accent" mono>Clocked in</Pill>
          <span className="text-caption text-ink-muted">Open session</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="neutral" mono>Scheduled</Pill>
          <span className="text-caption text-ink-muted">Future shift</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="neutral" mono>Off day</Pill>
          <span className="text-caption text-ink-muted">Holiday or override</span>
        </div>
      </div>
    </Layout>
  )
}

export default StaffSchedule