import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import Pagination from '../components/ui/Pagination'
import { TableSkeleton } from '../components/ui/Skeleton'
import Pill from '../components/ui/Pill'
import { formatTodayLong } from '../lib/attendance-format'
import { helpTimestamp } from '../lib/staff-help-requests'

const PAGE_SIZE = 12

/**
 * The durable events the backend writes today. The raw key stays visible in
 * the table (it is the truthful event name); this map only supplies the
 * readable label used in the drawer and as the pill's title.
 */
const ACTION_LABELS: Record<string, string> = {
  'attendance.recorded': 'Attendance recorded',
  'attendance.location_flagged': 'Location flagged',
  'attendance.marked': 'Attendance marked',
  'correction.submitted': 'Correction submitted',
  'correction.decided': 'Correction decided',
  'correction.decided.backstop': 'Correction decided by backstop',
  'correction.escalated': 'Correction escalated',
  'pin.change_failed': 'PIN change failed',
  'pin.changed.self': 'PIN changed',
  'pin.locked': 'PIN locked',
  'pin.verify_failed': 'PIN verification failed',
  'hr.reset_pin': 'PIN reset by HR',
  'help.request_submitted': 'Help request submitted',
  'help.request_status_changed': 'Help request updated',
  'help.request_resolved': 'Help request resolved',
  'job.auto_clock_out_closed': 'Auto clock-out closed',
  'job.auto_clock_out_flagged': 'Auto clock-out flagged',
  'kiosk.paired': 'Kiosk paired',
  'kiosk.pairing_code_issued': 'Pairing code issued',
  'kiosk.revoked': 'Kiosk revoked',
  'kiosk.token_renewed': 'Kiosk token renewed',
  'kiosk.token_rejected': 'Kiosk token rejected',
  'kiosk.expired': 'Kiosk pairing expired',
  'settings.updated': 'Settings updated',
  'report.exported': 'Report exported',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.deactivated': 'User deactivated',
  'user.reactivated': 'User reactivated',
  'verify.session_started': 'Verification started',
  'verify.succeeded': 'Verification succeeded',
  'verify.expired': 'Verification expired',
}

const ENTITY_LABELS: Record<string, string> = {
  attendance: 'Attendance',
  correction: 'Correction',
  user: 'User',
  kiosk: 'Kiosk',
  verification_session: 'Verification session',
  help_request: 'Help request',
  business: 'Business',
  report: 'Report',
  job: 'Job',
}

/** HR reads the supervised subset only; the backend applies the same scope. */
const HR_ACTION_PREFIXES = ['attendance.', 'correction.', 'pin.']
const HR_EXTRA_ACTIONS = ['hr.reset_pin']

const actionLabel = (action: string): string => ACTION_LABELS[action] || action
const entityLabel = (entityType: string): string => ENTITY_LABELS[entityType] || entityType

const actionOptions = (role?: string): string[] =>
  Object.keys(ACTION_LABELS)
    .filter((action) =>
      role !== 'HR'
        ? true
        : HR_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix)) || HR_EXTRA_ACTIONS.includes(action)
    )
    .sort()

/** HR only sees attendance, correction and user entities through its action subset. */
const entityOptions = (role?: string): string[] =>
  role === 'HR' ? ['attendance', 'correction', 'user'] : Object.keys(ENTITY_LABELS)

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actorType: string
  actorUserId?: string | null
  actorKioskId?: string | null
  actor: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  } | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  reason?: string | null
  createdAt: string
}

/** `<input type="date">` gives a UTC day; the API contract takes ISO instants. */
const startOfDayUtc = (value: string): string =>
  value ? new Date(`${value}T00:00:00.000Z`).toISOString() : ''
const endOfDayUtc = (value: string): string =>
  value ? new Date(`${value}T23:59:59.999Z`).toISOString() : ''

const actorName = (entry: AuditEntry): string => {
  if (entry.actor) return `${entry.actor.firstName} ${entry.actor.lastName}`
  if (entry.actorType === 'KIOSK') return entry.actorKioskId ? `Kiosk ${entry.actorKioskId.slice(0, 8)}` : 'Kiosk'
  if (entry.actorType === 'SYSTEM') return 'System'
  return 'Unknown actor'
}

function HrAudit() {
  const user = getCurrentUser()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  // Filter state
  const [actionFilter, setActionFilter] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Detail drawer
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null)

  const dateRangeInvalid = Boolean(startDate && endDate && startDate > endDate)

  const fetchAudit = async (targetPage = 1) => {
    if (dateRangeInvalid) return
    setFetching(true)
    setError('')
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (actionFilter) params.action = actionFilter
      if (entityTypeFilter) params.entityType = entityTypeFilter
      if (startDate) params.startDate = startOfDayUtc(startDate)
      if (endDate) params.endDate = endOfDayUtc(endDate)
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/audit', { params })
      setEntries(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch {
      setEntries([])
      setError('Could not load audit history. Check the connection and try again.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    void fetchAudit(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityTypeFilter, startDate, endDate, searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      void fetchAudit(newPage)
    }
  }

  const actions = actionOptions(user?.role)
  const hasFilters = Boolean(actionFilter || entityTypeFilter || startDate || endDate || searchQuery)

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
              {actions.map((value) => (
                <option key={value} value={value}>
                  {actionLabel(value)}
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
              {Object.entries(ENTITY_LABELS)
                .filter(([value]) => entityOptions(user?.role).includes(value))
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="auditStartDate">
              From (UTC)
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
              To (UTC)
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

      {dateRangeInvalid && (
        <p role="alert" className="text-body-sm text-error mb-4">
          From must be on or before To.
        </p>
      )}

      <SearchInput
        label="Search audit log"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search action, entity or reason…"
      />

      {!fetching && !error && searchQuery && entries.length === 0 && (
        <div className="card-elevated px-6 py-10 text-center mb-4">
          <p className="text-ink-muted text-body-sm">
            No results for <span className="text-ink font-mono">"{searchQuery}"</span>
          </p>
        </div>
      )}

      {error && !fetching && (
        <div role="alert" className="card-elevated px-6 py-10 text-center mb-4">
          <p className="text-body text-error mb-3">{error}</p>
          <button type="button" className="btn-secondary" onClick={() => void fetchAudit(page)}>
            Try again
          </button>
        </div>
      )}

      {fetching ? (
        <TableSkeleton showEmployee />
      ) : (
        !error && (
          <>
            {entries.length > 0 && (
              <div className="card-elevated relative overflow-hidden">
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Action</th>
                        <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Entity</th>
                        <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Actor</th>
                        <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Date (UTC)</th>
                        <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, index) => (
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
                              <span title={actionLabel(entry.action)}>{entry.action}</span>
                            </Pill>
                          </td>
                          <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                            {entityLabel(entry.entityType)}
                            {entry.entityId && (
                              <>
                                <span className="text-ink-tertiary mx-1">·</span>
                                {entry.entityId.slice(0, 8)}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                            {entry.actor
                              ? <>{entry.actor.firstName} {entry.actor.lastName} <span className="text-ink-muted">({entry.actor.role})</span></>
                              : actorName(entry)}
                          </td>
                          <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                            {helpTimestamp(entry.createdAt)}
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
            {entries.length === 0 && !searchQuery && (
              <div className="card-elevated relative overflow-hidden">
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
                <div className="p-8 text-center">
                  <p className="text-ink-muted text-body-sm">
                    {hasFilters ? 'No audit entries match these filters.' : 'No audit entries found.'}
                  </p>
                </div>
              </div>
            )}
          </>
        )
      )}

      {!fetching && !error && totalPages > 1 && (
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

interface AuditDetailDrawerProps {
  entry: AuditEntry
  onClose: () => void
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

const AuditDetailDrawer = ({ entry, onClose }: AuditDetailDrawerProps) => {
  const attendanceHref = entry.entityType === 'attendance' && entry.entityId
    ? `/hr-attendance/${encodeURIComponent(entry.entityId)}`
    : ''

  return (
    <div className="fixed inset-0 z-50 overlay-scrim backdrop-blur-sm flex items-end justify-center lg:items-center p-4 lg:p-0">
      <div
        className="w-full lg:w-96 bg-chrome border border-chrome-line shadow-elevated max-h-screen overflow-y-auto relative z-50"
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
                {actionLabel(entry.action)}
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
                <p className="text-caption text-chrome-ink-muted mb-1">Event</p>
                <p className="text-body text-chrome-ink">{actionLabel(entry.action)}</p>
                <p className="text-caption font-mono text-chrome-ink-subtle">{entry.action}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Entity Type</p>
                <p className="text-body text-chrome-ink">{entityLabel(entry.entityType)}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Entity ID</p>
                {attendanceHref ? (
                  <Link to={attendanceHref} className="text-body font-mono text-accent hover:underline break-all">
                    {entry.entityId}
                  </Link>
                ) : (
                  <p className="text-body font-mono text-chrome-ink break-all">{entry.entityId || '—'}</p>
                )}
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Timestamp (UTC)</p>
                <p className="text-body font-mono text-chrome-ink">{helpTimestamp(entry.createdAt)}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Actor</p>
                <p className="text-body text-chrome-ink">{actorName(entry)}</p>
                <p className="text-caption text-chrome-ink-subtle">{entry.actorType}</p>
              </div>
              {entry.actor && (
                <>
                  <div>
                    <p className="text-caption text-chrome-ink-muted mb-1">Actor Role</p>
                    <p className="text-body text-chrome-ink">{entry.actor.role}</p>
                  </div>
                  <div>
                    <p className="text-caption text-chrome-ink-muted mb-1">Actor Email</p>
                    <p className="text-body font-mono text-chrome-ink break-all">{entry.actor.email}</p>
                  </div>
                </>
              )}
            </div>

            <div>
              <p className="text-caption text-chrome-ink-muted mb-1">Reason</p>
              <p className="text-body text-chrome-ink whitespace-pre-wrap break-words">
                {entry.reason || 'No reason recorded.'}
              </p>
            </div>

            {entry.before && Object.keys(entry.before).length > 0 && (
              <div className="p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
                <p className="text-caption text-chrome-ink-muted mb-3">Before</p>
                <pre className="text-xs text-chrome-ink font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                  {formatValue(entry.before)}
                </pre>
              </div>
            )}

            {entry.after && Object.keys(entry.after).length > 0 && (
              <div className="p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
                <p className="text-caption text-chrome-ink-muted mb-3">After</p>
                <pre className="text-xs text-chrome-ink font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                  {formatValue(entry.after)}
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
