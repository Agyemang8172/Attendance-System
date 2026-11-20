/**
 * ModalShell — the one dialog system's keyboard contract.
 *
 * Covers the three behaviours the register B row closed:
 *   · the dialog is labelled and modal (role/aria-label/aria-modal)
 *   · focus is trapped — Tab at the last control cycles to the first,
 *     Shift+Tab at the first cycles to the last
 *   · Escape closes, and focus returns to the element that opened the shell
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModalShell from '../components/ui/ModalShell'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useState } from 'react'

function Harness({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <ModalShell open={open} onClose={() => setOpen(false)} label="Test dialog">
        <h2 id="dialog-title">Deactivate employee?</h2>
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </ModalShell>
    </>
  )
}

describe('ModalShell', () => {
  it('renders a labelled modal dialog', () => {
    render(<Harness />)

    const dialog = screen.getByRole('dialog', { name: /test dialog/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('focuses the first focusable child on open and cycles the focus trap', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /first action/i })).toHaveFocus()
    })

    // Tab from the second control should cycle back to the first (exclusive
    // of the opener — the trap keeps focus inside the shell).
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: /first action/i })).toHaveFocus()

    // Shift+Tab at the first control wraps to the last.
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: /second action/i })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the element that opened it', async () => {
    // Start closed so the opener click is the last real focus before open.
    render(<Harness initialOpen={false} />)

    const opener = screen.getByRole('button', { name: /open dialog/i })
    const user = userEvent.setup()
    await user.click(opener)

    expect(screen.getByRole('dialog', { name: /test dialog/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(opener).toHaveFocus()
  })

  it('closes on backdrop click', async () => {
    render(<Harness />)

    // The scrim itself (the fixed overlay), not the panel.
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('can be named by aria-labelledby instead of aria-label', () => {
    render(
      <ModalShell
        open
        onClose={() => {}}
        labelledBy="dialog-title"
        label={undefined}
      >
        <h2 id="dialog-title">Ledger</h2>
      </ModalShell>
    )

    expect(screen.getByRole('dialog', { name: /ledger/i })).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('composes the shell with both actions and confirms on click', async () => {
    const user = userEvent.setup()
    let calls = 0
    const onConfirm = () => {
      calls += 1
    }

    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Deactivate employee?"
        body={<p>They lose access immediately.</p>}
        confirmLabel="Deactivate"
        busyLabel="Deactivating…"
        busy={false}
      />
    )

    const dialog = screen.getByRole('dialog', { name: /confirm/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByRole('button', { name: /deactivate/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /deactivate/i }))
    expect(calls).toBe(1)
  })

  it('disables the actions and swaps the confirm label while busy', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Deactivate employee?"
        body={<p>They lose access immediately.</p>}
        confirmLabel="Deactivate"
        busyLabel="Deactivating…"
        busy
      />
    )

    expect(screen.getByRole('button', { name: /deactivating/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })
})
