import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import MeridianArt from '../assets/meridian.svg'

// ─── SetPassword ──────────────────────────────────────────────────────────────
//
//  Locked page for first-time password change. No sidebar, no navigation,
//  no way out except setting a new password. Visually mirrors the Login page
//  (split panel layout) so it feels like part of the same entry flow.
//
//  Shows when: mustChangePassword === true on login.
//  Calls: PUT /users/change-password (same endpoint as Settings).
//  After success: flag clears, user goes to their role-appropriate dashboard.
//
// ─────────────────────────────────────────────────────────────────────────────

const PasswordField = ({ label, hint, value, onChange, show, onToggle, disabled }) => (
  <div>
    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 font-sans">
      {label}
    </label>
    {hint && (
      <p className="text-slate-500 text-xs font-sans mb-2">{hint}</p>
    )}
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder="••••••••"
        disabled={disabled}
        className="
          w-full px-4 py-3 pr-11
          bg-stone-100
          border border-stone-300
          rounded-lg text-sm text-slate-900
          placeholder-slate-400
          font-sans
          focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition duration-150
        "
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        className="
          absolute right-3 top-1/2 -translate-y-1/2
          text-slate-400 hover:text-slate-900
          transition duration-150
          focus:outline-none
        "
      >
        {show ? <FaEyeSlash /> : <FaEye />}
      </button>
    </div>
  </div>
)

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
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
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

      // Navigate to the right dashboard based on role.
      if (user?.role === 'hr') {
        navigate('/hr-dashboard')
      } else if (user?.role === 'superadmin') {
        navigate('/superadmin-dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to set password.'
      // Translate the most common error into plain language.
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
    <div className="min-h-screen flex font-sans">

      {/* ── LEFT PANEL — brand side (matches Login exactly) ──────────────── */}
      <div
        className="
          hidden md:flex w-[45%] min-h-screen
          bg-slate-900
          flex-col items-center justify-center
          px-12 relative overflow-hidden
        "
      >
        <div className="absolute w-72 h-72 rounded-full bg-yellow-500 opacity-5 blur-3xl top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="w-48 h-48 mb-10 opacity-90">
          <img
            src={MeridianArt}
            alt="AttendPro visual"
            className="w-full h-full object-contain"
          />
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-yellow-500 mb-3 font-serif">
          AttendPro
        </h1>

        <p className="text-sm text-stone-50 opacity-50 tracking-widest uppercase font-sans">
          Employee Attendance System
        </p>

        <div className="absolute bottom-10 left-12 right-12 h-px bg-yellow-500 opacity-20" />
        <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-yellow-500 opacity-30 rounded-tr-sm" />
        <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-yellow-500 opacity-30 rounded-bl-sm" />
      </div>

      {/* ── RIGHT PANEL — set password form ──────────────────────────────── */}
      <div
        className="
          flex-1 min-h-screen bg-stone-50
          flex flex-col justify-center
          px-8 sm:px-16 lg:px-24
          relative
        "
      >
        {/* Mobile-only brand header */}
        <div className="flex md:hidden items-center gap-2 mb-10">
          <span className="text-2xl font-bold text-slate-900 font-serif">
            AttendPro
          </span>
          <span className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-sans">
            / Attendance
          </span>
        </div>

        <div className="w-full max-w-sm">

          {/* Heading */}
          <h2 className="text-3xl font-bold text-slate-900 mb-2 leading-tight font-serif">
            Set your password.
          </h2>
          <p className="text-slate-400 text-sm font-sans mb-8">
            Your account was just created with a temporary password.
            Choose a personal password to continue.
          </p>

          {/* Gold accent rule */}
          <div className="h-0.5 w-10 bg-yellow-500/60 mb-8" />

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
              hint="At least 6 characters. Pick something only you know."
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
              <p className="text-red-500 text-sm font-sans">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="
                w-full py-3 rounded-lg
                text-sm font-semibold font-sans
                bg-yellow-500 text-slate-900
                hover:bg-yellow-400
                focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-stone-50
                transition-colors duration-150
                shadow-sm shadow-yellow-500/20
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {loading ? 'Setting password…' : 'Set Password & Continue'}
            </button>
          </div>

          {/* Bottom note */}
          <p className="text-slate-400 text-xs font-sans mt-8 text-center">
            After this, you'll log in with your email and new password.
          </p>

        </div>
      </div>
    </div>
  )
}

export default SetPassword