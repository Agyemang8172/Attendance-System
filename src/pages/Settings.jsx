import { useState } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

// ─── Password Field ───────────────────────────────────────────────────────────

const PasswordField = ({ label, value, onChange, show, onToggle, disabled }) => (
  <div>
    <label className="block text-slate-400 text-xs font-sans mb-2">
      {label}
    </label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder="••••••••"
        disabled={disabled}
        className="
          w-full px-4 py-3 pr-11
          bg-slate-800 border border-slate-700
          rounded-lg text-sm text-slate-200
          placeholder-slate-600
          font-sans
          focus:outline-none focus:border-yellow-500/50
          focus:ring-1 focus:ring-yellow-500/30
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-150
        "
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-yellow-500 transition-colors text-sm focus:outline-none"
      >
        {show ? <FaEyeSlash /> : <FaEye />}
      </button>
    </div>
  </div>
)

// ─── Account Info Row ─────────────────────────────────────────────────────────

const InfoRow = ({ label, children, last = false }) => (
  <div className={last ? '' : 'border-b border-slate-800 pb-4 mb-4'}>
    <p className="text-slate-400 text-xs font-sans mb-1">{label}</p>
    {children}
  </div>
)

// ─── Settings ─────────────────────────────────────────────────────────────────

function Settings() {
  const user = getCurrentUser()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [show, setShow] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const toggle = (key) => setShow((s) => ({ ...s, [key]: !s[key] }))

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleUpdate = async () => {
    setError('')

    // Sequential validation — stop at first failure, never call API on fail
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.')
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
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }

    setLoading(true)
    try {
      await api.put('/users/change-password', {
        currentPassword,
        newPassword,
      })
      toast.success('Password changed successfully.')
      // Reset form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Failed to change password.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-yellow-500/70 mb-1">
          Settings
        </p>
        <h1 className="text-2xl font-bold text-slate-900 font-serif leading-tight">
          Account & Security
        </h1>
        <p className="text-slate-400 text-sm font-sans mt-1">
          Manage your account details and password.
        </p>
        <div className="mt-3 h-px w-12 bg-yellow-500/40" />
      </header>

      {/* ── Two-column grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Account Card ───────────────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Account
            </p>
            <div className="mt-2 h-px w-10 bg-yellow-500/40" />
          </div>

          <div className="relative bg-slate-900 rounded-2xl p-6 border border-slate-800 overflow-hidden">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-yellow-500 opacity-30 pointer-events-none" />

            <InfoRow label="Name">
              <p className="text-slate-100 text-sm font-sans">
                {user?.firstName} {user?.lastName}
              </p>
            </InfoRow>

            <InfoRow label="Email">
              <p className="text-slate-100 text-sm font-sans break-all">
                {user?.email}
              </p>
            </InfoRow>

            <InfoRow label="Role" last>
              <span className="inline-block px-3 py-1 rounded-md bg-yellow-500/10 text-yellow-500 text-xs font-mono uppercase tracking-wider">
                {user?.role}
              </span>
            </InfoRow>
          </div>
        </section>

        {/* ── Change Password Card ───────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Change Password
            </p>
            <div className="mt-2 h-px w-10 bg-yellow-500/40" />
          </div>

          <div className="relative bg-slate-900 rounded-2xl p-6 border border-slate-800 overflow-hidden">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-yellow-500 opacity-30 pointer-events-none" />

            <div className="space-y-4">
              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                show={show.current}
                onToggle={() => toggle('current')}
                disabled={loading}
              />

              <PasswordField
                label="New Password"
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

              {/* Inline error — single slot */}
              {error && (
                <p className="text-red-400 text-xs font-sans">{error}</p>
              )}

              {/* Submit */}
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="
                  w-full px-5 py-3 rounded-lg
                  text-sm font-medium font-sans
                  border border-yellow-500/40
                  text-yellow-500
                  bg-yellow-500/10
                  hover:bg-yellow-500/20
                  transition-colors duration-150
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </div>
        </section>

      </div>

    </Layout>
  )
}

export default Settings