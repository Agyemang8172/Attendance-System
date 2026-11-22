import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import Pagination from '../components/ui/Pagination'
import Pill from '../components/ui/Pill'
import { helpCategory, helpLabels, helpQuery, helpStatuses, helpTimestamp, helpTones, readHelpContext } from '../lib/staff-help-requests'
import type { HelpRequest } from '../lib/staff-help-requests'
import { useHelpList } from '../lib/use-staff-help-requests'

const NewRequestLink = () => <Link className="btn-primary inline-flex items-center" to="/staff/help-requests/new">New Request</Link>
function RequestRow({ request, query }: { request: HelpRequest; query: string }) {
  return <li><Link to={`/staff/help-requests/${encodeURIComponent(request.id)}${query}`} aria-label={`View help request: ${request.subject}`}
    className="card flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-sm p-md hover:bg-surface-2 active:bg-surface-2 active:scale-[0.99] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
    <div className="min-w-0"><p className="text-body font-medium text-ink break-words">{request.subject}</p>
      <p className="text-caption text-ink-muted mt-xxs">{helpCategory(request.category)} · {helpTimestamp(request.createdAt)}</p></div>
    <Pill tone={helpTones[request.status]} mono>{helpLabels[request.status]}</Pill>
  </Link></li>
}
function EmptyRequests({ filtered, page, total, clear }: { filtered: boolean; page: number; total: number; clear: () => void }) {
  const outsidePage = page > 1 || total > 0
  return <div className="card p-lg sm:p-xxl text-center">
    <h2 className="text-body font-medium text-ink">{outsidePage ? 'No requests on this page' : filtered ? 'No requests match this status' : 'No help requests yet'}</h2>
    <p className="text-body-sm text-ink-muted mt-xs mb-lg">{outsidePage || filtered ? 'View all requests or choose another status.' : 'Submit a request for help with your PIN, kiosk, profile or access.'}</p>
    {outsidePage || filtered ? <button className="btn-secondary" onClick={clear}>View all requests</button> : <NewRequestLink />}
  </div>
}
function ListBody({ state, status, page, query, clear, changePage }: {
  state: ReturnType<typeof useHelpList>; status: string; page: number; query: string; clear: () => void; changePage: (page: number) => void
}) {
  if (state.loading) return <div className="card p-lg" role="status">Loading help requests…</div>
  if (state.error) return <div className="card p-lg" role="alert"><p>{state.error}</p>{state.retryable && <button className="btn-secondary mt-md" onClick={state.retry}>Try again</button>}</div>
  if (!state.data) return null
  const { requests, total, totalPages, page: currentPage } = state.data
  if (!requests.length) return <EmptyRequests filtered={Boolean(status)} page={page} total={total} clear={clear} />
  return <><ul className="space-y-sm" aria-label="Help requests">{requests.map(request => <RequestRow key={request.id} request={request} query={query} />)}</ul>
    {totalPages > 1 && <Pagination page={currentPage} totalPages={totalPages} onPageChange={changePage} totalItems={total} pageSize={12} ariaLabel="Help requests pages" className="mt-md" />}</>
}
export default function StaffHelpRequests() {
  const [params, setParams] = useSearchParams()
  const { status, page } = useMemo(() => readHelpContext(params.toString()), [params])
  const state = useHelpList(status, page)
  const clear = () => setParams('', { replace: true })
  const query = helpQuery(status, page)
  const count = state.data ? `${state.data.total} request${state.data.total === 1 ? '' : 's'}` : state.loading ? 'Loading count…' : 'Count unavailable'
  return <Layout>
    <PageHeader eyebrow="Requests" title="Help Requests" actions={<NewRequestLink />} />
    <FilterBar label="Help request filters"><select className="input w-full sm:w-40" aria-label="Filter by status" value={status} onChange={event => setParams(helpQuery(event.target.value, 1))}>
      <option value="">All statuses</option>{helpStatuses.map(value => <option key={value} value={value}>{helpLabels[value]}</option>)}
    </select>{status && <button className="btn-secondary" onClick={clear}>Clear filters</button>}</FilterBar>
    <SectionHeader title="Your Help Requests" actions={<span className="text-caption font-mono text-ink-muted" aria-live="polite">{count}</span>} />
    <p className="text-caption text-ink-muted mb-md">Recorded event times shown in UTC.</p>
    <ListBody state={state} status={status} page={page} query={query} clear={clear} changePage={value => setParams(helpQuery(status, value))} />
  </Layout>
}
