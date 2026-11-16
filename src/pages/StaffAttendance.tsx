import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import AttendanceTable from '../components/ui/AttendanceTable.tsx'
import Pagination from '../components/ui/Pagination'
import { TableSkeleton } from '../components/ui/Skeleton'
import { attendanceContextQuery, emptyAttendanceFilters, readAttendanceContext, type AttendanceFilters } from '../lib/staff-attendance-context'
import type { AttendanceRecord } from '../types'

// ─── Staff Attendance Page ────────────────────────────────────────────────────

function StaffAttendance() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { filters, page } = useMemo(() => readAttendanceContext(searchParams), [searchParams])

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [pageSize] = useState(12)



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
    setSearchParams(attendanceContextQuery({ ...filters, [key]: value }, 1), { replace: true })
  }

  const clearFilters = () => {
    setSearchParams(attendanceContextQuery(emptyAttendanceFilters, 1), { replace: true })
  }

  const hasActiveFilters = filters.startDate || filters.endDate || filters.status || filters.sessionStatus || filters.search

  // ── Row click ───────────────────────────────────────────────────────────────
  const handleRowClick = (record: AttendanceRecord) => {
    const query = attendanceContextQuery(filters, page)
    navigate(`/staff/attendance/${encodeURIComponent(record.id)}${query ? `?${query}` : ''}`)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="My Attendance"
        title="Full History"
      />

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <FilterBar label="Attendance filters">
        <SearchInput
          label="Search attendance"
          value={filters.search}
          onChange={v => handleFilterChange('search', v)}
          placeholder="Remarks or closure reason…"
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
          <option value="EARLY">Early</option>
          <option value="ON_TIME">On time</option>
          <option value="LATE">Late</option>
          <option value="OPEN_SESSION">Open session</option>
          <option value="CLOCK_OUT_MISSING">Clock-out missing</option>
          <option value="AUTO_CLOSED">Auto closed</option>
          <option value="ABSENT">Absent</option>
          <option value="REQUIRES_REVIEW">Needs review</option>
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
              onPageChange={nextPage => setSearchParams(attendanceContextQuery(filters, nextPage), { replace: true })}
              totalItems={total}
              pageSize={PAGE_SIZE}
              ariaLabel="Attendance table pages"
              className="mt-4"
            />
          )}
        </>
      )}

    </Layout>
  )
}

export default StaffAttendance
