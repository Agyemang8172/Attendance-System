import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import Pill from '../components/ui/Pill'
import Pagination from '../components/ui/Pagination'
import { TableSkeleton } from '../components/ui/Skeleton'
import { formatShortDate } from '../lib/attendance-format'
import { FaPlus, FaMagnifyingGlass, FaXmark } from 'react-icons/fa6'

// ─── Types ────────────────────────────────────────────────────────────────────

type HelpRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type HelpRequestCategory = 'pin' | 'kiosk' | 'profile' | 'access' | 'other'

interface HelpRequest {
  id: string
  category: HelpRequestCategory
  subject: string
  body: string
  status: HelpRequestStatus
  createdAt: string
  updatedAt: string
  resolution?: {
    resolvedBy: string
    resolvedAt: string
    notes: string
  }
}

interface HelpRequestFilters {
  search: string
  status: HelpRequestStatus | ''
  page: number
}

const PAGE_SIZE = 12

// ─── Status Pill Helper ──────────────────────────────────────────────────────

const getStatusTone = (status: string): 'neutral' | 'accent' | 'success' | 'warning' | 'error' => {
  switch (status?.toUpperCase()) {
    case 'PENDING': return 'warning'
    case 'IN_PROGRESS': return 'accent'
    case 'RESOLVED': return 'success'
    case 'CLOSED': return 'neutral'
    default: return 'neutral'
  }
}

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    pin: 'PIN Issue',
    kiosk: 'Kiosk Problem',
    profile: 'Profile Issue',
    access: 'Access Problem',
    other: 'Other',
  }
  return labels[category] || category
}

// ─── Help Request Row ─────────────────────────────────────────────────────────

const HelpRequestRow = ({
  request,
  onClick,
}: {
  request: HelpRequest
  onClick: (request: HelpRequest) => void
}) => (
  <div
    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 card border-hairline cursor-pointer hover:bg-surface-2 transition-colors"
    onClick={() => onClick(request)}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(request); }}}
    tabIndex={0}
    role="button"
    aria-label={`View help request: ${request.subject}`}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
        <FaMagnifyingGlass className="text-accent" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-body font-medium text-ink truncate">{request.subject}</p>
        <p className="text-caption text-ink-muted flex items-center gap-2">
          <Pill tone="neutral" mono>{getCategoryLabel(request.category)}</Pill>
          <span>{formatShortDate(request.createdAt)}</span>
        </p>
      </div>
    </div>
    <div className="flex items-center gap-3 sm:flex-row-reverse">
      <Pill tone={getStatusTone(request.status)} mono>{request.status.replace('_', ' ')}</Pill>
    </div>
  </div>
)

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ onNew }: { onNew: () => void }) => (
  <div className="card p-12 text-center">
    <div className="w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-4">
      <FaMagnifyingGlass className="text-accent text-2xl" aria-hidden="true" />
    </div>
    <p className="text-body-sm text-ink-muted mb-2">No help requests yet</p>
    <p className="text-caption text-ink-subtle mb-6">
      Submit a request if you're having issues with the kiosk, your PIN, profile, or access.
    </p>
    <button
      type="button"
      onClick={onNew}
      className="btn-primary inline-flex items-center gap-2"
    >
      <FaPlus aria-hidden="true" /> New Request
    </button>
  </div>
)

// ─── Staff Help Requests List Page ────────────────────────────────────────────

function StaffHelpRequests() {
  const user = getCurrentUser()

  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [total, setTotal] = useState(0)
  const [fetching, setFetching] = useState(true)

  const [filters, setFilters] = useState<HelpRequestFilters>({
    search: '',
    status: '',
    page: 1,
  })

  // ── Fetch requests ──────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setFetching(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(filters.page))
      params.set('limit', String(PAGE_SIZE))
      if (filters.search) params.set('search', filters.search)
      if (filters.status) params.set('status', filters.status)

      const res = await api.get(`/staff/help-requests?${params.toString()}`)
      setRequests(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch {
      toast.error('Failed to load help requests.')
    } finally {
      setFetching(false)
    }
  }, [filters])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // ── Filter handlers ─────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }))
  }

  const handleStatusChange = (value: string) => {
    setFilters(prev => ({ ...prev, status: value as HelpRequestStatus | '', page: 1 }))
  }

  const clearFilters = () => {
    setFilters({ search: '', status: '', page: 1 })
  }

  const hasActiveFilters = filters.search || filters.status

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Help Requests"
        title="My Requests"
        actions={
          <button
            type="button"
            onClick={() => window.location.href = '/staff/help-requests/new'}
            className="btn-primary inline-flex items-center gap-2"
          >
            <FaPlus aria-hidden="true" /> New Request
          </button>
        }
      />

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <FilterBar label="Help request filters">
        <SearchInput
          label="Search requests"
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Subject, category…"
          className="w-full sm:w-64"
        />
        <select
          value={filters.status}
          onChange={e => handleStatusChange(e.target.value)}
          className="input w-36 sm:w-40"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
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

      {/* ── Requests List ────────────────────────────────────────────────── */}
      <SectionHeader
        title="Your Help Requests"
        actions={
          <span className="text-caption font-mono text-ink-muted" aria-live="polite">
            {total} request{total !== 1 ? 's' : ''}
          </span>
        }
      />

      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : requests.length === 0 ? (
        <EmptyState onNew={() => window.location.href = '/staff/help-requests/new'} />
      ) : (
        <>
          <div className="space-y-3" role="list" aria-label="Help requests">
            {requests.map(request => (
              <HelpRequestRow
                key={request.id}
                request={request}
                onClick={r => window.location.href = `/staff/help-requests/${r.id}`}
              />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <Pagination
              page={filters.page}
              totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              onPageChange={page => setFilters(prev => ({ ...prev, page }))}
              totalItems={total}
              pageSize={PAGE_SIZE}
              ariaLabel="Help requests pages"
              className="mt-4"
            />
          )}
        </>
      )}
    </Layout>
  )
}

export default StaffHelpRequests