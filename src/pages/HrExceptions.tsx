import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import Pagination from '../components/ui/Pagination'
import Pill from '../components/ui/Pill'
import { attendanceLabels, recordedDate, recordedTime } from '../lib/staff-attendance-detail'
import { operationalStatusTone } from '../lib/hr-attendance-data'
import { exceptionAttendancePath, exceptionsQuery, exceptionsRangeError, readExceptionsContext, type ExceptionsContext } from '../lib/exceptions-context'
import { attemptAction, attemptOutcome, attemptStep, exceptionEmployeeName, type ExceptionRecord } from '../lib/exceptions-data'
import { useExceptions } from '../lib/use-exceptions'

function RangeFilters({ context, apply }: { context: ExceptionsContext; apply: (context: ExceptionsContext) => void }) {
  const [startDate, setStartDate] = useState(context.startDate)
  const [endDate, setEndDate] = useState(context.endDate)
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const invalid = exceptionsRangeError(startDate, endDate)
    setError(invalid)
    if (!invalid) apply({ startDate, endDate, page: 1 })
  }
  return <form onSubmit={submit} noValidate>
    <FilterBar label="Exceptions date range">
      <label className="text-body-sm text-ink-muted flex-1" htmlFor="exceptions-from">From
        <input id="exceptions-from" className="input mt-xs min-h-xxl text-body sm:text-body-sm" type="date" required value={startDate} onChange={event => { setStartDate(event.target.value); setError('') }} />
      </label>
      <label className="text-body-sm text-ink-muted flex-1" htmlFor="exceptions-to">To
        <input id="exceptions-to" className="input mt-xs min-h-xxl text-body sm:text-body-sm" type="date" required value={endDate} onChange={event => { setEndDate(event.target.value); setError('') }} />
      </label>
      <button className="btn-primary min-h-xxl" type="submit">Apply dates</button>
    </FilterBar>
    {error && <p role="alert" className="text-body-sm text-error mb-md">{error}</p>}
  </form>
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-caption text-ink-muted mb-xs">{label}</dt><dd className="text-body-sm text-ink break-words">{children}</dd></div>
}
function AttendanceSummary({ record, context }: { record: Extract<ExceptionRecord, { kind: 'ATTENDANCE' }>; context: ExceptionsContext }) {
  return <>
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-md">
      <Field label="Attendance date"><span className="font-mono">{recordedDate(record.date)}</span></Field>
      <Field label="Classification"><Pill tone={operationalStatusTone(record.status)}>{attendanceLabels[record.status || ''] || 'Unavailable'}</Pill></Field>
      <Field label="Session state"><Pill>{record.sessionStatus === 'OPEN' ? 'Open' : record.sessionStatus === 'CLOSED' ? 'Closed' : 'Unavailable'}</Pill></Field>
    </dl>
    <div className="mt-md"><Link className="btn-secondary inline-flex items-center min-h-xxl" to={exceptionAttendancePath(record.id, context)} aria-label={'View attendance for ' + exceptionEmployeeName(record)}>View attendance</Link></div>
  </>
}
function AttemptSummary({ record }: { record: Extract<ExceptionRecord, { kind: 'ATTEMPT' }> }) {
  const location = ['OUTSIDE', 'UNKNOWN', 'INSIDE'].includes(record.locationResult || '') ? record.locationResult : 'Not recorded'
  return <>
    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
      <Field label="Attempt time (UTC)"><span className="font-mono">{recordedTime(record.date, 'UTC')}</span></Field>
      <Field label="Requested action">{attemptAction(record.action)}</Field>
      <Field label="Attempt outcome"><Pill tone={record.outcome === 'REJECTED' ? 'error' : 'neutral'}>{attemptOutcome(record.outcome)}</Pill></Field>
      <Field label="Recorded step"><span className="font-mono">{attemptStep(record.step)}</span></Field>
      <Field label="Site">{record.site || 'Not recorded'}</Field>
      <Field label="Terminal">{record.kiosk || 'Not recorded'}</Field>
      <Field label="Location assessment"><Pill tone={record.locationResult === 'OUTSIDE' || record.locationResult === 'UNKNOWN' ? 'warning' : 'neutral'}>{location}</Pill></Field>
    </dl>
    <p className="text-body-sm text-ink-muted mt-md">Attempt summary only. Full attempt detail is not available here.</p>
  </>
}
function ExceptionRow({ record, context }: { record: ExceptionRecord; context: ExceptionsContext }) {
  return <article className="card p-md sm:p-lg" aria-label={record.kind === 'ATTENDANCE' ? 'Attendance exception' : 'Location-related kiosk attempt'}>
    <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-sm mb-md">
      <div className="min-w-0"><h3 className="text-body font-medium text-ink break-words">{exceptionEmployeeName(record)}</h3>
        {record.employee?.employeeCode && <p className="text-caption font-mono text-ink-muted mt-xxs">{record.employee.employeeCode}</p>}
      </div><Pill>{record.kind === 'ATTENDANCE' ? 'Attendance' : 'Kiosk attempt'}</Pill>
    </div>
    {record.kind === 'ATTENDANCE' ? <AttendanceSummary record={record} context={context} /> : <AttemptSummary record={record} />}
    <div className="border-t border-hairline pt-md mt-md"><h4 className="text-caption text-ink-muted mb-xs">Recorded reason</h4><p className="text-body-sm whitespace-pre-wrap break-words">{record.reason || 'Not recorded'}</p></div>
  </article>
}
function Results({ state, context, valid, first, page }: { state: ReturnType<typeof useExceptions>; context: ExceptionsContext; valid: boolean; first: () => void; page: (value: number) => void }) {
  if (!valid) return <div className="card p-lg"><h2 className="text-display-sm font-serif text-ink">Choose a date range</h2><p className="text-body-sm text-ink-muted mt-xs">Select From and To dates, then apply them to view recorded exception rows.</p></div>
  if (state.loading) return <div className="card p-lg" role="status">Loading exceptions…</div>
  if (state.error) return <div className="card p-lg" role="alert"><p>{state.error}</p>{state.retryable && <button type="button" className="btn-secondary mt-md" onClick={state.retry}>Try again</button>}</div>
  if (!state.data) return null
  const { records, total, totalPages } = state.data
  if (!records.length) return <div className="card p-lg"><h2 className="text-body font-medium">{total || context.page > 1 ? 'No exceptions on this page' : 'No exceptions in this range'}</h2>
    <p className="text-body-sm text-ink-muted mt-xs">{total ? 'Return to the first page or apply a different date range.' : 'No matching recorded exception rows were returned for the applied dates.'}</p>
    {context.page > 1 && <button type="button" className="btn-secondary mt-md" onClick={first}>First page</button>}</div>
  return <><div className="space-y-md">{records.map(record => <ExceptionRow key={record.kind + record.id} record={record} context={context} />)}</div>
    {totalPages > 1 && <Pagination page={state.data.page} totalPages={totalPages} onPageChange={page} ariaLabel="Exceptions pages" className="mt-md flex-wrap" />}</>
}
export default function HrExceptions() {
  const [params, setParams] = useSearchParams()
  const context = readExceptionsContext(params)
  const rangeError = exceptionsRangeError(context.startDate, context.endDate)
  const valid = !rangeError
  const state = useExceptions(context)
  const query = exceptionsQuery(context)
  const changePage = (page: number) => setParams(exceptionsQuery({ ...context, page }))
  const apply = (next: ExceptionsContext) => {
    const nextQuery = exceptionsQuery(next)
    if (valid && nextQuery === query) state.retry()
    else setParams(nextQuery)
  }
  return <Layout><PageHeader eyebrow="Attendance" title="Exceptions" />
    <RangeFilters key={context.startDate + context.endDate} context={context} apply={apply} />
    {rangeError && (params.has('startDate') || params.has('endDate')) && <p role="alert" className="text-body-sm text-error mb-md">{rangeError}</p>}
    <p className="text-body-sm text-ink-muted mb-md">Attendance rows use stored attendance dates; location-related attempt summaries use their recorded UTC creation times. Attempt outcomes do not establish a completed attendance record.</p>
    {valid && <p className="text-body-sm text-ink-muted mb-lg">Applied range: <span className="font-mono">{context.startDate} to {context.endDate}</span>. Attendance rows appear before attempt rows.</p>}
    <SectionHeader title="Recorded exceptions" actions={<span aria-live="polite" className="text-caption font-mono text-ink-muted">{!valid ? 'Choose dates' : state.data ? state.data.total + ' exception rows' : state.loading ? 'Loading count…' : 'Count unavailable'}</span>} />
    <Results state={state} context={context} valid={valid} first={() => changePage(1)} page={changePage} />
  </Layout>
}
