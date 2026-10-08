// Type declaration for Skeleton.jsx — keeps the new loading primitives typed
// for the .tsx pages that consume them.

declare const Skeleton: import('react').FC<{ className?: string; label?: string }>

export const BentoSkeleton: import('react').FC<Record<string, never>>
export const TableSkeleton: import('react').FC<{ showEmployee?: boolean }>
export const ChartSkeleton: import('react').FC<Record<string, never>>
export const CalendarSkeleton: import('react').FC<Record<string, never>>
export const BadgeGridSkeleton: import('react').FC<Record<string, never>>

export default Skeleton