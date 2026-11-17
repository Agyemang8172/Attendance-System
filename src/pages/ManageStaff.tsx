import { useState, useEffect, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import Pagination from '../components/ui/Pagination'
import StaffTable from '../components/ui/StaffTable.tsx'
import AddEmployeeModal from '../components/ui/AddEmployeeModal.tsx'
import EditEmployeeModal from '../components/ui/EditEmployeeModal.tsx'
import ResetPasswordModal from '../components/ui/ResetPasswordModal.tsx'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ModalShell from '../components/ui/ModalShell'
import Pill from '../components/ui/Pill.tsx'
import { formatTodayLong } from '../lib/attendance-format'

const PAGE_SIZE = 10

interface StaffUser {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  department: string
  role: 'STAFF' | 'HR' | 'SUPERADMIN'
  phoneNumber?: string
  jobTitle?: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

function ManageStaff() {
  const currentUser = getCurrentUser()
  const role = currentUser?.role || 'SUPERADMIN'
  const isHr = role === 'HR'
  const isSuperAdmin = role === 'SUPERADMIN'

  // Which list we're looking at. `false` is "show deactivated accounts".
  const [inactive, setInactive] = useState(false)

  const [users, setUsers] = useState<StaffUser[]>([])
  const [fetching, setFetching] = useState(true)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null)
  const [resettingUser, setResettingUser] = useState<StaffUser | null>(null)

  // Deactivate/Reactivate confirms using ConfirmDialog
  const [deactivateConfirm, setDeactivateConfirm] = useState<StaffUser | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [reactivateConfirm, setReactivateConfirm] = useState<StaffUser | null>(null)
  const [reactivating, setReactivating] = useState(false)

  // Employee Detail
  const [detailUser, setDetailUser] = useState<StaffUser | null>(null)

  // PIN Reset
  const [pinResetUser, setPinResetUser] = useState<StaffUser | null>(null)
  const [pinResetReason, setPinResetReason] = useState('')
  const [pinResetting, setPinResetting] = useState(false)
  const [issuedPin, setIssuedPin] = useState<{ name: string; pin: string } | null>(null)
  const [pinCopied, setPinCopied] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // ── Load users for a given page and list ──────────────────────────────────
  const fetchUsers = async (targetPage = 1, showInactive = inactive) => {
    setFetching(true)
    try {
      const endpoint = isHr ? '/hr/employees' : '/hr/employees' // Both HR and SA use /hr/employees
      const res = await api.get(endpoint, {
        params: {
          page: targetPage,
          limit: PAGE_SIZE,
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
    } catch (_error: unknown) {
      toast.error('Failed to load employees.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchUsers(1, inactive)
  }, [inactive])

  const switchView = (showInactive: boolean) => {
    if (showInactive === inactive) return
    setInactive(showInactive)
    setPage(1)
  }

  // ── Row "Deactivate" clicked → open confirm ────────────────────────────────
  const handleDeactivateRequest = (user: StaffUser) => {
    if (currentUser?.email && user.email === currentUser.email) {
      toast.error("You can't deactivate your own account.")
      return
    }
    setDeactivateConfirm(user)
  }

  // ── Row "Reset Password" clicked ───────────────────────────────────────────
  const handleResetRequest = (user: StaffUser) => {
    if (currentUser?.email && user.email === currentUser.email) {
      toast.error("Use the Set Password page to change your own password.")
      return
    }
    setResettingUser(user)
  }

  // ── Row "Reactivate" clicked ───────────────────────────────────────────────
  const handleReactivateRequest = (user: StaffUser) => {
    setReactivateConfirm(user)
  }

  // ── Confirm Deactivate ─────────────────────────────────────────────────────
  const handleConfirmDeactivate = async () => {
    if (!deactivateConfirm) return
    setDeactivating(true)
    try {
      // Legacy DELETE /api/users/:id for deactivation (M8-R8)
      await api.delete(`/users/${deactivateConfirm.id}`)
      toast.success(`${deactivateConfirm.firstName || 'Employee'} deactivated.`)
      setDeactivateConfirm(null)
      fetchUsers(page, inactive)
    } catch (error: unknown) {
      const msg = error instanceof Error && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data
        ? String(error.response.data.message)
        : 'Failed to deactivate employee.'
      toast.error(msg)
    } finally {
      setDeactivating(false)
    }
  }

  // ── Confirm Reactivate ─────────────────────────────────────────────────────
  const handleConfirmReactivate = async () => {
    if (!reactivateConfirm) return
    setReactivating(true)
    try {
      // SUPERADMIN only - isActive is privileged field
      await api.put(`/users/${reactivateConfirm.id}`, { isActive: true })
      toast.success(`${reactivateConfirm.firstName || 'Employee'} reactivated.`)
      setReactivateConfirm(null)
      fetchUsers(page, inactive)
    } catch (error: unknown) {
      const msg = error instanceof Error && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data
        ? String(error.response.data.message)
        : 'Failed to reactivate employee.'
      toast.error(msg)
    } finally {
      setReactivating(false)
    }
  }

  // ── PIN Reset ──────────────────────────────────────────────────────────────
  const handlePinResetRequest = (user: StaffUser) => {
    // HR can only reset PIN for STAFF
    if (isHr && user.role !== 'STAFF') {
      toast.error('HR can only reset PIN for STAFF accounts.')
      return
    }
    if (currentUser?.email && user.email === currentUser.email) {
      toast.error("Use the Change PIN page to change your own PIN.")
      return
    }
    setPinResetUser(user)
    setPinResetReason('')
  }

  const handlePinResetConfirm = async () => {
    if (!pinResetUser) return
    if (!pinResetReason.trim()) {
      toast.error('A reason is required.')
      return
    }
    setPinResetting(true)
    try {
      const response = await api.post(`/hr/users/${pinResetUser.id}/reset-pin`, { reason: pinResetReason.trim() })
      const pin = response.data?.data?.pin
      const name = `${pinResetUser.firstName} ${pinResetUser.lastName}`
      if (typeof pin === 'string' && pin.length === 4) {
        setIssuedPin({ name, pin })
        setPinCopied(false)
      } else {
        toast.success(`PIN reset for ${name}.`)
      }
      setPinResetUser(null)
      setPinResetReason('')
    } catch (error: unknown) {
      const msg = error instanceof Error && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data
        ? String(error.response.data.message)
        : 'Failed to reset PIN.'
      toast.error(msg)
    } finally {
      setPinResetting(false)
    }
  }

  const goToPage = (target: number) => {
    if (target < 1 || target > totalPages || target === page) return
    fetchUsers(target, inactive)
  }

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    const q = searchQuery.toLowerCase()
    return users.filter((u) => {
      const name = `${u.firstName} ${u.lastName}`.toLowerCase()
      const email = (u.email || '').toLowerCase()
      const dept = (u.department || '').toLowerCase()
      const role = (u.role || '').toLowerCase()
      return name.includes(q) || email.includes(q) || dept.includes(q) || role.includes(q)
    })
  }, [users, searchQuery])

  // Open employee detail
  const handleViewDetail = (user: StaffUser) => {
    setDetailUser(user)
  }

  // Handle edit from detail view
  const handleEditFromDetail = (user: StaffUser) => {
    setDetailUser(null)
    setEditingUser(user)
  }

  // Handle deactivate from detail view
  const handleDeactivateFromDetail = (user: StaffUser) => {
    setDetailUser(null)
    handleDeactivateRequest(user)
  }

  // Handle reactivate from detail view
  const handleReactivateFromDetail = (user: StaffUser) => {
    setDetailUser(null)
    handleReactivateRequest(user)
  }

  // Handle PIN reset from detail view
  const handlePinResetFromDetail = (user: StaffUser) => {
    setDetailUser(null)
    handlePinResetRequest(user)
  }

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow={isHr ? 'Human Resources' : 'Superadmin'}
        title="Manage Staff"
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            + Add Employee
          </button>
        }
      />

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

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <FilterBar label="Employee filters">
        <SearchInput
          label="Search employees"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, email, department, role…"
        />
      </FilterBar>

      {/* ── Table / Loading ──────────────────────────────────────────────── */}
      {fetching ? (
        <div className="card flex items-center justify-center">
          <p className="text-ink-muted text-sm font-sans animate-pulse">
            Loading employees…
          </p>
        </div>
      ) : (
        <StaffTable
          users={filteredUsers}
          inactive={inactive}
          canReactivate={isSuperAdmin}
          onEdit={setEditingUser}
          onDeactivate={handleDeactivateRequest}
          onResetPassword={handleResetRequest}
          onReactivate={handleReactivateRequest}
          onViewDetail={handleViewDetail}
          onPinReset={handlePinResetRequest}
          onAdd={() => setShowAddModal(true)}
          onShowActive={() => switchView(false)}
        />
      )}

      {/* ── Pagination footer ─────────────────────────────────────────────── */}
      {!fetching && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={goToPage}
          totalItems={totalUsers}
          pageSize={PAGE_SIZE}
          ariaLabel="Employee list pages"
        />
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
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

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={!!deactivateConfirm}
        onClose={() => setDeactivateConfirm(null)}
        onConfirm={handleConfirmDeactivate}
        title="Deactivate employee?"
        body={
          <>
            <p>You're about to deactivate <span className="font-medium">{deactivateConfirm?.firstName} {deactivateConfirm?.lastName}</span>.</p>
            <p className="mt-2">They lose access immediately. Their attendance history is kept.</p>
          </>
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        busy={deactivating}
        busyLabel="Deactivating…"
        eyebrow="Confirm"
        danger
      />

      {/* Reactivate Confirm */}
      <ConfirmDialog
        open={!!reactivateConfirm}
        onClose={() => setReactivateConfirm(null)}
        onConfirm={handleConfirmReactivate}
        title="Reactivate employee?"
        body={
          <>
            <p>You're about to restore <span className="font-medium">{reactivateConfirm?.firstName} {reactivateConfirm?.lastName}</span> to Active.</p>
            <p className="mt-2">They'll be able to sign in again straight away.</p>
          </>
        }
        confirmLabel="Reactivate"
        cancelLabel="Cancel"
        busy={reactivating}
        busyLabel="Reactivating…"
        eyebrow="Confirm"
      />

      {/* Employee Detail Drawer */}
      {detailUser && (
        <EmployeeDetailDrawer
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onEdit={handleEditFromDetail}
          onDeactivate={handleDeactivateFromDetail}
          onReactivate={handleReactivateFromDetail}
          onPinReset={handlePinResetFromDetail}
          isHr={isHr}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* PIN Reset Dialog */}
      {pinResetUser && (
        <PinResetDialog
          user={pinResetUser}
          open={true}
          onClose={() => { setPinResetUser(null); setPinResetReason('') }}
          onConfirm={handlePinResetConfirm}
          reason={pinResetReason}
          setReason={setPinResetReason}
          busy={pinResetting}
          isHr={isHr}
        />
      )}

      {/* The PIN is shown once, to the administrator who performed the reset. */}
      {issuedPin && (
        <ModalShell
          open={true}
          onClose={() => setIssuedPin(null)}
          label="New kiosk PIN"
          maxWidth="sm"
        >
          <p className="text-eyebrow text-brass-chrome opacity-70 mb-3">One-time PIN</p>
          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-3">
            Kiosk PIN for {issuedPin.name}
          </h2>
          <p className="text-chrome-ink-muted text-sm font-sans mb-4">
            Give this PIN to the employee now. It will not be shown again.
          </p>
          <div className="flex items-stretch gap-2">
            <p className="flex-1 font-mono text-3xl tracking-[0.35em] text-chrome-ink bg-chrome-elevated border border-chrome-line rounded-md px-4 py-3 text-center">
              {issuedPin.pin}
            </p>
            <button
              type="button"
              onClick={() => {
                if (!navigator.clipboard) {
                  toast.error('Copy is not available in this browser.')
                  return
                }
                navigator.clipboard
                  .writeText(issuedPin.pin)
                  .then(() => setPinCopied(true))
                  .catch(() => toast.error('Could not copy the PIN.'))
              }}
              className="btn bg-chrome-elevated text-chrome-ink border border-chrome-line px-[14px] py-[8px] rounded-md transition-all duration-150 active:scale-[0.98]"
            >
              {pinCopied ? 'Copied' : 'Copy PIN'}
            </button>
          </div>
          <div className="flex justify-end mt-8">
            <button
              type="button"
              onClick={() => setIssuedPin(null)}
              className="btn bg-brass-chrome text-ink px-[14px] py-[8px] rounded-md transition-all duration-150 active:scale-[0.98]"
            >
              I have written it down
            </button>
          </div>
        </ModalShell>
      )}
    </Layout>
  )
}

// ─── Employee Detail Drawer ──────────────────────────────────────────────────────
interface EmployeeDetailDrawerProps {
  user: StaffUser
  onClose: () => void
  onEdit: (user: StaffUser) => void
  onDeactivate: (user: StaffUser) => void
  onReactivate: (user: StaffUser) => void
  onPinReset: (user: StaffUser) => void
  isHr: boolean
  isSuperAdmin: boolean
}

const EmployeeDetailDrawer = ({
  user,
  onClose,
  onEdit,
  onDeactivate,
  onReactivate,
  onPinReset,
  isHr,
  isSuperAdmin,
}: EmployeeDetailDrawerProps) => (
  <ModalShell open={true} onClose={onClose} label={`Employee: ${user.firstName} ${user.lastName}`} maxWidth="lg">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow text-brass-chrome opacity-70 mb-1">Employee Detail</p>
          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight">
            {user.firstName} {user.lastName}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={user.role === 'SUPERADMIN' ? 'accent' : user.role === 'HR' ? 'warning' : 'neutral'} mono>
            {user.role}
          </Pill>
          <Pill tone={user.isActive ? 'success' : 'error'} mono>
            {user.isActive ? 'Active' : 'Inactive'}
          </Pill>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-caption text-chrome-ink-muted mb-1">Employee ID</p>
          <p className="text-body font-mono text-chrome-ink">{user.employeeCode || '—'}</p>
        </div>
        <div>
          <p className="text-caption text-chrome-ink-muted mb-1">Email</p>
          <p className="text-body font-sans text-chrome-ink">{user.email}</p>
        </div>
        <div>
          <p className="text-caption text-chrome-ink-muted mb-1">Department</p>
          <p className="text-body font-sans text-chrome-ink">{user.department || '—'}</p>
        </div>
        <div>
          <p className="text-caption text-chrome-ink-muted mb-1">Job Title</p>
          <p className="text-body font-sans text-chrome-ink">{user.jobTitle || '—'}</p>
        </div>
        <div>
          <p className="text-caption text-chrome-ink-muted mb-1">Phone</p>
          <p className="text-body font-sans text-chrome-ink">{user.phoneNumber || '—'}</p>
        </div>
        <div>
          <p className="text-caption text-chrome-ink-muted mb-1">Account Created</p>
          <p className="text-body font-mono text-chrome-ink">{new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-chrome-line">
        <button type="button" onClick={() => onEdit(user)} className="btn-primary">Edit</button>
        {!isHr && user.role === 'STAFF' && (
          <button type="button" onClick={() => onPinReset(user)} className="btn-secondary">Reset PIN</button>
        )}
        {user.isActive ? (
          <button
            type="button"
            onClick={() => onDeactivate(user)}
            disabled={isHr && user.role !== 'STAFF'}
            className="btn-secondary danger"
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReactivate(user)}
            disabled={!isSuperAdmin}
            className="btn-primary"
          >
            Reactivate
          </button>
        )}
      </div>
    </div>
  </ModalShell>
)

// ─── PIN Reset Dialog ────────────────────────────────────────────────────────────
interface PinResetDialogProps {
  user: StaffUser
  open: boolean
  onClose: () => void
  onConfirm: () => void
  reason: string
  setReason: (reason: string) => void
  busy: boolean
  isHr: boolean
}

const PinResetDialog = ({
  user,
  open,
  onClose,
  onConfirm,
  reason,
  setReason,
  busy,
  isHr,
}: PinResetDialogProps) => (
  <ConfirmDialog
    open={open}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Reset PIN"
    body={
      <>
        <p>You are about to reset the kiosk PIN for <span className="font-medium">{user.firstName} {user.lastName}</span>.</p>
        <p className="mt-2">A new 4-digit PIN will be generated. It is shown to you once, so you can pass it to the employee.</p>
        <div className="mt-4">
          <label htmlFor="pin-reset-reason" className="text-caption text-ink-muted block mb-1">
            Reason (required)
          </label>
          <textarea
            id="pin-reset-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Explain why this PIN reset is required..."
            className="input w-full"
            required
          />
          <p className="text-caption text-ink-muted mt-1">
            {reason.length}/500 — HR must provide a reason for audit.
          </p>
        </div>
        {isHr && user.role !== 'STAFF' && (
          <p className="text-error text-caption mt-2">
            Warning: HR can only reset PIN for STAFF accounts. This action will be blocked.
          </p>
        )}
      </>
    }
    confirmLabel="Reset PIN"
    cancelLabel="Cancel"
    busy={busy}
    busyLabel="Resetting…"
    eyebrow="Confirm"
    maxWidth="sm"
  />
)

export default ManageStaff
