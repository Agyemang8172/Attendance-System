import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill from '../components/ui/Pill'
import { hrAttendanceReturnPath } from '../lib/hr-attendance-context'
import { employeeName, operationalStatusTone, type OperationalAttendance } from '../lib/hr-attendance-data'
import { useOperationalDetail } from '../lib/use-hr-attendance'
import { attendanceLabels, closureLabel, recordedDate, recordedHours, recordedMinute, recordedNumber, recordedTime, validRecordedTimezone } from '../lib/staff-attendance-detail'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-body-sm text-ink-muted mb-xs">{label}</dt><dd className="text-body text-ink break-words font-mono">{children}</dd></div>
}
function RecordedSession({ record }: { record: OperationalAttendance }) {
  const zone = validRecordedTimezone(record.timezoneSnapshot)
  return <section className="card" aria-label="Recorded attendance"><SectionHeader title="Recorded attendance" />
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg"><Field label="Employee">{employeeName(record)}</Field><Field label="Employee code">{record.user?.employeeCode || 'Not recorded'}</Field>
      <Field label="Attendance date">{recordedDate(record.date)}</Field><Field label="Classification"><Pill tone={operationalStatusTone(record.status)}>{attendanceLabels[record.status || ''] || 'Unavailable'}</Pill></Field>
      <Field label="Session state"><Pill>{record.sessionStatus === 'OPEN' ? 'Open' : record.sessionStatus === 'CLOSED' ? 'Closed' : 'Unavailable'}</Pill></Field><Field label="Recorded hours">{recordedHours(record)}</Field>
      <Field label="Clock in">{recordedTime(record.clockIn, zone)}</Field><Field label="Clock out">{recordedTime(record.clockOut, zone)}</Field><Field label="Closure reason">{closureLabel(record.closureReason)}</Field>
    </dl><p className="text-body-sm text-ink-muted mt-lg">{zone ? `Recorded timezone: ${zone}` : 'Recorded timezone unavailable. Recorded timestamps are shown without conversion.'}</p>
    {record.requiresReviewReason && <p role="status" className="border-t border-hairline pt-md mt-md text-body-sm text-ink">{record.requiresReviewReason}</p>}
    {record.remarks && <div className="border-t border-hairline pt-md mt-md"><h3 className="text-body-sm text-ink-muted mb-xs">Remarks</h3><p className="text-body whitespace-pre-wrap break-words">{record.remarks}</p></div>}
  </section>
}
function RecordedShift({ record }: { record: OperationalAttendance }) {
  return <section className="card" aria-label="Recorded shift"><SectionHeader title="Recorded shift" />
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg"><Field label="Shift">{record.shiftNameSnapshot || 'Not recorded'}</Field><Field label="Timezone">{record.timezoneSnapshot || 'Not recorded'}</Field>
      <Field label="Scheduled start">{recordedMinute(record.shiftStartMinuteSnapshot)}</Field><Field label="Scheduled end">{recordedMinute(record.shiftEndMinuteSnapshot)}{record.shiftCrossesMidnightSnapshot === true ? ' (next day)' : ''}</Field>
    </dl></section>
}
const recordedBoolean = (value: unknown) => typeof value === 'boolean' ? value ? 'Enabled' : 'Disabled' : 'Not recorded'
function RecordedPolicy({ record }: { record: OperationalAttendance }) {
  const policy = record.policySnapshot
  return <section className="card" aria-label="Recorded rules"><SectionHeader title="Recorded rules" /><p className="text-body-sm text-ink-muted mb-lg">Historical values only. Missing values stay unavailable.</p>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg"><Field label="Policy version">{recordedNumber(policy?.versionNumber)}</Field>
      <Field label="Policy effective from">{typeof policy?.effectiveFrom === 'string' ? recordedTime(policy.effectiveFrom, validRecordedTimezone(record.timezoneSnapshot)) : 'Not recorded'}</Field>
      <Field label="Early grace">{recordedNumber(record.graceEarlyMinutesSnapshot, ' min')}</Field><Field label="Late grace">{recordedNumber(record.graceLateMinutesSnapshot, ' min')}</Field>
      <Field label="Automatic clock-out">{recordedBoolean(policy?.autoClockOutEnabled)}</Field><Field label="Automatic clock-out buffer">{recordedNumber(policy?.autoClockOutBufferMinutes, ' min')}</Field>
      <Field label="Maximum open session">{recordedNumber(policy?.autoClockOutMaxOpenMinutes, ' min')}</Field><Field label="Correction window">{recordedNumber(policy?.correctionWindowDays, ' days')}</Field>
    </dl></section>
}
function RecordedLocation({ record }: { record: OperationalAttendance }) {
  const validCoordinates = typeof record.checkInLat === 'number' && record.checkInLat >= -90 && record.checkInLat <= 90 && typeof record.checkInLng === 'number' && record.checkInLng >= -180 && record.checkInLng <= 180
  return <section className="card" aria-label="Location and source"><SectionHeader title="Location and source" /><dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
    <Field label="Recorded check-in coordinates">{validCoordinates ? `${record.checkInLat}, ${record.checkInLng}` : 'Not recorded'}</Field><Field label="Source terminal">{record.createdByKiosk?.label || 'Not recorded'}</Field>
  </dl><p className="text-body-sm text-ink-muted mt-lg">This record does not provide a geofence assessment or a linked kiosk attempt.</p></section>
}
function DetailBody({ state }: { state: ReturnType<typeof useOperationalDetail> }) {
  if (state.loading) return <div className="card p-lg" role="status">Loading attendance record…</div>
  if (state.error) return <div className="card p-lg" role="alert"><p>{state.error}</p>{state.retryable && <button type="button" className="btn-secondary mt-md" onClick={state.retry}>Try again</button>}</div>
  if (!state.data) return null
  return <div className="space-y-lg"><RecordedSession record={state.data} /><RecordedShift record={state.data} /><RecordedPolicy record={state.data} /><RecordedLocation record={state.data} /><div><Link className="btn-secondary inline-flex items-center min-h-xxl" to={`/hr-audit/corrections/${encodeURIComponent(state.data.id)}`}>View correction trail</Link></div></div>
}
export default function HrAttendanceDetail({ id }: { id: string }) {
  const { search } = useLocation()
  const state = useOperationalDetail(id)
  return <Layout><PageHeader eyebrow="Attendance" title="Attendance detail" actions={<Link to={hrAttendanceReturnPath(search)} className="btn-secondary inline-flex items-center min-h-xxl">Back to Attendance</Link>} /><DetailBody state={state} /></Layout>
}
