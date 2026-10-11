import { useState, useEffect } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import StaffTable from '../components/ui/StaffTable'
import AddEmployeeModal from '../components/ui/AddEmployeeModal'
import EditEmployeeModal from '../components/ui/EditEmployeeModal'
import ResetPasswordModal from '../components/ui/ResetPasswordModal'

// ─── ManageStaff ────────────────────────────────────────────────────────────
//
//  Shared admin page (SUPERADMIN + HR) for managing employee accounts.
//  The role in the eyebrow adapts to whoever opened it, so a page that one
//  role owns never lies about who is looking.
//
//  Two views, two lists, one endpoint:
//    Active    → GET /users        (backend defaults to isActive=true)
//    Inactive  → GET /users?isActive=false
//  Reactivating is SUPERADMIN-only (isActive is a privileged field), so the
//  Inactive view stays open to HR but the row action is disabled for them —
//  visible boundary, not a hidden one (M6 rule).
//
// ─────────────────────────────────────────────────────────────────────────────

const ManageStaff = () => {
  const currentUser = getCurrentUser()
  const role = currentUser?.role || 'SUPERADMIN'
  const isHr = role === 'HR'

  // Which list we're looking at. `false` is "show deactivated accounts".
  const [inactive, setInactive] = useState(false)

  const [users, setUsers] = useState([])
  const [fetching, setFetching] = useState(true)

  // Pagination — the backend already returns this; we finally use it.
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)

  // Add Employee popup
  const [showAddModal, setShowAddModal] = useState(false)

  // Deactivate confirm: holds the user awaiting confirmation, or null.
  const [pendingUser, setPendingUser] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  // Reactivate confirm: same pair of states, separate slot.
  const [reactivatingUser, setReactivatingUser] = useState(null)
  const [reactivating, setReactivating] = useState(false)

  // Edit employee: holds the user being edited, or null.
  const [editingUser, setEditingUser] = useState(null)

  // Password reset: holds the user being reset, or null.
  const [resettingUser, setResettingUser] = useState(null)

  // ── Load users for a given page and list ──────────────────────────────────
  const fetchUsers = async (targetPage = 1, showInactive = inactive) => {
    setFetching(true)
    try {
      const res = await api.get('/users', {
        params: {
          page: targetPage,
          limit: 10,
          // `false` keeps the raw string "false" (validator whitelists it),
          // so the controller reads the filter correctly.
          ...(showInactive ? { isActive: false } : {}),
        },
      })
      setUsers(res.data.data || [])

      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalUsers(pag.totalUsers)
      }
    } catch (_error) {
      toast.error('Failed to load employees.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchUsers(1, inactive)
    // `inactive` is the only input; `fetchUsers` itself reads page/filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inactive])

  const switchView = (showInactive) => {
    if (showInactive === inactive) return
    setInactive(showInactive)
    setPage(1)
  }

  // ── Row "Deactivate" clicked → open the confirm popup ───────────────────────
  const handleDeactivateRequest = (user) => {
    // Guard: you cannot deactivate your own account. Compared on email because
    // it is unique and present on both the list user and the logged-in user,
    // regardless of how the id field is named.
    if (currentUser?.email && user.email === currentUser.email) {
      toast.error("You can't deactivate your own account.")
      return
    }
    setPendingUser(user)
  }

  // ── Row "Reset" clicked → open the reset popup ──────────────────────────────
  const handleResetRequest = (user) => {
    if (currentUser?.email && user.email === currentUser.email) {
      toast.error("Use the Set Password page to change your own password.")
      return
    }
    setResettingUser(user)
  }

  // ── Row "Reactivate" clicked → open the confirm popup ───────────────────────
  const handleReactivateRequest = (user) => {
    setReactivatingUser(user)
  }

  // ── Confirm button inside the deactivate popup → call the API ───────────────
  const handleConfirmDeactivate = async () => {
    if (!pendingUser) return
    setDeactivating(true)
    try {
      await api.delete(`/users/${pendingUser.id}`)
      toast.success(`${pendingUser.firstName || 'Employee'} deactivated.`)
      setPendingUser(null)
      // Refetch the current page so the list reflects the change.
      fetchUsers(page, inactive)
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to deactivate employee.'
      toast.error(msg)
    } finally {
      setDeactivating(false)
    }
  }

  // ── Confirm button inside the reactivate popup → call the API ───────────────
  const handleConfirmReactivate = async () => {
    if (!reactivatingUser) return
    setReactivating(true)
    try {
      // `isActive` is a privileged field — only SUPERADMIN carries it in the
      // write set (backend-side), so HR never reaches this handler's payload.
      await api.put(`/users/${reactivatingUser.id}`, { isActive: true })
      toast.success(`${reactivatingUser.firstName || 'Employee'} reactivated.`)
      setReactivatingUser(null)
      fetchUsers(page, inactive)
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to reactivate employee.'
      toast.error(msg)
    } finally {
      setReactivating(false)
    }
  }

  const goToPage = (target) => {
    if (target < 1 || target > totalPages || target === page) return
    fetchUsers(target, inactive)
  }

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-ink-muted text-caption font-mono mb-1">
            {isHr ? 'Human Resources' : 'Superadmin'}
          </p>
          <h1 className="text-display-sm text-ink font-serif leading-tight">
            Manage Staff
          </h1>
          <p className="text-ink-muted text-sm font-sans mt-1">
            {fetching
              ? 'Loading…'
              : `${totalUsers} ${
                  inactive ? 'deactivated account' : 'active employee'
                }${totalUsers === 1 ? '' : 's'}`}
          </p>
          <div className="mt-2 h-0.5 w-10 bg-accent/60" />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary w-full sm:w-auto"
        >
          + Add Employee
        </button>
      </header>

      {/* ── Active / Inactive toggle ─────────────────────────────────────── */}
      <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-hairline mb-4" role="tablist" aria-label="Employee account status">
        {[
          { key: false, label: 'Active' },
          { key: true, label: 'Inactive' },
        ].map((tab) => (
          <button
            key={String(tab.key)}
            role="tab"
            aria-selected={inactive === tab.key}
            onClick={() => switchView(tab.key)}
            className={[
              'px-3 py-1.5 rounded-sm text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
              inactive === tab.key
                ? 'bg-surface-1 text-ink border border-hairline-strong'
                : 'text-ink-muted hover:text-ink border border-transparent',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Table / Loading ──────────────────────────────────────────────── */}
      {fetching ? (
        <div className="card flex items-center justify-center">
          <p className="text-ink-muted text-sm font-sans animate-pulse">
            Loading employees…
          </p>
        </div>
      ) : (
        <StaffTable
          users={users}
          inactive={inactive}
          canReactivate={role === 'SUPERADMIN'}
          onEdit={setEditingUser}
          onDeactivate={handleDeactivateRequest}
          onResetPassword={handleResetRequest}
          onReactivate={handleReactivateRequest}
          onAdd={() => setShowAddModal(true)}
          onShowActive={() => switchView(false)}
        />
      )}

      {/* ── Pagination footer (only when more than one page) ─────────────── */}
      {!fetching && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-caption font-mono text-ink-muted">
            Page {page} of {totalPages} · {totalUsers} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="btn-secondary"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="btn-secondary"
            >
              Next ›
            </button>
          </div>
        </div>
      )}

      {/* ── Deactivate Confirm Popup ─────────────────────────────────────── */}
      {pendingUser && (
        <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated relative max-w-md w-full overflow-hidden border-accent/20">
            {/* Linear corner bracket */}
            <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />

            <p className="text-eyebrow text-accent mb-3">
              Confirm
            </p>

            <h2 className="text-display-sm text-ink font-serif mb-3">
              Deactivate employee?
            </h2>

            <p className="text-ink-muted text-sm font-sans mb-2">
              You're about to deactivate{' '}
              <span className="text-ink font-medium">
                {pendingUser.firstName} {pendingUser.lastName}
              </span>
              .
            </p>
            <p className="text-ink-muted text-sm font-sans mb-8">
              They lose access immediately. Their attendance history is kept.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingUser(null)}
                disabled={deactivating}
                className="btn-tertiary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeactivate}
                disabled={deactivating}
                className="btn-primary bg-error hover:bg-error/90"
              >
                {deactivating ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reactivate Confirm Popup ─────────────────────────────────────── */}
      {reactivatingUser && (
        <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="card-elevated relative max-w-md w-full overflow-hidden border-accent/20"
          >
            {/* Linear corner bracket */}
            <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />

            <p className="text-eyebrow text-accent mb-3">
              Confirm
            </p>

            <h2 className="text-display-sm text-ink font-serif mb-3">
              Reactivate employee?
            </h2>

            <p className="text-ink-muted text-sm font-sans mb-2">
              You're about to restore{' '}
              <span className="text-ink font-medium">
                {reactivatingUser.firstName} {reactivatingUser.lastName}
              </span>{' '}
              to Active.
            </p>
            <p className="text-ink-muted text-sm font-sans mb-8">
              They'll be able to sign in again straight away.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReactivatingUser(null)}
                disabled={reactivating}
                className="btn-tertiary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReactivate}
                disabled={reactivating}
                className="btn-primary"
              >
                {reactivating ? 'Reactivating…' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { fetchUsers(1, false); setInactive(false) }}
        />
      )}

      {editingUser && (
        <EditEmployeeModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={() => fetchUsers(page, inactive)}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onReset={() => fetchUsers(page, inactive)}
        />
      )}
    </Layout>
  )
}

export default ManageStaff