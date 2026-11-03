import { Link, useLocation, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import Pill from '../components/ui/Pill'
import { helpCategory, helpLabels, helpReturnPath, helpTimestamp, helpTones } from '../lib/staff-help-requests'
import type { HelpRequest } from '../lib/staff-help-requests'
import { useHelpDetail } from '../lib/use-staff-help-requests'

function RequestDetails({ request }: { request: HelpRequest }) {
  return <section className="card p-md sm:p-lg" aria-label="Request details">
    <div className="flex flex-col items-start sm:flex-row sm:justify-between gap-sm mb-md"><div className="min-w-0">
      <h2 className="text-display-sm font-serif font-medium text-ink break-words">{request.subject}</h2><p className="text-caption text-ink-muted mt-xxs">{helpCategory(request.category)}</p>
    </div><Pill tone={helpTones[request.status]} mono>{helpLabels[request.status]}</Pill></div>
    <dl className="grid sm:grid-cols-2 gap-md border-t border-hairline pt-md mb-lg">
      <div><dt className="text-caption text-ink-muted">Submitted</dt><dd className="text-body-sm font-mono">{helpTimestamp(request.createdAt)}</dd></div>
      <div><dt className="text-caption text-ink-muted">Last updated</dt><dd className="text-body-sm font-mono">{helpTimestamp(request.updatedAt)}</dd></div>
    </dl><h3 className="text-caption text-ink-muted mb-xs">Description</h3><p className="text-body text-ink whitespace-pre-wrap break-words">{request.body}</p>
  </section>
}
function Resolution({ request }: { request: HelpRequest }) {
  return <section className="card p-md sm:p-lg mt-md" aria-labelledby="help-resolution">
    <h2 id="help-resolution" className="text-display-sm font-serif font-medium text-ink mb-md">Resolution</h2>
    <dl><div className="mb-md"><dt className="text-caption text-ink-muted mb-xxs">Resolution note</dt>
      <dd className="text-body whitespace-pre-wrap break-words">{request.resolutionNote || 'No resolution note recorded.'}</dd></div>
      <div><dt className="text-caption text-ink-muted mb-xxs">Resolved at</dt><dd className="text-body-sm font-mono">{helpTimestamp(request.resolvedAt)}</dd></div></dl>
  </section>
}
function DetailBody({ state }: { state: ReturnType<typeof useHelpDetail> }) {
  if (state.loading) return <div className="card p-lg" role="status">Loading help request…</div>
  if (state.error) return <div className="card p-lg" role="alert"><p>{state.error}</p>{state.retryable && <button className="btn-secondary mt-md" onClick={state.retry}>Try again</button>}</div>
  return state.data ? <><RequestDetails request={state.data} /><Resolution request={state.data} /></> : null
}
export default function StaffHelpRequestDetail() {
  const { id } = useParams<{ id: string }>()
  const { search } = useLocation()
  const state = useHelpDetail(id)
  return <Layout>
    <PageHeader eyebrow="Requests" title="Help Request" actions={<Link className="btn-secondary inline-flex items-center" to={helpReturnPath(search)}>Back to Help Requests</Link>} />
    <p className="text-caption text-ink-muted mb-md">Recorded event times shown in UTC.</p>
    <DetailBody state={state} />
  </Layout>
}
