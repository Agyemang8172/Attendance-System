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
import { formatTodayLong, formatShortDate, formatTimeOfDay } from '../lib/attendance-format'
import { FaPlus, FaKey, FaTrash, FaArrowsRotate as FaRefreshCw, FaWifi, FaWifi as FaWifiSlash } from 'react-icons/fa6'

const PAGE_SIZE = 10

interface Device {
  id: string
  label: string
  siteId?: string
  siteName?: string
  state: 'PENDING_PAIRING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  pairingCode?: string
  pairingCodeExpiresAt?: string
  pairedAt?: string
  lastSeen?: string
  createdAt: string
  updatedAt: string
}

function Devices() {
  const user = getCurrentUser()

  const [devices, setDevices] = useState<Device[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  // Two modals share this lane: the form (open first) and the result that
  // replaces it once the code exists. M9-B6: the form used to render with
  // open={false} behind the same flag as the result, so the header button
  // could never reach it and no pairing code could be generated at all.
  const [showPairingForm, setShowPairingForm] = useState(false)
  const [showPairingModal, setShowPairingModal] = useState(false)
  const [newPairingCode, setNewPairingCode] = useState('')
  const [pairingCodeExpires, setPairingCodeExpires] = useState('')
  const [revokingDevice, setRevokingDevice] = useState<Device | null>(null)

  const [pairingForm, setPairingForm] = useState({
    label: '',
    siteId: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchDevices = async (targetPage = 1) => {
    setFetching(true)
    try {
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }
      if (searchQuery) params.search = searchQuery

      const res = await api.get('/kiosk/devices', { params })
      setDevices(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error('Failed to load devices.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchDevices(1)
  }, [searchQuery])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchDevices(newPage)
    }
  }

  const handleCreatePairingCode = async () => {
    setFormError('')
    if (!pairingForm.label.trim()) {
      setFormError('Label is required.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/kiosk/pairing-codes', pairingForm)
      setNewPairingCode(res.data.data.pairingCode)
      setPairingCodeExpires(res.data.data.expiresAt)
      setShowPairingForm(false)
      setShowPairingModal(true)
      setPairingForm({ label: '', siteId: '' })
      fetchDevices(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      const msg = err.response?.data?.message || 'Failed to create pairing code.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokingDevice) return
    try {
      await api.post(`/kiosk/devices/${revokingDevice.id}/revoke`)
      toast.success('Device revoked.')
      setRevokingDevice(null)
      fetchDevices(page)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      const msg = err.response?.data?.message || 'Failed to revoke device.'
      toast.error(msg)
    }
  }

  const stateConfig = {
    PENDING_PAIRING: { tone: 'warning' as const, label: 'Pending Pairing', icon: <FaWifiSlash /> },
    ACTIVE: { tone: 'success' as const, label: 'Active', icon: <FaWifi /> },
    REVOKED: { tone: 'error' as const, label: 'Revoked', icon: <FaWifiSlash /> },
    EXPIRED: { tone: 'neutral' as const, label: 'Expired', icon: <FaWifiSlash /> },
  }

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Kiosk Devices"
        actions={
          <button onClick={() => setShowPairingForm(true)} className="btn-primary">
            <FaPlus className="mr-2" /> Generate Pairing Code
          </button>
        }
      />

      <FilterBar label="Device filters">
        <SearchInput
          label="Search devices"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by label, site…"
        />
      </FilterBar>

      {fetching ? (
        <TableSkeleton showEmployee={false} />
      ) : (
        <>
          {devices.length > 0 && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Label</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Site</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">State</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Paired At</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Last Seen</th>
                      <th className="sticky top-0 z-10 px-4 py-3 text-left text-caption font-medium text-ink-muted whitespace-nowrap bg-surface-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device, index) => {
                      const config = stateConfig[device.state]
                      return (
                        <tr
                          key={device.id}
                          className={[
                            'border-b border-hairline last:border-b-0 transition-colors duration-150',
                            index % 2 === 1 ? 'bg-surface-2 hover:bg-surface-3' : 'hover:bg-surface-2',
                          ].join(' ')}
                        >
                          <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">{device.label}</td>
                          <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink-subtle">
                            {device.siteName || '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Pill tone={config.tone} mono>
                              {config.icon} {config.label}
                            </Pill>
                          </td>
                          <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                            {device.pairedAt ? formatShortDate(device.pairedAt) + ' ' + formatTimeOfDay(device.pairedAt) : '—'}
                          </td>
                          <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                            {device.lastSeen ? formatShortDate(device.lastSeen) + ' ' + formatTimeOfDay(device.lastSeen) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {device.state === 'PENDING_PAIRING' && (
                                <>
                                  <span className="text-caption text-ink-muted">Pairing code:</span>
                                  <code className="bg-surface-2 px-2 py-1 rounded font-mono text-xs text-ink">
                                    {device.pairingCode}
                                  </code>
                                  <span className="text-caption text-ink-muted">
                                    (expires {device.pairingCodeExpiresAt ? formatShortDate(device.pairingCodeExpiresAt) + ' ' + formatTimeOfDay(device.pairingCodeExpiresAt) : '—'})
                                  </span>
                                </>
                              )}
                              {device.state === 'ACTIVE' && (
                                <button
                                  onClick={() => setRevokingDevice(device)}
                                  className="text-error font-mono text-body-sm hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                                  title="Revoke"
                                >
                                  <FaTrash />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {devices.length === 0 && !searchQuery && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No kiosk devices registered.</p>
                <p className="text-caption text-ink-subtle mt-1">Generate a pairing code to register a new device.</p>
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
          ariaLabel="Devices pages"
        />
      )}

      {/* Pairing Code Modal */}
      {showPairingModal && newPairingCode && (
        <ModalShell
          open={true}
          onClose={() => { setShowPairingModal(false); setNewPairingCode(''); setPairingCodeExpires(''); }}
          label="Pairing Code Generated"
          maxWidth="md"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            Success
          </p>

          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-3">
            Pairing Code Created
          </h2>

          <p className="text-chrome-ink-muted text-sm font-sans mb-6">
            Enter this code on the kiosk device to pair it. The code expires in 10 minutes.
          </p>

          <div className="mb-6 p-4 bg-chrome-elevated border border-chrome-line rounded-lg text-center">
            <p className="text-caption text-chrome-ink-muted mb-1">Pairing Code</p>
            <code className="text-3xl font-mono text-chrome-ink tracking-widest break-all">
              {newPairingCode}
            </code>
            <p className="text-caption text-chrome-ink-muted mt-2">
              Expires: {pairingCodeExpires ? formatShortDate(pairingCodeExpires) + ' ' + formatTimeOfDay(pairingCodeExpires) : '—'}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => { setShowPairingModal(false); setNewPairingCode(''); setPairingCodeExpires(''); }}
              className="btn bg-brass-chrome text-ink px-4 py-2 rounded-md transition-all duration-150"
            >
              Done
            </button>
          </div>
        </ModalShell>
      )}

      {/* Generate Pairing Code Form Modal */}
      {showPairingForm && (
        <ModalShell
          open={true}
          onClose={() => {
            setShowPairingForm(false)
            setPairingForm({ label: '', siteId: '' })
            setFormError('')
          }}
          label="Generate Pairing Code"
          maxWidth="md"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-brass-chrome opacity-70 mb-3">
            New
          </p>

          <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-6">
            Generate Pairing Code
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="deviceLabel">
                Device Label
              </label>
              <input
                id="deviceLabel"
                type="text"
                value={pairingForm.label}
                onChange={(e) => setPairingForm(prev => ({ ...prev, label: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink placeholder-chrome-ink-subtle font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                placeholder="e.g., Reception Kiosk"
                maxLength={80}
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-caption text-chrome-ink-muted mb-1 font-sans" htmlFor="siteId">
                Site (optional)
              </label>
              <select
                id="siteId"
                value={pairingForm.siteId}
                onChange={(e) => setPairingForm(prev => ({ ...prev, siteId: e.target.value }))}
                className="w-full px-4 py-3 bg-chrome-elevated border border-chrome-line rounded-lg text-sm text-chrome-ink font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:border-transparent"
                disabled={submitting}
              >
                <option value="">No site assigned</option>
                {/* Sites would be loaded here - placeholder */}
              </select>
            </div>

            {formError && (
              <p className="text-chrome-error text-xs font-sans">{formError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowPairingForm(false); setPairingForm({ label: '', siteId: '' }); setFormError(''); }}
              disabled={submitting}
              className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-sm font-sans disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePairingCode}
              disabled={submitting}
              className="btn bg-brass-chrome text-ink px-4 py-2 rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {submitting ? 'Generating…' : 'Generate Code'}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Revoke Confirm */}
      <ConfirmDialog
        open={!!revokingDevice}
        onClose={() => setRevokingDevice(null)}
        onConfirm={handleRevoke}
        title="Revoke Device?"
        body={
          <>
            <p>You're about to revoke <span className="font-medium">{revokingDevice?.label}</span>.</p>
            <p className="mt-2">The device will no longer be able to record attendance. This action cannot be undone.</p>
          </>
        }
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        danger
        eyebrow="Confirm"
      />
    </Layout>
  )
}

export default Devices