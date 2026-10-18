import { useState, useEffect } from 'react'
import { getCurrentUser } from '../../utils/auth'
import api from '../../api/axios'

// ─── AddEmployeeModal ─────────────────────────────────────────────────────────
//
//  Two-step popup for creating an employee.
//
//    STEP 1 (form):   admin types name, email, department, role.
//                     No employee ID, no password — the backend generates both.
//    STEP 2 (reveal): the popup shows the generated Employee Code and the
//                     temporary password ONCE, with copy buttons, so the admin
//                     can hand them to the new employee.
//
//  The employee is forced to change the password on first login (backend flag),
//  so this temp password is single-use by design.
//
//  Props:
//    onClose   → () => void · close the popup
//    onCreated → () => void · called when the admin finishes, so the parent
//                refetches the list
//
//  ── ROLE LOCK (D4) ───────────────────────────────────────────────────────────
//  HR accounts may only create STAFF accounts — the backend refuses anything
//  else with a 403. The Role select therefore stays visible but DISABLED for an
//  HR caller, pinned to STAFF, rather than hidden (hiding is how privilege
//  escalation slips through a UI that still talks to the old API).
//
//  ── BACKEND CONTRACT this component expects ──────────────────────────────────
//    POST /users  with body { firstName, lastName, email, department, role }
//    On success (201), the response must be:
//      {
//        success: true,
//        data: { id, employeeCode, firstName, lastName, email, department, role },
//        tempPassword: "amber-tiger-42"
//      }
// ─────────────────────────────────────────────────────────────────────────────

const Field = ({ label, ...inputProps }) => (
  <div>
    <label className="block text-xs font-semibold uppercase tracking-widest text-chrome-ink-muted mb-2 font-sans">
      {label}
    </label>
    <input
      {...inputProps}
      className="
        w-full px-4 py-3
        bg-chrome-elevated border border-chrome-line
        rounded-lg text-sm text-chrome-ink
        placeholder-chrome-ink-subtle font-sans
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent
        disabled:opacity-50 disabled:cursor-not-allowed
        transition duration-150
      "
    />
  </div>
)

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

const AddEmployeeModal = ({ onClose, onCreated }) => {
  const currentUser = getCurrentUser()
  const isHr = currentUser?.role === 'HR'

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    role: 'STAFF',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // When set, we switch from the form to the reveal screen.
  const [created, setCreated] = useState(null)

  // Escape closes the popup — but ONLY on the form step
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !created) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, created])

  const update = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async () => {
    setError('')

    const required = ['firstName', 'lastName', 'email', 'department']
    const missing = required.find((k) => !form[k].trim())
    if (missing) {
      setError('Please fill in every field.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/users', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        // HR cannot mint HR or SUPERADMIN accounts (backend enforces this too),
        // so an HR caller always creates STAFF.
        role: isHr ? 'STAFF' : form.role,
      })

      const data = res.data?.data || {}
      setCreated({
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email.trim(),
        employeeCode: data.employeeCode || '—',
        tempPassword: res.data?.tempPassword || null,
      })
    } catch (err) {
      const raw = err.response?.data?.error || err.response?.data?.message || ''
      const friendly = /duplicate|E11000|P2002/i.test(raw)
        ? 'That email is already taken.'
        : raw || 'Failed to create employee. Please try again.'
      setError(friendly)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDone = () => {
    onCreated()
    onClose()
  }

  const goldButton =
    'px-6 py-2.5 rounded-xl text-sm font-semibold font-sans bg-brass-chrome text-ink hover:opacity-90 transition-opacity duration-150 shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div
      className="fixed inset-0 z-50 overlay-scrim backdrop-blur-sm flex items-center justify-center p-4"
      onClick={created ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-chrome rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-chrome-line shadow-elevated"
      >
        {/* MERIDIAN corner bracket */}
        <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-brass-chrome opacity-30 pointer-events-none" />

        {created ? (
          /* ── STEP 2: REVEAL CREDENTIALS ───────────────────────────────── */
          <>
            <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
              Account Created
            </p>
            <h2 className="text-2xl font-bold text-chrome-ink font-serif mb-2">
              {created.name} is set up
            </h2>
            <p className="text-chrome-ink-muted text-sm font-sans mb-6">
              Give {created.name.split(' ')[0]} their email and temporary password — that's
              what they log in with. They'll set their own password on first login.
            </p>

            <div className="space-y-4">
              <CopyRow label="Email" value={created.email} />
              {created.tempPassword ? (
                <CopyRow label="Temporary Password" value={created.tempPassword} />
              ) : (
                <p className="text-chrome-error text-xs font-sans">
                  The server didn't send a temporary password. Make sure
                  createUser returns a <span className="font-mono">tempPassword</span> field.
                </p>
              )}
              <CopyRow label="Employee Code (for reference)" value={created.employeeCode} />
            </div>

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
          /* ── STEP 1: FORM ─────────────────────────────────────────────── */
          <>
            <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
              New Account
            </p>
            <h2 className="text-2xl font-bold text-chrome-ink font-serif mb-6">
              Add Employee
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="First Name"
                  value={form.firstName}
                  onChange={update('firstName')}
                  placeholder="Ama"
                  disabled={submitting}
                  autoFocus
                />
                <Field
                  label="Last Name"
                  value={form.lastName}
                  onChange={update('lastName')}
                  placeholder="Boateng"
                  disabled={submitting}
                />
              </div>

              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="ama@company.com"
                disabled={submitting}
              />

              <Field
                label="Department"
                value={form.department}
                onChange={update('department')}
                placeholder="Operations"
                disabled={submitting}
              />

              {/* Role — disabled for HR (D4): the select stays visible so the
                  caller sees where the boundary is, but an HR caller cannot
                  move it off STAFF. */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-chrome-ink-muted mb-2 font-sans">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={update('role')}
                  disabled={submitting || isHr}
                  className="
                    w-full px-4 py-3
                    bg-chrome-elevated border border-chrome-line
                    rounded-lg text-sm text-chrome-ink font-sans
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition duration-150
                  "
                >
                  <option value="STAFF">Staff</option>
                  <option value="HR">HR</option>
                  <option value="SUPERADMIN">Superadmin</option>
                </select>
                {isHr && (
                  <p className="text-chrome-ink-subtle text-xs font-sans mt-1">
                    HR accounts can only create Staff accounts.
                  </p>
                )}
              </div>

              {error && <p className="text-chrome-error text-xs font-sans">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={goldButton}
                >
                  {submitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AddEmployeeModal