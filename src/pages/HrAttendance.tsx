import { Link, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import Pagination from '../components/ui/Pagination'
import Pill from '../components/ui/Pill'
import HrAttendanceDetail from './HrAttendanceDetail'
import { attendanceLabels, recordedDate, recordedHours, recordedTime, validRecordedTimezone } from '../lib/staff-attendance-detail'
import { emptyHrContext, hrAttendanceQuery, readHrAttendanceContext, hrClassifications, HR_PAGE_SIZE, type HrAttendanceContext } from '../lib/hr-attendance-context'
import { employeeName, operationalStatusTone, type OperationalAttendance } from '../lib/hr-attendance-data'
import { useOperationalList } from '../lib/use-hr-attendance'
import type { ReactNode } from 'react'

function Filters({ context, change, clear }: { context: HrAttendanceContext; change: (key: keyof HrAttendanceContext, value: string) => void; clear: () => void }) {
  return <FilterBar label="Attendance filters"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md w-full">
    <label className="text-body-sm text-ink-muted" htmlFor="hr-start-date">From (UTC clock-in date)<input id="hr-start-date" className="input mt-xs min-h-xxl text-body sm:text-body-sm" type="date" value={context.startDate} onChange={event => change('startDate', event.target.value)} /></label>
    <label className="text-body-sm text-ink-muted" htmlFor="hr-end-date">To (UTC clock-in date)<input id="hr-end-date" className="input mt-xs min-h-xxl text-body sm:text-body-sm" type="date" value={context.endDate} onChange={event => change('endDate', event.target.value)} /></label>
    <label className="text-body-sm text-ink-muted" htmlFor="hr-classification">Classification<select id="hr-classification" className="input mt-xs min-h-xxl text-body sm:text-body-sm" value={context.status} onChange={event => change('status', event.target.value)}>
      <option value="">All classifications</option>{hrClassifications.map(status => <option key={status} value={status}>{attendanceLabels[status]}</option>)}</select></label>
    <label className="text-body-sm text-ink-muted" htmlFor="hr-session">Session state<select id="hr-session" className="input mt-xs min-h-xxl text-body sm:text-body-sm" value={context.sessionStatus} onChange={event => change('sessionStatus', event.target.value)}>
      <option value="">All sessions</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select></label>
  </div><button type="button" className="btn-secondary" onClick={clear}>Clear filters</button></FilterBar>
}
function Cell({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return <td className="flex items-start justify-between gap-sm p-xs md:table-cell md:p-md md:align-top text-body-sm">
    <span className="text-caption text-ink-muted md:hidden shrink-0">{label}</span><div className={`min-w-0 break-words text-right md:text-left ${mono ? 'font-mono' : ''}`}>{children}</div>
  </td>
}
function AttendanceRow({ record, query }: { record: OperationalAttendance; query: string }) {
  const zone = validRecordedTimezone(record.timezoneSnapshot)
  return <tr className="block border border-hairline rounded-lg bg-surface-1 p-xs md:table-row md:border-x-0 md:rounded-none md:p-0 md:hover:bg-surface-2">
    <Cell label="Employee"><p>{employeeName(record)}</p><p className="text-caption font-mono text-ink-muted mt-xxs">{record.user?.employeeCode || 'Code not recorded'}</p></Cell>
    <Cell label="Date" mono>{recordedDate(record.date)}</Cell><Cell label="Clock in" mono>{recordedTime(record.clockIn, zone)}</Cell><Cell label="Clock out" mono>{recordedTime(record.clockOut, zone)}</Cell>
    <Cell label="Hours" mono>{recordedHours(record)}</Cell><Cell label="Classification"><Pill tone={operationalStatusTone(record.status)}>{attendanceLabels[record.status || ''] || 'Unavailable'}</Pill></Cell>
    <Cell label="Session state"><Pill>{record.sessionStatus === 'OPEN' ? 'Open' : record.sessionStatus === 'CLOSED' ? 'Closed' : 'Unavailable'}</Pill></Cell>
    <Cell label="Record"><Link className="btn-secondary inline-flex items-center min-h-xxl" to={`/hr-attendance/${encodeURIComponent(record.id)}${query}`} aria-label={`View attendance for ${employeeName(record)} on ${recordedDate(record.date)}`}>View detail</Link></Cell>
  </tr>
}
function AttendanceRows({ records, query }: { records: OperationalAttendance[]; query: string }) {
  return <div className="md:border md:border-hairline md:rounded-lg md:overflow-auto"><table className="block w-full md:table md:border-collapse">
    <caption className="sr-only">Attendance register records</caption><thead className="hidden md:table-header-group"><tr>{['Employee', 'Date', 'Clock in', 'Clock out', 'Hours', 'Classification', 'Session state', 'Record'].map(label => <th className="sticky top-0 bg-surface-2 p-md text-left text-caption text-ink-muted" scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody className="block space-y-md md:table-row-group md:space-y-0">{records.map(record => <AttendanceRow record={record} query={query} key={record.id} />)}</tbody>
  </table></div>
}
function RegisterBody({ state, context, clear, page }: { state: ReturnType<typeof useOperationalList>; context: HrAttendanceContext; clear: () => void; page: (value: number) => void }) {
  if (state.loading) return <div className="card p-lg" role="status">Loading attendance records…</div>
  if (state.error) return <div className="card p-lg" role="alert"><p>{state.error}</p>{state.retryable && <button type="button" className="btn-secondary mt-md" onClick={state.retry}>Try again</button>}</div>
  if (!state.data) return null
  const { records, total, totalPages } = state.data
  if (!records.length) return <div className="card p-lg"><h2 className="text-body font-medium">{context.page > totalPages || context.page > 1 ? 'No records on this page' : Object.entries(context).some(([key, value]) => key !== 'page' && Boolean(value)) ? 'No matching attendance records' : 'No attendance records yet'}</h2>
    <p className="text-body-sm text-ink-muted mt-xs">{total ? 'Choose the first page or adjust the filters.' : 'Attendance records appear here after a successful punch. Filters apply only to recorded clock-in instants.'}</p><button className="btn-secondary mt-md" onClick={clear}>View all records</button></div>
  return <><AttendanceRows records={records} query={hrAttendanceQuery(context)} />{totalPages > 1 && <Pagination page={state.data.page} totalPages={totalPages} onPageChange={page} totalItems={total} pageSize={HR_PAGE_SIZE} ariaLabel="Attendance register pages" className="mt-md flex-wrap" />}</>
}
function AttendanceRegister() {
  const [params, setParams] = useSearchParams()
  const context = readHrAttendanceContext(params)
  const state = useOperationalList(context)
  const clear = () => setParams(hrAttendanceQuery(emptyHrContext), { replace: true })
  const change = (key: keyof HrAttendanceContext, value: string) => setParams(hrAttendanceQuery({ ...context, [key]: value, page: 1 }))
  return <Layout><PageHeader eyebrow="Attendance" title="Attendance Register" />
    <Filters context={context} change={change} clear={clear} />
    <p className="text-body-sm text-ink-muted mb-lg">Date filters select UTC clock-in instants, not business days. Punch times use the recorded timezone where available; otherwise the recorded timestamp is shown.</p>
    <SectionHeader title="Recorded attendance" actions={<span aria-live="polite" className="text-caption font-mono text-ink-muted">{state.data ? `${state.data.total} records` : state.loading ? 'Loading count…' : 'Count unavailable'}</span>} />
    <RegisterBody state={state} context={context} clear={clear} page={value => setParams(hrAttendanceQuery({ ...context, page: value }))} />
  </Layout>
}
export default function HrAttendance() {
  const { id } = useParams<{ id: string }>()
  return id ? <HrAttendanceDetail id={id} /> : <AttendanceRegister />
}
