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
import { FaPlus, FaPenToSquare as FaEdit, FaTrash, FaLocationDot as FaMapMarkerAlt, FaToggleOn, FaToggleOff } from 'react-icons/fa6'

const PAGE_SIZE = 10

interface Site {
  id: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

function Sites() {
  const user = getCurrentUser()

  const [sites, setSites] = useState<Site[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [deactivatingSite, setDeactivatingSite] = useState<Site | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    latitude: 0,
    longitude: 0,
    radiusMeters: 150,
    isActive: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchSites = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/sites', { params })
      setSites(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load sites.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchSites(1)
  }, [searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchSites(newPage)
    }
  }

  const handleSubmit = async () => {
    setFormError('')
    if (!formData.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (formData.latitude < -90 || formData.latitude > 90) {
      setFormError('Latitude must be between -90 and 90.')
      return
    }
    if (formData.longitude < -180 || formData.longitude > 180) {
      setFormError('Longitude must be between -180 and 180.')
      return
    }
    if (formData.radiusMeters < 25 || formData.radiusMeters > 1000) {
      setFormError('Radius must be between 25 and 1000 meters.')
      return
    }

    setSubmitting(true)
    try {
      if (editingSite) {
        await api.patch(`/sites/${editingSite.id}`, formData)
        toast.success('Site updated.')
      } else {
        await api.post('/sites', formData)
        toast.success('Site created.')
      }
      setShowCreateModal(false)
      setEditingSite(null)
      resetForm()
      fetchSites(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to save site.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivatingSite) return
    try {
      await api.post(`/sites/${deactivatingSite.id}/deactivate`)
      toast.success('Site deactivated.')
      setDeactivatingSite(null)
      fetchSites(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to deactivate site.'
      toast.error(msg)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      latitude: 0,
      longitude: 0,
      radiusMeters: 150,
      isActive: true,
    })
  }

  const openCreateModal = () => {
    setEditingSite(null)
    resetForm()
    setFormError('')
    setShowCreateModal(true)
  }

  const openEditModal = (site: Site) => {
    setEditingSite(site)
    setFormData({
      name: site.name,
      latitude: site.latitude,
      longitude: site.longitude,
      radiusMeters: site.radiusMeters,
      isActive: site.isActive,
    })
    setFormError('')
    setShowCreateModal(true)
  }

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Sites / Geo-fences"
        actions={
          <button onClick={openCreateModal} className="btn-primary">
            <FaPlus className="mr-2" /> Create Site
          </button>
        }
      />

      <FilterBar label="Site filters">
        <SearchInput
          label="Search sites"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name…"
        />
      </FilterBar>

      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : (
        <>
          {sites.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Name</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Coordinates</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Radius (m)</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Status</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Created</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site, index) => (
                      <tr
                        key={site.id}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">{site.name}</td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {site.radiusMeters}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={site.isActive ? 'success' : 'neutral'} mono>
                            {site.isActive ? 'Active' : 'Inactive'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(site.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(site)}
                              className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              title="Edit"
                            >
                              <FaEdit />
                            </button>
                            {site.isActive && (
                              <button
                                onClick={() => setDeactivatingSite(site)}
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
          {sites.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No sites defined.</p>
                <p className="text-caption text-ink-subtle mt-1">Create a site to enable geo-fenced attendance.</p>
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
          ariaLabel="Sites pages"
        />
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <ModalShell
          open={true}
          onClose={() => { setShowCreateModal(false); setEditingSite(null); setFormError('') }}
          label={editingSite ? 'Edit Site' : 'Create Site'}
          maxWidth="md"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            {editingSite ? 'Edit' : 'New'}
          </p>

          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-6">
            {editingSite ? `Edit ${editingSite.name}` : 'Create Site / Geo-fence'}
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="siteName">
                Name
              </label>
              <input
                id="siteName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                placeholder="e.g., Main Office"
                maxLength={80}
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="latitude">
                  Latitude
                </label>
                <input
                  id="latitude"
                  type="number"
                  step="0.000001"
                  min="-90"
                  max="90"
                  value={formData.latitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  placeholder="e.g., 5.6037"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="longitude">
                  Longitude
                </label>
                <input
                  id="longitude"
                  type="number"
                  step="0.000001"
                  min="-180"
                  max="180"
                  value={formData.longitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  placeholder="e.g., -0.1870"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="radiusMeters">
                Radius (meters)
              </label>
              <input
                id="radiusMeters"
                type="number"
                min="25"
                max="1000"
                value={formData.radiusMeters}
                onChange={(e) => setFormData(prev => ({ ...prev, radiusMeters: parseInt(e.target.value) || 25 }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                disabled={submitting}
              />
              <p className="text-caption text-chrome-ink-muted mt-1">Min 25m, Max 1000m</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome"
                  disabled={submitting}
                />
                <span className="text-chrome-ink text-sm font-sans">Active</span>
              </label>
            </div>

            {formError && (
              <p className="text-chrome-error text-xs font-sans">{formError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowCreateModal(false); setEditingSite(null); setFormError('') }}
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
              {submitting ? 'Saving…' : (editingSite ? 'Update' : 'Create')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={!!deactivatingSite}
        onClose={() => setDeactivatingSite(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Site?"
        body={
          <>
            <p>You're about to deactivate <span className="font-medium">{deactivatingSite?.name}</span>.</p>
            <p className="mt-2">The geo-fence will no longer be used for attendance validation. Historical records are preserved.</p>
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

export default Sites