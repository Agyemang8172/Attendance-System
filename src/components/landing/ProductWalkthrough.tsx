// ProductWalkthrough — the hero product walkthrough player (PRD §6, U-06).
//
// Displays the 6 approved operating model scenes sequentially using DOM/SVG:
//   1. Management summary
//   2. Kiosk ready
//   3. Badge identified
//   4. Verification (4-digit PIN only, per D-07)
//   5. Attendance recorded (Clocked in · Early)
//   6. Management view
//
// Governed by:
//   - Root DESIGN.md §11.2 (Paper & Brass on light surface, dark kiosk surface inside paper frame)
//   - Approved decision D-07 (QR + 4-digit PIN only; zero SMS OTP)
//   - Approved decision U-06 (Lightweight DOM/SVG player, no external animation libraries)
//   - docs/attendpro/LANDING-PAGE-SPEC.md §3.7 (Timings, controls, transcript, reduced-motion)

import { useEffect, useMemo, useState } from 'react'

export interface WalkthroughScene {
  id: string
  title: string
  body: string
  duration: number
}

export const WALKTHROUGH_SCENES: WalkthroughScene[] = [
  {
    id: 'summary',
    title: 'Management summary',
    body: 'Example Organisation · Today · Expected 42 · Clocked in 37 · Late 5 · Open sessions 3',
    duration: 3500,
  },
  {
    id: 'ready',
    title: 'Kiosk ready',
    body: 'Example Organisation · Main entrance · 07:58 · Present your badge · Kiosk 2 online',
    duration: 3500,
  },
  {
    id: 'identified',
    title: 'Badge identified',
    body: 'Badge recognised · Kwabena · Verification required',
    duration: 3500,
  },
  {
    id: 'verify',
    title: 'Verification',
    body: 'Enter your 4-digit PIN · •••• · Checking…',
    duration: 4000,
  },
  {
    id: 'recorded',
    title: 'Attendance recorded',
    body: 'Kwabena, clocked in · Early · 05:55 AM · Recorded at the kiosk',
    duration: 3500,
  },
  {
    id: 'management',
    title: 'Management view',
    body: 'Attendance register · Kwabena Mensah · 05:55 AM · 02:00 PM · Early · Visible to authorised HR',
    duration: 5000,
  },
]

export const WALKTHROUGH_TRANSCRIPT = [
  'Scene 1, management summary: Example Organisation today shows 42 expected, 37 clocked in, 5 late, and 3 open sessions.',
  'Scene 2, kiosk ready: the kiosk shows the business name, live clock, and Present your badge.',
  'Scene 3, badge identified: the badge is recognised and shows Kwabena with Verification required.',
  'Scene 4, verification: the employee enters a 4-digit PIN. No PIN value is shown.',
  'Scene 5, attendance recorded: Kwabena clocked in, Early, at 05:55 AM. Recorded at the kiosk.',
  'Scene 6, management view: the attendance register shows Kwabena Mensah, 05:55 AM, 02:00 PM, Early. Visible to authorised HR.',
]

export const CornerBracket = () => (
  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
    <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-accent" />
    <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-accent" />
    <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-accent" />
    <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-accent" />
  </div>
)

interface SceneVisualProps {
  sceneId: string
  title: string
}

const SceneVisual = ({ sceneId, title }: SceneVisualProps) => {
  switch (sceneId) {
    case 'summary':
      return (
        <g data-testid="scene-summary">
          <rect width="640" height="300" fill="var(--surface-1)" stroke="var(--hairline)" />
          {/* Header */}
          <rect x="0" y="0" width="640" height="48" fill="var(--surface-2)" />
          <text x="28" y="30" fill="var(--ink-muted)" fontSize="13" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
            Example Organisation · Today
          </text>
          <rect x="490" y="14" width="122" height="22" rx="4" fill="var(--surface-3)" />
          <text x="502" y="29" fill="var(--ink-subtle)" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
            Illustrative data
          </text>

          {/* 4 KPI Cards */}
          <g transform="translate(28, 68)">
            <rect x="0" y="0" width="134" height="100" rx="8" fill="var(--surface-2)" stroke="var(--hairline)" />
            <text x="16" y="52" fill="var(--ink)" fontSize="32" fontFamily="Georgia, 'Times New Roman', ui-serif, serif" fontWeight="600">
              42
            </text>
            <text x="16" y="80" fill="var(--ink-subtle)" fontSize="12" fontFamily="system-ui, sans-serif">
              Expected
            </text>

            <rect x="150" y="0" width="134" height="100" rx="8" fill="var(--surface-2)" stroke="var(--hairline)" />
            <text x="166" y="52" fill="var(--ink)" fontSize="32" fontFamily="Georgia, 'Times New Roman', ui-serif, serif" fontWeight="600">
              37
            </text>
            <text x="166" y="80" fill="var(--ink-subtle)" fontSize="12" fontFamily="system-ui, sans-serif">
              Clocked in
            </text>

            <rect x="300" y="0" width="134" height="100" rx="8" fill="var(--surface-2)" stroke="var(--hairline)" />
            <text x="316" y="52" fill="var(--warning)" fontSize="32" fontFamily="Georgia, 'Times New Roman', ui-serif, serif" fontWeight="600">
              5
            </text>
            <text x="316" y="80" fill="var(--ink-subtle)" fontSize="12" fontFamily="system-ui, sans-serif">
              Late
            </text>

            <rect x="450" y="0" width="134" height="100" rx="8" fill="var(--surface-2)" stroke="var(--hairline)" />
            <text x="466" y="52" fill="var(--accent)" fontSize="32" fontFamily="Georgia, 'Times New Roman', ui-serif, serif" fontWeight="600">
              3
            </text>
            <text x="466" y="80" fill="var(--ink-subtle)" fontSize="12" fontFamily="system-ui, sans-serif">
              Open sessions
            </text>
          </g>

          {/* Sample Activity Preview */}
          <g transform="translate(28, 192)">
            <rect x="0" y="0" width="584" height="84" rx="8" fill="var(--canvas)" stroke="var(--hairline)" />
            <text x="20" y="32" fill="var(--ink)" fontSize="14" fontFamily="system-ui, sans-serif" fontWeight="500">
              Kwabena Mensah · Morning Shift
            </text>
            <text x="20" y="58" fill="var(--ink-muted)" fontSize="13" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
              Scheduled 06:00 AM · In: 05:55 AM · Early
            </text>
            <text x="440" y="46" fill="var(--accent)" fontSize="12" fontFamily="ui-monospace, monospace">
              Active Session
            </text>
          </g>
        </g>
      )

    case 'ready':
      return (
        <g data-testid="scene-ready">
          {/* Dark kiosk surface */}
          <rect width="640" height="300" fill="#000000" />
          <text x="32" y="36" fill="#b9c2d0" fontSize="13" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
            Example Organisation · Main entrance
          </text>
          <text x="500" y="36" fill="#4ade80" fontSize="13" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
            ● Kiosk 2 · Online
          </text>

          {/* Central Kiosk Screen Area */}
          <text x="32" y="96" fill="#ffffff" fontSize="48" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" fontWeight="600">
            07:58
          </text>
          <text x="32" y="140" fill="#ffffff" fontSize="28" fontFamily="system-ui, sans-serif" fontWeight="600">
            Present your badge
          </text>
          <text x="32" y="172" fill="#b9c2d0" fontSize="14" fontFamily="system-ui, sans-serif">
            Hold your employee QR credential up to the scanner
          </text>

          {/* Viewfinder Target */}
          <g transform="translate(420, 80)">
            <rect x="0" y="0" width="170" height="170" rx="12" fill="#121215" stroke="#3e3e44" strokeWidth="2" />
            <path d="M 20 40 L 20 20 L 40 20" stroke="#b45309" strokeWidth="3" fill="none" />
            <path d="M 150 40 L 150 20 L 130 20" stroke="#b45309" strokeWidth="3" fill="none" />
            <path d="M 20 130 L 20 150 L 40 150" stroke="#b45309" strokeWidth="3" fill="none" />
            <path d="M 150 130 L 150 150 L 130 150" stroke="#b45309" strokeWidth="3" fill="none" />
            <rect x="45" y="45" width="80" height="80" rx="6" fill="#1c1c20" stroke="#3e3e44" />
            <text x="85" y="90" fill="#8a8f98" fontSize="12" textAnchor="middle" fontFamily="ui-monospace, monospace">
              QR Frame
            </text>
          </g>
        </g>
      )

    case 'identified':
      return (
        <g data-testid="scene-identified">
          {/* Dark kiosk surface */}
          <rect width="640" height="300" fill="#000000" />
          <text x="32" y="36" fill="#b9c2d0" fontSize="13" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
            Example Organisation · Kiosk 2
          </text>

          {/* Badge recognized banner */}
          <g transform="translate(32, 64)">
            <rect x="0" y="0" width="220" height="32" rx="16" fill="#0c2b2b" stroke="#5eead4" strokeWidth="1" />
            <circle cx="18" cy="16" r="6" fill="#4ade80" />
            <text x="32" y="21" fill="#5eead4" fontSize="13" fontFamily="system-ui, sans-serif" fontWeight="500">
              Badge recognised
            </text>
          </g>

          {/* Employee Identified Details */}
          <text x="32" y="148" fill="#ffffff" fontSize="40" fontFamily="Georgia, 'Times New Roman', ui-serif, serif" fontWeight="600">
            Kwabena
          </text>
          <text x="32" y="184" fill="#fbbf24" fontSize="18" fontFamily="system-ui, sans-serif" fontWeight="500">
            Verification required
          </text>
          <text x="32" y="214" fill="#b9c2d0" fontSize="14" fontFamily="system-ui, sans-serif">
            Identity matched to scheduled shift · Enter badge PIN
          </text>

          {/* Badge Mockup Visual */}
          <g transform="translate(420, 64)">
            <rect x="0" y="0" width="180" height="190" rx="10" fill="#1e1e24" stroke="#3e3e44" />
            <rect x="20" y="20" width="140" height="28" rx="4" fill="#2a2a32" />
            <text x="90" y="38" fill="#eab308" fontSize="11" textAnchor="middle" fontFamily="ui-monospace, monospace">
              ATTENDPRO BADGE
            </text>
            <rect x="45" y="60" width="90" height="90" rx="4" fill="#ffffff" />
            <rect x="55" y="70" width="30" height="30" fill="#000000" />
            <rect x="95" y="70" width="20" height="20" fill="#000000" />
            <rect x="55" y="110" width="20" height="20" fill="#000000" />
            <rect x="85" y="100" width="40" height="40" fill="#000000" />
            <text x="90" y="172" fill="#b9c2d0" fontSize="12" textAnchor="middle" fontFamily="system-ui, sans-serif">
              Kwabena Mensah
            </text>
          </g>
        </g>
      )

    case 'verify':
      return (
        <g data-testid="scene-verify">
          {/* Dark kiosk surface */}
          <rect width="640" height="300" fill="#000000" />
          <text x="32" y="36" fill="#b9c2d0" fontSize="13" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
            Kwabena · Verification
          </text>

          <text x="32" y="88" fill="#ffffff" fontSize="24" fontFamily="system-ui, sans-serif" fontWeight="600">
            Enter your 4-digit PIN
          </text>
          <text x="32" y="116" fill="#b9c2d0" fontSize="14" fontFamily="system-ui, sans-serif">
            Security control: 10 attempts allowed before lockout
          </text>

          {/* 4 Masked PIN cells */}
          <g transform="translate(32, 140)">
            <rect x="0" y="0" width="60" height="68" rx="8" fill="#18181b" stroke="#eab308" strokeWidth="2" />
            <circle cx="30" cy="34" r="8" fill="#ffffff" />

            <rect x="76" y="0" width="60" height="68" rx="8" fill="#18181b" stroke="#eab308" strokeWidth="2" />
            <circle cx="106" cy="34" r="8" fill="#ffffff" />

            <rect x="152" y="0" width="60" height="68" rx="8" fill="#18181b" stroke="#eab308" strokeWidth="2" />
            <circle cx="182" cy="34" r="8" fill="#ffffff" />

            <rect x="228" y="0" width="60" height="68" rx="8" fill="#18181b" stroke="#eab308" strokeWidth="2" />
            <circle cx="258" cy="34" r="8" fill="#ffffff" />
          </g>

          <text x="32" y="244" fill="#fbbf24" fontSize="15" fontFamily="ui-monospace, monospace">
            Checking…
          </text>

          {/* Minimal Keypad Hint */}
          <g transform="translate(420, 60)">
            <rect x="0" y="0" width="180" height="200" rx="10" fill="#121215" stroke="#27272a" />
            <text x="90" y="32" fill="#8a8f98" fontSize="12" textAnchor="middle" fontFamily="ui-monospace, monospace">
              NUMERIC KEYPAD
            </text>
            <g transform="translate(25, 48)">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num, i) => {
                const col = i % 3
                const row = Math.floor(i / 3)
                return (
                  <g key={num} transform={`translate(${col * 46}, ${row * 36})`}>
                    <rect width="38" height="28" rx="4" fill="#202026" stroke="#2e2e38" />
                    <text x="19" y="19" fill="#b9c2d0" fontSize="12" textAnchor="middle" fontFamily="system-ui, sans-serif">
                      {num}
                    </text>
                  </g>
                )
              })}
              <g transform="translate(46, 108)">
                <rect width="38" height="28" rx="4" fill="#202026" stroke="#2e2e38" />
                <text x="19" y="19" fill="#b9c2d0" fontSize="12" textAnchor="middle" fontFamily="system-ui, sans-serif">
                  0
                </text>
              </g>
            </g>
          </g>
        </g>
      )

    case 'recorded':
      return (
        <g data-testid="scene-recorded">
          {/* Dark kiosk surface */}
          <rect width="640" height="300" fill="#000000" />
          <text x="32" y="36" fill="#b9c2d0" fontSize="13" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
            Example Organisation · Main entrance kiosk
          </text>

          {/* Success Checkmark Circle */}
          <g transform="translate(32, 60)">
            <circle cx="28" cy="28" r="28" fill="#08301b" stroke="#4ade80" strokeWidth="2" />
            <path d="M 18 28 L 25 36 L 39 20" stroke="#4ade80" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          <text x="108" y="94" fill="#4ade80" fontSize="32" fontFamily="Georgia, 'Times New Roman', ui-serif, serif" fontWeight="600">
            Clocked in · Early
          </text>

          <text x="32" y="160" fill="#ffffff" fontSize="24" fontFamily="system-ui, sans-serif" fontWeight="600">
            Kwabena Mensah
          </text>
          <text x="32" y="192" fill="#ffffff" fontSize="28" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
            05:55 AM
          </text>
          <text x="32" y="228" fill="#b9c2d0" fontSize="14" fontFamily="system-ui, sans-serif">
            Recorded at the kiosk · Shift window 06:00 AM - 02:00 PM
          </text>
          <text x="32" y="254" fill="#8a8f98" fontSize="12" fontFamily="ui-monospace, monospace">
            Session status: OPEN · Audit entry written
          </text>
        </g>
      )

    case 'management':
      return (
        <g data-testid="scene-management">
          {/* Light paper register */}
          <rect width="640" height="300" fill="var(--surface-1)" stroke="var(--hairline)" />
          {/* Table Header */}
          <rect x="0" y="0" width="640" height="44" fill="var(--surface-2)" />
          <text x="28" y="28" fill="var(--ink)" fontSize="14" fontFamily="Georgia, 'Times New Roman', ui-serif, serif" fontWeight="600">
            Attendance register · Manager view
          </text>
          <text x="440" y="28" fill="var(--accent)" fontSize="12" fontFamily="ui-monospace, monospace">
            Visible to authorised HR
          </text>

          {/* Table Columns */}
          <g transform="translate(28, 54)">
            <rect x="0" y="0" width="584" height="32" fill="var(--canvas)" />
            <text x="12" y="21" fill="var(--ink-muted)" fontSize="12" fontFamily="system-ui, sans-serif" fontWeight="600">Employee</text>
            <text x="180" y="21" fill="var(--ink-muted)" fontSize="12" fontFamily="system-ui, sans-serif" fontWeight="600">Clock-in</text>
            <text x="280" y="21" fill="var(--ink-muted)" fontSize="12" fontFamily="system-ui, sans-serif" fontWeight="600">Clock-out</text>
            <text x="400" y="21" fill="var(--ink-muted)" fontSize="12" fontFamily="system-ui, sans-serif" fontWeight="600">Status</text>
          </g>

          {/* Row 1 - Highlighted Active Punch */}
          <g transform="translate(28, 92)">
            <rect x="0" y="0" width="584" height="48" fill="#fefce8" stroke="#fef08a" rx="4" />
            <text x="12" y="30" fill="var(--ink)" fontSize="14" fontFamily="system-ui, sans-serif" fontWeight="500">
              Kwabena Mensah
            </text>
            <text x="180" y="30" fill="var(--ink-muted)" fontSize="13" fontFamily="ui-monospace, monospace">
              05:55 AM
            </text>
            <text x="280" y="30" fill="var(--ink-muted)" fontSize="13" fontFamily="ui-monospace, monospace">
              02:00 PM
            </text>
            <rect x="400" y="14" width="70" height="22" rx="11" fill="#dcfce7" />
            <text x="435" y="29" fill="#166534" fontSize="12" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">
              Early
            </text>
          </g>

          {/* Row 2 */}
          <g transform="translate(28, 144)">
            <rect x="0" y="0" width="584" height="42" fill="var(--surface-1)" />
            <text x="12" y="26" fill="var(--ink)" fontSize="13" fontFamily="system-ui, sans-serif">
              Akosua Boateng
            </text>
            <text x="180" y="26" fill="var(--ink-muted)" fontSize="13" fontFamily="ui-monospace, monospace">
              06:00 AM
            </text>
            <text x="280" y="26" fill="var(--ink-muted)" fontSize="13" fontFamily="ui-monospace, monospace">
              02:00 PM
            </text>
            <rect x="400" y="11" width="70" height="22" rx="11" fill="#dcfce7" />
            <text x="435" y="26" fill="#166534" fontSize="12" textAnchor="middle" fontFamily="ui-monospace, monospace">
              On time
            </text>
          </g>

          {/* Row 3 */}
          <g transform="translate(28, 190)">
            <rect x="0" y="0" width="584" height="42" fill="var(--surface-1)" />
            <text x="12" y="26" fill="var(--ink)" fontSize="13" fontFamily="system-ui, sans-serif">
              Yaw Owusu
            </text>
            <text x="180" y="26" fill="var(--ink-muted)" fontSize="13" fontFamily="ui-monospace, monospace">
              06:18 AM
            </text>
            <text x="280" y="26" fill="var(--ink-muted)" fontSize="13" fontFamily="ui-monospace, monospace">
              02:15 PM
            </text>
            <rect x="400" y="11" width="70" height="22" rx="11" fill="#fef3c7" />
            <text x="435" y="26" fill="#92400e" fontSize="12" textAnchor="middle" fontFamily="ui-monospace, monospace">
              Late
            </text>
          </g>

          <text x="38" y="268" fill="var(--ink-subtle)" fontSize="12" fontFamily="ui-monospace, monospace">
            Illustrative data · Verified append-only audit trail
          </text>
        </g>
      )

    default:
      return null
  }
}

const ProductWalkthrough = () => {
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  const [sceneIndex, setSceneIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(!prefersReducedMotion)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion || !isPlaying || isComplete) return

    const timer = window.setTimeout(() => {
      const nextIndex = sceneIndex + 1
      if (nextIndex >= WALKTHROUGH_SCENES.length) {
        setIsComplete(true)
        setIsPlaying(false)
      } else {
        setSceneIndex(nextIndex)
      }
    }, WALKTHROUGH_SCENES[sceneIndex].duration)

    return () => window.clearTimeout(timer)
  }, [isPlaying, isComplete, prefersReducedMotion, sceneIndex])

  const replay = () => {
    setSceneIndex(0)
    setIsComplete(false)
    setIsPlaying(true)
  }

  const togglePlay = () => {
    if (isComplete) {
      replay()
      return
    }
    setIsPlaying((value) => !value)
  }

  const scene = WALKTHROUGH_SCENES[sceneIndex]

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3 sm:px-6">
        <p className="text-eyebrow text-ink-subtle">Product walkthrough · Illustrative data</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="btn-secondary min-h-[44px] min-w-[44px] px-3 py-2 text-caption inline-flex items-center justify-center"
            aria-label={isPlaying ? 'Pause walkthrough' : 'Play walkthrough'}
          >
            {isPlaying ? 'Pause' : isComplete ? 'Replay' : 'Play'}
          </button>
          <button
            type="button"
            onClick={replay}
            className="btn-secondary min-h-[44px] min-w-[44px] px-3 py-2 text-caption inline-flex items-center justify-center"
            aria-label="Replay walkthrough"
          >
            Replay
          </button>
        </div>
      </div>

      <div className="relative bg-surface-2 p-4 sm:p-6">
        <CornerBracket />
        <svg
          viewBox="0 0 640 300"
          className="w-full h-auto"
          role="img"
          aria-label={scene.title}
        >
          <SceneVisual sceneId={scene.id} title={scene.title} />
        </svg>

        <p className="mt-4 text-body-sm text-ink max-w-xl" aria-live="polite">
          {scene.title}: {scene.body}
        </p>
        <p className="mt-2 text-caption text-ink-subtle">
          Illustrative data — not a live attendance record.
        </p>
      </div>

      <div className="px-5 py-4 sm:px-6">
        <details>
          <summary className="cursor-pointer text-body-sm text-accent py-2 min-h-[44px] inline-flex items-center">
            Transcript
          </summary>
          <ol className="mt-3 space-y-2 text-body-sm text-ink-muted">
            {WALKTHROUGH_TRANSCRIPT.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </details>
      </div>
    </div>
  )
}

export default ProductWalkthrough
