// StaffTable — Linear styled employee list for superadmin user management.
//
// Props:
//   users        → array of active user objects from getAllUsers
//   onEdit       → (user) => void · opens edit modal
//   onDeactivate → (user) => void · fires confirm action

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getFullName = (user) => {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim()
  return name || 'Unnamed user'
}

const roleConfig = {
  STAFF:      { label: 'Staff',      classes: 'bg-ink-subtle/15 text-ink-subtle border-ink-subtle/20' },
  HR:         { label: 'HR',         classes: 'bg-accent/15 text-accent border-accent/20' },
  SUPERADMIN: { label: 'Superadmin', classes: 'bg-warning/15 text-warning border-warning/20' },
}

const RolePill = ({ role }) => {
  const config = roleConfig[role] || {
    label: role || 'Unknown',
    classes: 'bg-ink-subtle/15 text-ink-subtle border-ink-subtle/20',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-[2px] rounded-full border text-caption font-medium font-mono ${config.classes}`}
    >
      {config.label}
    </span>
  )
}

const TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-widest text-ink-muted whitespace-nowrap">
    {children}
  </th>
)

const EmptyState = () => (
  <tr>
    <td colSpan={99}>
      <div className="relative flex flex-col items-center justify-center py-14 text-center">
        <span className="absolute top-4 left-6 w-5 h-5 border-t-2 border-l-2 border-accent opacity-30" />
        <span className="absolute bottom-4 right-6 w-5 h-5 border-b-2 border-r-2 border-accent opacity-30" />
        <p className="text-body-sm font-sans text-ink-muted">No employees found.</p>
        <p className="text-caption font-sans text-ink-tertiary mt-1">
          Add an employee to get started.
        </p>
      </div>
    </td>
  </tr>
)

const StaffTable = ({ users = [], onEdit, onDeactivate }) => {
  return (
    <div className="relative card overflow-hidden">

      {/* Linear corner bracket */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none z-10" />

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">

          <thead>
            <tr className="bg-surface-2 border-b border-hairline">
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Action</TH>
            </tr>
          </thead>

          <tbody>
            {users.length === 0 ? (
              <EmptyState />
            ) : (
              users.map((user, index) => (
                <tr
                  key={user.id || user._id || index}
                  className={[
                    'border-b border-hairline last:border-b-0',
                    'transition-colors duration-150 hover:bg-surface-2',
                    index % 2 === 0 ? 'bg-surface-1' : 'bg-surface-2/50',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 text-body-sm whitespace-nowrap font-sans text-ink">
                    {getFullName(user)}
                  </td>

                  <td className="px-4 py-3 text-body-sm whitespace-nowrap font-mono text-ink-subtle">
                    {user.email || '--'}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <RolePill role={user.role} />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => onEdit?.(user)}
                      className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                    >
                      Edit
                    </button>
                    <span className="text-ink-tertiary mx-1">·</span>
                    <button
                      onClick={() => onDeactivate?.(user)}
                      className="text-error font-mono text-body-sm hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>
    </div>
  )
}

export default StaffTable