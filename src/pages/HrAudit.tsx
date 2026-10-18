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
import ModalShell from '../components/ui/ModalShell'

const PAGE_SIZE = 12

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  actor: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  } | null
  before?: Record<string, any> | null
  after?: Record<string, any> | null
  metadata?: Record<string, any>
  createdAt: string
}

function HrAudit() {
  const user = getCurrentUser()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)

  // Filter state
  const [actionFilter, setActionFilter] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Detail drawer
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null)

  const fetchAudit = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (actionFilter) params.action = actionFilter
      if (entityTypeFilter) params.entityType = entityTypeFilter
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/audit', { params })
      setEntries(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load audit history.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchAudit(1)
  }, [actionFilter, entityTypeFilter, startDate, endDate, searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchAudit(newPage)
    }
  }

  const filteredEntries = useMemo(() => entries, [entries])

  const actionLabels: Record<string, string> = {
    'attendance.clock_in': 'Clock In',
    'attendance.clock_out': 'Clock Out',
    'attendance.auto_close': 'Auto Close',
    'attendance.dismiss_alert': 'Dismiss Alert',
    'attendance.correction_requested': 'Correction Requested',
    'attendance.correction_approved': 'Correction Approved',
    'attendance.correction_rejected': 'Correction Rejected',
    'user.created': 'User Created',
    'user.updated': 'User Updated',
    'user.deactivated': 'User Deactivated',
    'user.reactivated': 'User Reactivated',
    'user.pin_reset': 'PIN Reset',
    'user.password_reset': 'Password Reset',
    'settings.updated': 'Settings Updated',
    'shift.created': 'Shift Created',
    'shift.updated': 'Shift Updated',
    'shift.deactivated': 'Shift Deactivated',
    'assignment.created': 'Assignment Created',
    'assignment.deactivated': 'Assignment Deactivated',
    'policy.created': 'Policy Created',
    'policy.version_created': 'Policy Version Created',
    'calendar.updated': 'Calendar Updated',
    'calendar.exception_created': 'Calendar Exception Created',
    'site.created': 'Site Created',
    'site.updated': 'Site Updated',
    'site.deactivated': 'Site Deactivated',
    'kiosk.pairing_code_created': 'Pairing Code Created',
    'kiosk.device_revoked': 'Device Revoked',
    'help_request.created': 'Help Request Created',
    'help_request.updated': 'Help Request Updated',
  }

  const entityTypeLabels: Record<string, string> = {
    attendance: 'Attendance',
    user: 'User',
    shift: 'Shift',
    assignment: 'Assignment',
    policy: 'Policy',
    calendar: 'Calendar',
    site: 'Site',
    kiosk: 'Kiosk',
    help_request: 'Help Request',
  }

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Audit History"
      />

      <SectionHeader title="Filters" />
      <FilterBar label="Audit filters">
        <div className="flex flex-wrap items-end gap-3 w-full">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="auditAction">
              Action
            </label>
            <select
              id="auditAction"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              {Object.entries(actionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="auditEntityType">
              Entity Type
            </label>
            <select
              id="auditEntityType"
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              {Object.entries(entityTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="auditStartDate">
              From
            </label>
            <input
              id="auditStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="auditEndDate">
              To
            </label>
            <input
              id="auditEndDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </FilterBar>

      <SearchInput
        label="Search audit log"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by actor, entity ID, action…"
      />

      {!fetching && searchQuery && filteredEntries.length === 0 && (
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
          {filteredEntries.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Action</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Entity</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Actor</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Date</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry, index) => (
                      <tr
                        key={entry.id || index}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                          'cursor-pointer'
                        ].join(' ')}
                        onClick={() => setDetailEntry(entry)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone="neutral" mono>
                            {actionLabels[entry.action] || entry.action}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {entityTypeLabels[entry.entityType] || entry.entityType}
                          <span className="text-ink-tertiary mx-1">·</span>
                          {entry.entityId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                          {entry.actor
                            ? `${entry.actor.firstName} {entry.actor.lastName} <span className="text-ink-muted">({entry.actor.role})</span>`
                            : 'System'}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(entry.createdAt)} {formatTimeOfDay(entry.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetailEntry(entry)
                            }}
                            className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {filteredEntries.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No audit entries found.</p>
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
          ariaLabel="Audit log pages"
        />
      )}

      {detailEntry && (
        <AuditDetailDrawer
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
        />
      )}
    </Layout>
  )
}

// Detail drawer component
interface AuditDetailDrawerProps {
  entry: AuditEntry
  onClose: () => void
}

const AuditDetailDrawer = ({ entry, onClose }: AuditDetailDrawerProps) => {
  const actionLabels: Record<string, string> = {
    'attendance.clock_in': 'Clock In',
    'attendance.clock_out': 'Clock Out',
    'attendance.auto_close': 'Auto Close',
    'attendance.dismiss_alert': 'Dismiss Alert',
    'attendance.correction_requested': 'Correction Requested',
    'attendance.correction_approved': 'Correction Approved',
    'attendance.correction_rejected': 'Correction Rejected',
    'user.created': 'User Created',
    'user.updated': 'User Updated',
    'user.deactivated': 'User Deactivated',
    'user.reactivated': 'User Reactivated',
    'user.pin_reset': 'PIN Reset',
    'user.password_reset': 'Password Reset',
    'settings.updated': 'Settings Updated',
    'shift.created': 'Shift Created',
    'shift.updated': 'Shift Updated',
    'shift.deactivated': 'Shift Deactivated',
    'assignment.created': 'Assignment Created',
    'assignment.deactivated': 'Assignment Deactivated',
    'policy.created': 'Policy Created',
    'policy.version_created': 'Policy Version Created',
    'calendar.updated': 'Calendar Updated',
    'calendar.exception_created': 'Calendar Exception Created',
    'site.created': 'Site Created',
    'site.updated': 'Site Updated',
    'site.deactivated': 'Site Deactivated',
    'kiosk.pairing_code_created': 'Pairing Code Created',
    'kiosk.device_revoked': 'Device Revoked',
    'help_request.created': 'Help Request Created',
    'help_request.updated': 'Help Request Updated',
  }

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    return String(val)
  }

  return (
    <div className="fixed inset-0 z-50 overlay-scrim backdrop-blur-sm flex items-end justify-center lg:items-center p-4 lg:p-0">
      <div
        className="w-full lg:w-96 bg-chrome border border-chrome-line shadow-elevated max-h-screen overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Audit entry detail"
      >
        <div className="p-6 lg:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-2">
                Audit Entry
              </p>
              <h2 className="text-display-sm text-chrome-ink font-serif">
                {actionLabels[entry.action] || entry.action}
              </h2>
              <p className="text-chrome-ink-subtle text-xs font-mono mt-1">
                #{entry.id.slice(0, 8)}
              </p>
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
                <p className="text-caption text-chrome-ink-muted mb-1">Action</p>
                <p className="text-body text-chrome-ink">{actionLabels[entry.action] || entry.action}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Entity Type</p>
                <p className="text-body text-chrome-ink">{entry.entityType}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Entity ID</p>
                <p className="text-body font-mono text-chrome-ink">{entry.entityId}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Timestamp</p>
                <p className="text-body font-mono text-chrome-ink">
                  {formatShortDate(entry.createdAt)} {formatTimeOfDay(entry.createdAt)}
                </p>
              </div>
              {entry.actor && (
                <>
                  <div>
                    <p className="text-caption text-chrome-ink-muted mb-1">Actor</p>
                    <p className="text-body text-chrome-ink">
                      {entry.actor.firstName} {entry.actor.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-chrome-ink-muted mb-1">Actor Role</p>
                    <p className="text-body text-chrome-ink">{entry.actor.role}</p>
                  </div>
                  <div>
                    <p className="text-caption text-chrome-ink-muted mb-1">Actor Email</p>
                    <p className="text-body font-mono text-chrome-ink">{entry.actor.email}</p>
                  </div>
                </>
              )}
            </div>

            {entry.before && Object.keys(entry.before).length > 0 && (
              <div className="p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
                <p className="text-caption text-chrome-ink-muted mb-3">Before</p>
                <pre className="text-xs text-chrome-ink font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(entry.before, null, 2)}
                </pre>
              </div>
            )}

            {entry.after && Object.keys(entry.after).length > 0 && (
              <div className="p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
                <p className="text-caption text-chrome-ink-muted mb-3">After</p>
                <pre className="text-xs text-chrome-ink font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(entry.after, null, 2)}
                </pre>
              </div>
            )}

            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <div className="p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
                <p className="text-caption text-chrome-ink-muted mb-3">Metadata</p>
                <pre className="text-xs text-chrome-ink font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-chrome-line">
              <button
                onClick={onClose}
                className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="lg:hidden fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
    </div>
  )
}

export default HrAudit