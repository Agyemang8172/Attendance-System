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
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ModalShell from '../components/ui/ModalShell'

const PAGE_SIZE = 12

interface Correction {
  id: string
  attendanceId: string
  requester: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  employee: {
    id: string
    firstName: string
    lastName: string
  }
  reason: string
  proposedClockIn?: string | null
  proposedClockOut?: string | null
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
  reviewTier: 'SAME_DAY' | 'ESCALATED'
  currentClockIn?: string | null
  currentClockOut?: string | null
  currentStatus?: string
  decidedBy?: string | null
  decidedAt?: string | null
  decisionNote?: string | null
  backstopCondition?: string | null
  backstopReason?: string | null
  createdAt: string
  updatedAt: string
}

function HrCorrections() {
  const user = getCurrentUser()

  const [corrections, setCorrections] = useState<Correction[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Decision panel
  const [decisionCorrection, setDecisionCorrection] = useState<Correction | null>(null)
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [decisionNote, setDecisionNote] = useState('')
  const [backstopCondition, setBackstopCondition] = useState<'UNCLAIMED_24H' | 'CONFLICT_OF_INTEREST' | 'EXPLICIT_HANDOFF' | ''>('')
  const [backstopReason, setBackstopReason] = useState('')
  const [deciding, setDeciding] = useState(false)

  const fetchCorrections = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (statusFilter) params.status = statusFilter
      if (tierFilter) params.reviewTier = tierFilter
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/hr/corrections', { params })
      setCorrections(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load corrections.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchCorrections(1)
  }, [statusFilter, tierFilter, searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchCorrections(newPage)
    }
  }

  const openDecisionPanel = (correction: Correction) => {
    setDecisionCorrection(correction)
    setDecision('APPROVED')
    setDecisionNote('')
    setBackstopCondition('')
    setBackstopReason('')
  }

  const handleDecision = async () => {
    if (!decisionCorrection) return
    setDeciding(true)
    try {
      const payload: {
        decision: 'APPROVED' | 'REJECTED'
        note?: string
        backstopCondition?: 'UNCLAIMED_24H' | 'CONFLICT_OF_INTEREST' | 'EXPLICIT_HANDOFF'
        backstopReason?: string
      } = { decision }

      if (decisionNote.trim()) payload.note = decisionNote.trim()

      // For ESCALATED corrections, SUPERADMIN backstop requires condition + reason
      const currentUser = getCurrentUser()
      const isSuperAdmin = currentUser?.role === 'SUPERADMIN'
      const isEscalated = decisionCorrection.reviewTier === 'ESCALATED'

      if (isSuperAdmin && isEscalated) {
        if (!backstopCondition) {
          toast.error('Backstop condition is required for SUPERADMIN decisions on escalated corrections.')
          return
        }
        if (!backstopReason.trim()) {
          toast.error('Backstop reason is required for SUPERADMIN decisions on escalated corrections.')
          return
        }
        payload.backstopCondition = backstopCondition as 'UNCLAIMED_24H' | 'CONFLICT_OF_INTEREST' | 'EXPLICIT_HANDOFF'
        payload.backstopReason = backstopReason.trim()
      }

      await api.patch(`/hr/corrections/${decisionCorrection.id}/decision`, payload)
      toast.success(`Correction ${decision.toLowerCase()}.`)
      setDecisionCorrection(null)
      fetchCorrections(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to decide correction.'
      toast.error(msg)
    } finally {
      setDeciding(false)
    }
  }

  const filteredCorrections = useMemo(() => corrections, [corrections])

  const isEscalated = decisionCorrection?.reviewTier === 'ESCALATED'
  const currentUser = getCurrentUser()
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN'
  const showBackstopFields = isSuperAdmin && isEscalated

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Corrections Queue"
      />

      <SectionHeader title="Filters" />
      <FilterBar label="Correction filters">
        <div className="flex flex-wrap items-end gap-3 w-full">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="corrStatus">
              Status
            </label>
            <select
              id="corrStatus"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="corrTier">
              Tier
            </label>
            <select
              id="corrTier"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              <option value="SAME_DAY">Same Day</option>
              <option value="ESCALATED">Escalated</option>
            </select>
          </div>
        </div>
      </FilterBar>

      <SearchInput
        label="Search corrections"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by requester, employee, reason…"
      />

      {!fetching && searchQuery && filteredCorrections.length === 0 && (
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
          {filteredCorrections.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Requester</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Employee</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Date</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Tier</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Status</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Reason</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCorrections.map((corr, index) => (
                      <tr
                        key={corr.id || index}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                          'cursor-pointer'
                        ].join(' ')}
                        onClick={() => corr.status === 'SUBMITTED' && openDecisionPanel(corr)}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                          {corr.requester.firstName} {corr.requester.lastName}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                          {corr.employee.firstName} {corr.employee.lastName}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(corr.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill
                            tone={corr.reviewTier === 'ESCALATED' ? 'warning' : 'accent'}
                            mono
                          >
                            {corr.reviewTier.replace('_', ' ')}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill
                            tone={
                              corr.status === 'SUBMITTED' ? 'accent' :
                              corr.status === 'APPROVED' ? 'success' :
                              corr.status === 'REJECTED' ? 'error' :
                              'neutral'
                            }
                            mono
                          >
                            {corr.status}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap text-ink-muted max-w-xs truncate">
                          {corr.reason}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {corr.status === 'SUBMITTED' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openDecisionPanel(corr)
                              }}
                              className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                            >
                              Decide
                            </button>
                          )}
                          {corr.status !== 'SUBMITTED' && (
                            <span className="text-ink-tertiary font-mono text-body-sm">
                              Decided
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {filteredCorrections.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No corrections found.</p>
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
          ariaLabel="Corrections pages"
        />
      )}

      {decisionCorrection && (
        <DecisionPanel
          correction={decisionCorrection}
          onClose={() => setDecisionCorrection(null)}
          decision={decision}
          setDecision={setDecision}
          decisionNote={decisionNote}
          setDecisionNote={setDecisionNote}
          backstopCondition={backstopCondition}
          setBackstopCondition={setBackstopCondition}
          backstopReason={backstopReason}
          setBackstopReason={setBackstopReason}
          onConfirm={handleDecision}
          busy={deciding}
          isSuperAdmin={isSuperAdmin}
          showBackstopFields={showBackstopFields}
        />
      )}
    </Layout>
  )
}

// Decision Panel Component
interface DecisionPanelProps {
  correction: Correction
  onClose: () => void
  decision: 'APPROVED' | 'REJECTED'
  setDecision: (d: 'APPROVED' | 'REJECTED') => void
  decisionNote: string
  setDecisionNote: (s: string) => void
  backstopCondition: 'UNCLAIMED_24H' | 'CONFLICT_OF_INTEREST' | 'EXPLICIT_HANDOFF' | ''
  setBackstopCondition: (c: 'UNCLAIMED_24H' | 'CONFLICT_OF_INTEREST' | 'EXPLICIT_HANDOFF' | '') => void
  backstopReason: string
  setBackstopReason: (s: string) => void
  onConfirm: () => void
  busy: boolean
  isSuperAdmin: boolean
  showBackstopFields: boolean
}

const DecisionPanel = ({
  correction,
  onClose,
  decision,
  setDecision,
  decisionNote,
  setDecisionNote,
  backstopCondition,
  setBackstopCondition,
  backstopReason,
  setBackstopReason,
  onConfirm,
  busy,
  isSuperAdmin,
  showBackstopFields,
}: DecisionPanelProps) => {
  const backstopOptions = [
    { value: 'UNCLAIMED_24H', label: 'Unclaimed for 24 hours' },
    { value: 'CONFLICT_OF_INTEREST', label: 'Conflict of interest' },
    { value: 'EXPLICIT_HANDOFF', label: 'Explicit handoff from HR' },
  ] as const

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      label="Correction Decision"
      maxWidth="lg"
    >
      <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
        Decision Panel
      </p>

      <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-2">
        Correction Decision
      </h2>
      <p className="text-chrome-ink-muted text-sm font-sans mb-6">
        Review the proposed changes and decide.
      </p>

      {/* Before/After Diff */}
      <div className="mb-6 p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
        <p className="text-caption text-chrome-ink-muted mb-3">Proposed Changes</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-chrome-ink-muted mb-1">Clock In</p>
            <div className="flex items-center gap-2">
              <span className="text-chrome-ink font-mono">
                {correction.currentClockIn ? formatTimeOfDay(correction.currentClockIn) : '—'}
              </span>
              <span className="text-brass-chrome">→</span>
              <span className="text-chrome-ink font-mono font-medium">
                {correction.proposedClockIn ? formatTimeOfDay(correction.proposedClockIn) : '—'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-chrome-ink-muted mb-1">Clock Out</p>
            <div className="flex items-center gap-2">
              <span className="text-chrome-ink font-mono">
                {correction.currentClockOut ? formatTimeOfDay(correction.currentClockOut) : '—'}
              </span>
              <span className="text-brass-chrome">→</span>
              <span className="text-chrome-ink font-mono font-medium">
                {correction.proposedClockOut ? formatTimeOfDay(correction.proposedClockOut) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Context */}
      <div className="mb-6 p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-chrome-ink-muted mb-1">Requester</p>
            <p className="text-chrome-ink font-medium">{correction.requester.firstName} {correction.requester.lastName}</p>
          </div>
          <div>
            <p className="text-chrome-ink-muted mb-1">Employee</p>
            <p className="text-chrome-ink font-medium">{correction.employee.firstName} {correction.employee.lastName}</p>
          </div>
          <div>
            <p className="text-chrome-ink-muted mb-1">Tier</p>
            <Pill tone={correction.reviewTier === 'ESCALATED' ? 'warning' : 'accent'} mono>
              {correction.reviewTier.replace('_', ' ')}
            </Pill>
          </div>
          <div>
            <p className="text-chrome-ink-muted mb-1">Submitted</p>
            <p className="text-chrome-ink font-mono">{formatShortDate(correction.createdAt)}</p>
          </div>
        </div>
        <p className="text-caption text-chrome-ink-muted mt-3">Reason: {correction.reason}</p>
      </div>

      {/* Decision Form */}
      <div className="space-y-4 mb-6">
        <div>
          <p className="text-caption text-chrome-ink-muted mb-2">Decision</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="decision"
                value="APPROVED"
                checked={decision === 'APPROVED'}
                onChange={() => setDecision('APPROVED')}
                className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome"
              />
              <span className="text-chrome-ink font-medium">Approve</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="decision"
                value="REJECTED"
                checked={decision === 'REJECTED'}
                onChange={() => setDecision('REJECTED')}
                className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome"
              />
              <span className="text-chrome-ink font-medium">Reject</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-caption text-chrome-ink-muted mb-2 font-sans">
            Decision Note (required)
          </label>
          <textarea
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
            placeholder="Explain your decision…"
            maxLength={500}
            required
          />
          <p className="text-caption text-chrome-ink-muted mt-1 text-right">
            {decisionNote.length}/500
          </p>
        </div>

        {showBackstopFields && (
          <div className="border-t border-chrome-line pt-4">
            <p className="text-caption text-chrome-ink-muted mb-3 font-medium">
              SUPERADMIN Backstop — condition and reason required
            </p>
            <div>
              <label className="block text-caption text-chrome-ink-muted mb-2 font-sans">
                Backstop Condition
              </label>
              <select
                value={backstopCondition}
                onChange={(e) => setBackstopCondition(e.target.value as typeof backstopCondition)}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
              >
                <option value="">Select condition…</option>
                {backstopOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label className="block text-caption text-chrome-ink-muted mb-2 font-sans">
                Backstop Reason (required)
              </label>
              <textarea
                value={backstopReason}
                onChange={(e) => setBackstopReason(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                placeholder="Explain why this backstop applies…"
                maxLength={500}
              />
              <p className="text-caption text-chrome-ink-muted mt-1 text-right">
                {backstopReason.length}/500
              </p>
            </div>
          </div>
        )}

        {!isSuperAdmin && correction.reviewTier === 'ESCALATED' && (
          <div className="p-3 bg-warning-soft border border-warning-soft rounded-lg text-warning text-sm">
            This correction is escalated. As HR, you can decide normally. If there is a conflict of interest,
            a SUPERADMIN backstop decision is required.
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-chrome-line">
        <button
          onClick={onClose}
          disabled={busy}
          className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy || !decisionNote.trim() || (showBackstopFields && (!backstopCondition || !backstopReason.trim()))}
          className="btn bg-brass-chrome text-ink px-4 py-2 rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {busy ? 'Deciding…' : `Confirm ${decision}`}
        </button>
      </div>
    </ModalShell>
  )
}

export default HrCorrections