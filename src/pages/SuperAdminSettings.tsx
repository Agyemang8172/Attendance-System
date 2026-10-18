import { useState, useEffect } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import { formatTodayLong } from '../lib/attendance-format'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { FaFloppyDisk as FaSave, FaRotateLeft as FaUndo } from 'react-icons/fa6'

// ─── SuperAdminSettings ──────────────────────────────────────────────────────
// GET/PATCH /api/business/settings — name, timezone, branding, retention knobs
// retentionEnabled=true refused with O10 message (400)
// IANA tz validation; audit settings.updated with before/after

interface BusinessSettings {
  name: string
  timezone: string
  logoUrl?: string
  brandColor?: string
  supportEmail?: string
  supportPhone?: string
  retentionYears: number
  retentionEnabled?: boolean
  attendanceRetentionDays?: number
  auditRetentionDays?: number
}

function SuperAdminSettings() {
  const user = getCurrentUser()

  const [settings, setSettings] = useState<BusinessSettings>({
    name: '',
    timezone: '',
    logoUrl: '',
    brandColor: '',
    supportEmail: '',
    supportPhone: '',
    retentionYears: 7,
    retentionEnabled: false,
    attendanceRetentionDays: undefined,
    auditRetentionDays: undefined,
  })
  const [originalSettings, setOriginalSettings] = useState<BusinessSettings | null>(null)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/business/settings')
        const data = res.data.data
        setSettings({
          name: data.name || '',
          timezone: data.timezone || 'UTC',
          logoUrl: data.logoUrl || '',
          brandColor: data.brandColor || '',
          supportEmail: data.supportEmail || '',
          supportPhone: data.supportPhone || '',
          retentionYears: data.retentionYears || 7,
          retentionEnabled: data.retentionEnabled || false,
          attendanceRetentionDays: data.attendanceRetentionDays,
          auditRetentionDays: data.auditRetentionDays,
        })
        setOriginalSettings({ ...settings })
      } catch (_error) {
        toast.error('Failed to load settings.')
      } finally {
        setFetching(false)
      }
    }
    fetchSettings()
  }, [])

  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const hasChanges = () => {
    if (!originalSettings) return false
    return Object.keys(settings).some(key => settings[key as keyof BusinessSettings] !== originalSettings[key as keyof BusinessSettings])
  }

  const handleSave = async () => {
    if (!hasChanges()) {
      toast.success('No changes to save.')
      return
    }
    setShowConfirm(true)
  }

  const handleConfirmSave = async () => {
    setSaving(true)
    try {
      const payload = { ...settings }
      // Don't send retentionEnabled if true (O10 blocks it)
      if (payload.retentionEnabled === true) {
        delete payload.retentionEnabled
      }
      await api.patch('/business/settings', payload)
      toast.success('Settings saved.')
      setOriginalSettings({ ...settings })
      setShowConfirm(false)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }; const msg = err.response?.data?.message || 'Failed to save settings.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings })
    }
  }

  const timezoneError = !!settings.timezone && !isValidIANATimezone(settings.timezone)

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Business Settings"
      />

      {fetching ? (
        <div className="card flex items-center justify-center h-64">
          <p className="text-ink-muted text-sm font-sans animate-pulse">Loading settings…</p>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* Business Profile */}
          <SectionHeader title="Business Profile" />
          <div className="card-elevated relative overflow-hidden p-6 mb-6">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="name">Business Name</label>
                <input
                  id="name"
                  type="text"
                  value={settings.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="timezone">Timezone (IANA)</label>
                <input
                  id="timezone"
                  type="text"
                  value={settings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className={`input ${timezoneError ? 'border-error' : ''}`}
                  placeholder="e.g., Africa/Accra, Europe/London"
                  required
                />
                {timezoneError && (
                  <p className="text-error text-caption mt-1">Invalid IANA timezone</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="logoUrl">Logo URL</label>
                <input
                  id="logoUrl"
                  type="url"
                  value={settings.logoUrl}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  className="input"
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="brandColor">Brand Color (Hex)</label>
                <input
                  id="brandColor"
                  type="color"
                  value={settings.brandColor || '#b45309'}
                  onChange={(e) => handleChange('brandColor', e.target.value)}
                  className="input h-10 p-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="supportEmail">Support Email</label>
                <input
                  id="supportEmail"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => handleChange('supportEmail', e.target.value)}
                  className="input"
                  placeholder="support@example.com"
                />
              </div>
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="supportPhone">Support Phone</label>
                <input
                  id="supportPhone"
                  type="tel"
                  value={settings.supportPhone}
                  onChange={(e) => handleChange('supportPhone', e.target.value)}
                  className="input"
                  placeholder="+233 XX XXX XXXX"
                />
              </div>
            </div>
          </div>

          {/* Retention Settings */}
          <SectionHeader title="Data Retention" />
          <div className="card-elevated relative overflow-hidden p-6 mb-6">
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
            <div className="mb-4 p-4 bg-warning-soft border border-warning-soft rounded-lg">
              <p className="text-warning text-sm font-medium mb-1">⚠ Retention Policy (O10)</p>
              <p className="text-warning text-caption">
                Enabling automated deletion requires Ghana-specific legal advice.
                The "Enable Retention" toggle is locked until that review is complete.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="retentionYears">Default Retention (Years)</label>
                <input
                  id="retentionYears"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.retentionYears}
                  onChange={(e) => handleChange('retentionYears', parseInt(e.target.value) || 1)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="attendanceRetentionDays">Attendance Retention (Days)</label>
                <input
                  id="attendanceRetentionDays"
                  type="number"
                  min="1"
                  max="10950"
                  value={settings.attendanceRetentionDays || ''}
                  onChange={(e) => handleChange('attendanceRetentionDays', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="input"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="auditRetentionDays">Audit Retention (Days)</label>
                <input
                  id="auditRetentionDays"
                  type="number"
                  min="1"
                  max="10950"
                  value={settings.auditRetentionDays || ''}
                  onChange={(e) => handleChange('auditRetentionDays', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="input"
                  placeholder="Optional"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.retentionEnabled}
                    onChange={(e) => handleChange('retentionEnabled', e.target.checked)}
                    disabled={true}
                    className="w-4 h-4 text-brass-chrome border-chrome-line focus:ring-brass-chrome opacity-50 cursor-not-allowed"
                  />
                  <span className="text-ink-muted text-sm">Enable Retention (Locked)</span>
                </label>
              </div>
            </div>
            <p className="text-caption text-ink-muted">
              Max 30 years (10,950 days). Per-category windows override the default.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges() || saving}
              className="btn-secondary"
            >
              <FaUndo className="mr-2" /> Reset
            </button>
            <button
              type="submit"
              disabled={!hasChanges() || saving || timezoneError}
              className="btn-primary"
            >
              <FaSave className="mr-2" />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmSave}
        title="Save Changes?"
        body={
          <>
            <p>You are about to save changes to the business settings.</p>
            <p className="mt-2">This action will create an audit log entry with the before/after values.</p>
          </>
        }
        confirmLabel="Save"
        cancelLabel="Cancel"
        busy={saving}
        busyLabel="Saving…"
        eyebrow="Confirm"
      />
    </Layout>
  )
}

function isValidIANATimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export default SuperAdminSettings