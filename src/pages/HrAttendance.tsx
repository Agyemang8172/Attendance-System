import { useState, useEffect, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import AttendanceTable from '../components/ui/AttendanceTable.tsx'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import Pagination from '../components/ui/Pagination'
import { BentoSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import { formatTodayLong, formatShortDate, formatTimeOfDay, formatHoursValue } from '../lib/attendance-format'
import type { AttendanceRecord } from '../types'

const PAGE_SIZE = 12

function HrAttendance() {
  const user = getCurrentUser()

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)

  // Filter state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Detail drawer state
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null)

  const fetchAttendance = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (statusFilter) params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/attendance/all-attendance', { params })
      setRecords(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalUsers || pag.totalRecords || 0)
      }
    } catch (_error) {
      toast.error('Failed to load attendance records.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchAttendance(1)
  }, [startDate, endDate, statusFilter, searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchAttendance(newPage)
    }
  }

  const filteredRecords = useMemo(() => records, [records])

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Attendance Register"
      />

      <SectionHeader title="Filters" />
      <FilterBar label="Attendance filters">
        <div className="flex flex-wrap items-end gap-3 w-full">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="startDate">
              From
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="endDate">
              To
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              <option value="EARLY">Early</option>
              <option value="ON_TIME">On Time</option>
              <option value="LATE">Late</option>
              <option value="OPEN_SESSION">Open Session</option>
              <option value="CLOCK_OUT_MISSING">Clock-out Missing</option>
              <option value="AUTO_CLOSED">Auto-closed</option>
              <option value="ABSENT">Absent</option>
              <option value="REQUIRES_REVIEW">Requires Review</option>
            </select>
          </div>
        </div>
      </FilterBar>

      <SearchInput
        label="Search attendance"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, department, date or status…"
      />

      {!fetching && searchQuery && filteredRecords.length === 0 && (
        <div className="card-elevated px-6 py-10 text-center mb-4">
          <p className="text-ink-muted text-body-sm">
            No results for <span className="text-ink font-mono">"{searchQuery}"</span>
          </p>
        </div>
      )}

      {fetching ? (
        <TableSkeleton showEmployee />
      ) : (
        <>
          {filteredRecords.length > 0 && (
            <AttendanceTable
              records={filteredRecords}
              showEmployee={true}
              exceptionsFirst={true}
              onRowClick={(record) => setDetailRecord(record)}
            />
          )}
          {filteredRecords.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No attendance records found.</p>
                <p className="text-caption text-ink-subtle mt-1">Records will appear here once attendance is logged.</p>
              </div>
            </div>
          )}
        </>
      )}

      {!fetching && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={totalRecords}
          pageSize={PAGE_SIZE}
          ariaLabel="Attendance register pages"
        />
      )}

      {detailRecord && (
        <DetailDrawer
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </Layout>
  )
}

// Detail drawer component
interface DetailDrawerProps {
  record: AttendanceRecord
  onClose: () => void
}

const DetailDrawer = ({ record, onClose }: DetailDrawerProps) => {
  return (
    <div className="fixed inset-0 z-50 overlay-scrim backdrop-blur-sm flex items-end justify-center lg:items-center p-4 lg:p-0">
      <div
        className="w-full lg:w-96 bg-chrome border border-chrome-line shadow-elevated max-h-screen overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Attendance record detail"
      >
        <div className="p-6 lg:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-2">
                Record Detail
              </p>
              <h2 className="text-display-sm text-chrome-ink font-serif">
                {record.user ? `${record.user.firstName} ${record.user.lastName}` : 'Former Employee'}
              </h2>
              {record.user?.employeeCode && (
                <p className="text-chrome-ink-subtle text-xs font-mono mt-1">
                  {record.user.employeeCode}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-chrome-ink-muted hover:text-chrome-ink transition-colors p-1"
              aria-label="Close detail"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 border-t border-chrome-line pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Date</p>
                <p className="text-body font-mono text-chrome-ink">{formatShortDate(record.date)}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Department</p>
                <p className="text-body text-chrome-ink">{record.user?.department || '—'}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Clock In</p>
                <p className="text-body font-mono text-chrome-ink">{formatTimeOfDay(record.clockIn)}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Clock Out</p>
                <p className="text-body font-mono text-chrome-ink">{formatTimeOfDay(record.clockOut)}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Hours Worked</p>
                <p className="text-body font-mono text-chrome-ink">{formatHoursValue(record.hoursWorked)}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Session Status</p>
                <p className="text-body font-mono text-chrome-ink">{record.sessionStatus}</p>
              </div>
            </div>

            {record.shiftSnapshot && (
              <div className="p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
                <p className="text-caption text-chrome-ink-muted mb-2">Shift Snapshot</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-chrome-ink-muted">Name</span>
                  <span className="text-chrome-ink font-mono">{record.shiftSnapshot.name}</span>
                  <span className="text-chrome-ink-muted">Start</span>
                  <span className="text-chrome-ink font-mono">
                    {String(Math.floor(record.shiftSnapshot.startMinute / 60)).padStart(2, '0')}:{String(record.shiftSnapshot.startMinute % 60).padStart(2, '0')}
                  </span>
                  <span className="text-chrome-ink-muted">End</span>
                  <span className="text-chrome-ink font-mono">
                    {String(Math.floor(record.shiftSnapshot.endMinute / 60)).padStart(2, '0')}:{String(record.shiftSnapshot.endMinute % 60).padStart(2, '0')}
                  </span>
                  <span className="text-chrome-ink-muted">Overnight</span>
                  <span className="text-chrome-ink font-mono">{(record.shiftSnapshot as any)?.crossesMidnight ? 'Yes' : 'No'}</span>
                </div>
              </div>
            )}

            {record.locationFlag && (
              <div className="p-4 bg-warning-soft border border-warning-soft rounded-lg">
                <p className="text-caption text-warning mb-1">Location Flag</p>
                <p className="text-body font-mono text-warning">{record.locationFlag}</p>
                {record.remarks && (
                  <p className="text-caption text-chrome-ink-muted mt-2">{record.remarks}</p>
                )}
              </div>
            )}

            {record.autoClosedOut && (
              <div className="p-4 bg-accent-soft border border-accent-soft rounded-lg">
                <p className="text-caption text-accent mb-1">Auto-closed</p>
                <p className="text-body font-mono text-accent">
                  {record.closureReason || 'Closed by automatic clock-out process'}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-chrome-line">
              <button
                onClick={onClose}
                className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans"
              >
                Close
              </button>
              <a
                href={`/hr-audit/corrections/${record.id}`}
                className="px-4 py-2 bg-brass-chrome text-ink rounded-md text-sm font-semibold font-sans hover:opacity-90 transition-opacity"
              >
                View Correction Trail
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="lg:hidden fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
    </div>
  )
}

export default HrAttendance