import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill from '../components/ui/Pill'
import { formatShortDate } from '../lib/attendance-format'
import type { Role } from '../types'
import { FaLock, FaKey, FaArrowRight, FaUser } from 'react-icons/fa6'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const roleLabel: Record<Role, string> = {
  STAFF: 'Staff',
  HR: 'HR Manager',
  SUPERADMIN: 'Super Admin',
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

const InfoRow = ({
  label,
  value,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) => (
  <div className="border-b border-hairline pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
    <p className="text-ink-muted text-caption mb-1">{label}</p>
    <p className={`text-ink text-sm ${mono ? 'font-mono' : 'font-sans'}`}>{value}</p>
  </div>
)

// ─── Action Link ──────────────────────────────────────────────────────────────

const ActionLink = ({
  icon,
  label,
  description,
  href,
}: {
  icon: React.ReactNode
  label: string
  description: string
  href: string
}) => (
  <a
    href={href}
    className="flex items-center gap-4 p-4 card border-hairline hover:bg-surface-1 transition-colors"
  >
    <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-body font-medium text-ink truncate">{label}</p>
      <p className="text-caption text-ink-muted">{description}</p>
    </div>
    <FaArrowRight className="text-ink-muted shrink-0" aria-hidden="true" />
  </a>
)

// ─── Profile Page ─────────────────────────────────────────────────────────────

function Profile() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [records, setRecords] = useState<unknown[]>([])
  const [fetching, setFetching] = useState(true)

  const initials = [user?.firstName, user?.lastName]
    .filter((n): n is string => Boolean(n))
    .map((n) => n[0].toUpperCase())
    .join('')

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await api.get('/attendance/my-attendance')
        setRecords(res.data.data || [])
      } catch (_err) {
        toast.error('Failed to load profile data.')
      } finally {
        setFetching(false)
      }
    }
    fetchAttendance()
  }, [])

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Profile & Security"
        title="My Profile"
        size="page"
      />

      {/* ── Identity Card ─────────────────────────────────────────────────── */}
      <SectionHeader title="Identity" />
      <div className="relative card-elevated max-w-lg mb-8 overflow-hidden">
        {/* Corner brackets */}
        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-accent opacity-30 pointer-events-none" />

        {/* Avatar + identity */}
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-xl card border-hairline flex items-center justify-center shrink-0">
            <span className="text-accent text-xl font-bold font-sans">
              {initials || '??'}
            </span>
          </div>
          <div>
            <h2 className="text-ink text-lg font-semibold font-sans">
              {user?.firstName} {user?.lastName}
            </h2>
            <Pill tone="neutral" mono>
              {user?.role ? roleLabel[user.role as Role] || user.role : user?.role}
            </Pill>
          </div>
        </div>

        {/* Accent divider */}
        <div className="h-px bg-accent opacity-30 mb-6" />

        {/* Info rows */}
        <InfoRow label="Employee ID" value={user?.employeeCode || '--'} mono />
        <InfoRow label="Email" value={user?.email} />
      </div>

      {/* ── Security Actions ───────────────────────────────────────────────── */}
      <SectionHeader title="Security" />
      <div className="space-y-3 max-w-lg">
        <ActionLink
          icon={<FaLock className="text-accent" aria-hidden="true" />}
          label="Change Password"
          description="Update your account password"
          href="/set-password"
        />
        <ActionLink
          icon={<FaKey className="text-accent" aria-hidden="true" />}
          label="Change PIN"
          description="Update your 4-digit kiosk PIN"
          href="/profile/change-pin"
        />
      </div>

      {/* Note about read-only profile */}
      <div className="mt-8 p-4 bg-surface-1 rounded-lg border border-hairline max-w-lg">
        <p className="text-caption text-ink-muted">
          Profile information is managed by HR. To update your name, department, or shift assignment,
          please contact your HR team or submit a help request.
        </p>
      </div>
    </Layout>
  )
}

export default Profile