import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill from '../components/ui/Pill'
import { formatShortDate, formatTimeOfDay } from '../lib/attendance-format'
import { FaArrowLeft, FaClock, FaUser, FaCircleCheck, FaXmark, FaPenToSquare, FaClock as FaClockIcon } from 'react-icons/fa6'

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
  originalValues: {
    clockIn?: string
    clockOut?: string
    status?: string
  }
  createdAt: string
  updatedAt: string
  decision?: {
    decidedBy: string
    decidedAt: string
    outcome: 'APPROVED' | 'REJECTED'
    reason: string
  }
  auditTrail?: Array<{
    action: string
    actor: string
    timestamp: string
    details?: string
  }>
}

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

// ─── Diff Row ──────────────────────────────────────────────────────────────────

const DiffRow = ({ label, original, proposed }: { label: string; original?: string; proposed?: string }) => {
  const hasChange = original !== proposed
  const formatValue = (v?: string) => {
    if (!v) return '—'
    if (label === 'Clock In' || label === 'Clock Out') return formatTimeOfDay(v)
    return v
  }

  return (
    <div className={['grid grid-cols-3 gap-4 py-2', hasChange ? 'bg-warning-soft/30' : ''].join(' ')}>
      <span className="text-caption text-ink-muted">{label}</span>
      <span className={['text-body font-mono', hasChange ? 'text-error line-through' : 'text-ink-muted'].join(' ')}>
        {formatValue(original)}
      </span>
      <span className={['text-body font-mono', hasChange ? 'text-success' : 'text-ink'].join(' ')}>
        {formatValue(proposed)}
      </span>
    </div>
  )
}

// ─── Audit Trail Item ──────────────────────────────────────────────────────────

const AuditItem = ({ item }: { item: NonNullable<Correction['auditTrail']>[0] }) => (
  <div className="flex gap-4 pb-4 border-b border-hairline last:border-0">
    <div className="w-24 shrink-0 text-caption font-mono text-ink-muted">
      {formatShortDate(item.timestamp)}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-body-sm font-medium text-chrome-ink">{item.action}</p>
      <p className="text-caption text-chrome-ink-muted">By {item.actor}</p>
      {item.details && <p className="text-caption text-chrome-ink-muted mt-0.5">{item.details}</p>}
    </div>
  </div>
)

// ─── Staff Correction Detail Page ──────────────────────────────────────────────

function StaffCorrectionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [correction, setCorrection] = useState<Correction | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCorrection = useCallback(async () => {
    if (!id) return
    setFetching(true)
    setError(null)
    try {
      const res = await api.get(`/staff/corrections/${id}`)
      setCorrection(res.data.data)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Correction request not found.')
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view this correction.')
      } else {
        setError('Failed to load correction request.')
      }
    } finally {
      setFetching(false)
    }
  }, [id])

  useEffect(() => {
    fetchCorrection()
  }, [fetchCorrection])

  if (fetching) {
    return (
      <Layout>
        <PageHeader eyebrow="Correction" title="Loading…" />
        <div className="card p-8" role="status" aria-label="Loading correction">
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

  if (error || !correction) {
    return (
      <Layout>
        <PageHeader eyebrow="Correction" title="Not Found" />
        <div className="card p-12 text-center">
          <FaXmark className="text-error text-4xl mx-auto mb-4" aria-hidden="true" />
          <p className="text-body text-ink-muted">{error || 'Correction request not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/staff/corrections')}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <FaArrowLeft aria-hidden="true" /> Back to Corrections
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Correction"
        title={`Request for ${formatShortDate(correction.attendanceDate)}`}
        actions={
          <button
            type="button"
            onClick={() => navigate('/staff/corrections')}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FaArrowLeft aria-hidden="true" /> Back
          </button>
        }
      />

      {/* ── Correction Header ─────────────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning-soft flex items-center justify-center">
              <FaPenToSquare className="text-warning" aria-hidden="true" />
            </div>
            <div>
              <p className="text-caption text-ink-muted">Tier: <span className="text-ink-muted">{correction.tier}</span></p>
              <div className="flex items-center gap-2 mt-1">
                <Pill tone={getStatusTone(correction.status)} mono>{correction.status.replace('_', ' ')}</Pill>
                <Pill tone={getTierTone(correction.tier)} mono>{correction.tier}</Pill>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-caption font-mono text-ink-muted">
            <FaClockIcon aria-hidden="true" /> Submitted: {formatShortDate(correction.createdAt)}
          </div>
        </div>

        {/* Reason */}
        <div className="pt-4 border-t border-hairline">
          <p className="text-caption text-ink-muted mb-2">Reason</p>
          <p className="text-body text-ink whitespace-pre-wrap">{correction.reason}</p>
        </div>
      </div>

      {/* ── Before/After Diff ─────────────────────────────────────────────── */}
      <SectionHeader title="Proposed Changes" />
      <div className="card p-6 mb-6">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <span className="text-caption text-ink-muted">Field</span>
          <span className="text-caption text-ink-muted text-center">Original</span>
          <span className="text-caption text-ink-muted text-center">Proposed</span>
        </div>
        <DiffRow
          label="Clock In"
          original={correction.originalValues.clockIn}
          proposed={correction.proposedValues.clockIn}
        />
        <DiffRow
          label="Clock Out"
          original={correction.originalValues.clockOut}
          proposed={correction.proposedValues.clockOut}
        />
        <DiffRow
          label="Status"
          original={correction.originalValues.status}
          proposed={correction.proposedValues.status}
        />
      </div>

      {/* ── Decision Outcome ──────────────────────────────────────────────── */}
      {correction.decision && (
        <>
          <SectionHeader title="Decision" />
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={[
                'w-10 h-10 rounded-full flex items-center justify-center',
                correction.decision.outcome === 'APPROVED' ? 'bg-success-soft' : 'bg-error-soft',
              ].join(' ')}>
                {correction.decision.outcome === 'APPROVED' ? (
                  <FaCircleCheck className="text-success" aria-hidden="true" />
                ) : (
                  <FaXmark className="text-error" aria-hidden="true" />
                )}
              </div>
              <div>
                <p className="text-body font-semibold text-ink">
                  {correction.decision.outcome === 'APPROVED' ? 'Approved' : 'Rejected'}
                </p>
                <p className="text-caption text-ink-muted">
                  Decided by {correction.decision.decidedBy} on {formatShortDate(correction.decision.decidedAt)}
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-hairline">
              <p className="text-caption text-ink-muted mb-2">Decision Reason</p>
              <p className="text-body text-ink whitespace-pre-wrap">{correction.decision.reason}</p>
            </div>
          </div>
        </>
      )}

      {/* ── Audit Trail ───────────────────────────────────────────────────── */}
      <SectionHeader title="Audit Trail" />
      {correction.auditTrail && correction.auditTrail.length > 0 ? (
        <div className="card p-6">
          <div className="space-y-0">
            {correction.auditTrail.map((item, index) => (
              <AuditItem key={index} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center text-ink-muted">
          <FaClockIcon className="text-ink-subtle text-2xl mx-auto mb-2" aria-hidden="true" />
          <p className="text-body-sm">No audit trail entries</p>
        </div>
      )}
    </Layout>
  )
}

export default StaffCorrectionDetail