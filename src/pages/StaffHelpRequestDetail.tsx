import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill from '../components/ui/Pill'
import { formatShortDate } from '../lib/attendance-format'
import { FaArrowLeft, FaClock, FaUser, FaCircleCheck, FaXmark, FaMagnifyingGlass } from 'react-icons/fa6'

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
  timeline?: Array<{
    status: HelpRequestStatus
    changedBy: string
    changedAt: string
    notes?: string
  }>
}

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

// ─── Timeline Item ────────────────────────────────────────────────────────────

const TimelineItem = ({ item, isLast }: { item: NonNullable<HelpRequest['timeline']>[0]; isLast: boolean }) => {
  const tone = getStatusTone(item.status)
  return (
    <div className="relative flex gap-4 pb-6">
      <div className="flex flex-col items-center shrink-0">
        <div
          className={[
            'w-3 h-3 rounded-full border-2 border-chrome-line',
            'bg-chrome',
            tone === 'success' && 'bg-success border-success',
            tone === 'warning' && 'bg-warning border-warning',
            tone === 'accent' && 'bg-accent border-accent',
            tone === 'error' && 'bg-error border-error',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {!isLast && <div className="w-0.5 h-full mt-1 bg-chrome-line" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Pill tone={tone} mono>{item.status.replace('_', ' ')}</Pill>
          <span className="text-caption text-chrome-ink-muted font-mono">
            {formatShortDate(item.changedAt)}
          </span>
        </div>
        <p className="text-body-sm text-chrome-ink font-sans">{item.notes || `Status changed to ${item.status.replace('_', ' ').toLowerCase()} by ${item.changedBy}`}</p>
      </div>
    </div>
  )
}

// ─── Staff Help Request Detail Page ──────────────────────────────────────────

function StaffHelpRequestDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [request, setRequest] = useState<HelpRequest | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRequest = useCallback(async () => {
    if (!id) return
    setFetching(true)
    setError(null)
    try {
      const res = await api.get(`/staff/help-requests/${id}`)
      setRequest(res.data.data)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Help request not found.')
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view this request.')
      } else {
        setError('Failed to load help request.')
      }
    } finally {
      setFetching(false)
    }
  }, [id])

  useEffect(() => {
    fetchRequest()
  }, [fetchRequest])

  if (fetching) {
    return (
      <Layout>
        <PageHeader eyebrow="Help Request" title="Loading…" />
        <div className="card p-8" role="status" aria-label="Loading help request">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-1/3 bg-surface-2 rounded" />
            <div className="h-4 w-full bg-surface-2 rounded" />
            <div className="h-4 w-1/2 bg-surface-2 rounded" />
            <div className="h-32 bg-surface-2 rounded" />
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !request) {
    return (
      <Layout>
        <PageHeader eyebrow="Help Request" title="Not Found" />
        <div className="card p-12 text-center">
          <FaXmark className="text-error text-4xl mx-auto mb-4" aria-hidden="true" />
          <p className="text-body text-ink-muted">{error || 'Help request not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/staff/help-requests')}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <FaArrowLeft aria-hidden="true" /> Back to Requests
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Help Request"
        title={request.subject}
        actions={
          <button
            type="button"
            onClick={() => navigate('/staff/help-requests')}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FaArrowLeft aria-hidden="true" /> Back
          </button>
        }
      />

      {/* ── Request Header ───────────────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
              <FaMagnifyingGlass className="text-accent" aria-hidden="true" />
            </div>
            <div>
              <p className="text-caption text-ink-muted">{getCategoryLabel(request.category)}</p>
              <Pill tone={getStatusTone(request.status)} mono>{request.status.replace('_', ' ')}</Pill>
            </div>
          </div>
          <div className="flex items-center gap-2 text-caption font-mono text-ink-muted">
            <FaClock aria-hidden="true" /> Created: {formatShortDate(request.createdAt)}
          </div>
        </div>

        {/* Request Body */}
        <div className="pt-4 border-t border-hairline">
          <p className="text-caption text-ink-muted mb-2">Description</p>
          <p className="text-body text-ink whitespace-pre-wrap">{request.body}</p>
        </div>
      </div>

      {/* ── Resolution Timeline ──────────────────────────────────────────── */}
      <SectionHeader title="Resolution Timeline" />

      {request.timeline && request.timeline.length > 0 ? (
        <div className="card p-6">
          <div className="space-y-0">
            {request.timeline.map((item, index) => (
              <TimelineItem key={index} item={item} isLast={index === request.timeline!.length - 1} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center text-ink-muted">
          <FaClock className="text-ink-subtle text-2xl mx-auto mb-2" aria-hidden="true" />
          <p className="text-body-sm">No timeline entries yet</p>
          <p className="text-caption text-ink-subtle mt-1">Updates will appear here as HR reviews your request.</p>
        </div>
      )}

      {/* ── Resolution Details ───────────────────────────────────────────── */}
      {request.resolution && (
        <div>
          <SectionHeader title="Resolution" />
          <div className="card p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-caption text-ink-muted mb-1">Resolved By</p>
                <p className="text-body font-sans text-ink flex items-center gap-2">
                  <FaUser aria-hidden="true" /> {request.resolution.resolvedBy}
                </p>
              </div>
              <div>
                <p className="text-caption text-ink-muted mb-1">Resolved At</p>
                <p className="text-body font-mono text-ink flex items-center gap-2">
                  <FaClock aria-hidden="true" /> {formatShortDate(request.resolution.resolvedAt)}
                </p>
              </div>
              <div className="sm:col-span-3">
                <p className="text-caption text-ink-muted mb-1">Resolution Notes</p>
                <p className="text-body text-ink whitespace-pre-wrap">{request.resolution.notes}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default StaffHelpRequestDetail