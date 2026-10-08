import { useState, useEffect, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { BadgeGridSkeleton } from '../components/ui/Skeleton'
import { FaLock, FaCheck, FaFire, FaBolt, FaGem, FaTrophy } from 'react-icons/fa'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isLate = (clockInStr) => {
  const d = new Date(clockInStr)
  return d.getHours() > 6 || (d.getHours() === 6 && d.getMinutes() >= 30)
}

const isEarlyBird = (clockInStr) => {
  const d = new Date(clockInStr)
  return d.getHours() < 6
}

const roleLabel = {
  STAFF: 'Staff',
  HR: 'HR Manager',
  SUPERADMIN: 'Super Admin',
}

// ─── Badge Definitions ────────────────────────────────────────────────────────

const BADGES = [
  {
    id: 'on_fire',
    icon: <FaFire aria-hidden="true" />,
    name: 'On Fire',
    description: 'Current streak of 5+ on-time days.',
    hint: 'Clock in on time for 5 days in a row.',
    check: (records) => {
      let count = 0
      for (const r of records) {
        if (r.sessionStatus !== 'CLOSED') break
        if (isLate(r.clockIn)) break
        count++
      }
      return count >= 5
    },
    earnedCard: 'card border-success-soft',
    earnedText: 'text-success',
    earnedSub: 'text-ink-muted',
  },
  {
    id: 'early_bird',
    icon: <FaBolt aria-hidden="true" />,
    name: 'Early Bird',
    description: 'You have clocked in before 06:00.',
    hint: 'Clock in before 06:00 at least once.',
    check: (records) =>
      records.some(
        (r) => r.clockIn && r.sessionStatus === 'CLOSED' && isEarlyBird(r.clockIn)
      ),
    earnedCard: 'card border-warning-soft',
    earnedText: 'text-warning',
    earnedSub: 'text-ink-muted',
  },
  {
    id: 'perfect_month',
    icon: <FaGem aria-hidden="true" />,
    name: 'Perfect Month',
    description: 'Zero late arrivals this calendar month.',
    hint: 'Have no late clock-ins this month.',
    check: (records) => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const thisMonth = records.filter(
        (r) =>
          r.sessionStatus === 'CLOSED' && new Date(r.date) >= startOfMonth
      )
      if (thisMonth.length === 0) return false
      return thisMonth.every((r) => !isLate(r.clockIn))
    },
    earnedCard: 'card border-accent-soft',
    earnedText: 'text-accent',
    earnedSub: 'text-ink-muted',
  },
  {
    id: 'veteran',
    icon: <FaTrophy aria-hidden="true" />,
    name: 'Veteran',
    description: '30+ sessions completed.',
    hint: 'Complete 30 or more closed sessions.',
    check: (records) =>
      records.filter((r) => r.sessionStatus === 'CLOSED').length >= 30,
    earnedCard: 'card border-accent-soft',
    earnedText: 'text-accent',
    earnedSub: 'text-ink-muted',
  },
]

// ─── Badge Card ───────────────────────────────────────────────────────────────

const BadgeCard = ({ badge, earned }) => {
  if (earned) {
    return (
      <div
        className={`
          relative rounded-2xl border p-5
          flex flex-col gap-3
          ${badge.earnedCard}
        `}
      >
        {/* Corner bracket */}
        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />

        {/* Badge icon */}
        <span className="text-3xl">{badge.icon}</span>

        {/* Name + check */}
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-sans font-medium ${badge.earnedText}`}>
            {badge.name}
          </p>
          <FaCheck className="text-success text-xs shrink-0" />
        </div>

        {/* Description */}
        <p className={`text-xs font-sans leading-relaxed ${badge.earnedSub}`}>
          {badge.description}
        </p>
      </div>
    )
  }

  // Locked
  return (
    <div className="relative rounded-2xl border border-hairline bg-surface-2 p-5 flex flex-col gap-3">
      {/* Badge icon — muted via opacity */}
      <span className="text-3xl opacity-25">{badge.icon}</span>

      {/* Name + lock */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-sans font-medium text-ink-subtle">
          {badge.name}
        </p>
        <FaLock className="text-ink-tertiary text-xs shrink-0" />
      </div>

      {/* Hint */}
      <p className="text-xs font-sans leading-relaxed text-ink-tertiary">
        {badge.hint}
      </p>
    </div>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

const InfoRow = ({ label, value, mono = false, last = false }) => (
  <div className={last ? '' : 'border-b border-hairline pb-4 mb-4'}>
    <p className="text-ink-muted text-xs mb-1">
      {label}
    </p>
    <p className={`text-ink text-sm ${mono ? 'font-mono' : 'font-sans'}`}>
      {value}
    </p>
  </div>
)

// ─── Profile ──────────────────────────────────────────────────────────────────

function Profile() {
  const user = getCurrentUser()

  const [records, setRecords] = useState([])
  const [fetching, setFetching] = useState(true)

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join('')

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await api.get('/attendance/my-attendance')
        setRecords(res.data.data || [])
      } catch (err) {
        toast.error('Failed to load profile data.')
      } finally {
        setFetching(false)
      }
    }
    fetchAttendance()
  }, [])

  // Compute which badges are earned
  const earnedMap = useMemo(() => {
    const map = {}
    BADGES.forEach((b) => {
      map[b.id] = b.check(records)
    })
    return map
  }, [records])

  const earnedCount = Object.values(earnedMap).filter(Boolean).length

  return (
    <Layout>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="mb-8">
        <p className="text-ink-muted text-caption font-mono mb-1">
          Your profile
        </p>
        <h1 className="text-display-sm text-ink font-serif leading-tight">
          My Profile
        </h1>
        <p className="text-ink-muted text-body-sm mt-1">
          Your account details and achievements.
        </p>
        <div className="mt-3 h-px w-12 bg-accent opacity-40" />
      </header>

      {/* ── Profile Card ─────────────────────────────────────────────────── */}
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
            <span className="inline-block mt-1 px-3 py-0.5 rounded-md card border-hairline text-accent text-xs font-mono uppercase tracking-wider">
              {roleLabel[user?.role] || user?.role}
            </span>
          </div>
        </div>

        {/* Accent divider */}
        <div className="h-px bg-accent opacity-30 mb-6" />

        {/* Info rows */}
        <InfoRow label="Employee ID" value={user?.employeeCode || '--'} mono />
        <InfoRow label="Email" value={user?.email} last />
      </div>

      {/* ── Achievements ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-body-sm font-medium text-ink">
              Achievements
            </h2>
            <div className="mt-2 h-0.5 w-10 bg-accent opacity-40" />
          </div>
          {/* Badge count */}
          {!fetching && (
            <span className="text-caption font-mono text-ink-muted">
              <span className="text-accent">{earnedCount}</span>
              /{BADGES.length} earned
            </span>
          )}
        </div>

        {fetching ? (
          <BadgeGridSkeleton />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BADGES.map((badge) => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                earned={earnedMap[badge.id]}
              />
            ))}
          </div>
        )}
      </section>

    </Layout>
  )
}

export default Profile