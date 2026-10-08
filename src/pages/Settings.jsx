import { useState } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

// ─── Password Field ───────────────────────────────────────────────────────────

const PasswordField = ({ label, value, onChange, show, onToggle, disabled }) => (
  <div>
    <label className="block text-ink-muted text-xs font-sans mb-2">
      {label}
    </label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder="••••••••"
        disabled={disabled}
        className="input"
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-accent transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus"
      >
        {show ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
      </button>
    </div>
  </div>
)

// ─── Account Info Row ─────────────────────────────────────────────────────────

const InfoRow = ({ label, children, last = false }) => (
  <div className={last ? '' : 'border-b border-hairline pb-4 mb-4'}>
    <p className="text-ink-muted text-xs font-sans mb-1">{label}</p>
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
        <p className="text-ink-muted text-xs font-mono uppercase tracking-widest mb-1">
          Settings
        </p>
        <h1 className="text-display-sm text-ink font-serif leading-tight">
          Account & Security
        </h1>
        <p className="text-ink-muted text-sm font-sans mt-1">
          Manage your account details and password.
        </p>
        <div className="mt-3 h-px w-12 bg-accent/40" />
      </header>

      {/* ── Two-column grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Account Card ───────────────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">
              Account
            </p>
            <div className="mt-2 h-px w-10 bg-accent/40" />
          </div>

          <div className="card-elevated relative overflow-hidden">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />

            <InfoRow label="Name">
              <p className="text-ink text-sm font-sans">
                {user?.firstName} {user?.lastName}
              </p>
            </InfoRow>

            <InfoRow label="Email">
              <p className="text-ink text-sm font-sans break-all">
                {user?.email}
              </p>
            </InfoRow>

            <InfoRow label="Role" last>
              <span className="inline-block px-3 py-1 rounded-md card border-hairline text-accent text-xs font-mono uppercase tracking-wider">
                {user?.role}
              </span>
            </InfoRow>
          </div>
        </section>

        {/* ── Change Password Card ───────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">
              Change Password
            </p>
            <div className="mt-2 h-px w-10 bg-accent/40" />
          </div>

          <div className="card-elevated relative overflow-hidden">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />

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
                <p className="text-error text-xs font-sans">{error}</p>
              )}

              {/* Submit */}
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="btn-primary w-full"
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