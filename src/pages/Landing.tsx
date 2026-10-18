// Landing — the public product page at "/" (PRD §6, M8 Phase 1).
//
// Display-only by construction: this file imports no API client and holds no
// fetch of any kind. Every number and name below is a typed constant, so the
// page cannot leak live tenant data no matter what changes around it (the
// PRD §6 privacy rule "readers must never mistake it for live data" is kept
// honestly — by there being no source of live data on this screen at all).
//
// House rules honoured here:
//   - No registration link (O1 — no self-registration), no "forgot access"
//     link (M8-R3 — the O6 recovery endpoints were never built), and no
//     links into the dashboards. The single action is Sign in → /login.
//   - Paper and Brass tokens only, per the approved M8 plan; the primitives
//     from Phase 0 (PageHeader, SectionHeader, Pill) carry the connection
//     to the authenticated screens so the product reads as one object.
//   - No pricing, no trial CTA, no feature-card grid: the story is told with
//     one preview panel, which is what PRD §6 asks for and no more.
//
// Sample rows come verbatim from M1-NAVIGATION-AND-SCREENS.md §2 (the
// approved sample table), so the public preview matches the document the
// owner signed off.
//
// Mobile strategy for the sample table (the deliberate choice this screen
// was built with): below the `sm` breakpoint the five rows render as stacked
// record cards and the real <table> renders from `sm` upward. A marketing
// page should never pan inside a boxed card, and five rows stack cleanly —
// so there is no horizontal-scroll affordance to maintain and no overflow
// at 375px at all.

import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import Pill, { type PillTone } from '../components/ui/Pill'

// ─── Fictional sample data (constants — the only data this page knows) ──────

export interface SampleAttendanceRow {
  name: string
  shift: string
  clockIn: string | null
  // Canonical v1 status per DESIGN.md §11.3 — row content is the approved
  // M1 §2 sample; the mapping below covers all eight values so adding an
  // ABSENT or AUTO_CLOSED sample row later is a data change, not a UI one.
  status:
    | 'EARLY'
    | 'ON_TIME'
    | 'LATE'
    | 'OPEN_SESSION'
    | 'CLOCK_OUT_MISSING'
    | 'AUTO_CLOSED'
    | 'ABSENT'
    | 'REQUIRES_REVIEW'
}

const SAMPLE_BUSINESS = 'Finest Supermarket, Accra'

const SAMPLE_FIGURES: Array<{ label: string; value: string }> = [
  { label: 'Expected today', value: '42' },
  { label: 'Clocked in', value: '37' },
  { label: 'Late', value: '5' },
  { label: 'Open sessions', value: '3' },
]

const SAMPLE_ROWS: SampleAttendanceRow[] = [
  { name: 'Kwabena Mensah', shift: 'Morning', clockIn: '05:55 AM', status: 'EARLY' },
  { name: 'Akosua Boateng', shift: 'Morning', clockIn: '06:00 AM', status: 'ON_TIME' },
  { name: 'Yaw Owusu', shift: 'Morning', clockIn: '06:18 AM', status: 'LATE' },
  { name: 'Abena Asante', shift: 'Afternoon', clockIn: '02:04 PM', status: 'LATE' },
  { name: 'Kofi Appiah', shift: 'Night', clockIn: null, status: 'OPEN_SESSION' },
]

const statusLabels: Record<SampleAttendanceRow['status'], string> = {
  EARLY: 'Early',
  ON_TIME: 'On time',
  LATE: 'Late',
  OPEN_SESSION: 'Open session',
  CLOCK_OUT_MISSING: 'Clock-out missing',
  AUTO_CLOSED: 'Auto closed',
  ABSENT: 'Absent',
  REQUIRES_REVIEW: 'Needs review',
}

// Status → Pill tone. The v1 palette (index.css §5.4 green/amber/red/blue)
// has no violet the way the chrome-ground §11.3 set does, so REQUIRES_REVIEW
// takes the accent tone — the one tone on this paper that reads as "waiting,
// not broken" — and AUTO_CLOSED deliberately takes neutral: a system closure
// is a system act, not something a person did or failed to do.
const statusTones: Record<SampleAttendanceRow['status'], PillTone> = {
  EARLY: 'success',
  ON_TIME: 'success',
  LATE: 'warning',
  OPEN_SESSION: 'accent',
  CLOCK_OUT_MISSING: 'warning',
  AUTO_CLOSED: 'neutral',
  ABSENT: 'error',
  REQUIRES_REVIEW: 'accent',
}

// ─── Small local pieces ──────────────────────────────────────────────────────

const ArrowRight = () => (
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
)

/** One brass-marked line of what the product does — plain sentences, not feature cards. */
const FactLine = ({ children }: { children: ReactNode }) => (
  <li className="flex items-start gap-3 text-body-sm text-ink-muted">
    <span className="mt-[9px] h-1 w-3 shrink-0 bg-accent" aria-hidden="true" />
    <span>{children}</span>
  </li>
)

/** One figure of the sample stat row. */
const Figure = ({ label, value }: { label: string; value: string }) => (
  <div className="px-1 py-3 sm:px-4 sm:py-5">
    <dd className="text-display-sm text-ink font-serif">{value}</dd>
    <dt className="mt-1 text-caption text-ink-subtle">{label}</dt>
  </div>
)

const Landing = () => (
  <div className="min-h-screen bg-canvas font-sans text-ink flex flex-col">
    {/* ── Brand header zone: wordmark + the page's only action ── */}
    <header className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-display-md font-bold text-ink font-serif truncate">AttendPro</span>
          <span className="hidden sm:block text-eyebrow text-ink-subtle">Shift attendance</span>
        </div>
        {/* The single action on the page. A real link to /login — no
            registration path exists for visitors (O1), no recovery link
            exists anywhere (M8-R3), so this stays the honest one. */}
        <Link
          to="/login"
          className="btn-primary shrink-0 no-underline"
          aria-label="Sign in to your AttendPro workspace"
        >
          Sign in
          <ArrowRight />
        </Link>
      </div>
    </header>

    {/* ── Hero + preview: asymmetric split, not a centred marketing banner ── */}
    <main className="flex-1">
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8 items-start">
          {/* Text column */}
          <div className="lg:col-span-5">
            <PageHeader
              size="hero"
              eyebrow="Attendance for shift businesses"
              title="Attendance that starts at the kiosk."
            />
            <p className="text-body text-ink-muted max-w-xl">
              AttendPro records attendance at a shared kiosk. Staff clock in and out at the start
              and end of every shift with their badge or PIN, and the punch lands in one record
              nobody can quietly edit. Managers then run the day from a simple dashboard — who was
              expected, who clocked in, who is late, which sessions are still open.
            </p>
            <ul className="mt-8 space-y-4">
              <FactLine>
                One clock per shift, at the kiosk only — no personal-screen punching, no grey
                records to argue about.
              </FactLine>
              <FactLine>
                Late arrivals, forgotten clock-outs and still-open sessions surface themselves for
                review instead of hiding in a spreadsheet.
              </FactLine>
              <FactLine>
                Every correction keeps its before-and-after history, so the record stays worth
                trusting.
              </FactLine>
            </ul>
          </div>

          {/* Preview panel — the "small dashboard preview" PRD §6 asks for */}
          <div className="lg:col-span-7">
            <div className="rounded-lg border border-hairline bg-surface-1 shadow-card">
              {/* Panel label — always visible, always reads as a preview
                  first, so a skimming visitor cannot mistake it for live
                  data (PRD §6 privacy rule). */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6 sm:pt-6">
                <p className="text-eyebrow text-ink-subtle">Preview · {SAMPLE_BUSINESS}</p>
                <Pill tone="accent">Sample</Pill>
              </div>

              <p className="px-5 sm:px-6 pt-2 text-caption text-ink-muted">
                A worked example built from fictional data. It shows what a manager sees — not
                every statistic, not a real roster.
              </p>

              <SectionHeader title="Today at a glance" />

              {/* Sample figure row (M1 §2) */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 border-y border-hairline bg-surface-2 divide-x divide-hairline">
                {SAMPLE_FIGURES.map((figure) => (
                  <Figure key={figure.label} {...figure} />
                ))}
              </dl>

              {/* Visible caption lives with the table it describes (PRD §6). */}
              <table className="hidden sm:table w-full text-body-sm">
                <caption className="px-6 pt-4 pb-2 text-left text-caption text-ink-subtle">
                  Sample data — not real records
                </caption>
                <thead>
                  <tr className="bg-surface-2 text-left">
                    <th scope="col" className="px-6 py-2 font-medium text-eyebrow text-ink-muted">
                      Employee
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium text-eyebrow text-ink-muted">
                      Shift
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium text-eyebrow text-ink-muted">
                      Clock-in
                    </th>
                    <th scope="col" className="px-6 py-2 font-medium text-eyebrow text-ink-muted">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_ROWS.map((row) => (
                    <tr key={row.name} className="border-t border-hairline">
                      <td className="px-6 py-3 text-ink font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.shift}</td>
                      <td className="px-4 py-3 text-mono text-ink-muted">
                        {row.clockIn ?? '--'}
                      </td>
                      <td className="px-6 py-3">
                        <Pill tone={statusTones[row.status]}>{statusLabels[row.status]}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Compact card stack (below sm) — the deliberate mobile
                  strategy; same constants as the table, so the two can
                  never show different rows. */}
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
                        {row.shift} shift · Clock-in {row.clockIn ?? '--'}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Panel footer keeps the note physically inside the preview. */}
              <p className="px-5 pb-5 sm:px-6 sm:pb-6 pt-4 text-caption text-ink-subtle">
                Figures and names on this panel are fictional examples of the product, not actual
                attendance records.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>

    {/* ── Footer: copyright + the one honest sentence. No register link (O1),
        no recovery link (M8-R3), no dashboard links. ── */}
    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-body-sm text-ink-muted">© 2026 AttendPro. All rights reserved.</p>
        <p className="text-body-sm text-ink-subtle">Built for Ghana's shift businesses.</p>
      </div>
    </footer>
  </div>
)

export default Landing
