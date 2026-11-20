import { Link, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import FilterBar from '../components/ui/FilterBar'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import Pill from '../components/ui/Pill'
import SectionHeader from '../components/ui/SectionHeader'
import {
  CORRECTION_PAGE_SIZE, CORRECTION_QUEUE, correctionDate, correctionQuery, correctionStatuses,
  evidenceLabel, readCorrectionContext, statusLabels, statusTones, tierLabels,
  type CorrectionContext, type CorrectionSnapshot, type ReviewerCorrection,
} from '../lib/hr-corrections'
import { helpTimestamp } from '../lib/staff-help-requests'
import { useOwnCorrectionDetail, useOwnCorrectionQueue } from '../lib/use-hr-corrections'

const OWN_QUEUE = CORRECTION_QUEUE + '/mine'
type OwnContext = Pick<CorrectionContext, 'status' | 'page'>

function ownQuery(context: OwnContext) {
  return correctionQuery({ ...context, reviewTier: '' })
}

function ReadFeedback({ loading, error, retryable, refresh }: {
  loading: boolean
  error?: string
  retryable?: boolean
  refresh: () => void
}) {
  if (loading) return <p role="status" className="card p-lg">Loading corrections…</p>
  if (!error) return null
  return <div role="alert" className="card p-lg">
    <p>{error}</p>
    {retryable && <button type="button" className="btn-secondary mt-md" onClick={refresh}>Try again</button>}
  </div>
}

function OwnQueueRows({ state, context, changePage }: {
  state: ReturnType<typeof useOwnCorrectionQueue>
  context: OwnContext
  changePage: (page: number) => void
}) {
  const queue = state.data
  if (!queue) return <ReadFeedback {...state} />
  if (context.page > Math.max(1, queue.totalPages)) return <div className="card p-lg">
    <p>This page is no longer available.</p>
    <button type="button" className="btn-secondary mt-md" onClick={() => changePage(1)}>Go to first page</button>
  </div>
  if (!queue.rows.length) return <p className="card p-lg">
    {context.status ? 'No corrections match this status.' : 'You have no correction requests.'}
  </p>
  return <div className="space-y-md">
    <p className="text-caption text-ink-muted">{queue.total} {queue.total === 1 ? 'correction' : 'corrections'}</p>
    <ul aria-label="My correction requests" className="card p-0">
      {queue.rows.map(row => <li key={row.id} className="grid gap-sm border-b border-hairline px-md py-md last:border-b-0 md:grid-cols-[2fr_1fr_auto] md:items-start">
        <Link to={OWN_QUEUE + '/' + encodeURIComponent(row.id) + ownQuery(context)}
          className="min-w-0 break-words font-medium text-accent hover:underline active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors">
          {row.reason || 'View correction'}
        </Link>
        <p className="text-caption text-ink-muted">Submitted {helpTimestamp(row.requestedAt)}</p>
        <CorrectionBadges row={row} />
      </li>)}
    </ul>
    {queue.totalPages > 1 && <Pagination page={queue.page} totalPages={queue.totalPages} totalItems={queue.total}
      pageSize={CORRECTION_PAGE_SIZE} onPageChange={changePage} ariaLabel="Correction pages" />}
  </div>
}

function OwnQueue() {
  const [params, setParams] = useSearchParams()
  const { status, page } = readCorrectionContext(params.toString())
  const context = { status, page }
  const state = useOwnCorrectionQueue(context)
  const change = (next: OwnContext) => setParams(ownQuery(next).slice(1))
  return <Layout>
    <PageHeader eyebrow="Requests" title="My corrections" actions={
      <Link className="btn-secondary" to={CORRECTION_QUEUE}>Back to reviewer queue</Link>
    } />
    <FilterBar label="Correction filters">
      <label className="text-body-sm text-ink-muted">
        Status
        <select className="input mt-xs block" value={status} onChange={event => {
          const next = correctionStatuses.find(value => value === event.target.value) || ''
          change({ status: next, page: 1 })
        }}>
          <option value="">All statuses</option>
          {correctionStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
        </select>
      </label>
    </FilterBar>
    <p className="text-caption text-ink-muted mb-md">Submission times shown in UTC.</p>
    <OwnQueueRows state={state} context={context} changePage={next => change({ status, page: next })} />
  </Layout>
}

function CorrectionBadges({ row }: { row: ReviewerCorrection }) {
  return <div className="flex flex-wrap gap-xs">
    <Pill tone={statusTones[row.status]} mono>{statusLabels[row.status]}</Pill>
    <Pill tone={row.reviewTier === 'ESCALATED' ? 'warning' : 'neutral'}>{tierLabels[row.reviewTier]}</Pill>
  </div>
}

function PunchValues({ clockIn, clockOut, absent }: {
  clockIn: string | null
  clockOut: string | null
  absent: string
}) {
  return <dl className="space-y-xs">
    <div><dt className="text-caption text-ink-muted">Clock in</dt><dd className="font-mono">{clockIn ? helpTimestamp(clockIn) : absent}</dd></div>
    <div><dt className="text-caption text-ink-muted">Clock out</dt><dd className="font-mono">{clockOut ? helpTimestamp(clockOut) : absent}</dd></div>
  </dl>
}

function SnapshotValues({ title, value }: { title: string; value: CorrectionSnapshot | null }) {
  return <div>
    <h3 className="text-body-sm font-medium text-ink mb-sm">{title}</h3>
    {value ? <>
      <PunchValues clockIn={value.clockIn} clockOut={value.clockOut} absent="Not recorded" />
      <dl className="mt-sm space-y-xs">
        <div><dt className="text-caption text-ink-muted">Attendance status</dt><dd>{evidenceLabel(value.status)}</dd></div>
        <div><dt className="text-caption text-ink-muted">Session status</dt><dd>{evidenceLabel(value.sessionStatus)}</dd></div>
        <div><dt className="text-caption text-ink-muted">Closure reason</dt><dd>{evidenceLabel(value.closureReason)}</dd></div>
        <div><dt className="text-caption text-ink-muted">Hours worked</dt><dd>{value.hoursWorked ?? 'Not recorded'}</dd></div>
      </dl>
    </> : <p className="text-body-sm text-ink-muted">No {title.toLowerCase()} values recorded.</p>}
  </div>
}

function OwnEvidence({ row }: { row: ReviewerCorrection }) {
  return <div className="space-y-md">
    <section className="card p-md sm:p-lg" aria-label="Correction summary">
      <SectionHeader title="Attendance record" />
      <p className="mb-sm text-body-sm">{correctionDate(row.date)}</p>
      <CorrectionBadges row={row} />
      <p className="mt-md text-caption text-ink-muted">Submitted (UTC)</p>
      <p className="font-mono">{helpTimestamp(row.requestedAt)}</p>
      <p className="mt-md text-caption text-ink-muted">Reason</p>
      <p className="whitespace-pre-wrap break-words">{row.reason || 'No reason recorded.'}</p>
    </section>
    <section className="card p-md sm:p-lg" aria-label="Punch evidence">
      <SectionHeader title="Punch evidence" />
      <p className="text-caption text-ink-muted mb-md">Recorded timestamps shown in UTC.</p>
      <div className="grid gap-md md:grid-cols-3">
        <SnapshotValues title="Original" value={row.original} />
        <div>
          <h3 className="text-body-sm font-medium text-ink mb-sm">Proposed</h3>
          <PunchValues clockIn={row.proposedClockIn} clockOut={row.proposedClockOut} absent="Unchanged" />
        </div>
        <SnapshotValues title="Approved" value={row.approved} />
      </div>
    </section>
    {(row.decidedAt || row.decisionNote) && <section className="card p-md sm:p-lg" aria-label="Decision information">
      <SectionHeader title="Decision information" />
      {row.decidedAt && <>
        <p className="text-caption text-ink-muted">Decided (UTC)</p>
        <p className="font-mono">{helpTimestamp(row.decidedAt)}</p>
      </>}
      {row.decisionNote && <>
        <p className="text-caption text-ink-muted mt-sm">Decision note</p>
        <p className="whitespace-pre-wrap break-words">{row.decisionNote}</p>
      </>}
    </section>}
  </div>
}

function OwnDetail({ id }: { id: string }) {
  const [params] = useSearchParams()
  const { status, page } = readCorrectionContext(params.toString())
  const state = useOwnCorrectionDetail(id)
  return <Layout>
    <PageHeader eyebrow="My corrections" title="Correction details" actions={
      <Link className="btn-secondary" to={OWN_QUEUE + ownQuery({ status, page })}>Back to my corrections</Link>
    } />
    {state.data ? <OwnEvidence row={state.data} /> : <ReadFeedback {...state} />}
  </Layout>
}

export default function HrOwnCorrections() {
  const { id } = useParams<{ id: string }>()
  return id ? <OwnDetail key={id} id={id} /> : <OwnQueue />
}
