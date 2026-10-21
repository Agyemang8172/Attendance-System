import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import { formatShortDate, formatTimeOfDay } from '../lib/attendance-format'
import type { AttendanceRecord } from '../types'
import { FaArrowLeft, FaXmark, FaCalendar, FaCircleCheck } from 'react-icons/fa6'

// ─── Staff Correction New Page ────────────────────────────────────────────────

function StaffCorrectionNew() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [fetchingRecords, setFetchingRecords] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)

  const [proposedClockIn, setProposedClockIn] = useState('')
  const [proposedClockOut, setProposedClockOut] = useState('')
  const [proposedStatus, setProposedStatus] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const REASON_MAX = 1000
  const reasonCount = reason.length

  // ── Fetch attendance records for picker ─────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setFetchingRecords(true)
    try {
      const res = await api.get('/attendance/my-attendance?limit=100')
      setRecords(res.data.data || [])
    } catch {
      toast.error('Failed to load attendance records.')
    } finally {
      setFetchingRecords(false)
    }
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // ── Handle record selection ─────────────────────────────────────────────────
  const handleRecordSelect = (record: AttendanceRecord) => {
    setSelectedRecord(record)
    // Pre-fill with current values
    setProposedClockIn(record.clockIn ? new Date(record.clockIn).toISOString().slice(0, 16) : '')
    setProposedClockOut(record.clockOut ? new Date(record.clockOut).toISOString().slice(0, 16) : '')
    setProposedStatus(record.status)
  }

  // ── Format date for display ─────────────────────────────────────────────────
  const formatDateTimeLocal = (iso?: string) => {
    if (!iso) return ''
    return new Date(iso).toISOString().slice(0, 16)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedRecord) {
      toast.error('Please select an attendance record.')
      return
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for the correction.')
      return
    }

    // Check if any values actually changed
    const originalClockIn = selectedRecord.clockIn ? formatDateTimeLocal(selectedRecord.clockIn) : ''
    const originalClockOut = selectedRecord.clockOut ? formatDateTimeLocal(selectedRecord.clockOut) : ''
    const originalStatus = selectedRecord.status

    const hasChanges =
      proposedClockIn !== originalClockIn ||
      proposedClockOut !== originalClockOut ||
      proposedStatus !== originalStatus

    if (!hasChanges) {
      toast.error('No changes detected. Please modify at least one field.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        attendanceId: selectedRecord.id,
        proposedValues: {
          clockIn: proposedClockIn ? new Date(proposedClockIn).toISOString() : undefined,
          clockOut: proposedClockOut ? new Date(proposedClockOut).toISOString() : undefined,
          status: proposedStatus || undefined,
        },
        reason: reason.trim(),
      }

      const res = await api.post('/attendance/corrections', payload)
      toast.success('Correction request submitted.')
      navigate(`/staff/corrections/${res.data.data.id}`)
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error(err.response.data?.message || 'This record has been modified. Please refresh and try again.')
      } else if (err.response?.status === 400) {
        toast.error(err.response.data?.message || 'Invalid correction. Check the correction window and try again.')
      } else {
        toast.error('Failed to submit correction. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Computed: whether any field has changed ────────────────────────────────
  const originalClockIn = selectedRecord?.clockIn ? formatDateTimeLocal(selectedRecord.clockIn) : ''
  const originalClockOut = selectedRecord?.clockOut ? formatDateTimeLocal(selectedRecord.clockOut) : ''
  const originalStatus = selectedRecord?.status || ''
  const hasChanges = selectedRecord && (
    proposedClockIn !== originalClockIn ||
    proposedClockOut !== originalClockOut ||
    proposedStatus !== originalStatus
  )

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Corrections"
        title="New Correction"
        actions={
          <button
            type="button"
            onClick={() => navigate('/staff/corrections')}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FaArrowLeft aria-hidden="true" /> Cancel
          </button>
        }
      />

      {/* ── Step 1: Select Record ────────────────────────────────────────── */}
      <section className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-body font-medium text-ink">Step 1: Select Attendance Record</p>
          <span className="text-caption text-ink-muted">Required</span>
        </div>

        {fetchingRecords ? (
          <div className="animate-pulse space-y-3" role="status" aria-label="Loading records">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-16 bg-surface-2 rounded-lg" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-ink-muted">
            <FaCalendar className="text-ink-subtle text-3xl mx-auto mb-2" aria-hidden="true" />
            <p className="text-body-sm">No attendance records found</p>
            <p className="text-caption text-ink-subtle mt-1">You need at least one attendance record to submit a correction.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto" role="listbox" aria-label="Select attendance record">
            {records.map(record => {
              const isSelected = selectedRecord?.id === record.id
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => handleRecordSelect(record)}
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    'w-full p-3 text-left rounded-lg border-2 transition-all duration-150',
                    isSelected
                      ? 'border-accent bg-accent-soft'
                      : 'border-hairline hover:border-accent hover:bg-surface-1',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-1 flex items-center justify-center shrink-0">
                        <FaCalendar className="text-ink-muted" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-body font-medium text-ink">{formatShortDate(record.date)}</p>
                        <p className="text-caption text-ink-muted flex items-center gap-2">
                          <span className="font-mono">
                            In: {record.clockIn ? formatTimeOfDay(record.clockIn) : '—'}
                          </span>
                          <span className="font-mono">
                            Out: {record.clockOut ? formatTimeOfDay(record.clockOut) : '—'}
                          </span>
                          <span className="font-mono">{formatHoursValue(record.hoursWorked)}</span>
                        </p>
                      </div>
                    </div>
                    {isSelected && <FaCircleCheck className="text-accent" aria-hidden="true" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Step 2: Propose Changes ────────────────────────────────────────── */}
      {selectedRecord && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-body font-medium text-ink">Step 2: Propose Changes</p>
              <span className="text-caption text-ink-muted">Modify only the fields that need correction</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Clock In */}
              <div>
                <label htmlFor="proposedClockIn" className="text-caption text-ink-muted mb-1 block">
                  Clock In
                </label>
                <input
                  type="datetime-local"
                  id="proposedClockIn"
                  value={proposedClockIn}
                  onChange={e => setProposedClockIn(e.target.value)}
                  className="input w-full"
                  placeholder={selectedRecord.clockIn ? formatDateTimeLocal(selectedRecord.clockIn) : 'Not set'}
                />
                <p className="text-caption text-ink-muted mt-1">
                  Original: {selectedRecord.clockIn ? formatTimeOfDay(selectedRecord.clockIn) : 'Not set'}
                </p>
              </div>

              {/* Clock Out */}
              <div>
                <label htmlFor="proposedClockOut" className="text-caption text-ink-muted mb-1 block">
                  Clock Out
                </label>
                <input
                  type="datetime-local"
                  id="proposedClockOut"
                  value={proposedClockOut}
                  onChange={e => setProposedClockOut(e.target.value)}
                  className="input w-full"
                  placeholder={selectedRecord.clockOut ? formatDateTimeLocal(selectedRecord.clockOut) : 'Not set'}
                />
                <p className="text-caption text-ink-muted mt-1">
                  Original: {selectedRecord.clockOut ? formatTimeOfDay(selectedRecord.clockOut) : 'Not set'}
                </p>
              </div>

              {/* Status */}
              <div>
                <label htmlFor="proposedStatus" className="text-caption text-ink-muted mb-1 block">
                  Status
                </label>
                <select
                  id="proposedStatus"
                  value={proposedStatus}
                  onChange={e => setProposedStatus(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Keep current ({selectedRecord.status})</option>
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="ABSENT">Absent</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>
                <p className="text-caption text-ink-muted mt-1">
                  Original: {selectedRecord.status}
                </p>
              </div>
            </div>

            {/* Preview of changes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <p className="text-caption font-medium text-ink mb-3">Changes Summary</p>
              <div className="space-y-2 text-sm">
                {proposedClockIn !== (selectedRecord.clockIn ? formatDateTimeLocal(selectedRecord.clockIn) : '') && (
                  <p className="flex items-center gap-2 text-warning">
                    <FaXmark className="text-xs" aria-hidden="true" />
                    Clock In: <span className="font-mono line-through">{selectedRecord.clockIn ? formatTimeOfDay(selectedRecord.clockIn) : 'Not set'}</span>{' '}→{' '}
                    <span className="font-mono text-success">{proposedClockIn ? formatTimeOfDay(proposedClockIn) : 'Cleared'}</span>
                  </p>
                )}
                {proposedClockOut !== (selectedRecord.clockOut ? formatDateTimeLocal(selectedRecord.clockOut) : '') && (
                  <p className="flex items-center gap-2 text-warning">
                    <FaXmark className="text-xs" aria-hidden="true" />
                    Clock Out: <span className="font-mono line-through">{selectedRecord.clockOut ? formatTimeOfDay(selectedRecord.clockOut) : 'Not set'}</span>{' '}→{' '}
                    <span className="font-mono text-success">{proposedClockOut ? formatTimeOfDay(proposedClockOut) : 'Cleared'}</span>
                  </p>
                )}
                {proposedStatus !== selectedRecord.status && proposedStatus && (
                  <p className="flex items-center gap-2 text-warning">
                    <FaXmark className="text-xs" aria-hidden="true" />
                    Status: <span className="font-mono line-through">{selectedRecord.status}</span>{' '}→{' '}
                    <span className="font-mono text-success">{proposedStatus}</span>
                  </p>
                )}
                {proposedClockIn === (selectedRecord.clockIn ? formatDateTimeLocal(selectedRecord.clockIn) : '') &&
                proposedClockOut === (selectedRecord.clockOut ? formatDateTimeLocal(selectedRecord.clockOut) : '') &&
                proposedStatus === selectedRecord.status && (
                  <p className="text-ink-muted">No changes yet — modify a field above to propose a correction.</p>
                )}
              </div>
            </div>
          </section>

          {/* Step 3: Reason */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="reason" className="text-caption text-ink-muted">
                Reason for Correction
              </label>
              <span className={[
                'text-caption font-mono',
                reasonCount > REASON_MAX ? 'text-error' : 'text-ink-muted',
              ].join(' ')}>
                {reasonCount}/{REASON_MAX}
              </span>
            </div>
            <textarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={REASON_MAX}
              rows={4}
              placeholder="Explain why this correction is needed. Include any supporting details (e.g., kiosk malfunction, missed punch, system error)."
              className="input w-full"
              required
            />
            <p className="text-caption text-ink-muted mt-1">
              Be specific — HR needs this to evaluate your request.
            </p>
          </section>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
            <button
              type="button"
              onClick={() => navigate('/staff/corrections')}
              className="btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || reasonCount > REASON_MAX || !reason.trim() || !hasChanges}
            >
              {submitting ? 'Submitting…' : 'Submit Correction'}
            </button>
          </div>
        </form>
      )}
    </Layout>
  )
}

// Helper to format hours value
const formatHoursValue = (hours?: number | null): string => {
  if (hours == null || hours === 0) return '--'
  return `${Number(hours).toFixed(2)} hrs`
}

export default StaffCorrectionNew