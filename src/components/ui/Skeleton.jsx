// Skeleton loading primitives — §17 of docs/DESIGN_PROPOSAL.md.
//
// Geometry-matched placeholders replace the "Loading records…" text state:
// a surface-2 block on canvas reads as an empty ledger slot of the correct
// shape, so the frame the user is waiting for is already visible.

const Skeleton = ({ className = '', label = 'Loading' }) => (
  <div
    className={`animate-pulse rounded-md bg-surface-2 ${className}`}
    role="status"
    aria-label={label}
  />
)

// ─── Bento skeleton — hero block + two dense cards ───────────────────────────

export const BentoSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <Skeleton className="h-32 lg:col-span-2" label="Loading key metrics" />
    <Skeleton className="h-32" />
    <Skeleton className="h-32" />
  </div>
)

// ─── Table skeleton — header row + body rows, geometry-matched ───────────────

const TableRowSkeleton = ({ cells }) => (
  <div className="flex items-center gap-6 px-4">
    {cells.map((width, i) => (
      <Skeleton
        key={i}
        className={`h-4 ${width}`}
        label="Loading table row"
      />
    ))}
  </div>
)

export const TableSkeleton = ({ showEmployee = false }) => {
  const headerCells = showEmployee
    ? ['w-32', 'w-24', 'w-24', 'w-20', 'w-20', 'w-16', 'w-20']
    : ['w-24', 'w-20', 'w-20', 'w-16', 'w-20']
  const rowCells = showEmployee
    ? ['w-28', 'w-20', 'w-16', 'w-16', 'w-16', 'w-14', 'w-16']
    : ['w-16', 'w-16', 'w-16', 'w-14', 'w-16']

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center gap-6 px-4 py-3 border-b border-hairline bg-surface-2">
        {headerCells.map((width, i) => (
          <Skeleton
            key={i}
            className={`h-2.5 ${width}`}
            label="Loading table header"
          />
        ))}
      </div>
      <div className="divide-y divide-hairline">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="py-4">
            <TableRowSkeleton cells={rowCells} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Chart skeleton — card frame with a blank plot ───────────────────────────

export const ChartSkeleton = () => (
  <div className="card-elevated">
    <Skeleton className="h-4 w-40 mb-6" label="Loading chart title" />
    <Skeleton className="h-44 w-full" label="Loading chart" />
  </div>
)

// ─── Calendar skeleton — 5 × 7 grid of day cells ─────────────────────────────

export const CalendarSkeleton = () => (
  <div className="card-elevated">
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {Array.from({ length: 35 }).map((_, i) => (
        <Skeleton
          key={i}
          className="aspect-square rounded-lg"
          label="Loading calendar"
        />
      ))}
    </div>
  </div>
)

// ─── Badge grid skeleton — 4 profile cards ───────────────────────────────────

export const BadgeGridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {[0, 1, 2, 3].map((_, i) => (
      <Skeleton key={i} className="h-40" label="Loading achievement" />
    ))}
  </div>
)

export default Skeleton