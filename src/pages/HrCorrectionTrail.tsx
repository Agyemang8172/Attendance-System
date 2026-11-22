import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/axios'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import Pill, { type PillTone } from '../components/ui/Pill'
import { BentoSkeleton } from '../components/ui/Skeleton'
import {
  correctionDate,
  evidenceLabel,
  statusLabels,
  statusTones,
  tierLabels,
  type CorrectionStatus,
  type ReviewTier,
} from '../lib/hr-corrections'
import { helpTimestamp } from '../lib/staff-help-requests'

interface Person {
  id?: string | null
  firstName: string
  lastName: string
  email?: string
}

interface Revision {
  id: string
  revisionNo: number
  action: string
  reason?: string | null
  valuesBefore?: Record<string, unknown> | null
  valuesAfter?: Record<string, unknown> | null
  createdAt: string
  actor?: Person | null
}

interface TrailAudit {
  id: string
  action: string
  actorType: string
  actorUserId?: string | null
  actorKioskId?: string | null
  reason?: string | null
  createdAt: string
  actor?: Person | null
}

interface Correction {
  id: string
  reason: string
  requestedAt: string
  reviewTier: ReviewTier | string
  proposedClockIn?: string | null
  proposedClockOut?: string | null
  originalValues?: Record<string, unknown> | null
  approvedValues?: Record<string, unknown> | null
  status: CorrectionStatus | string
  decisionNote?: string | null
  decidedAt?: string | null
  requestedBy?: Person | null
  reviewedBy?: Person | null
  attendance: {
    id: string
    date: string
    user?: { firstName: string; lastName: string } | null
  }
  attendanceCorrectionRevisions: Revision[]
  audits: TrailAudit[]
}

const statusTone = (status: string): PillTone =>
  statusTones[status as CorrectionStatus] ?? 'neutral'

const statusLabel = (status: string): string =>
  statusLabels[status as CorrectionStatus] ?? evidenceLabel(status)

const tierLabel = (tier: string): string =>
  tierLabels[tier as ReviewTier] ?? evidenceLabel(tier)

const fullName = (person?: Person | null): string =>
  person ? `${person.firstName} ${person.lastName}` : 'Unknown'

const auditActor = (entry: TrailAudit): string => {
  if (entry.actor) return fullName(entry.actor)
  if (entry.actorType === 'KIOSK') return entry.actorKioskId ? `Kiosk ${entry.actorKioskId.slice(0, 8)}` : 'Kiosk'
  if (entry.actorType === 'SYSTEM') return 'System'
  return entry.actorUserId ? `User ${entry.actorUserId.slice(0, 8)}` : 'Unknown actor'
}

/**
 * Snapshot keys the correction lane can carry. Unknown keys keep a readable
 * fallback instead of leaking raw camelCase into the page.
 */
const SNAPSHOT_LABELS: Record<string, string> = {
  clockIn: 'Clock in',
  clockOut: 'Clock out',
  status: 'Status',
  sessionStatus: 'Session status',
  closureReason: 'Closure reason',
  hoursWorked: 'Hours worked',
}

const humanizeKey = (key: string): string =>
  SNAPSHOT_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()

const snapshotValue = (key: string, value: unknown): string => {
  if (key === 'clockIn' || key === 'clockOut') return `${helpTimestamp(String(value))} UTC`
  if (key === 'status' || key === 'sessionStatus' || key === 'closureReason') {
    return evidenceLabel(String(value))
  }
  return String(value)
}

const snapshotRows = (values?: Record<string, unknown> | null): Array<[string, string]> => {
  if (!values) return []
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => [humanizeKey(key), snapshotValue(key, value)])
}

function SnapshotList({ title, values }: { title: string; values?: Record<string, unknown> | null }) {
  const rows = snapshotRows(values)
  if (rows.length === 0) return null
  return (
    <div className="mt-4">
      <p className="text-caption text-ink-muted mb-1">{title}</p>
      <dl className="grid sm:grid-cols-2 gap-2 text-body-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-caption text-ink-subtle">{label}</dt>
            <dd className="font-mono break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function HrCorrectionTrail() {
  const { id } = useParams<{ id: string }>()
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/audit/corrections/${id}`)
        if (!cancelled) setCorrections(res.data?.data ?? [])
      } catch (err: unknown) {
        if (!cancelled) {
          const response = (err as { response?: { status?: number; data?: { message?: string } } }).response
          const message = response?.status === 404
            ? 'This attendance record was not found or is not available to your account.'
            : response?.data?.message ?? 'Could not load the correction trail. Check the connection and try again.'
          setError(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) void load()
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const first = corrections[0]
  const employee = first?.attendance.user
  const heading = employee
    ? `${employee.firstName} ${employee.lastName}`
    : 'Attendance record'
  const backHref = first?.attendance.id
    ? `/hr-attendance/${encodeURIComponent(first.attendance.id)}`
    : '/hr-attendance'

  return (
    <Layout>
      <PageHeader
        eyebrow="Audit"
        title="Correction trail"
        actions={
          <Link to={backHref} className="btn-secondary">
            {first?.attendance.id ? 'Back to record' : 'Back to attendance'}
          </Link>
        }
      />

      <p className="text-body-sm text-ink-muted mb-6">
        {heading}
        {first ? ` · ${correctionDate(first.attendance.date)}` : ''}
      </p>

      {loading && <BentoSkeleton />}

      {!loading && error && (
        <div role="alert" className="card p-6 border-error-soft">
          <p className="text-body text-error">{error}</p>
          <button type="button" className="btn-secondary mt-md" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && corrections.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-body text-ink-muted">
            No correction requests were filed against this attendance record.
          </p>
        </div>
      )}

      {!loading && !error && corrections.length > 0 && (
        <div className="space-y-6">
          {corrections.map((correction) => (
            <article key={correction.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow text-ink-muted mb-1">
                    Requested {helpTimestamp(correction.requestedAt)} UTC
                  </p>
                  <p className="text-body-sm text-ink-muted">
                    {fullName(correction.requestedBy)} · {tierLabel(correction.reviewTier)}
                  </p>
                </div>
                <Pill tone={statusTone(correction.status)}>{statusLabel(correction.status)}</Pill>
              </div>

              <p className="text-body text-ink mt-4">{correction.reason}</p>

              <dl className="grid sm:grid-cols-2 gap-3 mt-4 text-body-sm">
                <div>
                  <dt className="text-caption text-ink-muted">Proposed clock-in</dt>
                  <dd className="font-mono">
                    {correction.proposedClockIn
                      ? `${helpTimestamp(correction.proposedClockIn)} UTC`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">Proposed clock-out</dt>
                  <dd className="font-mono">
                    {correction.proposedClockOut
                      ? `${helpTimestamp(correction.proposedClockOut)} UTC`
                      : '—'}
                  </dd>
                </div>
              </dl>

              <SnapshotList title="Original values" values={correction.originalValues} />
              <SnapshotList title="Approved values" values={correction.approvedValues} />

              {correction.status === 'WITHDRAWN' && (
                <p className="text-body-sm text-ink-muted mt-4">
                  Withdrawn by the requester
                  {correction.decidedAt ? ` on ${helpTimestamp(correction.decidedAt)} UTC` : ''}.
                </p>
              )}

              {(correction.status === 'APPROVED' || correction.status === 'REJECTED') && correction.decidedAt && (
                <p className="text-body-sm text-ink-muted mt-4">
                  {statusLabel(correction.status)} {helpTimestamp(correction.decidedAt)} UTC by{' '}
                  {fullName(correction.reviewedBy)}
                  {correction.decisionNote ? `: ${correction.decisionNote}` : '.'}
                </p>
              )}

              <div className="grid lg:grid-cols-2 gap-6 mt-6 pt-5 border-t border-hairline">
                <section>
                  <h2 className="text-caption text-ink-muted mb-3">Revision history</h2>
                  {correction.attendanceCorrectionRevisions.length === 0 ? (
                    <p className="text-body-sm text-ink-subtle">No revisions recorded.</p>
                  ) : (
                    <ol className="space-y-3">
                      {correction.attendanceCorrectionRevisions.map((revision) => (
                        <li key={revision.id} className="border-l-2 border-accent-focus pl-3">
                          <p className="text-body-sm text-ink">
                            {revision.action} · #{revision.revisionNo}
                          </p>
                          <p className="text-caption text-ink-muted">
                            {helpTimestamp(revision.createdAt)} UTC · {fullName(revision.actor)}
                          </p>
                          {revision.reason && (
                            <p className="text-caption text-ink-muted mt-1">{revision.reason}</p>
                          )}
                          <SnapshotList title="Before" values={revision.valuesBefore} />
                          <SnapshotList title="After" values={revision.valuesAfter} />
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                <section>
                  <h2 className="text-caption text-ink-muted mb-3">Audit events</h2>
                  {correction.audits.length === 0 ? (
                    <p className="text-body-sm text-ink-subtle">No audit events recorded.</p>
                  ) : (
                    <ol className="space-y-3">
                      {correction.audits.map((entry) => (
                        <li key={entry.id} className="border-l-2 border-hairline-strong pl-3">
                          <p className="text-body-sm font-mono text-ink">{entry.action}</p>
                          <p className="text-caption text-ink-muted">
                            {helpTimestamp(entry.createdAt)} UTC · {auditActor(entry)}
                            {entry.reason ? ` · ${entry.reason}` : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  )
}

export default HrCorrectionTrail
