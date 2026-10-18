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
import { FaPlus, FaPenToSquare as FaEdit, FaCalendar, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa6'

const PAGE_SIZE = 10

interface Calendar {
  id: string
  name: string
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
  sunday: boolean
  timezone: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface CalendarException {
  id: string
  calendarId: string
  date: string
  kind: 'HOLIDAY' | 'WORKING_OVERRIDE'
  name: string
  createdAt: string
}

function CalendarSettings() {
  const user = getCurrentUser()

  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [exceptions, setExceptions] = useState<CalendarException[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null)
  const [showExceptions, setShowExceptions] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null)
  const [creatingException, setCreatingException] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    timezone: 'UTC',
    isDefault: false,
  })
  const [exceptionData, setExceptionData] = useState({
    date: new Date().toISOString().split('T')[0],
    kind: 'HOLIDAY' as 'HOLIDAY' | 'WORKING_OVERRIDE',
    name: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [deletingException, setDeletingException] = useState<CalendarException | null>(null)

  const fetchCalendars = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/business/calendars', { params })
      setCalendars(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load calendars.')
    } finally {
      setFetching(false)
    }
  }

  const fetchExceptions = async (calendarId: string) => {
    try {
      const res = await api.get(`/business/calendars/${calendarId}/exceptions`)
      setExceptions(res.data.data || [])
    } catch (_error) {
      toast.error('Failed to load calendar exceptions.')
    }
  }

  useEffect(() => {
    fetchCalendars(1)
  }, [searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchCalendars(newPage)
    }
  }

  const handleCalendarSubmit = async () => {
    setFormError('')
    if (!formData.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!isValidIANATimezone(formData.timezone)) {
      setFormError('Invalid IANA timezone.')
      return
    }

    setSubmitting(true)
    try {
      if (editingCalendar) {
        await api.patch(`/business/calendars/${editingCalendar.id}`, formData)
        toast.success('Calendar updated.')
      } else {
        await api.post('/business/calendars', formData)
        toast.success('Calendar created.')
      }
      setShowCreateModal(false)
      setEditingCalendar(null)
      resetForm()
      fetchCalendars(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      const msg = err.response?.data?.message || 'Failed to save calendar.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleExceptionSubmit = async () => {
    setFormError('')
    if (!exceptionData.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!exceptionData.date) {
      setFormError('Date is required.')
      return
    }

    setSubmitting(true)
    try {
      await api.post(`/business/calendars/${selectedCalendar?.id}/exceptions`, {
        date: exceptionData.date,
        kind: exceptionData.kind,
        name: exceptionData.name,
      })
      toast.success('Exception added.')
      setCreatingException(false)
      setExceptionData({ date: new Date().toISOString().split('T')[0], kind: 'HOLIDAY', name: '' })
      if (selectedCalendar) fetchExceptions(selectedCalendar.id)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      const msg = err.response?.data?.message || 'Failed to add exception.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      timezone: 'UTC',
      isDefault: false,
    })
  }

  const openCreateModal = () => {
    setEditingCalendar(null)
    resetForm()
    setFormError('')
    setShowCreateModal(true)
  }

  const openEditModal = (calendar: Calendar) => {
    setEditingCalendar(calendar)
    setFormData({
      name: calendar.name,
      monday: calendar.monday,
      tuesday: calendar.tuesday,
      wednesday: calendar.wednesday,
      thursday: calendar.thursday,
      friday: calendar.friday,
      saturday: calendar.saturday,
      sunday: calendar.sunday,
      timezone: calendar.timezone,
      isDefault: calendar.isDefault,
    })
    setFormError('')
    setShowCreateModal(true)
  }

  const openExceptionsView = (calendar: Calendar) => {
    setSelectedCalendar(calendar)
    setShowExceptions(true)
    fetchExceptions(calendar.id)
  }

  function isValidIANATimezone(tz: string): boolean {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz })
      return true
    } catch {
      return false
    }
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Calendar Settings"
        actions={
          <button onClick={openCreateModal} className="btn-primary">
            <FaPlus className="mr-2" /> Create Calendar
          </button>
        }
      />

      <FilterBar label="Calendar filters">
        <SearchInput
          label="Search calendars"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name…"
        />
      </FilterBar>

      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : (
        <>
          {calendars.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Name</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Working Days</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Timezone</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Default</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Exceptions</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Created</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendars.map((cal, index) => (
                      <tr
                        key={cal.id}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">{cal.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-1">
                            {dayKeys.map((key, i) => (
                              <span
                                key={key}
                                className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                                  cal[key] ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted'
                                }`}
                              >
                                {dayLabels[i]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">{cal.timezone}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={cal.isDefault ? 'accent' : 'neutral'} mono>
                            {cal.isDefault ? 'Yes' : 'No'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {exceptions.filter(e => e.calendarId === cal.id).length}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(cal.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(cal)}
                              className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              title="Edit"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => openExceptionsView(cal)}
                              className="text-ink-muted font-mono text-body-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              title="Exceptions"
                            >
                              <FaCalendar />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {calendars.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No calendars defined.</p>
                <p className="text-caption text-ink-subtle mt-1">Create a calendar to define working days and holidays.</p>
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
          ariaLabel="Calendars pages"
        />
      )}

      {/* Create/Edit Calendar Modal */}
      {showCreateModal && (
        <ModalShell
          open={true}
          onClose={() => { setShowCreateModal(false); setEditingCalendar(null); setFormError('') }}
          label={editingCalendar ? 'Edit Calendar' : 'Create Calendar'}
          maxWidth="md"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            {editingCalendar ? 'Edit' : 'New'}
          </p>

          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-6">
            {editingCalendar ? `Edit ${editingCalendar.name}` : 'Create Work Calendar'}
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="calName">
                Name
              </label>
              <input
                id="calName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                placeholder="e.g., Standard Work Week"
                maxLength={80}
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="timezone">
                Timezone (IANA)
              </label>
              <input
                id="timezone"
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                className={`w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent ${!isValidIANATimezone(formData.timezone) && formData.timezone ? 'border-error' : ''}`}
                placeholder="e.g., Africa/Accra, Europe/London"
                disabled={submitting}
              />
              {!isValidIANATimezone(formData.timezone) && formData.timezone && (
                <p className="text-chrome-error text-caption mt-1">Invalid IANA timezone</p>
              )}
            </div>

            <div>
              <p className="text-caption text-chrome-ink-muted mb-2 font-sans">Working Days</p>
              <div className="flex flex-wrap gap-2">
                {dayKeys.map((key, i) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                      formData[key]
                        ? 'bg-accent-soft border-accent-soft text-accent'
                        : 'bg-surface-2 border-hairline text-ink-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData[key]}
                      onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome"
                      disabled={submitting}
                    />
                    <span className="text-sm font-mono">{dayLabels[i]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome"
                  disabled={submitting}
                />
                <span className="text-chrome-ink text-sm font-sans">Set as default calendar</span>
              </label>
            </div>

            {formError && (
              <p className="text-chrome-error text-xs font-sans">{formError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowCreateModal(false); setEditingCalendar(null); setFormError('') }}
              disabled={submitting}
              className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCalendarSubmit}
              disabled={submitting}
              className="btn bg-brass-chrome text-ink px-4 py-2 rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {submitting ? 'Saving…' : (editingCalendar ? 'Update' : 'Create')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Exceptions Modal */}
      {showExceptions && selectedCalendar && (
        <ModalShell
          open={true}
          onClose={() => { setShowExceptions(false); setSelectedCalendar(null); setExceptions([]); }}
          label="Calendar Exceptions"
          maxWidth="lg"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            Exceptions
          </p>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-display-sm text-chrome-ink font-serif leading-tight">
              Exceptions for {selectedCalendar.name}
            </h2>
            <button
              onClick={() => setCreatingException(true)}
              className="btn-primary text-sm"
            >
              <FaPlus className="mr-1" /> Add Exception
            </button>
          </div>

          {creatingException ? (
            <div className="space-y-4 mb-6 p-4 bg-chrome-elevated border border-chrome-line rounded-lg">
              <h3 className="text-body font-medium text-chrome-ink">Add Exception</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="excDate">
                    Date
                  </label>
                  <input
                    id="excDate"
                    type="date"
                    value={exceptionData.date}
                    onChange={(e) => setExceptionData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3 bg-chrome border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="excKind">
                    Type
                  </label>
                  <select
                    id="excKind"
                    value={exceptionData.kind}
                    onChange={(e) => setExceptionData(prev => ({ ...prev, kind: e.target.value as 'HOLIDAY' | 'WORKING_OVERRIDE' }))}
                    className="w-full px-4 py-3 bg-chrome border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  >
                    <option value="HOLIDAY">Holiday (day off)</option>
                    <option value="WORKING_OVERRIDE">Working Override (work day)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="excName">
                    Name
                  </label>
                  <input
                    id="excName"
                    type="text"
                    value={exceptionData.name}
                    onChange={(e) => setExceptionData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-chrome border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                    placeholder="e.g., Independence Day"
                    maxLength={80}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setCreatingException(false); setExceptionData({ date: new Date().toISOString().split('T')[0], kind: 'HOLIDAY', name: '' }); }}
                  className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExceptionSubmit}
                  disabled={submitting}
                  className="btn bg-brass-chrome text-ink px-4 py-2 rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {submitting ? 'Adding…' : 'Add Exception'}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {exceptions.length === 0 ? (
                <p className="text-chrome-ink-muted text-body-sm text-center py-8">No exceptions defined.</p>
              ) : (
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Date</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Type</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Name</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((exc, index) => (
                      <tr
                        key={exc.id}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-chrome-elevated hover:bg-chrome' : 'hover:bg-chrome-elevated',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-chrome-ink-subtle">
                          {formatShortDate(exc.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={exc.kind === 'HOLIDAY' ? 'warning' : 'success'} mono>
                            {exc.kind === 'HOLIDAY' ? 'Holiday' : 'Working Day'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap text-chrome-ink">{exc.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setDeletingException(exc)}
                            className="text-error font-mono text-body-sm hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </ModalShell>
      )}

      {/* Delete Exception Confirm */}
      <ConfirmDialog
        open={!!deletingException}
        onClose={() => setDeletingException(null)}
        onConfirm={async () => {
          if (!deletingException || !selectedCalendar) return
          try {
            await api.delete(`/business/calendars/${selectedCalendar.id}/exceptions/${deletingException.id}`)
            toast.success('Exception deleted.')
            setDeletingException(null)
            fetchExceptions(selectedCalendar.id)
          } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } }
            toast.error(err.response?.data?.message || 'Failed to delete exception.')
          }
        }}
        title="Delete Exception?"
        body={
          <>
            <p>You're about to delete <span className="font-medium">{deletingException?.name}</span>.</p>
            <p className="mt-2">This action cannot be undone.</p>
          </>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        eyebrow="Confirm"
      />
    </Layout>
  )
}

export default CalendarSettings