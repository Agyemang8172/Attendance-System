import { Link, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import FilterBar from '../components/ui/FilterBar'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import Pill from '../components/ui/Pill'
import { HR_HELP_PAGE_SIZE, HR_HELP_QUEUE, type HrHelpRequest } from '../lib/hr-help-requests'
import { helpCategory, helpLabels, helpQuery, helpStatuses, helpTimestamp, helpTones, readHelpContext } from '../lib/staff-help-requests'
import { useHrHelpQueue } from '../lib/use-hr-help-requests'
import HrHelpRequestDetail from './HrHelpRequestDetail'

function QueueRow({ request, context }: { request: HrHelpRequest; context: string }) {
  const path = `${HR_HELP_QUEUE}/${encodeURIComponent(request.id)}${context}`
  return <li className="grid gap-sm border-b border-hairline px-md py-md last:border-b-0 md:grid-cols-[2fr_1fr_auto] md:items-start">
    <div className="min-w-0">
      <Link className="text-accent font-medium break-words hover:underline active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors" to={path}>{request.subject}</Link>
      <p className="text-caption text-ink-muted mt-xxs">{helpCategory(request.category)}</p>
    </div>
    <div className="min-w-0">
      <p className="text-body-sm text-ink break-words">{request.requester.name || 'Requester not recorded'}</p>
      <p className="text-caption text-ink-muted mt-xxs">{helpTimestamp(request.createdAt)}</p>
    </div>
    <div><Pill tone={helpTones[request.status]} mono>{helpLabels[request.status]}</Pill></div>
  </li>
}

function QueueBody({ state, context, changePage }: {
  state: ReturnType<typeof useHrHelpQueue>
  context: ReturnType<typeof readHelpContext>
  changePage: (page: number) => void
}) {
  if (state.loading) return <div className="card p-lg" role="status">Loading help requests…</div>
  if (state.error) return <div className="card p-lg" role="alert">
    <p>{state.error}</p>
    {state.retryable && <button type="button" className="btn-secondary mt-md" onClick={state.refresh}>Try again</button>}
  </div>

  const queue = state.data
  if (!queue) return null
  if (context.page > Math.max(queue.totalPages, 1)) return <div className="card p-lg">
    <p>This page is no longer available.</p>
    <button type="button" className="btn-secondary mt-md" onClick={() => changePage(1)}>Go to first page</button>
  </div>
  if (queue.requests.length === 0) return <div className="card p-lg">
    <p>{context.status ? 'No help requests match this status.' : 'No help requests have been submitted.'}</p>
  </div>

  return <div className="space-y-md">
    <p className="text-caption text-ink-muted">{queue.total} {queue.total === 1 ? 'request' : 'requests'}</p>
    <ul aria-label="Help request queue" className="card overflow-hidden p-0">
      {queue.requests.map(request => <QueueRow key={request.id} request={request} context={helpQuery(context.status, context.page)} />)}
    </ul>
    {queue.totalPages > 1 && <Pagination page={queue.page} totalPages={queue.totalPages} totalItems={queue.total}
      pageSize={HR_HELP_PAGE_SIZE} onPageChange={changePage} ariaLabel="Help request pages" />}
  </div>
}

function HelpQueue() {
  const [params, setParams] = useSearchParams()
  const context = readHelpContext(params.toString())
  const state = useHrHelpQueue(context.status, context.page)
  const changePage = (page: number) => setParams(helpQuery(context.status, page).slice(1))
  return <Layout>
    <PageHeader eyebrow="Requests" title="Help Requests" />
    <FilterBar label="Help request filters">
      <label className="text-body-sm text-ink-muted">
        Status
        <select className="input mt-xs block" value={context.status} onChange={event => setParams(helpQuery(event.target.value, 1).slice(1))}>
          <option value="">All statuses</option>
          {helpStatuses.map(status => <option key={status} value={status}>{helpLabels[status]}</option>)}
        </select>
      </label>
    </FilterBar>
    <p className="text-caption text-ink-muted mb-md">Submission times shown in UTC.</p>
    <QueueBody state={state} context={context} changePage={changePage} />
  </Layout>
}

export default function HrHelpRequests() {
  const { id } = useParams<{ id: string }>()
  return id ? <HrHelpRequestDetail key={id} id={id} /> : <HelpQueue />
}
