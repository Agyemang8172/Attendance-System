// ConfirmDialog — the cancel/confirm pattern on ModalShell (A5 companion).
//
// Replaces the paper confirms hand-built inside ManageStaff (deactivate +
// reactivate) with one accessible dialog: the chrome surface, the token
// eyebrow, and the ModalShell focus contract (trap + return + Escape).
//
// `busy` disables both actions and swaps the confirm label — the same
// "keep the submit disabled while in flight" rule every destructive action
// follows. `danger` renders the confirm button in the error family, for the
// deactivate-style confirmations the PRD §19 item 6 asks to restate the
// consequence of.

import ModalShell from './ModalShell'
import type { ReactNode } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** The accessible name and the serif display heading. */
  title: ReactNode
  /** Restates the consequence — one or two sentences. */
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** In-flight state: both actions disable, confirm label swaps. */
  busyLabel?: string
  busy?: boolean
  eyebrow?: string
  maxWidth?: 'sm' | 'md' | 'lg'
  /** Renders the confirm button in the error family for destructive actions. */
  danger?: boolean
}

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  busyLabel,
  busy = false,
  eyebrow = 'Confirm',
  maxWidth = 'md',
  danger = false,
}: ConfirmDialogProps) => (
  <ModalShell open={open} onClose={onClose} label={eyebrow} maxWidth={maxWidth}>
    <p className="text-eyebrow text-brass-chrome opacity-70 mb-3">{eyebrow}</p>

    <h2 className="text-display-sm text-chrome-ink font-serif leading-tight mb-3">
      {title}
    </h2>

    <div className="text-chrome-ink-muted text-sm font-sans space-y-2 mb-8">
      {body}
    </div>

    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="px-4 py-2 text-chrome-ink-muted hover:text-chrome-ink text-button font-sans transition-colors duration-150 disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      {/* On chrome the accent polarity forbids --accent (#b45309); the
          destructive confirm takes the --error family's chrome twin. Fills
          carry ink text on both, per the measured ratios in the token
          comments (brass 9.31:1, chrome-error 6.45:1 on ink). */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className={`btn px-[14px] py-[8px] rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
          danger ? 'bg-chrome-error text-chrome-ink' : 'bg-brass-chrome text-ink'
        }`}
      >
        {busy && busyLabel ? busyLabel : confirmLabel}
      </button>
    </div>
  </ModalShell>
)

export default ConfirmDialog
