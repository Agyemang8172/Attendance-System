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

type CorrectionStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ESCALATED'
type CorrectionTier = 'STANDARD' | 'ESCALATED'

interface Correction {
  id: string
  attendanceId: string
  attendanceDate: string
  status: CorrectionStatus
  tier: CorrectionTier
  reason: string
  proposedValues: {
    clockIn?: string
    clockOut?: string
    status?: string
  }
  createdAt: string
  updatedAt: string
}

interface CorrectionFilters {
  search: string
  status: CorrectionStatus | ''
  page: number
}

const PAGE_SIZE = 12

// ─── Status/Tier Pill Helpers ─────────────────────────────────────────────────

const getStatusTone = (status: string): 'neutral' | 'accent' | 'success' | 'warning' | 'error' => {
  switch (status?.toUpperCase()) {
    case 'SUBMITTED': return 'warning'
    case 'UNDER_REVIEW': return 'accent'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'error'
    case 'ESCALATED': return 'accent'
    default: return 'neutral'
  }
}

const getTierTone = (tier: string): 'neutral' | 'accent' | 'success' | 'warning' | 'error' => {
  switch (tier?.toUpperCase()) {
    case 'STANDARD': return 'neutral'
    case 'ESCALATED': return 'warning'
    default: return 'neutral'
  }
}

// ─── Correction Row ────────────────────────────────────────────────────────────

const CorrectionRow = ({
  correction,
  onClick,
}: {
  correction: Correction
  onClick: (correction: Correction) => void
}) => (
  <div
    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 card border-hairline cursor-pointer hover:bg-surface-2 transition-colors"
    onClick={() => onClick(correction)}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(correction); }}}
    tabIndex={0}
    role="button"
    aria-label={`View correction for ${formatShortDate(correction.attendanceDate)}`}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-lg bg-warning-soft flex items-center justify-center shrink-0">
        <FaMagnifyingGlass className="text-warning" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-body font-medium text-ink truncate">
          Correction for {formatShortDate(correction.attendanceDate)}
        </p>
        <p className="text-caption text-ink-muted flex items-center gap-2">
          <Pill tone={getTierTone(correction.tier)} mono>{correction.tier}</Pill>
          <span>{formatShortDate(correction.createdAt)}</span>
        </p>
      </div>
    </div>
    <div className="flex items-center gap-3 sm:flex-row-reverse">
      <Pill tone={getStatusTone(correction.status)} mono>{correction.status.replace('_', ' ')}</Pill>
    </div>
  </div>
)

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ onNew }: { onNew: () => void }) => (
  <div className="card p-12 text-center">
    <div className="w-16 h-16 rounded-full bg-warning-soft flex items-center justify-center mx-auto mb-4">
      <FaMagnifyingGlass className="text-warning text-2xl" aria-hidden="true" />
    </div>
    <p className="text-body-sm text-ink-muted mb-2">No correction requests yet</p>
    <p className="text-caption text-ink-subtle mb-6">
      Submit a correction if you notice an error in your attendance record.
    </p>
    <button
      type="button"
      onClick={onNew}
      className="btn-primary inline-flex items-center gap-2"
    >
      <FaPlus aria-hidden="true" /> New Correction
    </button>
  </div>
)

// ─── Staff Corrections List Page ──────────────────────────────────────────────

function StaffCorrections() {
  const user = getCurrentUser()

  const [corrections, setCorrections] = useState<Correction[]>([])
  const [total, setTotal] = useState(0)
  const [fetching, setFetching] = useState(true)

  const [filters, setFilters] = useState<CorrectionFilters>({
    search: '',
    status: '',
    page: 1,
  })

  // ── Fetch corrections ───────────────────────────────────────────────────────
  const fetchCorrections = useCallback(async () => {
    setFetching(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(filters.page))
      params.set('limit', String(PAGE_SIZE))
      if (filters.search) params.set('search', filters.search)
      if (filters.status) params.set('status', filters.status)

      const res = await api.get(`/staff/corrections?${params.toString()}`)
      setCorrections(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch {
      toast.error('Failed to load corrections.')
    } finally {
      setFetching(false)
    }
  }, [filters])

  useEffect(() => {
    fetchCorrections()
  }, [fetchCorrections])

  // ── Filter handlers ─────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }))
  }

  const handleStatusChange = (value: string) => {
    setFilters(prev => ({ ...prev, status: value as CorrectionStatus | '', page: 1 }))
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
        eyebrow="Corrections"
        title="My Requests"
        actions={
          <button
            type="button"
            onClick={() => window.location.href = '/staff/corrections/new'}
            className="btn-primary inline-flex items-center gap-2"
          >
            <FaPlus aria-hidden="true" /> New Correction
          </button>
        }
      />

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <FilterBar label="Correction filters">
        <SearchInput
          label="Search corrections"
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Date, reason…"
          className="w-full sm:w-64"
        />
        <select
          value={filters.status}
          onChange={e => handleStatusChange(e.target.value)}
          className="input w-36 sm:w-44"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ESCALATED">Escalated</option>
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

      {/* ── Corrections List ─────────────────────────────────────────────── */}
      <SectionHeader
        title="Your Correction Requests"
        actions={
          <span className="text-caption font-mono text-ink-muted" aria-live="polite">
            {total} request{total !== 1 ? 's' : ''}
          </span>
        }
      />

      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : corrections.length === 0 ? (
        <EmptyState onNew={() => window.location.href = '/staff/corrections/new'} />
      ) : (
        <>
          <div className="space-y-3" role="list" aria-label="Correction requests">
            {corrections.map(correction => (
              <CorrectionRow
                key={correction.id}
                correction={correction}
                onClick={c => window.location.href = `/staff/corrections/${c.id}`}
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
              ariaLabel="Corrections pages"
              className="mt-4"
            />
          )}
        </>
      )}
    </Layout>
  )
}

export default StaffCorrections