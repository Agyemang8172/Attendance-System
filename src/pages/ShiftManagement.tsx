import { useState, useEffect } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import SearchInput from '../components/ui/SearchInput'
import Pagination from '../components/ui/Pagination'
import { BentoSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import Pill from '../components/ui/Pill'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ModalShell from '../components/ui/ModalShell'
import { formatTodayLong, formatShortDate } from '../lib/attendance-format'
import { FaPlus, FaPenToSquare as FaEdit, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa6'

const PAGE_SIZE = 10

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

function ShiftManagement() {
  const user = getCurrentUser()

  const [shifts, setShifts] = useState<Shift[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [deactivatingShift, setDeactivatingShift] = useState<Shift | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    startMinute: 360, // 6:00 AM
    endMinute: 840,   // 2:00 PM
    crossesMidnight: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchShifts = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/business/shifts', { params })
      setShifts(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load shifts.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchShifts(1)
  }, [searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchShifts(newPage)
    }
  }

  const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0')
    const m = (minutes % 60).toString().padStart(2, '0')
    return `${h}:${m}`
  }

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const handleSubmit = async () => {
    setFormError('')
    if (!formData.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (formData.startMinute === formData.endMinute && !formData.crossesMidnight) {
      setFormError('A same-day shift must have different start and end times.')
      return
    }

    setSubmitting(true)
    try {
      if (editingShift) {
        await api.patch(`/business/shifts/${editingShift.id}`, formData)
        toast.success('Shift updated.')
      } else {
        await api.post('/business/shifts', formData)
        toast.success('Shift created.')
      }
      setShowCreateModal(false)
      setEditingShift(null)
      setFormData({ name: '', startMinute: 360, endMinute: 840, crossesMidnight: false })
      fetchShifts(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to save shift.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivatingShift) return
    try {
      await api.post(`/business/shifts/${deactivatingShift.id}/deactivate`)
      toast.success('Shift deactivated.')
      setDeactivatingShift(null)
      fetchShifts(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to deactivate shift.'
      toast.error(msg)
    }
  }

  const openCreateModal = () => {
    setEditingShift(null)
    setFormData({ name: '', startMinute: 360, endMinute: 840, crossesMidnight: false })
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

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Shift Definitions"
        actions={
          <button onClick={openCreateModal} className="btn-primary">
            <FaPlus className="mr-2" /> Create Shift
          </button>
        }
      />

      <FilterBar label="Shift filters">
        <SearchInput
          label="Search shifts"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name…"
        />
      </FilterBar>

      {fetching ? (
        <TableSkeleton showEmployee={false} />
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
                            <button
                              onClick={() => openEditModal(shift)}
                              className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              title="Edit"
                            >
                              <FaEdit />
                            </button>
                            {shift.isActive && (
                              <button
                                onClick={() => setDeactivatingShift(shift)}
                                className="text-error font-mono text-body-sm hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                                title="Deactivate"
                              >
                                <FaTrash />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {shifts.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No shifts defined.</p>
                <p className="text-caption text-ink-subtle mt-1">Create a shift to get started.</p>
              </div>
            </div>
          )}
        </>
      )}

      {!fetching && totalPages > 1 && (
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
              <p className="text-chrome-error text-xs font-sans">{formError}</p>
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
        onClose={() => setDeactivatingShift(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Shift?"
        body={
          <>
            <p>You're about to deactivate <span className="font-medium">{deactivatingShift?.name}</span>.</p>
            <p className="mt-2">Historical attendance records will be preserved. The shift will no longer be available for new assignments.</p>
          </>
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        danger
        eyebrow="Confirm"
      />
    </Layout>
  )
}

export default ShiftManagement