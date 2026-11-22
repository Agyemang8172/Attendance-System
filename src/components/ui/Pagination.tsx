// Pagination — the one shared pagination control (M8-GAP-REGISTER B row
// "Tables (both)": no `aria-live` page change before this).
//
// Replaces the two variants that shipped side by side:
//   AttendanceTable footer — chevron icon buttons, already with labels but
//                            without a live page announcement
//   ManageStaff footer     — ‹ Prev / Next › .btn-secondary pair, unlabelled
//
// Grammar: `[caption]  ‹ prev · Page x of y · next ›` — chevron buttons carry
// their own accessible names, the page indicator is the polite live region
// that announces the page change to screen readers, and when the caller knows
// server-side totals the caption renders the same "Showing a–b of n records"
// range the AttendanceTable footer showed.

import { FaChevronLeft, FaChevronRight } from 'react-icons/fa6'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Known total with pageSize renders the "Showing a–b of n" caption. */
  totalItems?: number
  pageSize?: number
  /** Accessible name for the control group, e.g. "Attendance table pages". */
  ariaLabel?: string
  className?: string
}

const navButton =
  'w-8 h-8 flex items-center justify-center rounded-md border border-hairline text-ink-subtle hover:text-ink hover:bg-surface-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-subtle'

const Pagination = ({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  ariaLabel,
  className = '',
}: PaginationProps) => {
  const atFirst = page <= 1
  const atLast = page >= totalPages

  const rangeCaption =
    totalItems !== undefined && pageSize !== undefined
      ? totalItems === 0
        ? null
        : {
            start: (page - 1) * pageSize + 1,
            end: Math.min(page * pageSize, totalItems),
            total: totalItems,
          }
      : null

  return (
    <div
      className={`flex items-center justify-between gap-4 ${className ? className : ''}`}
      aria-label={ariaLabel}
    >
      <p className="text-caption text-ink-muted">
        {rangeCaption ? (
          <>
            Showing{' '}
            <span className="font-mono text-ink">
              {rangeCaption.start}–{rangeCaption.end}
            </span>{' '}
            of{' '}
            <span className="font-mono text-ink">{rangeCaption.total}</span>{' '}
            records
          </>
        ) : null}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={atFirst}
          aria-label="Previous page"
          className={navButton}
        >
          <FaChevronLeft className="text-xs" aria-hidden="true" />
        </button>

        {/* Polite live region — the page change announcement the register
            B row asked for. Rendered in the control so AT users hear the
            result of pressing prev/next without moving focus. */}
        <span
          aria-live="polite"
          className="text-caption font-mono text-ink-muted min-w-24 text-center"
        >
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={atLast}
          aria-label="Next page"
          className={navButton}
        >
          <FaChevronRight className="text-xs" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default Pagination
