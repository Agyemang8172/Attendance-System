// SearchInput — the labelled search field, built once for the screens that
// filtered data with a bare unlabelled input (HrDashboard.tsx:237–243, the
// register B row).
//
// A controlled, debounce-free input. The accessible name comes from the
// `label` prop as aria-label (screens that later ship a visible label render
// it themselves and pass it as `labelledBy` instead).
//
// The clear affordance is a real button — touch target ≥ 24px, focusable,
// carrying its own accessible name — not a hover-only icon.

import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6'

export interface SearchInputProps {
  /** Accessible name announced to assistive tech. */
  label: string
  /** Points the name at a caller-rendered <label id>. Overrides `label`. */
  labelledBy?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  /** Extra classes on the input element (uses the shared `.input` style). */
  className?: string
}

const SearchInput = ({
  label,
  labelledBy,
  value,
  onChange,
  placeholder,
  id,
  className = '',
}: SearchInputProps) => {
  const clearValue = () => onChange('')

  return (
    <div className={`relative ${className ? className : ''}`}>
      <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle text-xs pointer-events-none" />
      <input
        type="text"
        id={id}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="input pl-11 pr-10"
      />

      {value !== '' && (
        <button
          type="button"
          onClick={clearValue}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-subtle hover:text-ink transition-colors duration-150 cursor-pointer"
        >
          <FaXmark className="text-sm" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default SearchInput
