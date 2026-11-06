import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../api/axios'
import Layout from '../components/Layout'
import ModalShell from '../components/ui/ModalShell'
import PageHeader from '../components/ui/PageHeader'
import Pill from '../components/ui/Pill'
import SectionHeader from '../components/ui/SectionHeader'
import { CORRECTION_QUEUE, backstopConditions, backstopLabels, confirmCorrectionDecision, correctionDate, correctionQuery, evidenceLabel, readBackstopCondition, readCorrectionContext, statusLabels, statusTones, tierLabels, type BackstopCondition, type CorrectionSnapshot, type Decision, type ReviewerCorrection } from '../lib/hr-corrections'
import { helpTimestamp } from '../lib/staff-help-requests'
import { correctionHttpStatus, useCorrectionDetail } from '../lib/use-hr-corrections'
import { getCurrentUser } from '../utils/auth'

const NOTE_LIMIT = 500

type DecisionInput = { decision: Decision; note: string; backstopCondition?: BackstopCondition; backstopReason?: string }
type Notice = { message: string; error?: boolean }

function CorrectionSummary({ row }: { row: ReviewerCorrection }) {
  return <section className="card p-md sm:p-lg" aria-labelledby="correction-subject">
    <div className="flex flex-wrap items-start justify-between gap-sm mb-md">
      <h2 id="correction-subject" className="text-display-sm font-serif text-ink min-w-0 break-words">{row.employee.name || 'Employee not recorded'}</h2>
      <div className="flex flex-wrap gap-xs">
        <Pill tone={statusTones[row.status]} mono>{statusLabels[row.status]}</Pill>
        <Pill tone={row.reviewTier === 'ESCALATED' ? 'warning' : 'neutral'}>{tierLabels[row.reviewTier]}</Pill>
      </div>
    </div>
    <dl className="grid gap-md sm:grid-cols-2 border-t border-hairline pt-md mb-lg">
      <div><dt className="text-caption text-ink-muted">Requester</dt><dd className="text-body-sm break-words">{row.requester.name || 'Not recorded'}</dd></div>
      <div><dt className="text-caption text-ink-muted">Attendance date</dt><dd className="text-body-sm font-mono">{correctionDate(row.date)}</dd></div>
      <div><dt className="text-caption text-ink-muted">Submitted (UTC)</dt><dd className="text-body-sm font-mono">{helpTimestamp(row.requestedAt)}</dd></div>
    </dl>
    <h3 className="text-caption text-ink-muted mb-xs">Reason</h3>
    <p className="text-body whitespace-pre-wrap break-words">{row.reason || 'Not recorded'}</p>
  </section>
}

function Snapshot({ heading, values }: { heading: string; values: CorrectionSnapshot | null }) {
  return <div className="min-w-0">
    <h3 className="text-body-sm font-medium text-ink mb-sm">{heading}</h3>
    {!values ? <p className="text-body-sm text-ink-muted">No snapshot recorded.</p> : <dl className="space-y-sm text-body-sm">
      <div><dt className="text-caption text-ink-muted">Clock in</dt><dd className="font-mono">{helpTimestamp(values.clockIn)}</dd></div>
      <div><dt className="text-caption text-ink-muted">Clock out</dt><dd className="font-mono">{helpTimestamp(values.clockOut)}</dd></div>
      <div><dt className="text-caption text-ink-muted">Status</dt><dd>{evidenceLabel(values.status)}</dd></div>
      <div><dt className="text-caption text-ink-muted">Session</dt><dd>{evidenceLabel(values.sessionStatus)}</dd></div>
      <div><dt className="text-caption text-ink-muted">Closure reason</dt><dd>{evidenceLabel(values.closureReason)}</dd></div>
      <div><dt className="text-caption text-ink-muted">Hours worked</dt><dd className="font-mono">{values.hoursWorked ?? 'Not recorded'}</dd></div>
    </dl>}
  </div>
}

function CorrectionEvidence({ row }: { row: ReviewerCorrection }) {
  return <section className="card p-md sm:p-lg" aria-label="Correction evidence">
    <SectionHeader title="Correction evidence" />
    <p className="text-caption text-ink-muted mb-md">Recorded snapshots and requested changes. Times shown in UTC.</p>
    <div className="grid gap-lg sm:grid-cols-3">
      <Snapshot heading="Original" values={row.original} />
      <div className="min-w-0">
        <h3 className="text-body-sm font-medium text-ink mb-sm">Proposed</h3>
        <dl className="space-y-sm text-body-sm">
          <div><dt className="text-caption text-ink-muted">Clock in</dt><dd className="font-mono">{row.proposedClockIn ? helpTimestamp(row.proposedClockIn) : 'Unchanged'}</dd></div>
          <div><dt className="text-caption text-ink-muted">Clock out</dt><dd className="font-mono">{row.proposedClockOut ? helpTimestamp(row.proposedClockOut) : 'Unchanged'}</dd></div>
        </dl>
      </div>
      <Snapshot heading="Approved" values={row.approved} />
    </div>
  </section>
}

function BackstopFields({ condition, reason, busy, choose, update }: {
  condition: BackstopCondition | ''; reason: string; busy: boolean
  choose: (value: BackstopCondition | '') => void; update: (value: string) => void
}) {
  return <fieldset disabled={busy} className="space-y-sm border-t border-chrome-line pt-md">
    <legend className="text-body-sm font-medium text-chrome-ink">Superadmin backstop</legend>
    <p className="text-caption text-chrome-ink-muted">Attest to the condition that applies and record your reason.</p>
    <label htmlFor="correction-condition" className="text-body-sm text-chrome-ink block">Backstop condition</label>
    <select id="correction-condition" required value={condition} className="input w-full"
      onChange={event => choose(readBackstopCondition(event.target.value))}>
      <option value="">Choose a condition</option>
      {backstopConditions.map(value => <option key={value} value={value}>{backstopLabels[value]}</option>)}
    </select>
    <label htmlFor="correction-backstop" className="text-body-sm text-chrome-ink block">Backstop reason</label>
    <textarea id="correction-backstop" className="input w-full" rows={2} required maxLength={NOTE_LIMIT}
      value={reason} onChange={event => update(event.target.value)} />
  </fieldset>
}

function DecisionDialog({ decision, needsBackstop, busy, cancel, submit }: {
  decision: Decision; needsBackstop: boolean; busy: boolean; cancel: () => void; submit: (input: DecisionInput) => void
}) {
  const [note, setNote] = useState('')
  const [condition, setCondition] = useState<BackstopCondition | ''>('')
  const [reason, setReason] = useState('')
  const validNote = note.trim().length > 0 && note.trim().length <= NOTE_LIMIT
  const validBackstop = Boolean(condition && reason.trim() && reason.trim().length <= NOTE_LIMIT)
  const canConfirm = validNote && (!needsBackstop || validBackstop) && !busy
  const confirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canConfirm) return
    submit({ decision, note: note.trim(), ...(needsBackstop && condition ? { backstopCondition: condition, backstopReason: reason.trim() } : {}) })
  }
  return <ModalShell open onClose={busy ? () => undefined : cancel} labelledBy="correction-decision-title">
    <form onSubmit={confirm} className="p-lg space-y-md">
      <h2 id="correction-decision-title" className="text-display-sm font-serif text-chrome-ink">{decision === 'APPROVED' ? 'Approve correction' : 'Decline correction'}</h2>
      <label htmlFor="correction-note" className="text-body-sm text-chrome-ink block">Decision note</label>
      <textarea id="correction-note" className="input w-full" rows={3} required maxLength={NOTE_LIMIT}
        aria-describedby="correction-note-count" value={note} disabled={busy} onChange={event => setNote(event.target.value)} />
      <p id="correction-note-count" className="text-caption text-chrome-ink-muted">{note.length}/{NOTE_LIMIT} characters</p>
      {needsBackstop && <BackstopFields condition={condition} reason={reason} busy={busy} choose={setCondition} update={setReason} />}
      <div className="flex flex-wrap gap-sm justify-end">
        <button type="button" className="btn-secondary" onClick={cancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!canConfirm}>{busy ? 'Saving…' : 'Confirm'}</button>
      </div>
    </form>
  </ModalShell>
}

function decisionFailure(error: unknown): Notice {
  const status = correctionHttpStatus(error)
  if (status === 409) return { error: true, message: 'The correction or attendance changed. The latest correction is being loaded.' }
  if (status === 403) return { error: true, message: 'You are not eligible to decide this correction. Another eligible reviewer may be needed.' }
  if (status === 401 || status === 404) return { error: true, message: 'You no longer have access to decide this correction.' }
  return { error: true, message: 'The decision could not be confirmed. Check the current correction before trying again.' }
}

function useCorrectionDecision(id: string, state: ReturnType<typeof useCorrectionDetail>) {
  const [target, setTarget] = useState<Decision | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>()
  const inFlight = useRef<AbortController | null>(null)
  useEffect(() => () => inFlight.current?.abort(), [])

  const submit = async (input: DecisionInput) => {
    const row = state.data
    const user = getCurrentUser()
    if (!row?.requester.id || !user || row.requester.id === user.id || row.status !== 'SUBMITTED'
      || !state.isCurrent() || inFlight.current || target !== input.decision) return
    const needsBackstop = user.role === 'SUPERADMIN' && row.reviewTier === 'ESCALATED'
    if (!input.note.trim() || input.note.trim().length > NOTE_LIMIT) return
    if (needsBackstop && (!input.backstopCondition || !input.backstopReason?.trim() || input.backstopReason.trim().length > NOTE_LIMIT)) return
    const controller = new AbortController()
    inFlight.current = controller
    setBusy(true)
    setNotice(undefined)
    try {
      const response = await api.patch('/hr/corrections/' + encodeURIComponent(id) + '/decision', input, { signal: controller.signal })
      if (!state.isCurrent() || controller.signal.aborted) return
      confirmCorrectionDecision(response.data, id, input.decision)
      setNotice({ message: 'Correction ' + statusLabels[input.decision].toLowerCase() + '.' })
    } catch (error) {
      if (state.isCurrent() && !controller.signal.aborted) setNotice(decisionFailure(error))
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

function DecisionPanel({ row, review }: { row: ReviewerCorrection; review: ReturnType<typeof useCorrectionDecision> }) {
  const user = getCurrentUser()
  const self = Boolean(user?.id && user.id === row.requester.id)
  const eligible = row.status === 'SUBMITTED' && !self && Boolean(row.requester.id && user?.id)
  const needsBackstop = user?.role === 'SUPERADMIN' && row.reviewTier === 'ESCALATED'
  return <section className="card p-md sm:p-lg" aria-label="Decision">
    <SectionHeader title="Decision" />
    {row.status !== 'SUBMITTED' ? <dl className="space-y-sm">
      <div><dt className="text-caption text-ink-muted">Outcome</dt><dd>{statusLabels[row.status]}</dd></div>
      {row.decidedAt && <div><dt className="text-caption text-ink-muted">Decided (UTC)</dt><dd className="font-mono">{helpTimestamp(row.decidedAt)}</dd></div>}
      <div><dt className="text-caption text-ink-muted">Decision note</dt><dd className="whitespace-pre-wrap break-words">{row.decisionNote || 'No decision note recorded.'}</dd></div>
    </dl> : self ? <p>You raised this request. Another reviewer must decide it.</p> : !eligible ? <p>Reviewer eligibility is unavailable.</p> : <>
      {row.reviewTier === 'ESCALATED' && <p className="text-body-sm text-ink-muted mb-md">
        {needsBackstop ? 'A Superadmin backstop decision requires an attested condition and reason.' : 'The server will check second-reviewer eligibility for this escalated correction.'}
      </p>}
      <div className="flex flex-wrap gap-sm">
        <button type="button" className="btn-primary" onClick={() => review.choose('APPROVED')}>Approve</button>
        <button type="button" className="btn-secondary" onClick={() => review.choose('REJECTED')}>Decline</button>
      </div>
      {review.target && <DecisionDialog key={review.target} decision={review.target} needsBackstop={needsBackstop}
        busy={review.busy} cancel={() => review.choose(null)} submit={review.submit} />}
    </>}
  </section>
}

function DetailBody({ state, review }: {
  state: ReturnType<typeof useCorrectionDetail>; review: ReturnType<typeof useCorrectionDecision>
}) {
  if (state.loading) return <div className="card p-lg" role="status">Loading correction…</div>
  if (state.error) return <div className="card p-lg" role="alert">
    <p>{state.error}</p>
    {state.retryable && <button type="button" className="btn-secondary mt-md" onClick={state.refresh}>Try again</button>}
  </div>
  if (!state.data) return null
  return <div className="space-y-md">
    <CorrectionSummary row={state.data} />
    <CorrectionEvidence row={state.data} />
    <DecisionPanel row={state.data} review={review} />
  </div>
}

export default function HrCorrectionDetail({ id }: { id: string }) {
  const { search } = useLocation()
  const state = useCorrectionDetail(id)
  const review = useCorrectionDecision(id, state)
  const notice = state.isCurrent() ? review.notice : undefined
  return <Layout>
    <PageHeader eyebrow="Corrections" title="Review correction" actions={
      <Link className="btn-secondary inline-flex items-center" to={CORRECTION_QUEUE + correctionQuery(readCorrectionContext(search))}>Back to queue</Link>
    } />
    {notice && <p className="card p-md mb-md" role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
    <DetailBody state={state} review={review} />
  </Layout>
}
