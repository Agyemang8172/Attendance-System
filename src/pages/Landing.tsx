// Landing — the public product page at "/" (PRD §6).
//
// Display-only by construction: this file imports no API client and holds no
// fetch of any kind. Every number, name, time, and scene label is a typed
// constant, so the page cannot leak live tenant data.
//
// Approved landing contract (2026-10-21):
//   - Paper & Brass only.
//   - Example Organisation is the fictional sample organisation.
//   - One Sign in action in the header and one Sign in action in the hero.
//   - No registration, recovery, pricing, trial, demo, or dashboard link.
//   - The preview carries id="preview" and is the target of /#preview.
//   - The walkthrough is a labelled illustration, not live data.
//   - The walkthrough uses the approved QR + PIN verification step only.

import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill from '../components/ui/Pill'
import ProductWalkthrough from '../components/landing/ProductWalkthrough'

// ─── Fictional sample data ───────────────────────────────────────────────────

export interface SampleAttendanceRow {
  name: string
  clockIn: string | null
  clockOut: string | null
  status: 'EARLY' | 'ON_TIME' | 'LATE' | 'OPEN_SESSION'
}

const SAMPLE_BUSINESS = 'Example Organisation'

const SAMPLE_FIGURES: Array<{ label: string; value: string }> = [
  { label: 'Expected', value: '42' },
  { label: 'Clocked in', value: '37' },
  { label: 'Late', value: '5' },
  { label: 'Open sessions', value: '3' },
]

// Proposed sample rows for owner review. The clock-out values are illustrative
// and are marked as proposed until the owner approves the expanded data.
const SAMPLE_ROWS: SampleAttendanceRow[] = [
  { name: 'Kwabena Mensah', clockIn: '05:55 AM', clockOut: '02:00 PM', status: 'EARLY' },
  { name: 'Akosua Boateng', clockIn: '06:00 AM', clockOut: '02:00 PM', status: 'ON_TIME' },
  { name: 'Yaw Owusu', clockIn: '06:18 AM', clockOut: '02:15 PM', status: 'LATE' },
  { name: 'Abena Asante', clockIn: '02:04 PM', clockOut: '10:00 PM', status: 'LATE' },
  { name: 'Kofi Appiah', clockIn: null, clockOut: null, status: 'OPEN_SESSION' },
]

const statusLabels: Record<SampleAttendanceRow['status'], string> = {
  EARLY: 'Early',
  ON_TIME: 'On time',
  LATE: 'Late',
  OPEN_SESSION: 'Open session',
}

const statusTones: Record<SampleAttendanceRow['status'], 'success' | 'warning' | 'accent'> = {
  EARLY: 'success',
  ON_TIME: 'success',
  LATE: 'warning',
  OPEN_SESSION: 'accent',
}

const Landing = () => (
  <div className="min-h-screen bg-canvas font-sans text-ink flex flex-col">
    <header className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <svg
            className="w-7 h-7 text-accent shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" strokeOpacity="0.4" strokeDasharray="2 2" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path d="M12 2v20M2 12h20" strokeOpacity="0.5" />
          </svg>
          <span className="text-display-md font-semibold text-ink font-serif truncate">AttendPro</span>
          <span className="hidden sm:block text-eyebrow text-ink-subtle">Attendance management</span>
        </div>
        <Link
          to="/login"
          className="btn-primary shrink-0 no-underline"
          aria-label="Sign in to your AttendPro workspace"
        >
          Sign in
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </header>

    <main className="flex-1">
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8 items-start">
          <div className="lg:col-span-5">
            <PageHeader
              size="hero"
              eyebrow="Attendance management"
              title="Attendance that starts at the kiosk."
            />
            <p className="mt-4 text-body text-ink-muted max-w-xl">
              AttendPro helps businesses record staff attendance, track late arrivals, and review
              clock-in and clock-out activity from one management dashboard.
            </p>
            <ul className="mt-8 space-y-4">
              <li className="flex items-start gap-3 text-body-sm text-ink-muted">
                <span className="mt-2 h-1 w-3 shrink-0 bg-accent" aria-hidden="true" />
                <span>Attendance is recorded at an authorised workplace kiosk, not from a personal screen.</span>
              </li>
              <li className="flex items-start gap-3 text-body-sm text-ink-muted">
                <span className="mt-2 h-1 w-3 shrink-0 bg-accent" aria-hidden="true" />
                <span>Late arrivals, forgotten clock-outs, and open sessions surface for review.</span>
              </li>
              <li className="flex items-start gap-3 text-body-sm text-ink-muted">
                <span className="mt-2 h-1 w-3 shrink-0 bg-accent" aria-hidden="true" />
                <span>Corrections keep before-and-after history so the record stays trustworthy.</span>
              </li>
            </ul>
            <div className="mt-8">
              <Link to="/login" className="btn-primary no-underline">
                Sign in
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <ProductWalkthrough />
          </div>
        </div>
      </section>

      <section id="preview" className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16 scroll-mt-8">
        <div className="rounded-lg border border-hairline bg-surface-1 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6 sm:pt-6">
            <p className="text-eyebrow text-ink-subtle">Preview · {SAMPLE_BUSINESS}</p>
            <Pill tone="accent">Sample</Pill>
          </div>

          <p className="px-5 sm:px-6 pt-2 text-caption text-ink-muted">
            A worked example built from fictional data. It shows what a manager sees, not every
            statistic and not a real roster.
          </p>

          <div className="px-5 sm:px-6 pt-4">
            <SectionHeader title="Today at a glance" />
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 border-y border-hairline bg-surface-2 divide-x divide-hairline">
            {SAMPLE_FIGURES.map((figure) => (
              <div key={figure.label} className="px-1 py-3 sm:px-4 sm:py-5">
                <dt className="text-caption text-ink-subtle">{figure.label}</dt>
                <dd className="mt-1 text-display-sm text-ink font-serif">{figure.value}</dd>
              </div>
            ))}
          </dl>

          <p className="px-5 sm:px-6 pt-4 text-caption text-ink-subtle">
            Sample data — not real records
          </p>

          <table className="hidden sm:table w-full text-body-sm">
            <caption className="px-6 pt-2 pb-2 text-left text-caption text-ink-subtle">
              Sample data — not real records
            </caption>
            <thead>
              <tr className="bg-surface-2 text-left">
                <th scope="col" className="px-6 py-2 font-medium text-eyebrow text-ink-muted">
                  Employee
                </th>
                <th scope="col" className="px-4 py-2 font-medium text-eyebrow text-ink-muted">
                  Clock-in
                </th>
                <th scope="col" className="px-4 py-2 font-medium text-eyebrow text-ink-muted">
                  Clock-out
                </th>
                <th scope="col" className="px-6 py-2 font-medium text-eyebrow text-ink-muted">
                  Attendance status
                </th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.name} className="border-t border-hairline">
                  <td className="px-6 py-3 text-ink font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-mono text-ink-muted">{row.clockIn ?? '--'}</td>
                  <td className="px-4 py-3 text-mono text-ink-muted">{row.clockOut ?? '--'}</td>
                  <td className="px-6 py-3">
                    <Pill tone={statusTones[row.status]}>{statusLabels[row.status]}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sm:hidden px-5 py-4">
            <p className="text-caption text-ink-subtle">Sample data — not real records</p>
            <ul className="mt-2 divide-y divide-hairline">
              {SAMPLE_ROWS.map((row) => (
                <li key={row.name} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body-sm text-ink font-medium">{row.name}</span>
                    <Pill tone={statusTones[row.status]}>{statusLabels[row.status]}</Pill>
                  </div>
                  <p className="mt-1 text-caption text-ink-muted">
                    Clock-in {row.clockIn ?? '--'} · Clock-out {row.clockOut ?? '--'}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <p className="px-5 pb-5 sm:px-6 sm:pb-6 pt-4 text-caption text-ink-subtle">
            Figures and names on this panel are fictional examples of the product, not actual
            attendance records.
          </p>
        </div>
      </section>
    </main>

    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-body-sm text-ink-muted">© 2026 AttendPro. All rights reserved.</p>
        <p className="text-body-sm text-ink-subtle">Attendance management for modern teams.</p>
      </div>
    </footer>
  </div>
)

export default Landing
