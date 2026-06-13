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

  if (record) {
    if (record.sessionStatus === 'open') return 'open'
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
    return <div className="aspect-square rounded-lg bg-slate-800/10" />
  }

  const status = getDayStatus(date, recordsByDay, today)
  const record = recordsByDay[date.toDateString()]
  const isToday = sameDay(date, today)

  const styles = {
    ontime: 'bg-green-500/10 border border-green-500/20',
    late: 'bg-yellow-500/10 border border-yellow-500/20',
    absent: 'bg-red-500/10 border border-red-500/20',
    open: 'bg-blue-500/10 border border-blue-500/20',
    future: 'bg-slate-800/20 border border-transparent',
    weekend: 'bg-slate-800/10 border border-transparent',
  }

  const dateColor = {
    ontime: 'text-green-400',
    late: 'text-yellow-500',
    absent: 'text-red-400',
    open: 'text-blue-400',
    future: 'text-slate-600',
    weekend: 'text-slate-700',
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
        isToday ? 'ring-1 ring-yellow-500/60' : '',
      ].join(' ')}
    >
      {/* Date number */}
      <span
        className={[
          'text-xs sm:text-sm font-mono font-medium',
          dateColor[status],
        ].join(' ')}
      >
        {date.getDate()}
      </span>

      {/* Clock in time — only when there's a record */}
      {record && record.clockIn && (
        <span className="hidden sm:block text-[10px] text-slate-400 font-mono mt-0.5">
          {formatTime(record.clockIn)}
        </span>
      )}

      {/* Status label — pushed to bottom */}
      {label[status] && (
        <span
          className={[
            'mt-auto text-[9px] sm:text-[10px] font-mono uppercase tracking-wide',
            dateColor[status],
          ].join(' ')}
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
    <span className="text-slate-400 text-xs font-sans">{label}</span>
  </div>
)

// ─── Schedule ─────────────────────────────────────────────────────────────────

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
        <p className="text-xs font-mono uppercase tracking-widest text-yellow-500/70 mb-1">
          Schedule
        </p>
        <h1 className="text-2xl font-bold text-slate-900 font-serif leading-tight">
          My Attendance Calendar
        </h1>
        <p className="text-slate-400 text-sm font-sans mt-1">
          A month-by-month view of your attendance history.
        </p>
        <div className="mt-3 h-px w-12 bg-yellow-500/40" />
      </header>

      {fetching ? (
        <div className="bg-slate-900 rounded-2xl p-8 flex items-center justify-center">
          <p className="text-slate-500 text-sm font-sans animate-pulse">
            Loading calendar…
          </p>
        </div>
      ) : (
        <>
          {/* ── Calendar Card ───────────────────────────────────────────── */}
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">

            {/* Corner bracket */}
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-yellow-500 opacity-30 pointer-events-none z-10" />

            {/* Month navigation */}
            <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700">
              <button
                onClick={goPrev}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-yellow-500 hover:bg-slate-700/50 transition-colors text-xs"
                aria-label="Previous month"
              >
                <FaChevronLeft />
              </button>

              <h2 className="text-slate-100 font-serif font-medium text-base sm:text-lg">
                {monthLabel}
              </h2>

              <button
                onClick={goNext}
                disabled={isCurrentMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-yellow-500 hover:bg-slate-700/50 transition-colors text-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
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
                    className="text-center text-[10px] sm:text-xs font-mono uppercase tracking-wide text-slate-400 py-1"
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
            <LegendItem colorClass="bg-green-500/40" label="On time" />
            <LegendItem colorClass="bg-yellow-500/40" label="Late" />
            <LegendItem colorClass="bg-red-500/40" label="Absent" />
            <LegendItem colorClass="bg-blue-500/40" label="Open" />
          </div>
        </>
      )}

    </Layout>
  )
}

export default Schedule