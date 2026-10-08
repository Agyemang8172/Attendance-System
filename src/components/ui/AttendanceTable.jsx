import { useMemo, useState } from 'react'
import StatBadge from './StatBadge'
import {
  FaArrowUp,
  FaArrowDown,
  FaArrowsUpDown,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa6'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatTime = (dateStr) => {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatHours = (hours) => {
  if (hours == null || hours === 0) return '--'
  return `${Number(hours).toFixed(2)} hrs`
}

const getEmployeeName = (record) => {
  if (!record.user) return 'Former Employee'
  return `${record.user.firstName} ${record.user.lastName}`
}

const getDepartment = (record) => {
  return record.user?.department || '--'
}

const isLate = (record) => {
  if (!record?.clockIn) return false
  const d = new Date(record.clockIn)
  return d.getHours() > 6 || (d.getHours() === 6 && d.getMinutes() >= 30)
}

// Late rows sort above Open above Closed — the exception-first default.
const STATUS_RANK = { LATE: 3, OPEN: 2, CLOSED: 1 }

const getSortValue = (record, key) => {
  switch (key) {
    case 'employee':
      return record.user
        ? `${record.user.firstName} ${record.user.lastName}`.toLowerCase()
        : '~~former'
    case 'department':
      return (record.user?.department || '').toLowerCase()
    case 'date':
      return record.date ? new Date(record.date).getTime() : 0
    case 'clockIn':
      return record.clockIn ? new Date(record.clockIn).getTime() : 0
    case 'clockOut':
      return record.clockOut ? new Date(record.clockOut).getTime() : 0
    case 'hours':
      return Number(record.hoursWorked) || 0
    case 'status': {
      const st = (record.sessionStatus || '').toUpperCase()
      let rank = STATUS_RANK[st] ?? 0
      // A closed session with a late clock-in is still an exception.
      if (isLate(record)) rank = Math.max(rank, 3)
      return rank
    }
    default:
      return 0
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TH = ({ col, sort, onSort }) => {
  const active = sort.key === col.key
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
  const Icon = !active ? FaArrowsUpDown : sort.dir === 'asc' ? FaArrowUp : FaArrowDown

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className="sticky top-0 z-10 px-4 py-3 text-left align-bottom whitespace-nowrap bg-surface-2"
    >
      <button
        type="button"
        onClick={onSort}
        className={[
          'inline-flex items-center gap-1.5 text-caption font-medium transition-colors',
          active ? 'text-ink' : 'text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        {col.label}
        <Icon
          className={`text-[10px] ${active ? 'text-accent' : 'text-ink-subtle'}`}
          aria-hidden="true"
        />
      </button>
    </th>
  )
}

const TD = ({ children, muted = false, mono = false }) => (
  <td
    className={[
      'px-4 py-3 text-body-sm whitespace-nowrap',
      mono ? 'font-mono' : 'font-sans',
      muted ? 'text-ink-subtle' : 'text-ink',
    ].join(' ')}
  >
    {children}
  </td>
)

const EmptyState = ({ colSpan }) => (
  <tr>
    <td colSpan={colSpan}>
      <div className="relative flex flex-col items-center justify-center py-14 text-center">
        <span className="absolute top-4 left-6 w-5 h-5 border-t-2 border-l-2 border-accent opacity-30" />
        <span className="absolute bottom-4 right-6 w-5 h-5 border-b-2 border-r-2 border-accent opacity-30" />
        <p className="text-body-sm font-sans text-ink-muted">
          No attendance records found.
        </p>
        <p className="text-caption font-sans text-ink-subtle mt-1">
          Records will appear here once attendance is logged.
        </p>
      </div>
    </td>
  </tr>
)

// ─── AttendanceTable ──────────────────────────────────────────────────────────
//
//  Props:
//    records         → attendance array from API
//    showEmployee    → false = staff view (5 cols)
//                      true  = HR/admin view (7 cols)
//    exceptionsFirst → HR signature (§11): late rows first and carry a
//                      warning left-border; the Status column sorts LATE
//                      above OPEN above CLOSED.
//
//  §8.4: sticky header (sunken ground), sort indicators with aria-sort,
//  pagination with total count. Rows scroll inside a bounded, two-axis
//  viewport so the header stays pinned.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12

const AttendanceTable = ({
  records = [],
  showEmployee = false,
  exceptionsFirst = false,
}) => {
  const [sort, setSort] = useState(() => ({
    key: exceptionsFirst ? 'status' : 'date',
    dir: 'desc',
  }))
  const [page, setPage] = useState(1)

  const columns = showEmployee
    ? [
        { key: 'employee', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'date', label: 'Date' },
        { key: 'clockIn', label: 'Clock In' },
        { key: 'clockOut', label: 'Clock Out' },
        { key: 'hours', label: 'Hours' },
        { key: 'status', label: 'Status' },
      ]
    : [
        { key: 'date', label: 'Date' },
        { key: 'clockIn', label: 'Clock In' },
        { key: 'clockOut', label: 'Clock Out' },
        { key: 'hours', label: 'Hours' },
        { key: 'status', label: 'Status' },
      ]

  const sorted = useMemo(() => {
    const rows = [...records]
    rows.sort((a, b) => {
      const av = getSortValue(a, sort.key)
      const bv = getSortValue(b, sort.key)
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      // Stable tiebreak: newest first.
      return new Date(b.date) - new Date(a.date)
    })
    return rows
  }, [records, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  // Clamp, don't reset: records can shrink (a search narrows the set) while a
  // page is open, and forcing state inside an effect would be a needless
  // second render. The clamped page drives both the slice and the controls.
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSort = (key) => {
    setPage(1)
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: key === 'date' || key === 'clockIn' || key === 'clockOut' ? 'desc' : 'asc' }
    })
  }

  const rangeStart = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, sorted.length)

  return (
    <div className="relative card overflow-hidden p-0">

      {/* Linear corner bracket */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none z-20" />

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-max border-collapse">

          <thead>
            <tr className="border-b border-hairline">
              {columns.map((col) => (
                <TH
                  key={col.key}
                  col={col}
                  sort={sort}
                  onSort={() => handleSort(col.key)}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 ? (
              <EmptyState colSpan={columns.length} />
            ) : (
              pageRows.map((record, index) => (
                <tr
                  key={record.id || record._id || index}
                  className={[
                    'border-b border-hairline last:border-b-0 transition-colors duration-150',
                    index % 2 === 1
                      ? 'bg-surface-2 hover:bg-surface-3'
                      : 'hover:bg-surface-2',
                    exceptionsFirst && isLate(record)
                      ? 'border-l-[3px] border-l-warning'
                      : '',
                  ].join(' ')}
                >
                  {showEmployee && (
                    <>
                      <TD muted={!record.user}>
                        {getEmployeeName(record)}
                      </TD>
                      <TD muted>{getDepartment(record)}</TD>
                    </>
                  )}

                  <TD mono>{formatDate(record.date)}</TD>
                  <TD mono muted={!record.clockIn}>{formatTime(record.clockIn)}</TD>
                  <TD mono muted={!record.clockOut}>
                    {formatTime(record.clockOut)}
                  </TD>
                  <TD mono muted={!record.hoursWorked}>
                    {formatHours(record.hoursWorked)}
                  </TD>

                  <td className="px-4 py-3">
                    <StatBadge status={record.sessionStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>

      {/* Pagination — §8.4 */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-hairline">
          <p className="text-caption text-ink-muted">
            Showing{' '}
            <span className="font-mono text-ink">
              {rangeStart}–{rangeEnd}
            </span>{' '}
            of <span className="font-mono text-ink">{sorted.length}</span> records
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
              className="w-8 h-8 flex items-center justify-center rounded-md border border-hairline text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-subtle"
            >
              <FaChevronLeft className="text-xs" aria-hidden="true" />
            </button>
            <span className="text-caption font-mono text-ink-muted min-w-[88px] text-center">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
              className="w-8 h-8 flex items-center justify-center rounded-md border border-hairline text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-subtle"
            >
              <FaChevronRight className="text-xs" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default AttendanceTable