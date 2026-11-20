/**
 * Pill, SearchInput and Pagination — the small shared primitives.
 *
 * Covers what the register rows asked for:
 *   · Pill tone variants render the soft-tint ground (bg-*-soft) per the
 *     token system, not per-caller variant maps
 *   · SearchInput carries its accessible name and exposes a clear control
 *   · Pagination exposes labelled prev/next buttons and announces the page
 *     change via the polite live region
 */
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Pill from '../components/ui/Pill'
import SearchInput from '../components/ui/SearchInput'
import Pagination from '../components/ui/Pagination'

describe('Pill', () => {
  it('renders each tone variant on the soft-tint token grounds', () => {
    const { container } = render(
      <>
        <Pill tone="neutral">Unknown</Pill>
        <Pill tone="accent">Open</Pill>
        <Pill tone="success">Closed</Pill>
        <Pill tone="warning">Late</Pill>
        <Pill tone="error">Absent</Pill>
      </>
    )

    expect(container.querySelector('span.rounded-full')).toBeTruthy()

    const pills = container.querySelectorAll('span.rounded-full')
    expect(pills).toHaveLength(5)

    const classes = Array.from(pills).map((p) => p.className)
    expect(classes[0]).toContain('bg-surface-2')
    expect(classes[1]).toContain('bg-accent-soft')
    expect(classes[2]).toContain('bg-success-soft')
    expect(classes[3]).toContain('bg-warning-soft')
    expect(classes[4]).toContain('bg-error-soft')

    // The grammar is uniform: border + pill radius + mono caption on all.
    for (const cls of classes) {
      expect(cls).toContain('border')
      expect(cls).toContain('font-mono')
    }
  })

  it('falls back to the neutral paper chip and renders plain labels', () => {
    render(<Pill>Something Else</Pill>)

    const pill = screen.getByText(/something else/i)
    expect(pill).toHaveClass('bg-surface-2')
  })
})

describe('SearchInput', () => {
  it('carries the accessible name and calls back as a controlled input', async () => {
    const user = userEvent.setup()
    let latest = ''
    render(
      <SearchInput
        label="Search attendance"
        value={latest}
        onChange={(v) => {
          latest = v
          // The visual is controlled by the caller; for the assert we re-render
          // with the new value by typing into the same element state.
        }}
      />
    )

    await user.type(screen.getByRole('textbox', { name: /search attendance/i }), 'x')
    expect(latest).toBe('x')
  })

  it('shows a clear affordance only while there is text, and clears on click', async () => {
    function Harness() {
      const [value, setValue] = useState('Ada')
      return (
        <SearchInput
          label="Search attendance"
          value={value}
          onChange={setValue}
        />
      )
    }
    const user = userEvent.setup()
    render(<Harness />)

    const clear = screen.getByRole('button', { name: /clear search/i })
    await user.click(clear)

    expect(screen.getByRole('textbox', { name: /search attendance/i })).toHaveValue('')
    expect(
      screen.queryByRole('button', { name: /clear search/i })
    ).not.toBeInTheDocument()
  })
})

describe('Pagination', () => {
  it('labels both page buttons and announces the page politely', () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        onPageChange={() => {}}
        ariaLabel="Attendance table pages"
      />
    )

    expect(
      screen.getByRole('button', { name: /previous page/i })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: /next page/i })).toBeEnabled()

    const live = screen.getByText(/page 2 of 5/i)
    expect(live).toHaveAttribute('aria-live', 'polite')
  })

  it('disables prev on the first page and next on the last', () => {
    const { unmount } = render(
      <Pagination page={1} totalPages={3} onPageChange={() => {}} />
    )
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next page/i })).toBeEnabled()
    unmount()

    render(<Pagination page={3} totalPages={3} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: /previous page/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled()
  })

  it('fires the page change in the right direction', async () => {
    const user = userEvent.setup()
    const seen: number[] = []
    render(
      <Pagination
        page={2}
        totalPages={5}
        onPageChange={(p) => seen.push(p)}
      />
    )

    await user.click(screen.getByRole('button', { name: /previous page/i }))
    await user.click(screen.getByRole('button', { name: /next page/i }))

    expect(seen).toEqual([1, 3])
  })

  it('renders the range caption when server-side totals are known', () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        onPageChange={() => {}}
        totalItems={46}
        pageSize={12}
      />
    )

    expect(screen.getByText(/showing/i)).toBeInTheDocument()
    expect(screen.getByText(/13–24/)).toBeInTheDocument()
    expect(screen.getByText(/46/)).toBeInTheDocument()
  })
})
