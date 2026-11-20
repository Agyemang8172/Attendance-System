import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import api from '../api/axios'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill, { type PillTone } from '../components/ui/Pill'
import Skeleton from '../components/ui/Skeleton'
import { getCurrentUser, getToken } from '../utils/auth'
import { attendanceReturnPath } from '../lib/staff-attendance-context'
import {
  attendanceLabels, closureLabel, recordedDate, recordedHours, recordedMinute, recordedNumber,
  recordedTime, validRecordedTimezone, type StaffAttendanceRecord,
} from '../lib/staff-attendance-detail'

type DetailState = { id?: string; record?: StaffAttendanceRecord; loading: boolean; error?: string; retryable?: boolean }
const loadError = (error: unknown): Pick<DetailState, 'error' | 'retryable'> => {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 403) return { error: 'You do not have access to this attendance record.' }
  if (status === 404) return { error: 'Attendance record not found.' }
  if (status === 400) return { error: 'This attendance record link is not available.' }
  return { error: 'Unable to load this attendance record.', retryable: true }
}

const acceptedRecord = (response: unknown, id: string, ownerId?: string): response is StaffAttendanceRecord => {
  if (!response || typeof response !== 'object' || !ownerId) return false
  const data = response as Partial<StaffAttendanceRecord>
  return data.id === id && data.userId === ownerId
}

const useAttendanceDetail = (id?: string) => {
  const [state, setState] = useState<DetailState>({ id, loading: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const ownerId = getCurrentUser()?.id
    const token = getToken()
    setState({ id, loading: true })
    const stillCurrent = () => active && getCurrentUser()?.id === ownerId && getToken() === token
    if (!id) { setState({ id, loading: false, error: 'Attendance record not found.' }); return }
    api.get(`/attendance/${encodeURIComponent(id)}`, { signal: controller.signal }).then(response => {
      if (!active) return
      if (!stillCurrent()) { setState({ id, loading: false, error: 'Your session changed. Sign in again to view attendance.' }); return }
      if (response.data?.success !== true || !acceptedRecord(response.data?.data, id, ownerId)) {
        setState({ id, loading: false, error: 'The attendance record could not be confirmed.', retryable: true }); return
      }
      setState({ id, loading: false, record: response.data.data })
    }).catch((error: unknown) => {
      if (!active) return
      setState({ id, loading: false, ...(stillCurrent() ? loadError(error) : { error: 'Your session changed. Sign in again to view attendance.' }) })
    })
    return () => { active = false; controller.abort() }
  }, [id, attempt])
  const retry = () => { setState({ id, loading: true }); setAttempt(value => value + 1) }
  return { state: state.id === id ? state : { id, loading: true }, retry }
}

const Field = ({ label, children, mono = true }: { label: string; children: ReactNode; mono?: boolean }) => (
  <div className="min-w-0">
    <dt className="text-body-sm text-ink-muted mb-xs">{label}</dt>
    <dd className={`text-body text-ink break-words ${mono ? 'font-mono' : 'font-sans'}`}>{children}</dd>
  </div>
)

const classificationTone = (status?: string | null): PillTone => {
  if (status === 'EARLY' || status === 'ON_TIME') return 'success'
  if (status === 'LATE' || status === 'CLOCK_OUT_MISSING' || status === 'REQUIRES_REVIEW') return 'warning'
  return status === 'ABSENT' ? 'error' : 'neutral'
}

const RecordedAttendance = ({ record }: { record: StaffAttendanceRecord }) => {
  const zone = validRecordedTimezone(record.timezoneSnapshot)
  const classification = record.status ? attendanceLabels[record.status] : undefined
  const session = record.sessionStatus === 'OPEN' ? 'Open' : record.sessionStatus === 'CLOSED' ? 'Closed' : 'Unavailable'
  return (
    <section className="card" aria-label="Recorded attendance">
      <SectionHeader title="Recorded attendance" />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
        <Field label="Attendance date">{recordedDate(record.date)}</Field>
        <Field label="Classification">{classification ? <Pill tone={classificationTone(record.status)}>{classification}</Pill> : 'Unavailable'}</Field>
        <Field label="Session state"><Pill>{session}</Pill></Field>
        <Field label="Recorded hours">{recordedHours(record)}</Field>
        <Field label="Clock in">{recordedTime(record.clockIn, zone)}</Field>
        <Field label="Clock out">{recordedTime(record.clockOut, zone)}</Field>
        <Field label="Closure reason" mono={false}>{closureLabel(record.closureReason)}</Field>
      </dl>
      <p className="text-body-sm text-ink-muted mt-lg">{zone ? `Recorded timezone: ${zone}` : 'Recorded timezone unavailable. Recorded timestamps are shown without conversion.'}</p>
      {record.requiresReviewReason && <p role="status" className="mt-lg border-t border-hairline pt-lg text-body-sm text-ink">{record.requiresReviewReason}</p>}
      {record.remarks && <div className="mt-lg border-t border-hairline pt-lg"><p className="text-body-sm text-ink-muted mb-xs">Remarks</p><p className="text-body text-ink break-words">{record.remarks}</p></div>}
    </section>
  )
}

const RecordedShift = ({ record }: { record: StaffAttendanceRecord }) => (
  <section className="card" aria-label="Recorded shift">
    <SectionHeader title="Recorded shift" />
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
      <Field label="Shift" mono={false}>{record.shiftNameSnapshot || 'Not recorded'}</Field>
      <Field label="Timezone">{record.timezoneSnapshot || 'Not recorded'}</Field>
      <Field label="Scheduled start">{recordedMinute(record.shiftStartMinuteSnapshot)}</Field>
      <Field label="Scheduled end">{recordedMinute(record.shiftEndMinuteSnapshot)}{record.shiftCrossesMidnightSnapshot === true ? ' (next day)' : ''}</Field>
    </dl>
  </section>
)

const policyBoolean = (value: unknown): string => typeof value === 'boolean' ? value ? 'Enabled' : 'Disabled' : 'Not recorded'
const RecordedRules = ({ record }: { record: StaffAttendanceRecord }) => {
  const policy = record.policySnapshot
  return (
    <section className="card" aria-label="Recorded rules">
      <SectionHeader title="Recorded rules" />
      <p className="text-body-sm text-ink-muted mb-lg">Historical values recorded with this attendance; current rules are not substituted.</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
        <Field label="Policy version">{recordedNumber(policy?.versionNumber)}</Field>
        <Field label="Policy effective from">{typeof policy?.effectiveFrom === 'string' ? recordedTime(policy.effectiveFrom, validRecordedTimezone(record.timezoneSnapshot)) : 'Not recorded'}</Field>
        <Field label="Early grace">{recordedNumber(record.graceEarlyMinutesSnapshot, ' min')}</Field>
        <Field label="Late grace">{recordedNumber(record.graceLateMinutesSnapshot, ' min')}</Field>
        <Field label="Automatic clock-out">{policyBoolean(policy?.autoClockOutEnabled)}</Field>
        <Field label="Automatic clock-out buffer">{recordedNumber(policy?.autoClockOutBufferMinutes, ' min')}</Field>
        <Field label="Maximum open session">{recordedNumber(policy?.autoClockOutMaxOpenMinutes, ' min')}</Field>
        <Field label="Correction window">{recordedNumber(policy?.correctionWindowDays, ' days')}</Field>
      </dl>
    </section>
  )
}

const LocationSource = ({ record }: { record: StaffAttendanceRecord }) => {
  const hasCoordinates = typeof record.checkInLat === 'number' && Number.isFinite(record.checkInLat)
    && typeof record.checkInLng === 'number' && Number.isFinite(record.checkInLng)
  return (
    <section className="card" aria-label="Location and source">
      <SectionHeader title="Location and source" />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
        <Field label="Recorded check-in coordinates">{hasCoordinates ? `${record.checkInLat}, ${record.checkInLng}` : 'Not recorded'}</Field>
        <Field label="Source terminal" mono={false}>{record.createdByKiosk?.label || 'Not recorded'}</Field>
      </dl>
    </section>
  )
}

const DetailBody = ({ state, retry }: { state: DetailState; retry: () => void }) => {
  if (state.loading) return <div aria-busy="true"><p role="status" className="text-body-sm text-ink-muted mb-lg">Loading attendance record…</p><Skeleton className="h-section w-full" label="Loading attendance detail" /></div>
  if (state.error || !state.record) return (
    <div className="card"><p role="alert" className="text-body text-error">{state.error || 'Attendance record not available.'}</p>
      {state.retryable && <button type="button" onClick={retry} className="btn-secondary mt-lg active:scale-[0.98]">Try again</button>}
    </div>
  )
  return <div className="space-y-lg"><RecordedAttendance record={state.record} /><RecordedShift record={state.record} /><RecordedRules record={state.record} /><LocationSource record={state.record} /></div>
}

export default function StaffAttendanceDetail() {
  const { id } = useParams<{ id: string }>()
  const { search } = useLocation()
  const { state, retry } = useAttendanceDetail(id)
  return (
    <Layout>
      <PageHeader eyebrow="Attendance" title="Attendance detail" actions={<Link to={attendanceReturnPath(search)} className="btn-secondary inline-flex items-center min-h-xxl active:scale-[0.98]">Back to Attendance</Link>} />
      <DetailBody state={state} retry={retry} />
    </Layout>
  )
}
