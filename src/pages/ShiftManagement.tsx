import { useState, useEffect, useRef } from 'react'
import { getCurrentUser, getToken } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import Pagination from '../components/ui/Pagination'
import { TableSkeleton } from '../components/ui/Skeleton'
import Pill from '../components/ui/Pill'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ModalShell from '../components/ui/ModalShell'
import { formatTodayLong, formatShortDate } from '../lib/attendance-format'
import { FaPlus, FaPenToSquare as FaEdit, FaToggleOn, FaToggleOff } from 'react-icons/fa6'

const PAGE_SIZE = 10
const SESSION_ERROR = 'Your session changed. Sign in again to view shifts.'

interface Shift {
  id: string
  name: string
  startMinute: number
  endMinute: number
  crossesMidnight: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ShiftForm {
  name: string
  startMinute: number | null
  endMinute: number | null
  crossesMidnight: boolean
}

const emptyForm = (): ShiftForm => ({ name: '', startMinute: 360, endMinute: 840, crossesMidnight: false })

const minutesToTime = (minutes: number | null) => minutes == null ? '' :
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const timeToMinutes = (time: string): number | null => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const validateForm = ({ name, startMinute, endMinute, crossesMidnight }: ShiftForm): string => {
  if (!name.trim()) return 'Name is required.'
  if (name.trim().length > 80) return 'Name must be at most 80 characters.'
  if (startMinute == null || endMinute == null) return 'Both start and end times are required.'
  if (endMinute <= startMinute && !crossesMidnight) return 'End time must be after start time, or select Overnight.'
  if (endMinute > startMinute && crossesMidnight) return 'Overnight must be off when the end time is after the start time.'
  return ''
}

function shiftSession() {
  const user = getCurrentUser()
  const token = getToken()
  if (!user?.id || !token || user.mustChangePassword !== false || !['HR', 'SUPERADMIN'].includes(user.role)) return null
  return JSON.stringify([user.id, user.role, token])
}

function isShift(value: unknown): value is Shift {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && Boolean(row.id)
    && typeof row.name === 'string' && Boolean(row.name.trim())
    && typeof row.startMinute === 'number' && Number.isInteger(row.startMinute) && row.startMinute >= 0 && row.startMinute <= 1439
    && typeof row.endMinute === 'number' && Number.isInteger(row.endMinute) && row.endMinute >= 0 && row.endMinute <= 1439
    && typeof row.crossesMidnight === 'boolean' && row.crossesMidnight === (row.endMinute <= row.startMinute)
    && typeof row.isActive === 'boolean' && typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
    && typeof row.updatedAt === 'string' && Number.isFinite(Date.parse(row.updatedAt))
}

function readShiftResult(value: unknown, expected: Partial<Shift>): Shift {
  const response = value as { success?: unknown; data?: unknown } | null
  if (response?.success !== true || !isShift(response.data)) throw new Error('Unconfirmed shift response')
  const shift = response.data
  if (Object.entries(expected).some(([key, value]) => shift[key as keyof Shift] !== value)) throw new Error('Unconfirmed shift response')
  return shift
}

function ShiftManagement() {
  const user = getCurrentUser()
  const session = shiftSession()
  const initialSession = useRef(session)
  const mounted = useRef(true)
  const mutationInFlight = useRef(false)
  const sessionCurrent = () => Boolean(initialSession.current && initialSession.current === shiftSession())

  const [shifts, setShifts] = useState<Shift[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  // The search box feeds the server through a short debounce so typing a name
  // costs one request instead of one per keystroke; the /api rate limit makes
  // that difference real. Filters and paging still act immediately.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // The route is SUPERADMIN-only (DESIGN-PLAN A-03), so every write control
  // below is also gated on the role. The gate keeps the component honest if a
  // read-only surface is ever opened for HR the way Sites is read today:
  // M1-API-CONTRACTS grants HR a read on GET /api/business/shifts while
  // SUPERADMIN owns every write, and M1-ROLE-EXPERIENCES keeps shift
  // management out of HR navigation.
  const canManage = sessionCurrent() && user?.role === 'SUPERADMIN'

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [deactivatingShift, setDeactivatingShift] = useState<Shift | null>(null)

  const [formData, setFormData] = useState<ShiftForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const hideOldSession = () => {
    setShifts([])
    setLoadError(SESSION_ERROR)
    setFetching(false)
    setShowCreateModal(false)
    setEditingShift(null)
    setDeactivatingShift(null)
  }

  useEffect(() => {
    mounted.current = true
    const checkSession = () => { if (!sessionCurrent()) hideOldSession() }
    window.addEventListener('storage', checkSession)
    return () => {
      mounted.current = false
      window.removeEventListener('storage', checkSession)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const controller = new AbortController()
    if (!sessionCurrent()) { hideOldSession(); return }
    setFetching(true)
    setLoadError('')
    const params: Record<string, string | number> = { page, limit: PAGE_SIZE }
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
    if (activeFilter) params.isActive = activeFilter
    api.get('/business/shifts', { params, signal: controller.signal }).then((response) => {
      if (controller.signal.aborted) return
      if (!sessionCurrent()) { hideOldSession(); return }
      const records = response.data?.data
      const pagination = response.data?.pagination
      if (response.data?.success !== true || !Array.isArray(records) || !records.every(isShift)
        || !Number.isSafeInteger(pagination?.totalRecords)
        || pagination.totalRecords < 0 || pagination.currentPage !== page
        || pagination.totalPages !== Math.ceil(pagination.totalRecords / PAGE_SIZE)
        || records.length > Math.min(PAGE_SIZE, pagination.totalRecords)) throw new Error('Invalid shifts response')
      if (page > 1 && page > Math.max(pagination.totalPages, 1)) {
        setPage(Math.max(pagination.totalPages, 1))
        return
      }
      setShifts(records)
      setTotalPages(pagination.totalPages)
      setTotalRecords(pagination.totalRecords)
    }).catch(() => {
      if (!controller.signal.aborted) {
        if (!sessionCurrent()) { hideOldSession(); return }
        setShifts([])
        setLoadError('Could not load shifts. Try again.')
      }
    }).finally(() => { if (!controller.signal.aborted) setFetching(false) })
    return () => controller.abort()
  }, [page, debouncedSearch, activeFilter, reloadKey, session])

  const beginMutation = () => {
    if (!sessionCurrent() || getCurrentUser()?.role !== 'SUPERADMIN') { hideOldSession(); return false }
    if (mutationInFlight.current) return false
    mutationInFlight.current = true
    return true
  }

  const mutationCurrent = () => {
    if (!mounted.current) return false
    if (!sessionCurrent()) { hideOldSession(); return false }
    return true
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  const handleSubmit = async () => {
    setFormError('')
    const error = validateForm(formData)
    if (error) { setFormError(error); return }
    if (!beginMutation()) return

    setSubmitting(true)
    try {
      const payload = { ...formData, name: formData.name.trim() }
      if (editingShift) {
        const response = await api.patch(`/business/shifts/${editingShift.id}`, payload)
        if (!mutationCurrent()) return
        readShiftResult(response.data, { ...payload, id: editingShift.id, isActive: editingShift.isActive } as Partial<Shift>)
        toast.success(`${payload.name} updated.`)
      } else {
        const response = await api.post('/business/shifts', payload)
        if (!mutationCurrent()) return
        readShiftResult(response.data, { ...payload, isActive: true } as Partial<Shift>)
        toast.success(`${payload.name} created.`)
      }
      setShowCreateModal(false)
      setEditingShift(null)
      setFormData(emptyForm())
      setPage(1)
      setReloadKey((value) => value + 1)
    } catch (error: unknown) {
      if (!mutationCurrent()) return
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to save shift.'
      setFormError(msg)
    } finally {
      mutationInFlight.current = false
      if (mounted.current) setSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivatingShift || !beginMutation()) return
    setDeactivating(true)
    setActionError('')
    try {
      const response = await api.post(`/business/shifts/${deactivatingShift.id}/deactivate`)
      if (!mutationCurrent()) return
      readShiftResult(response.data, { id: deactivatingShift.id, isActive: false })
      toast.success(`${deactivatingShift.name} deactivated.`)
      setDeactivatingShift(null)
      setReloadKey((value) => value + 1)
    } catch (error: unknown) {
      if (!mutationCurrent()) return
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to deactivate shift.'
      setActionError(msg)
    } finally {
      mutationInFlight.current = false
      if (mounted.current) setDeactivating(false)
    }
  }

  const handleActivate = async (shift: Shift) => {
    if (!beginMutation()) return
    setActivatingId(shift.id)
    setActionError('')
    try {
      const response = await api.patch(`/business/shifts/${shift.id}`, { isActive: true })
      if (!mutationCurrent()) return
      readShiftResult(response.data, { id: shift.id, isActive: true })
      toast.success(`${shift.name} activated.`)
      setReloadKey((value) => value + 1)
    } catch (error: unknown) {
      if (!mutationCurrent()) return
      const err = error as { response?: { data?: { message?: string } } }
      setActionError(err.response?.data?.message || 'Failed to activate shift.')
    } finally {
      mutationInFlight.current = false
      if (mounted.current) setActivatingId(null)
    }
  }

  const openCreateModal = () => {
    setEditingShift(null)
    setFormData(emptyForm())
    setFormError('')
    setShowCreateModal(true)
  }

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift)
    setFormData({
      name: shift.name,
      startMinute: shift.startMinute,
      endMinute: shift.endMinute,
      crossesMidnight: shift.crossesMidnight,
    })
    setFormError('')
    setShowCreateModal(true)
  }

  if (!sessionCurrent()) return <Layout><PageHeader eyebrow="Workforce" title="Shift Definitions" /><p role="alert" className="card p-lg">{SESSION_ERROR}</p></Layout>

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Shift Definitions"
        actions={canManage && (
          <button type="button" onClick={openCreateModal} className="btn-primary">
            <FaPlus className="mr-2" aria-hidden="true" /> Create Shift
          </button>
        )}
      />

      <FilterBar label="Shift filters">
        <SearchInput
          label="Search shifts"
          value={searchQuery}
          onChange={(value) => { setSearchQuery(value.slice(0, 100)); setPage(1) }}
          placeholder="Search by name…"
        />
        <label className="text-body-sm text-ink-muted" htmlFor="shift-active-filter">
          Status
          <select
            id="shift-active-filter"
            className="input mt-xs min-h-xxl text-body sm:text-body-sm"
            value={activeFilter}
            onChange={(event) => { setActiveFilter(event.target.value); setPage(1) }}
          >
            <option value="">All shifts</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </FilterBar>

      {actionError && !deactivatingShift && <p role="alert" className="text-body-sm text-error mb-4">{actionError}</p>}
      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : loadError ? (
        <div role="alert" className="card p-6">
          <p>{loadError}</p>
          <button type="button" className="btn-secondary mt-3" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>
        </div>
      ) : (
        <>
          {shifts.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Name</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Start</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">End</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Overnight</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Status</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Created</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift, index) => (
                      <tr
                        key={shift.id}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">{shift.name}</td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">{minutesToTime(shift.startMinute)}</td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">{minutesToTime(shift.endMinute)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={shift.crossesMidnight ? 'accent' : 'neutral'} mono>
                            {shift.crossesMidnight ? 'Yes' : 'No'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={shift.isActive ? 'success' : 'neutral'} mono>
                            {shift.isActive ? 'Active' : 'Inactive'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(shift.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {canManage && <button
                              type="button"
                              onClick={() => openEditModal(shift)}
                              className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              aria-label={`Edit ${shift.name}`}
                              title="Edit"
                            >
                              <FaEdit aria-hidden="true" />
                            </button>}
                            {canManage && (shift.isActive ? (
                              <button
                                type="button"
                                onClick={() => { setActionError(''); setDeactivatingShift(shift) }}
                                className="text-error font-mono text-body-sm hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                                aria-label={`Deactivate ${shift.name}`}
                                title="Deactivate"
                              >
                                <FaToggleOff aria-hidden="true" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleActivate(shift)}
                                disabled={activatingId === shift.id}
                                className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1 disabled:opacity-50"
                                aria-label={`Activate ${shift.name}`}
                              >
                                <FaToggleOn aria-hidden="true" />
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
           {shifts.length === 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                 <p className="text-ink-muted text-body-sm">{searchQuery || activeFilter ? 'No shifts match these filters.' : 'No shifts defined.'}</p>
                 <p className="text-caption text-ink-subtle mt-1">{searchQuery || activeFilter ? 'Change the search or status filter.' : 'Create a shift before assigning employees.'}</p>
              </div>
            </div>
          )}
        </>
      )}

       {!fetching && !loadError && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={totalRecords}
          pageSize={PAGE_SIZE}
          ariaLabel="Shifts pages"
        />
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <ModalShell
          open={true}
          onClose={() => { setShowCreateModal(false); setEditingShift(null); setFormError('') }}
          label={editingShift ? 'Edit Shift' : 'Create Shift'}
          maxWidth="md"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            {editingShift ? 'Edit' : 'New'}
          </p>

          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-6">
            {editingShift ? `Edit ${editingShift.name}` : 'Create Shift'}
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="shiftName">
                Name
              </label>
              <input
                id="shiftName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                placeholder="e.g., Morning Shift"
                maxLength={80}
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="startTime">
                  Start Time
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={minutesToTime(formData.startMinute)}
                  onChange={(e) => setFormData(prev => ({ ...prev, startMinute: timeToMinutes(e.target.value) }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="endTime">
                  End Time
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={minutesToTime(formData.endMinute)}
                  onChange={(e) => setFormData(prev => ({ ...prev, endMinute: timeToMinutes(e.target.value) }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.crossesMidnight}
                  onChange={(e) => setFormData(prev => ({ ...prev, crossesMidnight: e.target.checked }))}
                  className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome"
                  disabled={submitting}
                />
                <span className="text-chrome-ink text-sm font-sans">Crosses midnight (overnight shift)</span>
              </label>
            </div>

           {formError && (
              <p role="alert" className="text-chrome-error text-xs font-sans">{formError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowCreateModal(false); setEditingShift(null); setFormError('') }}
              disabled={submitting}
              className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn bg-brass-chrome text-ink px-4 py-2 rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {submitting ? 'Saving…' : (editingShift ? 'Update' : 'Create')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={!!deactivatingShift}
        onClose={() => { if (!deactivating) setDeactivatingShift(null) }}
        onConfirm={handleDeactivate}
        title="Deactivate Shift?"
        body={
          <>
            <p>You're about to deactivate <span className="font-medium">{deactivatingShift?.name}</span>.</p>
            <p className="mt-2">Historical attendance records will be preserved. The shift will no longer be available for new assignments.</p>
            {actionError && <p role="alert" className="text-chrome-error">{actionError}</p>}
          </>
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        danger
        eyebrow="Confirm"
        busy={deactivating}
        busyLabel="Deactivating…"
      />
    </Layout>
  )
}

export default ShiftManagement
