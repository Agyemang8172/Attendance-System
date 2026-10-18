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
import { formatTodayLong, formatShortDate } from '../lib/attendance-format'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ModalShell from '../components/ui/ModalShell'

const PAGE_SIZE = 12

interface HelpRequest {
  id: string
  requester: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  category: 'pin' | 'kiosk' | 'profile' | 'access' | 'other'
  subject: string
  body: string
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  resolutionNote?: string | null
  createdAt: string
  updatedAt: string
  resolvedAt?: string | null
}

function HrHelpRequests() {
  const user = getCurrentUser()

  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Detail drawer
  const [detailRequest, setDetailRequest] = useState<HelpRequest | null>(null)

  // Status transition
  const [transitioningId, setTransitioningId] = useState<string | null>(null)
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false)
  const [requestToTransition, setRequestToTransition] = useState<HelpRequest | null>(null)
  const [newStatus, setNewStatus] = useState<'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'>('IN_REVIEW')
  const [resolutionNote, setResolutionNote] = useState('')

  const fetchRequests = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (statusFilter) params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/hr/help-requests', { params })
      setRequests(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load help requests.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchRequests(1)
  }, [statusFilter, searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchRequests(newPage)
    }
  }

  const openTransitionDialog = (request: HelpRequest, targetStatus: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED') => {
    setRequestToTransition(request)
    setNewStatus(targetStatus)
    setResolutionNote('')
    setTransitionDialogOpen(true)
  }

  const handleStatusTransition = async () => {
    if (!requestToTransition) return
    setTransitioningId(requestToTransition.id)
    try {
      const payload: { status: string; resolutionNote?: string } = { status: newStatus }
      if (resolutionNote.trim()) payload.resolutionNote = resolutionNote.trim()
      await api.patch(`/hr/help-requests/${requestToTransition.id}`, payload)
      toast.success(`Request marked as ${newStatus.replace('_', ' ')}.`)
      setTransitionDialogOpen(false)
      setRequestToTransition(null)
      fetchRequests(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to update request.'
      toast.error(msg)
    } finally {
      setTransitioningId(null)
    }
  }

  const statusOrder = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']
  const canTransition = (current: string, target: string) => {
    const currentIdx = statusOrder.indexOf(current)
    const targetIdx = statusOrder.indexOf(target)
    return targetIdx > currentIdx // Only forward transitions
  }

  const filteredRequests = useMemo(() => requests, [requests])

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Help Requests"
      />

      <SectionHeader title="Filters" />
      <FilterBar label="Help request filters">
        <div className="flex flex-wrap items-end gap-3 w-full">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="hrStatus">
              Status
            </label>
            <select
              id="hrStatus"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      </FilterBar>

      <SearchInput
        label="Search help requests"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by requester, subject or category…"
      />

      {!fetching && searchQuery && filteredRequests.length === 0 && (
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
          {filteredRequests.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Requester</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Category</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Subject</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Status</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Created</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((req, index) => (
                      <tr
                        key={req.id || index}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                          'cursor-pointer'
                        ].join(' ')}
                        onClick={() => setDetailRequest(req)}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                          {req.requester.firstName} {req.requester.lastName}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle capitalize">
                          {req.category}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap text-ink max-w-xs truncate">
                          {req.subject}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill
                            tone={
                              req.status === 'OPEN' ? 'accent' :
                              req.status === 'IN_REVIEW' ? 'warning' :
                              req.status === 'RESOLVED' ? 'success' :
                              'neutral'
                            }
                            mono
                          >
                            {req.status.replace('_', ' ')}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(req.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetailRequest(req)
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
          {filteredRequests.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No help requests found.</p>
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
          ariaLabel="Help requests pages"
        />
      )}

      {detailRequest && (
        <HelpRequestDetailDrawer
          request={detailRequest}
          onClose={() => setDetailRequest(null)}
          onTransition={openTransitionDialog}
          canTransition={canTransition(detailRequest.status, 'IN_REVIEW')}
        />
      )}

      {transitionDialogOpen && requestToTransition && (
        <TransitionDialog
          request={requestToTransition}
          open={transitionDialogOpen}
          onClose={() => {
            setTransitionDialogOpen(false)
            setRequestToTransition(null)
            setResolutionNote('')
          }}
          onConfirm={handleStatusTransition}
          status={newStatus}
          setStatus={setNewStatus}
          resolutionNote={resolutionNote}
          setResolutionNote={setResolutionNote}
          busy={!!transitioningId}
        />
      )}
    </Layout>
  )
}

// Detail drawer component
interface DetailDrawerProps {
  request: HelpRequest
  onClose: () => void
  onTransition: (request: HelpRequest, status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED') => void
  canTransition: boolean
}

const HelpRequestDetailDrawer = ({ request, onClose, onTransition, canTransition }: DetailDrawerProps) => {
  const statusTone = {
    OPEN: 'accent' as const,
    IN_REVIEW: 'warning' as const,
    RESOLVED: 'success' as const,
    CLOSED: 'neutral' as const,
  }

  return (
    <div className="fixed inset-0 z-50 overlay-scrim backdrop-blur-sm flex items-end justify-center lg:items-center p-4 lg:p-0">
      <div
        className="w-full lg:w-96 bg-chrome border border-chrome-line shadow-elevated max-h-screen overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Help request detail"
      >
        <div className="p-6 lg:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-2">
                Help Request
              </p>
              <h2 className="text-display-sm text-chrome-ink font-serif">{request.subject}</h2>
              <p className="text-chrome-ink-subtle text-xs font-mono mt-1">
                #{request.id.slice(0, 8)}
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
                <p className="text-caption text-chrome-ink-muted mb-1">Requester</p>
                <p className="text-body text-chrome-ink">{request.requester.firstName} {request.requester.lastName}</p>
                <p className="text-caption text-chrome-ink-muted font-mono">{request.requester.email}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Category</p>
                <p className="text-body text-chrome-ink capitalize">{request.category}</p>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Status</p>
                <Pill tone={statusTone[request.status]} mono>
                  {request.status.replace('_', ' ')}
                </Pill>
              </div>
              <div>
                <p className="text-caption text-chrome-ink-muted mb-1">Created</p>
                <p className="text-body font-mono text-chrome-ink">{formatShortDate(request.createdAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-caption text-chrome-ink-muted mb-1">Description</p>
              <p className="text-body text-chrome-ink whitespace-pre-wrap">{request.body}</p>
            </div>

            {request.resolutionNote && (
              <div className="p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
                <p className="text-caption text-chrome-ink-muted mb-1">Resolution Note</p>
                <p className="text-body text-chrome-ink">{request.resolutionNote}</p>
                {request.resolvedAt && (
                  <p className="text-caption text-chrome-ink-muted mt-1">
                    Resolved: {formatShortDate(request.resolvedAt)}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-chrome-line">
              <button
                onClick={onClose}
                className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans"
              >
                Close
              </button>
              {canTransition && request.status !== 'CLOSED' && (
                <>
                  {request.status === 'OPEN' && (
                    <button
                      onClick={() => onTransition(request, 'IN_REVIEW')}
                      className="px-4 py-2 bg-brass-chrome text-ink rounded-md text-sm font-semibold font-sans hover:opacity-90 transition-opacity"
                    >
                      Start Review
                    </button>
                  )}
                  {request.status === 'IN_REVIEW' && (
                    <button
                      onClick={() => onTransition(request, 'RESOLVED')}
                      className="px-4 py-2 bg-brass-chrome text-ink rounded-md text-sm font-semibold font-sans hover:opacity-90 transition-opacity"
                    >
                      Resolve
                    </button>
                  )}
                  {(request.status === 'RESOLVED' || request.status === 'IN_REVIEW') && (
                    <button
                      onClick={() => onTransition(request, 'CLOSED')}
                      className="px-4 py-2 bg-chrome-elevated text-chrome-ink border border-chrome-line rounded-md text-sm font-semibold font-sans hover:bg-chrome transition-colors"
                    >
                      Close
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="lg:hidden fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
    </div>
  )
}

// Transition dialog component
interface TransitionDialogProps {
  request: HelpRequest
  open: boolean
  onClose: () => void
  onConfirm: () => void
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  setStatus: (s: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED') => void
  resolutionNote: string
  setResolutionNote: (s: string) => void
  busy: boolean
}

const TransitionDialog = ({
  request,
  open,
  onClose,
  onConfirm,
  status,
  setStatus,
  resolutionNote,
  setResolutionNote,
  busy,
}: TransitionDialogProps) => {
  const statusLabels: Record<string, string> = {
    OPEN: 'Open',
    IN_REVIEW: 'In Review',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      label="Confirm Status Change"
      maxWidth="md"
    >
      <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
        Confirm
      </p>

      <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-3">
        Change status to {statusLabels[status]}?
      </h2>

      <div className="text-chrome-ink-muted text-sm font-sans space-y-2 mb-6">
        <p>Request: <span className="font-medium">{request.subject}</span></p>
        <p>Requester: <span className="font-medium">{request.requester.firstName} {request.requester.lastName}</span></p>
        <p>Current status: <span className="font-medium">{statusLabels[request.status]}</span></p>
      </div>

      {status === 'RESOLVED' || status === 'CLOSED' ? (
        <div className="mb-6">
          <label className="block text-caption text-chrome-ink-muted mb-2 font-sans">
            Resolution Note (required for Resolved/Closed)
          </label>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
            placeholder="Describe the resolution…"
            maxLength={500}
          />
          <p className="text-caption text-chrome-ink-muted mt-1 text-right">
            {resolutionNote.length}/500
          </p>
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || (status === 'RESOLVED' || status === 'CLOSED') && !resolutionNote.trim()}
          className="btn bg-brass-chrome text-ink px-4 py-2 rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {busy ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </ModalShell>
  )
}

export default HrHelpRequests