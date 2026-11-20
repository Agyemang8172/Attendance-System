// ModalShell — the one dialog system (M8-GAP-REGISTER A5 + the "All ui/
// modals" B row).
//
// Today two dialog grammars ship side by side — the dark chrome shells in
// ui/*Modal (Escape works, but no focus trap, no focus return, one dialog
// missing its accessible name) and the paper confirms inside ManageStaff
// (role="dialog" missing on the deactivate twin). ModalShell is the shared
// chrome shell that unifies them:
//
//   · role="dialog" + aria-modal="true", named via `label` or `labelledBy`
//   · dark chrome surface (bg-chrome + chrome-line border) per ui/ modals
//   · Escape closes (the existing pattern, honoured unchanged)
//   · focus is trapped while open — Tab/Shift+Tab cycle within the shell,
//     focus lands on the first focusable child on open
//   · focus returns to the previously focused element on close
//   · backdrop click closes; the scrim uses the token overlay-scrim class
//     (index.css), not an arbitrary `bg-canvas/80`
//
// ConfirmDialog composes this shell for the cancel/confirm pattern; bespoke
// screens stay untouched this phase and migrate as each phase rewrites them.

import { useEffect, useRef, type ReactNode } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

export interface ModalShellProps {
  open: boolean
  onClose: () => void
  /** Accessible name of the dialog, when the caller renders the label inline. */
  label?: string
  /** id of the element that names the dialog (a titled header). */
  labelledBy?: string
  children?: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
}

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const maxWidths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

const ModalShell = ({
  open,
  onClose,
  label,
  labelledBy,
  children,
  maxWidth = 'lg',
}: ModalShellProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // The close handler is read through a ref so the open-effect below runs
  // once per open — not on every parent re-render that passes a fresh inline
  // onClose.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    // Focus-return anchor — captured while opening, restored in cleanup.
    returnFocusRef.current = document.activeElement as HTMLElement | null

    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTOR
    )
    focusables?.[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      // Focus return — the other anchor of keyboard navigation.
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
    }
  }, [open])

  if (!open) return null

  // Tab / Shift+Tab cycle inside the panel — the native focus trap.
  // (No visibility filter: jsdom computes no layout, so offsetParent-based
  // checks read null there; the shell only renders real content when open.)
  const onTrapKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    )
    if (focusables.length === 0) return

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const current = document.activeElement

    if (e.shiftKey && current === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && current === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overlay-scrim backdrop-blur-sm flex items-center justify-center p-4"
      onClick={closeRef.current}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        onKeyDown={onTrapKey}
        onClick={(e) => e.stopPropagation()}
        className={[
          'relative bg-chrome border border-chrome-line shadow-elevated',
          'rounded-lg p-8 w-full',
          'max-h-screen overflow-y-auto',
          maxWidths[maxWidth],
        ].join(' ')}
      >
        {/* MERIDIAN corner bracket — the ui/ modal signature */}
        <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-brass-chrome opacity-30 pointer-events-none" />
        {children}
      </div>
    </div>
  )
}

export default ModalShell
