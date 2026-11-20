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
import { FaPlus, FaPenToSquare as FaEdit, FaTrash, FaUser, FaCalendar } from 'react-icons/fa6'

const PAGE_SIZE = 10

interface Assignment {
  id: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
  }
  shift: {
    id: string
    name: string
  }
  effectiveFrom: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
}

interface Shift {
  id: string
  name: string
}

function Scheduling() {
  const user = getCurrentUser()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [deactivatingAssignment, setDeactivatingAssignment] = useState<Assignment | null>(null)

  const [formData, setFormData] = useState({
    employeeId: '',
    shiftId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchData = async (targetPage = 1) => {
    setFetching(true)
    try {
      const [assignmentsRes, employeesRes, shiftsRes] = await Promise.all([
        api.get('/business/assignments', {
          params: { page: targetPage, limit: PAGE_SIZE, search: searchQuery }
        }),
        api.get('/hr/employees', { params: { limit: 1000, isActive: 'true' } }),
        api.get('/business/shifts', { params: { isActive: 'true', limit: 1000 } }),
      ])
      setAssignments(assignmentsRes.data.data || [])
      setEmployees(employeesRes.data.data || [])
      setShifts(shiftsRes.data.data || [])

      const pag = assignmentsRes.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load scheduling data.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchData(1)
  }, [searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchData(newPage)
    }
  }

  const handleSubmit = async () => {
    setFormError('')
    if (!formData.employeeId || !formData.shiftId || !formData.effectiveFrom) {
      setFormError('All fields are required.')
      return
    }

    setSubmitting(true)
    try {
      if (editingAssignment) {
        // For editing, we deactivate old and create new (no direct update endpoint)
        await api.post('/business/shifts/' + formData.shiftId + '/assignments', {
          employeeId: formData.employeeId,
          effectiveFrom: formData.effectiveFrom + 'T00:00:00.000Z',
        })
        toast.success('Assignment updated.')
      } else {
        await api.post('/business/shifts/' + formData.shiftId + '/assignments', {
          employeeId: formData.employeeId,
          effectiveFrom: formData.effectiveFrom + 'T00:00:00.000Z',
        })
        toast.success('Assignment created.')
      }
      setShowCreateModal(false)
      setEditingAssignment(null)
      setFormData({ employeeId: '', shiftId: '', effectiveFrom: new Date().toISOString().split('T')[0] })
      fetchData(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to save assignment.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivatingAssignment) return
    try {
      await api.delete(`/business/assignments/${deactivatingAssignment.id}`)
      toast.success('Assignment deactivated.')
      setDeactivatingAssignment(null)
      fetchData(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to deactivate assignment.'
      toast.error(msg)
    }
  }

  const openCreateModal = () => {
    setEditingAssignment(null)
    setFormData({ employeeId: '', shiftId: '', effectiveFrom: new Date().toISOString().split('T')[0] })
    setFormError('')
    setShowCreateModal(true)
  }

  const openEditModal = (assignment: Assignment) => {
    setEditingAssignment(assignment)
    setFormData({
      employeeId: assignment.employee.id,
      shiftId: assignment.shift.id,
      effectiveFrom: assignment.effectiveFrom.split('T')[0],
    })
    setFormError('')
    setShowCreateModal(true)
  }

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Scheduling"
        actions={
          <button onClick={openCreateModal} className="btn-primary">
            <FaPlus className="mr-2" /> Assign Shift
          </button>
        }
      />

      <FilterBar label="Assignment filters">
        <SearchInput
          label="Search assignments"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by employee name…"
        />
      </FilterBar>

      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : (
        <>
          {assignments.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Employee</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Shift</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Effective From</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Status</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Created</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment, index) => (
                      <tr
                        key={assignment.id}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                          {assignment.employee.firstName} {assignment.employee.lastName}
                          <span className="text-ink-tertiary mx-1">·</span>
                          <span className="font-mono text-ink-subtle">{assignment.employee.employeeCode}</span>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                          {assignment.shift.name}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(assignment.effectiveFrom)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={assignment.isActive ? 'success' : 'neutral'} mono>
                            {assignment.isActive ? 'Active' : 'Inactive'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(assignment.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(assignment)}
                              className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              title="Edit"
                            >
                              <FaEdit />
                            </button>
                            {assignment.isActive && (
                              <button
                                onClick={() => setDeactivatingAssignment(assignment)}
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
          {assignments.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No shift assignments.</p>
                <p className="text-caption text-ink-subtle mt-1">Assign employees to shifts to create the schedule.</p>
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
          ariaLabel="Assignments pages"
        />
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <ModalShell
          open={true}
          onClose={() => { setShowCreateModal(false); setEditingAssignment(null); setFormError('') }}
          label={editingAssignment ? 'Edit Assignment' : 'Create Assignment'}
          maxWidth="md"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            {editingAssignment ? 'Edit' : 'New'}
          </p>

          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-6">
            {editingAssignment ? 'Edit Assignment' : 'Create Shift Assignment'}
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="employeeSelect">
                Employee
              </label>
              <select
                id="employeeSelect"
                value={formData.employeeId}
                onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                disabled={submitting}
              >
                <option value="">Select employee…</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="shiftSelect">
                Shift
              </label>
              <select
                id="shiftSelect"
                value={formData.shiftId}
                onChange={(e) => setFormData(prev => ({ ...prev, shiftId: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                disabled={submitting}
              >
                <option value="">Select shift…</option>
                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="effectiveFrom">
                Effective From
              </label>
              <input
                id="effectiveFrom"
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                disabled={submitting}
              />
            </div>

            {formError && (
              <p className="text-chrome-error text-xs font-sans">{formError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowCreateModal(false); setEditingAssignment(null); setFormError('') }}
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
              {submitting ? 'Saving…' : (editingAssignment ? 'Update' : 'Create')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={!!deactivatingAssignment}
        onClose={() => setDeactivatingAssignment(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Assignment?"
        body={
          <>
            <p>You're about to deactivate the assignment for <span className="font-medium">{deactivatingAssignment?.employee.firstName} {deactivatingAssignment?.employee.lastName}</span>.</p>
            <p className="mt-2">This will end their shift assignment from today forward. Historical records are preserved.</p>
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

export default Scheduling