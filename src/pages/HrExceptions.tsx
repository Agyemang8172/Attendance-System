import { useState, useEffect, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import Pagination from '../components/ui/Pagination'
import { BentoSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import Pill from '../components/ui/Pill'
import { formatTodayLong, formatShortDate, formatTimeOfDay } from '../lib/attendance-format'
import type { AttendanceRecord } from '../types'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const PAGE_SIZE = 12

interface ExceptionRecord extends AttendanceRecord {
  exceptionType?: string
  reason?: string
}

function HrExceptions() {
  const user = getCurrentUser()

  const [records, setRecords] = useState<ExceptionRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  // Filter state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Dismiss confirmation
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false)
  const [recordToDismiss, setRecordToDismiss] = useState<ExceptionRecord | null>(null)

  const fetchExceptions = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (typeFilter) params.type = typeFilter
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/reports/exceptions', { params })
      setRecords(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load exceptions.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchExceptions(1)
  }, [startDate, endDate, typeFilter, searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchExceptions(newPage)
    }
  }

  const handleDismiss = async () => {
    if (!recordToDismiss) return
    setDismissingId(recordToDismiss.id)
    try {
      await api.patch(`/attendance/${recordToDismiss.id}/dismiss-alert`)
      toast.success('Alert dismissed.')
      setDismissDialogOpen(false)
      setRecordToDismiss(null)
      fetchExceptions(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to dismiss alert.'
      toast.error(msg)
    } finally {
      setDismissingId(null)
    }
  }

  const filteredRecords = useMemo(() => records, [records])

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Exceptions"
      />

      <SectionHeader title="Filters" />
      <FilterBar label="Exception filters">
        <div className="flex flex-wrap items-end gap-3 w-full">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="excStartDate">
              From
            </label>
            <input
              id="excStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="excEndDate">
              To
            </label>
            <input
              id="excEndDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="excType">
              Type
            </label>
            <select
              id="excType"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="REQUIRES_REVIEW">Requires Review</option>
              <option value="OUTSIDE">Outside Geo-fence</option>
              <option value="UNKNOWN">Unknown Location</option>
              <option value="CLOCK_OUT_MISSING">Missing Clock-out</option>
            </select>
          </div>
        </div>
      </FilterBar>

      <SearchInput
        label="Search exceptions"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, date, type or reason…"
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
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Employee</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Date</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Type</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Reason</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Clock In</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Clock Out</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((ex, index) => (
                      <tr
                        key={ex.id || index}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                          {ex.user ? `${ex.user.firstName} ${ex.user.lastName}` : 'Former Employee'}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(ex.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill
                            tone={
                              ex.exceptionType === 'LATE' ? 'warning' :
                              ex.exceptionType === 'ABSENT' ? 'error' :
                              ex.exceptionType === 'OUTSIDE' || ex.exceptionType === 'UNKNOWN' ? 'accent' :
                              'warning'
                            }
                            mono
                          >
                            {ex.exceptionType || ex.status}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap text-ink-muted max-w-xs truncate">
                          {ex.reason || ex.remarks || ex.locationFlag || '—'}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatTimeOfDay(ex.clockIn)}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatTimeOfDay(ex.clockOut)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/hr-attendance/${ex.id}`}
                              className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                            >
                              View
                            </a>
                            {!ex.alertDismissed && (
                              <button
                                onClick={() => {
                                  setRecordToDismiss(ex)
                                  setDismissDialogOpen(true)
                                }}
                                disabled={dismissingId === ex.id}
                                className="text-error font-mono text-body-sm hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Dismiss
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {filteredRecords.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No exceptions found.</p>
                <p className="text-caption text-ink-subtle mt-1">All caught up — no records need review.</p>
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
          ariaLabel="Exceptions pages"
        />
      )}

      <ConfirmDialog
        open={dismissDialogOpen}
        onClose={() => setDismissDialogOpen(false)}
        onConfirm={handleDismiss}
        title="Dismiss Alert?"
        body={
          <>
            <p>You are about to dismiss the alert for this attendance record.</p>
            <p className="mt-2">This action cannot be undone. The record will no longer appear in the exceptions queue.</p>
          </>
        }
        confirmLabel="Dismiss"
        cancelLabel="Cancel"
        busy={!!dismissingId}
        busyLabel="Dismissing…"
        eyebrow="Confirm"
      />
    </Layout>
  )
}

export default HrExceptions