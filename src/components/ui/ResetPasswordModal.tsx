import { useState, useEffect } from 'react'
import api from '../../api/axios'

// ─── ResetPasswordModal ──────────────────────────────────────────────────────
//
//  Two-step popup for issuing a fresh temporary password.
//
//    STEP 1 (confirm): shows who is being reset and what it does; the caller
//                      confirms before anything is sent.
//    STEP 2 (reveal): the popup shows the server-generated temporary password
//                     ONCE, with a copy button, so the admin can hand it over.
//                     The account must change it on next sign-in (backend flag),
//                     so this is single-use by design — same lifecycle as the
//                     temporary password minted on account creation.
//
//  Props:
//    user    → the employee being reset (from the table row)
//    onClose → () => void · close the popup
//    onReset → () => void · called after the reset, so the parent refetches
//
//  ── BACKEND CONTRACT this component expects ──────────────────────────────────
//    PUT /users/:id/reset-password
//    On success (200) the response is:
//      { success: true, message: string, tempPassword: string }
//    The temporary password rides at the top level, not inside `data`.
// ─────────────────────────────────────────────────────────────────────────────

const CopyRow = ({ label, value }) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail on non-HTTPS origins — fail quietly
    }
  }

  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-widest text-chrome-ink-muted mb-1">
        {label}
      </p>
      <div className="flex items-center justify-between gap-3 bg-chrome-elevated border border-chrome-line rounded-lg px-4 py-3">
        <span className="text-sm text-chrome-ink font-mono break-all">{value}</span>
        <button
          onClick={copy}
          className="shrink-0 text-xs font-mono uppercase tracking-wide text-brass-chrome hover:text-chrome-ink transition-colors duration-150"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

const ResetPasswordModal = ({ user, onClose, onReset }) => {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  // When set, we switch from the confirm screen to the reveal screen.
  const [tempPassword, setTempPassword] = useState(null)

  // Escape closes the popup — but ONLY on the confirm step
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !tempPassword) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, tempPassword])

  const handleReset = async () => {
    setError('')
    setConfirming(true)
    try {
      const res = await api.put(`/users/${user.id}/reset-password`)
      setTempPassword(res.data?.tempPassword || null)
      if (!res.data?.tempPassword) {
        setError('The server did not return a temporary password.')
      }
    } catch (err) {
      const raw = err.response?.data?.message || err.response?.data?.error || ''
      setError(raw || 'Failed to reset password.')
    } finally {
      setConfirming(false)
    }
  }

  const handleDone = () => {
    onReset()
    onClose()
  }

  const goldButton =
    'px-6 py-2.5 rounded-xl text-sm font-semibold font-sans bg-brass-chrome text-ink hover:opacity-90 transition-opacity duration-150 shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div
      className="fixed inset-0 z-50 overlay-scrim backdrop-blur-sm flex items-center justify-center p-4"
      onClick={tempPassword ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-chrome rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-chrome-line shadow-elevated"
      >
        {/* MERIDIAN corner bracket */}
        <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-brass-chrome opacity-30 pointer-events-none" />

        {tempPassword ? (
          /* ── STEP 2: REVEAL ────────────────────────────────────────────── */
          <>
            <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
              Password Reset
            </p>
            <h2 className="text-2xl font-bold text-chrome-ink font-serif mb-2">
              {user.firstName} is back in
            </h2>
            <p className="text-chrome-ink-muted text-sm font-sans mb-6">
              Hand over this temporary password — it shows once, and they're
              forced to change it at their next sign-in.
            </p>

            <CopyRow label="Temporary Password" value={tempPassword} />

            <p className="text-chrome-ink-subtle text-xs font-sans mt-6">
              This is the only time the temporary password is shown — copy it now.
            </p>

            <div className="flex justify-end mt-6">
              <button onClick={handleDone} className={goldButton}>
                Done
              </button>
            </div>
          </>
        ) : (
          /* ── STEP 1: CONFIRM ───────────────────────────────────────────── */
          <>
            <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
              Confirm
            </p>
            <h2 className="text-2xl font-bold text-chrome-ink font-serif mb-2">
              Reset password?
            </h2>
            <p className="text-chrome-ink-muted text-sm font-sans mb-1">
              <span className="text-chrome-ink font-medium">
                {user.firstName} {user.lastName}
              </span>
            </p>
            {user.email && (
              <p className="text-chrome-ink-subtle text-xs font-mono mb-6">
                {user.email}
              </p>
            )}

            <div className="space-y-3 text-chrome-ink-muted text-sm font-sans mb-8">
              <p>
                Their current password stops working immediately. The account
                must set a new one at the next sign-in.
              </p>
              <p>
                The system generates the replacement — the temporary password
                is shown once, right after this.
              </p>
            </div>

            {error && <p className="text-chrome-error text-xs font-sans mb-4">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={confirming}
                className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={confirming}
                className={goldButton}
              >
                {confirming ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordModal