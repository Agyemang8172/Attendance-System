import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../api/axios'
import Layout from '../components/Layout'
import ModalShell from '../components/ui/ModalShell'
import PageHeader from '../components/ui/PageHeader'
import Pill from '../components/ui/Pill'
import SectionHeader from '../components/ui/SectionHeader'
import { confirmHelpTransition, HR_HELP_QUEUE, reviewActions, reviewLabels, type HrHelpRequest, type ReviewStatus } from '../lib/hr-help-requests'
import { helpCategory, helpLabels, helpQuery, helpTimestamp, helpTones, readHelpContext } from '../lib/staff-help-requests'
import { hrHelpErrorStatus, useHrHelpDetail } from '../lib/use-hr-help-requests'

const NOTE_LIMIT = 500
type Notice = { message: string; error?: boolean }

function RequestDetails({ request }: { request: HrHelpRequest }) {
  return <section className="card p-md sm:p-lg" aria-labelledby="hr-help-subject">
    <div className="flex flex-wrap items-start justify-between gap-sm mb-md">
      <div className="min-w-0">
        <h2 id="hr-help-subject" className="text-display-sm font-serif text-ink break-words">{request.subject}</h2>
        <p className="text-caption text-ink-muted mt-xxs">{helpCategory(request.category)}</p>
      </div>
      <Pill tone={helpTones[request.status]} mono>{helpLabels[request.status]}</Pill>
    </div>
    <dl className="grid sm:grid-cols-2 gap-md border-t border-hairline pt-md mb-lg">
      <div>
        <dt className="text-caption text-ink-muted">Requester</dt>
        <dd className="text-body-sm break-words">{request.requester.name || 'Not recorded'}</dd>
        {request.requester.email && <dd className="text-caption text-ink-muted break-words">{request.requester.email}</dd>}
      </div>
      <div>
        <dt className="text-caption text-ink-muted">Submitted (UTC)</dt>
        <dd className="text-body-sm font-mono">{helpTimestamp(request.createdAt)}</dd>
      </div>
    </dl>
    <h3 className="text-caption text-ink-muted mb-xs">Description</h3>
    <p className="text-body whitespace-pre-wrap break-words">{request.body}</p>
  </section>
}

function TransitionDialog({ status, busy, cancel, submit }: {
  status: ReviewStatus
  busy: boolean
  cancel: () => void
  submit: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const finalMove = status !== 'IN_REVIEW'
  const valid = !finalMove || (note.trim().length > 0 && note.trim().length <= NOTE_LIMIT)
  const confirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (valid && !busy) submit(note.trim())
  }
  return <ModalShell open onClose={busy ? () => undefined : cancel} labelledBy="hr-help-action-title" maxWidth="md">
    <form onSubmit={confirm} className="space-y-md" aria-busy={busy}>
      <h2 id="hr-help-action-title" className="text-display-sm font-serif text-chrome-ink">{reviewLabels[status]}</h2>
      {finalMove ? <>
        <p className="text-body-sm text-chrome-ink-muted">The requester will see the final status and this note.</p>
        <label className="text-body-sm text-chrome-ink block" htmlFor="hr-help-note">Resolution note</label>
        <textarea id="hr-help-note" className="w-full rounded-md border border-chrome-line bg-chrome-elevated p-sm text-body-sm text-chrome-ink focus-visible:ring-2 focus-visible:ring-brass-chrome" rows={4} required maxLength={NOTE_LIMIT}
          aria-describedby="hr-help-note-count" value={note} disabled={busy} onChange={event => setNote(event.target.value)} />
        <p id="hr-help-note-count" className="text-caption text-chrome-ink-muted">{note.length}/{NOTE_LIMIT} characters</p>
      </> : <p className="text-body-sm text-chrome-ink-muted">The requester will see that their request is in review.</p>}
      <div className="flex flex-wrap gap-sm justify-end">
        <button type="button" className="btn px-md py-sm text-chrome-ink-muted hover:text-chrome-ink focus-visible:ring-2 focus-visible:ring-brass-chrome" onClick={cancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn bg-brass-chrome px-md py-sm text-ink hover:bg-brass-chrome/90 focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:ring-offset-2 focus-visible:ring-offset-chrome" disabled={!valid || busy}>{busy ? 'Saving…' : 'Confirm'}</button>
      </div>
    </form>
  </ModalShell>
}

function ReviewPanel({ request, choose }: { request: HrHelpRequest; choose: (status: ReviewStatus) => void }) {
  const actions = reviewActions[request.status]
  return <section className="card p-md sm:p-lg" aria-label="Review and resolution">
    <SectionHeader title="Review and resolution" />
    <dl className="space-y-md">
      <div>
        <dt className="text-caption text-ink-muted">Resolution note</dt>
        <dd className="text-body whitespace-pre-wrap break-words">{request.resolutionNote || 'No resolution note recorded.'}</dd>
      </div>
      {request.status === 'RESOLVED' && <div>
        <dt className="text-caption text-ink-muted">Resolved at (UTC)</dt>
        <dd className="text-body-sm font-mono">{helpTimestamp(request.resolvedAt)}</dd>
      </div>}
    </dl>
    {actions.length ? <div className="flex flex-wrap gap-sm mt-md">
      {actions.map(status => <button key={status} type="button" className="btn-secondary" onClick={() => choose(status)}>
        {reviewLabels[status]}
      </button>)}
    </div> : <p className="text-body-sm text-ink-muted mt-md">This request has reached its final status.</p>}
  </section>
}

function transitionFailure(error: unknown): Notice {
  const status = hrHelpErrorStatus(error)
  if (status === 409) return { message: 'This request changed while you were reviewing it. Check the latest state before trying again.', error: true }
  if (status === 401 || status === 403 || status === 404) return { message: 'You no longer have access to update this request.', error: true }
  return { message: 'The update could not be confirmed. Check the latest request state before trying again.', error: true }
}

function useReviewTransition(id: string, state: ReturnType<typeof useHrHelpDetail>) {
  const [target, setTarget] = useState<ReviewStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>()
  const inFlight = useRef<AbortController | null>(null)
  useEffect(() => () => inFlight.current?.abort(), [])
  const submit = async (note: string) => {
    if (!state.data || !target || !reviewActions[state.data.status].includes(target) || !state.isCurrent() || inFlight.current) return
    if (target !== 'IN_REVIEW' && (!note || note.length > NOTE_LIMIT)) return
    const controller = new AbortController()
    inFlight.current = controller
    setBusy(true)
    setNotice(undefined)
    try {
      const response = await api.patch(`/hr/help-requests/${encodeURIComponent(id)}`, {
        status: target, ...(note ? { resolutionNote: note } : {}),
      }, { signal: controller.signal })
      if (!state.isCurrent() || controller.signal.aborted) return
      confirmHelpTransition(response.data, id, target)
      setNotice({ message: `The requester will see the status “${helpLabels[target]}”${note ? ' and your resolution note' : ''}.` })
    } catch (error) {
      if (state.isCurrent() && !controller.signal.aborted) setNotice(transitionFailure(error))
    } finally {
      inFlight.current = null
      if (!controller.signal.aborted) {
        state.refresh()
        setTarget(null)
        setBusy(false)
      }
    }
  }
  return { target, choose: setTarget, busy, notice, submit }
}

function DetailBody({ state, review }: {
  state: ReturnType<typeof useHrHelpDetail>
  review: ReturnType<typeof useReviewTransition>
}) {
  if (state.loading) return <div className="card p-lg" role="status">Loading help request…</div>
  if (state.error) return <div className="card p-lg" role="alert">
    <p>{state.error}</p>
    {state.retryable && <button type="button" className="btn-secondary mt-md" onClick={state.refresh}>Try again</button>}
  </div>
  if (!state.data) return null

  return <div className="space-y-md">
    <RequestDetails request={state.data} />
    <ReviewPanel request={state.data} choose={review.choose} />
    {review.target && <TransitionDialog key={review.target} status={review.target} busy={review.busy}
      cancel={() => review.choose(null)} submit={review.submit} />}
  </div>
}

export default function HrHelpRequestDetail({ id }: { id: string }) {
  const { search } = useLocation()
  const context = readHelpContext(search)
  const state = useHrHelpDetail(id)
  const review = useReviewTransition(id, state)
  const notice = state.isCurrent() ? review.notice : undefined
  return <Layout>
    <PageHeader eyebrow="Requests" title="Help Request" actions={
      <Link className="btn-secondary inline-flex items-center" to={HR_HELP_QUEUE + helpQuery(context.status, context.page)}>Back to queue</Link>
    } />
    {notice && <p className="card p-md mb-md" role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
    <DetailBody state={state} review={review} />
  </Layout>
}
