import { useState, useEffect, useMemo } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isLate = (clockInStr) => {
  const d = new Date(clockInStr)
  return d.getHours() > 6 || (d.getHours() === 6 && d.getMinutes() >= 30)
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Build calendar grid — array of weeks, each week an array of 7 day objects.
// Leading/trailing nulls pad the grid so weeks align Mon–Sun.
const buildCalendarGrid = (year, month) => {
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // JS getDay: 0=Sun..6=Sat. We want Mon=0..Sun=6.
  let startOffset = firstOfMonth.getDay() - 1
  if (startOffset < 0) startOffset = 6 // Sunday wraps to end

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

// Determine the attendance status for a given calendar day
const getDayStatus = (date, recordsByDay, today) => {
  if (!date) return 'empty'

  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  const isFuture = date > today && !sameDay(date, today)

  const key = date.toDateString()
  const record = recordsByDay[key]

  // Normalize session status (Prisma returns uppercase enums)
  const sessionStatus = (record?.sessionStatus || '').toUpperCase()

  if (record) {
    if (sessionStatus === 'OPEN') return 'open'
    if (isLate(record.clockIn)) return 'late'
    return 'ontime'
  }

  // No record
  if (isFuture) return 'future'
  if (isWeekend) return 'weekend'
  return 'absent'
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

const DayCell = ({ date, recordsByDay, today }) => {
  if (!date) {
    return <div className="aspect-square rounded-lg bg-surface-1/20" />
  }

  const status = getDayStatus(date, recordsByDay, today)
  const record = recordsByDay[date.toDateString()]
  const isToday = sameDay(date, today)

  const styles = {
    ontime: 'bg-success/10 border border-success/20',
    late: 'bg-warning/10 border border-warning/20',
    absent: 'bg-error/10 border border-error/20',
    open: 'bg-accent/10 border border-accent/20',
    future: 'bg-surface-1/20 border border-transparent',
    weekend: 'bg-surface-1/10 border border-transparent',
  }

  const dateColor = {
    ontime: 'text-success',
    late: 'text-warning',
    absent: 'text-error',
    open: 'text-accent',
    future: 'text-ink-subtle',
    weekend: 'text-ink-tertiary',
  }

  const label = {
    ontime: 'On time',
    late: 'Late',
    absent: 'Absent',
    open: 'Open',
    future: '',
    weekend: '',
  }

  return (
    <div
      className={[
        'aspect-square rounded-lg p-1.5 sm:p-2 flex flex-col',
        styles[status],
        isToday ? 'ring-1 ring-accent/60' : '',
      ].join(' ')}
    >
      {/* Date number */}
      <span
        className={`
          text-xs sm:text-sm font-mono font-medium
          ${dateColor[status]}
        `}
      >
        {date.getDate()}
      </span>

      {/* Clock in time — only when there's a record */}
      {record && record.clockIn && (
        <span className="hidden sm:block text-[10px] text-ink-subtle font-mono mt-0.5">
          {formatTime(record.clockIn)}
        </span>
      )}

      {/* Status label — pushed to bottom */}
      {label[status] && (
        <span
          className={`
            mt-auto text-[9px] sm:text-[10px] font-mono uppercase tracking-wide
            ${dateColor[status]}
          `}
        >
          {label[status]}
        </span>
      )}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const LegendItem = ({ colorClass, label }) => (
  <div className="flex items-center gap-2">
    <span className={`w-3 h-3 rounded ${colorClass}`} />
    <span className="text-ink-muted text-xs font-sans">{label}</span>
  </div>
)

// ─── Schedule ──────────────────────────────────────────────────────────────────

function Schedule() {
  const [records, setRecords] = useState([])
  const [fetching, setFetching] = useState(true)

  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await api.get('/attendance/my-attendance')
        setRecords(res.data.data || [])
      } catch (_err) {
        toast.error('Failed to load attendance calendar.')
      } finally {
        setFetching(false)
      }
    }
    fetchAttendance()
  }, [])

  // Index records by day string for O(1) lookup in the grid
  const recordsByDay = useMemo(() => {
    const map = {}
    records.forEach((r) => {
      const key = new Date(r.date).toDateString()
      // If multiple records exist for a day, keep the first (most recent — API sorts desc)
      if (!map[key]) map[key] = r
    })
    return map
  }, [records])

  const weeks = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    'en-GB',
    { month: 'long', year: 'numeric' }
  )

  // Block navigating into the future beyond the current month
  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth()

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goNext = () => {
    if (isCurrentMonth) return
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="mb-8">
        <p className="text-ink-muted text-xs font-mono uppercase tracking-widest mb-1">
          Schedule
        </p>
        <h1 className="text-display-sm text-ink font-serif leading-tight">
          My Attendance Calendar
        </h1>
        <p className="text-ink-muted text-sm font-sans mt-1">
          A month-by-month view of your attendance history.
        </p>
        <div className="mt-3 h-px w-12 bg-accent/40" />
      </header>

      {fetching ? (
        <div className="card flex items-center justify-center">
          <p className="text-ink-muted text-sm font-sans animate-pulse">
            Loading calendar…
          </p>
        </div>
      ) : (
        <>
          {/* ── Calendar Card ───────────────────────────────────────────── */}
          <div className="relative card-elevated overflow-hidden border-accent/20">

            {/* Corner bracket */}
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none z-10" />

            {/* Month navigation */}
            <div className="card border-b border-hairline px-4 py-3 flex items-center justify-between">
              <button
                onClick={goPrev}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:text-accent hover:bg-surface-2 transition-colors text-xs"
                aria-label="Previous month"
              >
                <FaChevronLeft />
              </button>

              <h2 className="text-ink font-serif font-medium text-base sm:text-lg">
                {monthLabel}
              </h2>

              <button
                onClick={goNext}
                disabled={isCurrentMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:text-accent hover:bg-surface-2 transition-colors text-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-subtle"
                aria-label="Next month"
              >
                <FaChevronRight />
              </button>
            </div>

            {/* Grid */}
            <div className="p-3 sm:p-4">
              {/* Day name headers */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] sm:text-xs font-mono uppercase tracking-wide text-ink-muted py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Week rows */}
              <div className="space-y-1.5 sm:space-y-2">
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {week.map((date, di) => (
                      <DayCell
                        key={di}
                        date={date}
                        recordsByDay={recordsByDay}
                        today={today}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Legend ──────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-4 mt-4 px-1">
            <LegendItem colorClass="bg-success/40" label="On time" />
            <LegendItem colorClass="bg-warning/40" label="Late" />
            <LegendItem colorClass="bg-error/40" label="Absent" />
            <LegendItem colorClass="bg-accent/40" label="Open" />
          </div>
        </>
      )}

    </Layout>
  )
}

export default Schedule