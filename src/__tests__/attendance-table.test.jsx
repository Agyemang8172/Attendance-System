/**
 * AttendanceTable — §8.4 ledger behaviour: sortable columns with aria-sort,
 * pagination with a visible total, and the HR exception-first default.
 *
 * The component takes records as a prop, so there is no API surface here —
 * the fixture below only needs enough fields to exercise the render logic.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttendanceTable from '../components/ui/AttendanceTable'

// Local-time safe clock-in, so the 06:30 late threshold reads the same
// regardless of the host timezone.
const at = (h, m) => new Date(2026, 9, 5, h, m).toISOString()

const rec = (overrides = {}) => ({
  id: `r-${Math.random().toString(36).slice(2)}`,
  date: '2026-10-05T00:00:00.000Z',
  clockIn: at(7, 0),
  clockOut: at(16, 0),
  hoursWorked: 8.5,
  sessionStatus: 'CLOSED',
  user: { firstName: 'Alan', lastName: 'Turing', department: 'Engineering' },
  ...overrides,
})

const bodyRows = () => screen.getAllByRole('row').slice(1)

describe('AttendanceTable', () => {
  it('announces the active sort on the Date column header', () => {
    render(<AttendanceTable records={[rec()]} />)
    expect(screen.getByRole('columnheader', { name: /date/i })).toHaveAttribute(
      'aria-sort',
      'descending'
    )
  })

  it('sorts newest-first by default and oldest-first after clicking Date', async () => {
    const user = userEvent.setup()
    const records = [
      rec({ id: 'a', date: '2026-10-03T00:00:00.000Z', user: { firstName: 'Alan', lastName: 'Turing', department: 'Engineering' } }),
      rec({ id: 'b', date: '2026-10-08T00:00:00.000Z', user: { firstName: 'Ada', lastName: 'Lovelace', department: 'Engineering' } }),
      rec({ id: 'c', date: '2026-10-06T00:00:00.000Z', user: { firstName: 'Grace', lastName: 'Hopper', department: 'Engineering' } }),
    ]
    render(<AttendanceTable records={records} showEmployee />)

    expect(bodyRows()[0]).toHaveTextContent('Ada')

    const dateHeader = screen.getByRole('columnheader', { name: /date/i })
    await user.click(within(dateHeader).getByRole('button'))

    expect(dateHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(bodyRows()[0]).toHaveTextContent('Alan')
  })

  // The footer mixes text and <span> emphasis, so a function matcher on the
  // paragraph's full textContent is needed (getByText only sees direct nodes).
  const footerLine = (text) =>
    screen.getByText((_, el) => el?.tagName === 'P' && el.textContent.includes(text))

  it('paginates in rows of twelve with a visible total', async () => {
    const user = userEvent.setup()
    const records = Array.from({ length: 15 }, (_, i) =>
      rec({
        id: `r-${i}`,
        date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      })
    )
    render(<AttendanceTable records={records} />)

    expect(footerLine('Showing 1–12 of 15 records')).toBeInTheDocument()
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(footerLine('Showing 13–15 of 15 records')).toBeInTheDocument()
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument()
  })

  it('keeps late rows on top and marks them when exceptionsFirst is set', () => {
    const records = [
      rec({ id: 'on', clockIn: at(6, 0), user: { firstName: 'On', lastName: 'Time', department: 'Ops' } }),
      rec({ id: 'late', clockIn: at(7, 45), user: { firstName: 'Late', lastName: 'Arriver', department: 'Ops' } }),
    ]
    render(<AttendanceTable records={records} showEmployee exceptionsFirst />)

    const first = bodyRows()[0]
    expect(first).toHaveTextContent('Late')
    expect(first).toHaveTextContent('Arriver')
    expect(first).toHaveClass('border-l-warning')
  })

  it('shows the empty state when there are no records', () => {
    render(<AttendanceTable records={[]} />)
    expect(screen.getByText('No attendance records found.')).toBeInTheDocument()
  })
})