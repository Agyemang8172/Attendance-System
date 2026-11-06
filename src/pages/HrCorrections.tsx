import { Link, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import FilterBar from '../components/ui/FilterBar'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import Pill from '../components/ui/Pill'
import { CORRECTION_PAGE_SIZE, CORRECTION_QUEUE, correctionDate, correctionQuery, correctionStatuses, readCorrectionContext, reviewTiers, statusLabels, statusTones, tierLabels, type CorrectionContext, type ReviewerCorrection } from '../lib/hr-corrections'
import { helpTimestamp } from '../lib/staff-help-requests'
import { useCorrectionQueue } from '../lib/use-hr-corrections'
import { getCurrentUser } from '../utils/auth'
import HrCorrectionDetail from './HrCorrectionDetail'

function QueueRow({ row, context }: { row: ReviewerCorrection; context: CorrectionContext }) {
  const path = CORRECTION_QUEUE + '/' + encodeURIComponent(row.id) + correctionQuery(context)
  return <li className="grid gap-sm border-b border-hairline px-md py-md last:border-b-0 md:grid-cols-[2fr_1fr_auto] md:items-start">
    <div className="min-w-0">
      <Link to={path} className="font-medium text-accent hover:underline active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors break-words">
        {row.employee.name || 'Employee not recorded'}
      </Link>
      <p className="text-caption text-ink-muted mt-xxs break-words">Requester: {row.requester.name || 'Not recorded'}</p>
    </div>
    <div>
      <p className="text-body-sm text-ink">{correctionDate(row.date)}</p>
      <p className="text-caption text-ink-muted mt-xxs">Submitted {helpTimestamp(row.requestedAt)}</p>
    </div>
    <div className="flex flex-wrap gap-xs">
      <Pill tone={statusTones[row.status]} mono>{statusLabels[row.status]}</Pill>
      <Pill tone={row.reviewTier === 'ESCALATED' ? 'warning' : 'neutral'}>{tierLabels[row.reviewTier]}</Pill>
    </div>
  </li>
}

function QueueBody({ state, context, changePage }: {
  state: ReturnType<typeof useCorrectionQueue>
  context: CorrectionContext
  changePage: (page: number) => void
}) {
  if (state.loading) return <div className="card p-lg" role="status">Loading corrections…</div>
  if (state.error) return <div className="card p-lg" role="alert">
    <p>{state.error}</p>
    {state.retryable && <button type="button" className="btn-secondary mt-md" onClick={state.refresh}>Try again</button>}
  </div>

  const queue = state.data
  if (!queue) return null
  if (context.page > Math.max(1, queue.totalPages)) return <div className="card p-lg">
    <p>This page is no longer available.</p>
    <button type="button" className="btn-secondary mt-md" onClick={() => changePage(1)}>Go to first page</button>
  </div>
  if (!queue.rows.length) return <div className="card p-lg">
    <p>{context.status || context.reviewTier ? 'No corrections match these filters.' : 'No corrections have been submitted.'}</p>
  </div>

  return <div className="space-y-md">
    <p className="text-caption text-ink-muted">{queue.total} {queue.total === 1 ? 'correction' : 'corrections'}</p>
    <ul aria-label="Correction queue" className="card p-0">
      {queue.rows.map(row => <QueueRow key={row.id} row={row} context={context} />)}
    </ul>
    {queue.totalPages > 1 && <Pagination page={queue.page} totalPages={queue.totalPages} totalItems={queue.total}
      pageSize={CORRECTION_PAGE_SIZE} onPageChange={changePage} ariaLabel="Correction pages" />}
  </div>
}

function CorrectionQueue() {
  const [params, setParams] = useSearchParams()
  const context = readCorrectionContext(params.toString())
  const state = useCorrectionQueue(context)
  const change = (next: CorrectionContext) => setParams(correctionQuery(next).slice(1))
  return <Layout>
    <PageHeader eyebrow="Requests" title="Corrections" actions={getCurrentUser()?.role === 'HR' && (
      <Link className="btn-secondary" to="/hr-corrections/mine">My corrections</Link>
    )} />
    <FilterBar label="Correction filters">
      <label className="text-body-sm text-ink-muted">
        Status
        <select className="input mt-xs block" value={context.status} onChange={event => {
          const status = correctionStatuses.find(value => value === event.target.value) || ''
          change({ ...context, status, page: 1 })
        }}>
          <option value="">All statuses</option>
          {correctionStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
      </label>
      <label className="text-body-sm text-ink-muted">
        Review tier
        <select className="input mt-xs block" value={context.reviewTier} onChange={event => {
          const reviewTier = reviewTiers.find(value => value === event.target.value) || ''
          change({ ...context, reviewTier, page: 1 })
        }}>
          <option value="">All tiers</option>
          {reviewTiers.map(tier => <option key={tier} value={tier}>{tierLabels[tier]}</option>)}
        </select>
      </label>
    </FilterBar>
    <p className="text-caption text-ink-muted mb-md">Submission times shown in UTC.</p>
    <QueueBody state={state} context={context} changePage={page => change({ ...context, page })} />
  </Layout>
}

export default function HrCorrections() {
  const { id } = useParams<{ id: string }>()
  return id ? <HrCorrectionDetail id={id} key={id} /> : <CorrectionQueue />
}
