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
import { FaPlus, FaPenToSquare as FaEdit, FaClock, FaCalendar } from 'react-icons/fa6'

const PAGE_SIZE = 10

interface Policy {
  id: string
  name: string
  shiftId?: string
  shiftName?: string
  graceEarlyMinutes: number
  graceLateMinutes: number
  earlyThresholdMinutes: number
  autoClockOutEnabled: boolean
  autoClockOutBufferMinutes: number
  autoClockOutMaxOpenMinutes: number
  correctionWindowDays: number
  geoFenceRadiusMeters: number
  locationAccuracyThresholdMeters: number
  gpsFreshnessSeconds: number
  observePublicHolidays: boolean
  effectiveFrom: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface PolicyVersion {
  id: string
  policyId: string
  version: number
  graceEarlyMinutes: number
  graceLateMinutes: number
  earlyThresholdMinutes: number
  autoClockOutEnabled: boolean
  autoClockOutBufferMinutes: number
  autoClockOutMaxOpenMinutes: number
  correctionWindowDays: number
  geoFenceRadiusMeters: number
  locationAccuracyThresholdMeters: number
  gpsFreshnessSeconds: number
  observePublicHolidays: boolean
  effectiveFrom: string
  createdAt: string
}

function Policies() {
  const user = getCurrentUser()

  const [policies, setPolicies] = useState<Policy[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [viewingVersions, setViewingVersions] = useState<Policy | null>(null)
  const [versions, setVersions] = useState<PolicyVersion[]>([])

  const [formData, setFormData] = useState({
    name: '',
    shiftId: '',
    graceEarlyMinutes: 0,
    graceLateMinutes: 5,
    earlyThresholdMinutes: 0,
    autoClockOutEnabled: false,
    autoClockOutBufferMinutes: 15,
    autoClockOutMaxOpenMinutes: 480,
    correctionWindowDays: 3,
    geoFenceRadiusMeters: 150,
    locationAccuracyThresholdMeters: 50,
    gpsFreshnessSeconds: 60,
    observePublicHolidays: true,
    effectiveFrom: new Date().toISOString().split('T')[0],
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchPolicies = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/business/policies', { params })
      setPolicies(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load policies.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchPolicies(1)
  }, [searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchPolicies(newPage)
    }
  }

  const fetchVersions = async (policyId: string) => {
    try {
      const res = await api.get(`/business/policies/${policyId}/versions`)
      setVersions(res.data.data || [])
    } catch (_error) {
      toast.error('Failed to load policy versions.')
    }
  }

  const handleSubmit = async () => {
    setFormError('')
    if (!formData.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!formData.effectiveFrom) {
      setFormError('Effective date is required.')
      return
    }

    setSubmitting(true)
    try {
      if (editingPolicy) {
        // Create new version for existing policy
        const { name, shiftId, effectiveFrom, ...versionData } = formData
        await api.post(`/business/policies/${editingPolicy.id}/versions`, {
          ...versionData,
          effectiveFrom: effectiveFrom + 'T00:00:00.000Z',
        })
        toast.success('Policy version created.')
      } else {
        await api.post('/business/policies', {
          ...formData,
          effectiveFrom: formData.effectiveFrom + 'T00:00:00.000Z',
        })
        toast.success('Policy created.')
      }
      setShowCreateModal(false)
      setEditingPolicy(null)
      resetForm()
      fetchPolicies(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to save policy.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      shiftId: '',
      graceEarlyMinutes: 0,
      graceLateMinutes: 5,
      earlyThresholdMinutes: 0,
      autoClockOutEnabled: false,
      autoClockOutBufferMinutes: 15,
      autoClockOutMaxOpenMinutes: 480,
      correctionWindowDays: 3,
      geoFenceRadiusMeters: 150,
      locationAccuracyThresholdMeters: 50,
      gpsFreshnessSeconds: 60,
      observePublicHolidays: true,
      effectiveFrom: new Date().toISOString().split('T')[0],
    })
  }

  const openCreateModal = () => {
    setEditingPolicy(null)
    resetForm()
    setFormError('')
    setShowCreateModal(true)
  }

  const openEditModal = (policy: Policy) => {
    setEditingPolicy(policy)
    setFormData({
      name: policy.name,
      shiftId: policy.shiftId || '',
      graceEarlyMinutes: policy.graceEarlyMinutes,
      graceLateMinutes: policy.graceLateMinutes,
      earlyThresholdMinutes: policy.earlyThresholdMinutes,
      autoClockOutEnabled: policy.autoClockOutEnabled,
      autoClockOutBufferMinutes: policy.autoClockOutBufferMinutes,
      autoClockOutMaxOpenMinutes: policy.autoClockOutMaxOpenMinutes,
      correctionWindowDays: policy.correctionWindowDays,
      geoFenceRadiusMeters: policy.geoFenceRadiusMeters,
      locationAccuracyThresholdMeters: policy.locationAccuracyThresholdMeters,
      gpsFreshnessSeconds: policy.gpsFreshnessSeconds,
      observePublicHolidays: policy.observePublicHolidays,
      effectiveFrom: policy.effectiveFrom.split('T')[0],
    })
    setFormError('')
    setShowCreateModal(true)
  }

  const openVersionsModal = (policy: Policy) => {
    setViewingVersions(policy)
    fetchVersions(policy.id)
  }

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Attendance Policies"
        actions={
          <button onClick={openCreateModal} className="btn-primary">
            <FaPlus className="mr-2" /> Create Policy
          </button>
        }
      />

      <FilterBar label="Policy filters">
        <SearchInput
          label="Search policies"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name…"
        />
      </FilterBar>

      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : (
        <>
          {policies.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Name</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Shift</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Grace (Early/Late)</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Auto Clock-Out</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Correction Window</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Effective From</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Status</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((policy, index) => (
                      <tr
                        key={policy.id}
                        className={[
                          'border-b border-hairline last:border-b-0 transition-colors duration-150',
                          index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">{policy.name}</td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink-subtle">
                          {policy.shiftName || '—'}
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {policy.graceEarlyMinutes}m / {policy.graceLateMinutes}m
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={policy.autoClockOutEnabled ? 'success' : 'neutral'} mono>
                            {policy.autoClockOutEnabled ? 'Enabled' : 'Disabled'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {policy.correctionWindowDays} days
                        </td>
                        <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                          {formatShortDate(policy.effectiveFrom)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={policy.isActive ? 'success' : 'neutral'} mono>
                            {policy.isActive ? 'Active' : 'Inactive'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(policy)}
                              className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              title="New Version"
                            >
                              <FaEdit /> Version
                            </button>
                            <button
                              onClick={() => openVersionsModal(policy)}
                              className="text-ink-muted font-mono text-body-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                              title="View Versions"
                            >
                              <FaClock /> History
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
          {policies.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No attendance policies defined.</p>
                <p className="text-caption text-ink-subtle mt-1">Create a policy to configure grace periods, auto clock-out, and more.</p>
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
          ariaLabel="Policies pages"
        />
      )}

      {/* Create/Edit Policy Modal */}
      {showCreateModal && (
        <ModalShell
          open={true}
          onClose={() => { setShowCreateModal(false); setEditingPolicy(null); setFormError('') }}
          label={editingPolicy ? 'New Version' : 'Create Policy'}
          maxWidth="lg"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            {editingPolicy ? 'New Version' : 'New'}
          </p>

          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-6">
            {editingPolicy ? `New Version for ${editingPolicy.name}` : 'Create Attendance Policy'}
          </h2>

          <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="policyName">
                Policy Name
              </label>
              <input
                id="policyName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                placeholder="e.g., Standard Office Policy"
                maxLength={80}
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="shiftId">
                Associated Shift (optional)
              </label>
              <select
                id="shiftId"
                value={formData.shiftId}
                onChange={(e) => setFormData(prev => ({ ...prev, shiftId: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                disabled={submitting}
              >
                <option value="">None (global policy)</option>
                {/* Shifts would be loaded here - placeholder */}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="graceEarly">
                  Grace Early (minutes)
                </label>
                <input
                  id="graceEarly"
                  type="number"
                  min="0"
                  max="120"
                  value={formData.graceEarlyMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, graceEarlyMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="graceLate">
                  Grace Late (minutes)
                </label>
                <input
                  id="graceLate"
                  type="number"
                  min="0"
                  max="120"
                  value={formData.graceLateMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, graceLateMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="earlyThreshold">
                  Early Threshold (minutes)
                </label>
                <input
                  id="earlyThreshold"
                  type="number"
                  min="0"
                  max="120"
                  value={formData.earlyThresholdMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, earlyThresholdMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoClockOutEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoClockOutEnabled: e.target.checked }))}
                    className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome"
                    disabled={submitting}
                  />
                  <span className="text-chrome-ink text-sm font-sans">Enable Auto Clock-Out</span>
                </label>
              </div>
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="autoBuffer">
                  Buffer (minutes)
                </label>
                <input
                  id="autoBuffer"
                  type="number"
                  min="0"
                  max="720"
                  value={formData.autoClockOutBufferMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoClockOutBufferMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="autoMaxOpen">
                  Max Open (minutes)
                </label>
                <input
                  id="autoMaxOpen"
                  type="number"
                  min="60"
                  max="1440"
                  value={formData.autoClockOutMaxOpenMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoClockOutMaxOpenMinutes: parseInt(e.target.value) || 60 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="correctionWindow">
                  Correction Window (days)
                </label>
                <input
                  id="correctionWindow"
                  type="number"
                  min="1"
                  max="7"
                  value={formData.correctionWindowDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, correctionWindowDays: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="geoFence">
                  Geo-fence Radius (meters)
                </label>
                <input
                  id="geoFence"
                  type="number"
                  min="25"
                  max="1000"
                  value={formData.geoFenceRadiusMeters}
                  onChange={(e) => setFormData(prev => ({ ...prev, geoFenceRadiusMeters: parseInt(e.target.value) || 25 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="locationAccuracy">
                  Location Accuracy (meters)
                </label>
                <input
                  id="locationAccuracy"
                  type="number"
                  min="10"
                  max="500"
                  value={formData.locationAccuracyThresholdMeters}
                  onChange={(e) => setFormData(prev => ({ ...prev, locationAccuracyThresholdMeters: parseInt(e.target.value) || 10 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="gpsFreshness">
                  GPS Freshness (seconds)
                </label>
                <input
                  id="gpsFreshness"
                  type="number"
                  min="10"
                  max="600"
                  value={formData.gpsFreshnessSeconds}
                  onChange={(e) => setFormData(prev => ({ ...prev, gpsFreshnessSeconds: parseInt(e.target.value) || 10 }))}
                  className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                  disabled={submitting}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.observePublicHolidays}
                    onChange={(e) => setFormData(prev => ({ ...prev, observePublicHolidays: e.target.checked }))}
                    className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome"
                    disabled={submitting}
                  />
                  <span className="text-chrome-ink text-sm font-sans">Observe Public Holidays</span>
                </label>
              </div>
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
              onClick={() => { setShowCreateModal(false); setEditingPolicy(null); setFormError('') }}
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
              {submitting ? 'Saving…' : (editingPolicy ? 'Create Version' : 'Create Policy')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Versions Modal */}
      {viewingVersions && (
        <ModalShell
          open={true}
          onClose={() => setViewingVersions(null)}
          label="Policy Versions"
          maxWidth="lg"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            History
          </p>

          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-4">
            Versions for {viewingVersions.name}
          </h2>

          {versions.length === 0 ? (
            <p className="text-chrome-ink-muted text-body-sm text-center py-8">No versions found.</p>
          ) : (
            <div className="overflow-x-auto max-h-[50vh]">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Version</th>
                    <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Effective From</th>
                    <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Grace (E/L)</th>
                    <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Auto Clock-Out</th>
                    <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Correction Window</th>
                    <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-chrome-ink-muted whitespace-nowrap bg-chrome-elevated">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((version, index) => (
                    <tr
                      key={version.id}
                      className={[
                        'border-b border-hairline last:border-b-0 transition-colors duration-150',
                        index % 2 === 1 ? 'bg-chrome-elevated hover:bg-chrome' : 'hover:bg-chrome-elevated',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-chrome-ink">v{version.version}</td>
                      <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-chrome-ink-subtle">
                        {formatShortDate(version.effectiveFrom)}
                      </td>
                      <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-chrome-ink-subtle">
                        {version.graceEarlyMinutes}m / {version.graceLateMinutes}m
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Pill tone={version.autoClockOutEnabled ? 'success' : 'neutral'} mono>
                          {version.autoClockOutEnabled ? 'Enabled' : 'Disabled'}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-chrome-ink-subtle">
                        {version.correctionWindowDays} days
                      </td>
                      <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-chrome-ink-subtle">
                        {formatShortDate(version.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalShell>
      )}
    </Layout>
  )
}

export default Policies