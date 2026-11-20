import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { FaArrowLeft, FaLock, FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6'

// ─── Staff Change PIN Page ────────────────────────────────────────────────────

function StaffChangePin() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  // PIN validation
  const isValidPin = (pin: string) => /^\d{4}$/.test(pin)
  const pinsMatch = newPin === confirmPin && newPin.length === 4
  const currentPinValid = isValidPin(currentPin)
  const newPinValid = isValidPin(newPin)

  const canSubmit = currentPinValid && newPinValid && pinsMatch && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canSubmit) return

    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setConfirmSubmitting(true)
    try {
      await api.post('/staff/profile/change-pin', {
        currentPin,
        newPin,
      })
      toast.success('PIN changed successfully.')
      setShowConfirm(false)
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      navigate('/profile')
    } catch (err: any) {
      if (err.response?.status === 400) {
        toast.error(err.response.data?.message || 'Invalid current PIN. Please try again.')
      } else if (err.response?.status === 429) {
        toast.error('Too many attempts. Please wait a moment and try again.')
      } else {
        toast.error('Failed to change PIN. Please try again.')
      }
    } finally {
      setConfirmSubmitting(false)
    }
  }

  const handleCancel = () => {
    setShowConfirm(false)
  }

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Profile & Security"
        title="Change PIN"
        actions={
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FaArrowLeft aria-hidden="true" /> Cancel
          </button>
        }
      />

      {/* ── PIN Policy Hint ───────────────────────────────────────────────── */}
      <div className="card p-4 mb-6 border border-warning-soft bg-warning-soft/30">
        <div className="flex items-start gap-3">
          <FaTriangleExclamation className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-ink">
            <p className="font-medium mb-1">PIN Policy</p>
            <ul className="list-disc list-inside space-y-1 text-ink-muted">
              <li>4 digits only (0000–9999)</li>
              <li>10 failed attempts locks the PIN for 5 minutes</li>
              <li>The lock clears after 5 minutes; HR can reset a forgotten PIN</li>
              <li>Your current PIN is required to make changes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="max-w-md space-y-6">
        {/* Current PIN */}
        <div className="card p-6">
          <label htmlFor="currentPin" className="text-caption text-ink-muted mb-1 block">
            Current PIN
          </label>
          <input
            type="password"
            id="currentPin"
            value={currentPin}
            onChange={e => setCurrentPin(e.target.value)}
            maxLength={4}
            placeholder="••••"
            className="input w-full text-center text-2xl tracking-widest font-mono"
            aria-describedby="current-pin-hint"
            required
            disabled={submitting}
          />
          <p id="current-pin-hint" className="text-caption text-ink-muted mt-1 text-center">
            Enter your current 4-digit PIN
          </p>
        </div>

        {/* New PIN */}
        <div className="card p-6">
          <label htmlFor="newPin" className="text-caption text-ink-muted mb-1 block">
            New PIN
          </label>
          <input
            type="password"
            id="newPin"
            value={newPin}
            onChange={e => setNewPin(e.target.value)}
            maxLength={4}
            placeholder="••••"
            className={[
              'input w-full text-center text-2xl tracking-widest font-mono',
              newPin && !newPinValid ? 'border-error' : '',
            ].join(' ')}
            aria-describedby="new-pin-hint"
            required
            disabled={submitting}
          />
          <p id="new-pin-hint" className={[
            'text-caption mt-1 text-center',
            newPin && !newPinValid ? 'text-error' : 'text-ink-muted',
          ].join(' ')}>
            {newPin && !newPinValid ? 'PIN must be exactly 4 digits' : 'Enter a new 4-digit PIN'}
          </p>
        </div>

        {/* Confirm New PIN */}
        <div className="card p-6">
          <label htmlFor="confirmPin" className="text-caption text-ink-muted mb-1 block">
            Confirm New PIN
          </label>
          <input
            type="password"
            id="confirmPin"
            value={confirmPin}
            onChange={e => setConfirmPin(e.target.value)}
            maxLength={4}
            placeholder="••••"
            className={[
              'input w-full text-center text-2xl tracking-widest font-mono',
              confirmPin && !pinsMatch ? 'border-error' : '',
            ].join(' ')}
            aria-describedby="confirm-pin-hint"
            required
            disabled={submitting}
          />
          <p id="confirm-pin-hint" className={[
            'text-caption mt-1 text-center',
            confirmPin && !pinsMatch ? 'text-error' : 'text-ink-muted',
          ].join(' ')}>
            {confirmPin && !pinsMatch ? 'PINs do not match' : 'Confirm your new PIN'}
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!canSubmit}
          >
            {submitting ? 'Changing…' : 'Continue'}
          </button>
        </div>
      </form>

      {/* ── Confirmation Dialog ───────────────────────────────────────────── */}
      <ConfirmDialog
        open={showConfirm}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="Change PIN"
        body={
          <>
            <p>You are about to change your kiosk PIN.</p>
            <p className="mt-2">This will take effect immediately for your next kiosk session.</p>
          </>
        }
        confirmLabel="Change PIN"
        cancelLabel="Cancel"
        busyLabel="Changing…"
        busy={confirmSubmitting}
        eyebrow="Confirm"
        maxWidth="sm"
      />
    </Layout>
  )
}

export default StaffChangePin