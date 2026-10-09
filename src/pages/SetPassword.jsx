import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, updateCurrentUser, roleHome } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { FaEye, FaEyeSlash } from 'react-icons/fa6'
import MeridianArt from '../assets/meridian.svg'
import { validatePassword } from '../utils/passwordPolicy'

// ─── SetPassword ──────────────────────────────────────────────────────────────
//
//  Locked page for first-time password change. No sidebar, no navigation,
//  no way out except setting a new password. Mirrors the Login split screen
//  exactly, so the whole entry flow is one identity (§10.2 R4).
//
//  Shows when: mustChangePassword === true on login (and S15 bounces anyone
//  here whose flag is already clear).
//  Calls: PUT /users/change-password (same endpoint as Settings).
//  After success: the server clears the flag with a 200 that carries no user,
//  so the stored session is patched locally before the role home is shown.
//
// ─────────────────────────────────────────────────────────────────────────────

const PasswordField = ({ label, hint, value, onChange, show, onToggle, disabled }) => {
  const inputId = label.toLowerCase().replace(/[^a-z]+/g, '-')
  return (
    <div>
      <label htmlFor={inputId} className="block text-xs font-semibold text-ink uppercase tracking-widest mb-2 font-sans">
        {label}
      </label>
      {hint && (
        <p className="text-ink-subtle text-xs font-sans mb-2">{hint}</p>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder="••••••••"
          disabled={disabled}
          className="input pr-11 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="
            absolute right-3 top-1/2 -translate-y-1/2
            text-ink-subtle hover:text-ink
            transition duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
          "
        >
          {show ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

const SetPassword = () => {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [tempPassword, setTempPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [show, setShow] = useState({
    temp: false,
    new: false,
    confirm: false,
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const toggle = (key) => setShow((s) => ({ ...s, [key]: !s[key] }))

  const handleSubmit = async () => {
    setError('')

    if (!tempPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all three fields.')
      return
    }

    // S7 — the client and the server quote the same policy, so the user hears
    // the same reason before the request as after it.
    const policyError = validatePassword(newPassword)
    if (policyError) {
      setError(policyError)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword === tempPassword) {
      setError('Your new password must be different from the temporary one.')
      return
    }

    setLoading(true)
    try {
      await api.put('/users/change-password', {
        currentPassword: tempPassword,
        newPassword,
      })

      toast.success('Password set! Welcome to AttendPro.')
      updateCurrentUser({ mustChangePassword: false })
      navigate(roleHome(user?.role))
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to set password.'
      if (/invalid current/i.test(msg)) {
        setError('The temporary password is wrong. Check what the admin gave you.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex font-sans bg-canvas">

      {/* ── LEFT PANEL — brand side (matches Login exactly) ──────────────── */}
      <div
        className="
          hidden md:flex w-[45%] min-h-screen
          bg-chrome
          flex-col items-center justify-center
          px-12 relative overflow-hidden
        "
      >
        <div className="absolute inset-0 chrome-grid opacity-10 pointer-events-none" />

        <div className="w-48 h-48 mb-10 opacity-90">
          <img
            src={MeridianArt}
            alt="AttendPro visual"
            className="w-full h-full object-contain"
          />
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-brass-chrome mb-3 font-serif">
          AttendPro
        </h1>

        <p className="text-sm text-chrome-ink-muted tracking-widest uppercase font-sans">
          Employee Attendance System
        </p>

        <div className="absolute bottom-10 left-12 right-12 h-px bg-brass-chrome opacity-20" />
        <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-brass-chrome opacity-30 rounded-tr-sm" />
        <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-brass-chrome opacity-30 rounded-bl-sm" />
      </div>

      {/* ── RIGHT PANEL — set password form ──────────────────────────────── */}
      <div
        className="
          flex-1 min-h-screen bg-canvas
          flex flex-col justify-center
          px-8 sm:px-16 lg:px-24
          relative
        "
      >
        {/* Mobile-only brand header */}
        <div className="flex md:hidden items-center gap-2 mb-10">
          <span className="text-2xl font-bold text-ink font-serif">
            AttendPro
          </span>
          <span className="text-xs text-ink-subtle uppercase tracking-widest mt-1 font-sans">
            / Attendance
          </span>
        </div>

        <div className="w-full max-w-sm">

          {/* Heading */}
          <h2 className="text-3xl font-bold text-ink mb-2 leading-tight font-serif">
            Set your password.
          </h2>
          <p className="text-ink-subtle text-sm font-sans mb-8">
            Your account was just created with a temporary password.
            Choose a personal password to continue.
          </p>

          {/* Accent rule */}
          <div className="h-0.5 w-10 bg-accent mb-8" />

          <div className="space-y-5">

            <PasswordField
              label="Temporary Password"
              hint="The password the admin gave you."
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              show={show.temp}
              onToggle={() => toggle('temp')}
              disabled={loading}
            />

            <PasswordField
              label="New Password"
              hint={`At least 10 characters. Pick something only you know.`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              show={show.new}
              onToggle={() => toggle('new')}
              disabled={loading}
            />

            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              show={show.confirm}
              onToggle={() => toggle('confirm')}
              disabled={loading}
            />

            {/* Error */}
            {error && (
              <p className="text-error text-sm font-sans">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Setting password…' : 'Set Password & Continue'}
            </button>
          </div>

          {/* Bottom note */}
          <p className="text-ink-subtle text-caption font-sans mt-8 text-center">
            After this, you'll log in with your email and new password.
          </p>

        </div>
      </div>
    </div>
  )
}

export default SetPassword