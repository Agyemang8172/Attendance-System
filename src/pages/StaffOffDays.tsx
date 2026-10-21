import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill from '../components/ui/Pill'
import { formatShortDate } from '../lib/attendance-format'
import { FaCalendar, FaCircleInfo } from 'react-icons/fa6'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OffDay {
  date: string
  kind: string
  note?: string
}

// ─── Off Day Item ─────────────────────────────────────────────────────────────

const OffDayItem = ({ offDay }: { offDay: OffDay }) => {
  const isHoliday = offDay.kind?.toLowerCase() === 'holiday'
  const tone = isHoliday ? 'accent' : 'warning'

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 card border-hairline">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex-shrink-0 w-14 sm:w-16 text-center">
          <p className="text-display-md font-mono font-bold text-ink">{new Date(offDay.date).getDate()}</p>
          <p className="text-caption font-mono text-ink-muted uppercase">
            {new Date(offDay.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short' })}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Pill tone={tone} mono>{offDay.kind || 'Off day'}</Pill>
            <span className="text-body font-semibold text-ink">
              {formatShortDate(offDay.date)}
            </span>
          </div>
          {offDay.note && (
            <p className="text-caption text-ink-muted mt-1 truncate">{offDay.note}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-caption text-ink-muted">
        <FaCircleInfo aria-hidden="true" />
        <span>Set by HR / Calendar</span>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = () => (
  <div className="card p-12 text-center">
    <FaCalendar className="text-ink-subtle text-4xl mx-auto mb-4" aria-hidden="true" />
    <p className="text-body-sm text-ink-muted mb-2">No off-days scheduled</p>
    <p className="text-caption text-ink-subtle mb-4">
      Off-days are set by your HR team or come from the company calendar.
    </p>
    <p className="text-body-sm text-ink-muted">
      If you believe a day should be marked as an off-day, please contact HR or submit a help request.
    </p>
  </div>
)

// ─── Staff Off-Days Page ──────────────────────────────────────────────────────

function StaffOffDays() {
  const user = getCurrentUser()

  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [fetching, setFetching] = useState(true)

  const fetchOffDays = useCallback(async () => {
    setFetching(true)
    try {
      const res = await api.get('/staff/off-days')
      setOffDays(res.data.data || [])
    } catch {
      toast.error('Failed to load off-days.')
      setOffDays([])
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchOffDays()
  }, [fetchOffDays])

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Off-Days"
        title="Holidays & Calendar Overrides"
      />

      {/* ── Off-Days List ────────────────────────────────────────────────── */}
      <SectionHeader
        title={`Off-Days`}
        actions={
          <span className="text-caption font-mono text-ink-muted" aria-live="polite">
            {offDays.length} day{offDays.length !== 1 ? 's' : ''}
          </span>
        }
      />

      {fetching ? (
        <div className="space-y-3" role="list" aria-label="Off-days loading" aria-busy="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="animate-pulse card border-hairline p-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-surface-2 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-surface-2 rounded" />
                  <div className="h-3 w-32 bg-surface-2 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : offDays.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3" role="list" aria-label="Off-days">
          {offDays
            .slice()
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(offDay => (
              <OffDayItem key={offDay.date} offDay={offDay} />
            ))}
        </div>
      )}
    </Layout>
  )
}

export default StaffOffDays