import { useState, useEffect, useMemo, useCallback } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import Pill from '../components/ui/Pill'
import AttendanceTable from '../components/ui/AttendanceTable.tsx'
import Pagination from '../components/ui/Pagination'
import ModalShell from '../components/ui/ModalShell'
import { TableSkeleton } from '../components/ui/Skeleton'
import { formatShortDate, formatTimeOfDay, formatHoursValue } from '../lib/attendance-format'
import type { AttendanceRecord } from '../types'
import type { ReactNode } from 'react'
import { FaMagnifyingGlass, FaCalendar, FaXmark } from 'react-icons/fa6'

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE'
type SessionStatus = 'OPEN' | 'CLOSED'

interface AttendanceFilters {
  startDate: string
  endDate: string
  status: AttendanceStatus | ''
  sessionStatus: SessionStatus | ''
  search: string
}

// ─── Status Pill Helpers ──────────────────────────────────────────────────────

const getAttendanceStatusTone = (status: string): 'neutral' | 'accent' | 'success' | 'warning' | 'error' => {
  switch (status?.toUpperCase()) {
    case 'PRESENT': return 'success'
    case 'LATE': return 'warning'
    case 'ABSENT': return 'error'
    case 'HALF_DAY': return 'warning'
    case 'ON_LEAVE': return 'accent'
    default: return 'neutral'
  }
}

const getSessionStatusTone = (status: string): 'neutral' | 'accent' | 'success' | 'warning' | 'error' => {
  switch (status?.toUpperCase()) {
    case 'OPEN': return 'accent'
    case 'CLOSED': return 'success'
    default: return 'neutral'
  }
}

const StatusCell = ({ status, sessionStatus }: Pick<AttendanceRecord, 'status' | 'sessionStatus'>) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Pill tone={getAttendanceStatusTone(status)} mono>{status}</Pill>
    <Pill tone={getSessionStatusTone(sessionStatus)} mono>{sessionStatus}</Pill>
  </div>
)

// ─── Detail Drawer ────────────────────────────────────────────────────────────

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  record: AttendanceRecord | null
}

const DetailDrawer = ({ open, onClose, record }: DetailDrawerProps) => {
  if (!record) return null

  const formatMinute = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

  return (
    <ModalShell open={open} onClose={onClose} label="Attendance Record Detail" maxWidth="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-eyebrow text-brass-chrome opacity-70 mb-1">Attendance Record</p>
            <h2 className="text-display-sm text-chrome-ink font-serif leading-tight">
              {formatShortDate(record.date)}
            </h2>
          </div>
          <StatusCell status={record.status} sessionStatus={record.sessionStatus} />
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-caption text-chrome-ink-muted mb-1">Shift Window</p>
            <p className="text-body font-mono text-chrome-ink">
              {record.shiftSnapshot?.name || '—'}
              {record.shiftSnapshot?.startMinute != null && record.shiftSnapshot?.endMinute != null && (
                <>
                  {' '}—{' '}
                  {formatMinute(record.shiftSnapshot.startMinute)}–{' '}
                  {formatMinute(record.shiftSnapshot.endMinute)}
                </>
              )}
            </p>
          </div>

          <div>
            <p className="text-caption text-chrome-ink-muted mb-1">Clock In</p>
            <p className="text-body font-mono text-chrome-ink">
              {record.clockIn ? formatTimeOfDay(record.clockIn) : '—'}
            </p>
          </div>

          <div>
            <p className="text-caption text-chrome-ink-muted mb-1">Clock Out</p>
            <p className="text-body font-mono text-chrome-ink">
              {record.clockOut ? formatTimeOfDay(record.clockOut) : '—'}
            </p>
          </div>

          <div>
            <p className="text-caption text-chrome-ink-muted mb-1">Hours Worked</p>
            <p className="text-body font-mono text-chrome-ink">{formatHoursValue(record.hoursWorked)}</p>
          </div>

          <div>
            <p className="text-caption text-chrome-ink-muted mb-1">Closure Reason</p>
            <p className="text-body font-sans text-chrome-ink">
              {record.closureReason || (record.autoClosedOut ? 'Auto-closed by system' : 'Manual clock-out')}
            </p>
          </div>

          <div>
            <p className="text-caption text-chrome-ink-muted mb-1">Location Flag</p>
            <p className="text-body font-sans text-chrome-ink">
              {record.locationFlag || (record.checkInLat && record.checkInLng ? 'INSIDE' : '—')}
            </p>
          </div>
        </div>

        {/* Remarks */}
        {record.remarks && (
          <div className="p-4 bg-surface-2 rounded-lg">
            <p className="text-caption text-chrome-ink-muted mb-1">Remarks</p>
            <p className="text-body font-sans text-chrome-ink">{record.remarks}</p>
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-4 border-t border-chrome-line">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-button font-sans transition-colors duration-150"
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ─── Staff Attendance Page ────────────────────────────────────────────────────

function StaffAttendance() {
  const user = getCurrentUser()

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [pageSize] = useState(12)

  const [filters, setFilters] = useState<AttendanceFilters>({
    startDate: '',
    endDate: '',
    status: '',
    sessionStatus: '',
    search: '',
  })

  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const PAGE_SIZE = pageSize

  // ── Fetch records ───────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setFetching(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.status) params.set('status', filters.status)
      if (filters.sessionStatus) params.set('sessionStatus', filters.sessionStatus)
      if (filters.search) params.set('search', filters.search)

      const res = await api.get(`/attendance/my-attendance?${params.toString()}`)
      setRecords(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch {
      toast.error('Failed to load attendance records.')
    } finally {
      setFetching(false)
    }
  }, [page, filters, PAGE_SIZE])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // ── Filter handlers ─────────────────────────────────────────────────────────
  const handleFilterChange = (key: keyof AttendanceFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', status: '', sessionStatus: '', search: '' })
    setPage(1)
  }

  const hasActiveFilters = filters.startDate || filters.endDate || filters.status || filters.sessionStatus || filters.search

  // ── Row click ───────────────────────────────────────────────────────────────
  const handleRowClick = (record: AttendanceRecord) => {
    setDetailRecord(record)
    setDetailOpen(true)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="My Attendance"
        title="Full History"
        actions={
          <button
            type="button"
            onClick={() => { setDetailRecord(null); setDetailOpen(false); }}
            className="px-3 py-1.5 text-caption font-sans text-ink-muted hover:text-ink transition-colors"
            aria-label="Close drawer"
          >
            Close drawer
          </button>
        }
      />

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <FilterBar label="Attendance filters">
        <SearchInput
          label="Search attendance"
          value={filters.search}
          onChange={v => handleFilterChange('search', v)}
          placeholder="Employee code, shift, remarks…"
          className="w-full sm:w-64"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="start-date" className="text-caption text-ink-muted hidden sm:block">
            From
          </label>
          <input
            type="date"
            id="start-date"
            value={filters.startDate}
            onChange={e => handleFilterChange('startDate', e.target.value)}
            className="input w-36 sm:w-44"
            aria-label="Start date"
          />
          <label htmlFor="end-date" className="text-caption text-ink-muted hidden sm:block">
            To
          </label>
          <input
            type="date"
            id="end-date"
            value={filters.endDate}
            onChange={e => handleFilterChange('endDate', e.target.value)}
            className="input w-36 sm:w-44"
            aria-label="End date"
          />
        </div>
        <select
          value={filters.status}
          onChange={e => handleFilterChange('status', e.target.value)}
          className="input w-36 sm:w-40"
          aria-label="Attendance status"
        >
          <option value="">All statuses</option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
          <option value="ABSENT">Absent</option>
          <option value="HALF_DAY">Half day</option>
          <option value="ON_LEAVE">On leave</option>
        </select>
        <select
          value={filters.sessionStatus}
          onChange={e => handleFilterChange('sessionStatus', e.target.value)}
          className="input w-36 sm:w-40"
          aria-label="Session status"
        >
          <option value="">All sessions</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-1.5 text-caption font-sans text-ink-muted hover:text-ink transition-colors"
          >
            Clear filters
          </button>
        )}
      </FilterBar>

      {/* ── Attendance Table ─────────────────────────────────────────────── */}
      <SectionHeader
        title="Attendance Records"
        actions={
          <span className="text-caption font-mono text-ink-muted" aria-live="polite">
            {total} record{total !== 1 ? 's' : ''}
          </span>
        }
      />
      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : records.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-body-sm text-ink-muted mb-2">No attendance records found.</p>
          <p className="text-caption text-ink-subtle">
            Records will appear here once attendance is logged.
          </p>
        </div>
      ) : (
        <>
          <AttendanceTable
            records={records}
            showEmployee={false}
            exceptionsFirst={false}
            onRowClick={handleRowClick}
          />
          {total > PAGE_SIZE && (
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              onPageChange={setPage}
              totalItems={total}
              pageSize={PAGE_SIZE}
              ariaLabel="Attendance table pages"
              className="mt-4"
            />
          )}
        </>
      )}

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <DetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setDetailRecord(null)
        }}
        record={detailRecord}
      />
    </Layout>
  )
}

export default StaffAttendance