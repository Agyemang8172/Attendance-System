import { useState, useEffect } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import StaffTable from '../components/ui/StaffTable'
import AddEmployeeModal from '../components/ui/AddEmployeeModal'
import EditEmployeeModal from '../components/ui/EditEmployeeModal'

// ─── ManageStaff ────────────────────────────────────────────────────────────
//
//  Shared admin page (SUPERADMIN + HR) for managing employee accounts.
//  The role in the eyebrow adapts to whoever opened it, so a page that one
//  role owns never lies about who is looking.
//
//  This is the "smart" file: it talks to the backend, holds state, and feeds
//  the dumb StaffTable. The Add Employee popup is wired here but built next.
//
// ─────────────────────────────────────────────────────────────────────────────

const ManageStaff = () => {
  const currentUser = getCurrentUser()

  const [users, setUsers] = useState([])
  const [fetching, setFetching] = useState(true)

  // Pagination — the backend already returns this; we finally use it.
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)

  // Add Employee popup (the popup itself is the next piece we build)
  const [showAddModal, setShowAddModal] = useState(false)

  // Deactivate confirm: holds the user awaiting confirmation, or null.
  const [pendingUser, setPendingUser] = useState(null)
  const [deactivating, setDeactivating] = useState(false)
  // Edit employee: holds the user being edited, or null.
  const [editingUser, setEditingUser] = useState(null)

  // ── Load users for a given page ────────────────────────────────────────────
  const fetchUsers = async (targetPage = 1) => {
    setFetching(true)
    try {
      const res = await api.get('/users', {
        params: { page: targetPage, limit: 10 },
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
    fetchUsers(1)
  }, [])

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

  // ── Confirm button inside the popup → call the API ──────────────────────────
  const handleConfirmDeactivate = async () => {
    if (!pendingUser) return
    setDeactivating(true)
    try {
      await api.delete(`/users/${pendingUser.id}`)
      toast.success(`${pendingUser.firstName || 'Employee'} deactivated.`)
      setPendingUser(null)
      // Refetch the current page so the list reflects the change.
      fetchUsers(page)
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to deactivate employee.'
      toast.error(msg)
    } finally {
      setDeactivating(false)
    }
  }

  const goToPage = (target) => {
    if (target < 1 || target > totalPages || target === page) return
    fetchUsers(target)
  }

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-accent mb-1">
            {currentUser?.role === 'HR' ? 'Human Resources' : 'Superadmin'}
          </p>
          <h1 className="text-display-sm text-ink font-serif leading-tight">
            Manage Staff
          </h1>
          <p className="text-ink-muted text-sm font-sans mt-1">
            {fetching
              ? 'Loading…'
              : `${totalUsers} active employee${totalUsers === 1 ? '' : 's'}`}
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

      {/* ── Table / Loading ──────────────────────────────────────────────── */}
      {fetching ? (
        <div className="card flex items-center justify-center">
          <p className="text-ink-muted text-sm font-sans animate-pulse">
            Loading employees…
          </p>
        </div>
      ) : (
        <StaffTable users={users} onEdit={setEditingUser} onDeactivate={handleDeactivateRequest} />
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

      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => fetchUsers(1)}
        />
      )}

      {editingUser && (
        <EditEmployeeModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={() => fetchUsers(page)}
        />
      )}
    </Layout>
  )
}

export default ManageStaff