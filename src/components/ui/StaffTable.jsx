// StaffTable — Linear styled employee list for superadmin user management.
//
// Props:
//   users           → array of user objects from getAllUsers
//   onEdit          → (user) => void · opens edit modal
//   onDeactivate    → (user) => void · fires deactivate confirm
//   onResetPassword → (user) => void · opens password-reset modal
//   onReactivate    → (user) => void · fires reactivate confirm
//   onAdd           → () => void · empty-state "Add Employee" action
//   inactive        → boolean · render the deactivated list (Reactivate
//                     replaces Deactivate; rows carry a status pill)
//   canReactivate   → boolean · only SUPERADMIN may flip isActive back on

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

// Active empty state gets a real action: the caller can open the Add modal.
const EmptyState = ({ inactive, onAdd, onShowActive }) => (
  <tr>
    <td colSpan={99}>
      <div className="relative flex flex-col items-center justify-center py-14 text-center">
        <span className="absolute top-4 left-6 w-5 h-5 border-t-2 border-l-2 border-accent opacity-30" />
        <span className="absolute bottom-4 right-6 w-5 h-5 border-b-2 border-r-2 border-accent opacity-30" />
        <p className="text-body-sm font-sans text-ink-muted">
          {inactive ? 'No deactivated employees.' : 'No employees found.'}
        </p>
        <p className="text-caption font-sans text-ink-tertiary mt-1">
          {inactive
            ? 'Everyone is currently active.'
            : 'Add an employee to get started.'}
        </p>
        <button
          onClick={inactive ? onShowActive : onAdd}
          className="mt-4 btn-primary"
        >
          {inactive ? 'View Active Employees' : '+ Add Employee'}
        </button>
      </div>
    </td>
  </tr>
)

const StaffTable = ({
  users = [],
  onEdit,
  onDeactivate,
  onResetPassword,
  onReactivate,
  onAdd,
  onShowActive,
  inactive = false,
  canReactivate = false,
}) => {
  const showStatus = inactive

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
              {showStatus && <TH>Status</TH>}
              <TH>Action</TH>
            </tr>
          </thead>

          <tbody>
            {users.length === 0 ? (
              <EmptyState
                inactive={inactive}
                onAdd={onAdd}
                onShowActive={onShowActive}
              />
            ) : (
              users.map((user, index) => (
                <tr
                  key={user.id || user._id || index}
                  className={[
                    'border-b border-hairline last:border-b-0',
                    'transition-colors duration-150 hover:bg-surface-2',
                    index % 2 === 0 ? 'bg-surface-1' : 'bg-surface-2/50',
                    inactive ? 'text-ink-muted' : '',
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

                  {showStatus && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-[2px] rounded-full border border-hairline-strong bg-surface-2 text-caption font-medium font-mono text-ink-muted">
                        Inactive
                      </span>
                    </td>
                  )}

                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => onEdit?.(user)}
                      className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                    >
                      Edit
                    </button>
                    <span className="text-ink-tertiary mx-1">·</span>
                    {!inactive && (
                      <>
                        <button
                          onClick={() => onResetPassword?.(user)}
                          className="text-ink-muted font-mono text-body-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                        >
                          Reset
                        </button>
                        <span className="text-ink-tertiary mx-1">·</span>
                      </>
                    )}
                    {inactive ? (
                      <button
                        onClick={() => onReactivate?.(user)}
                        disabled={!canReactivate}
                        title={
                          canReactivate
                            ? undefined
                            : 'Only a SUPERADMIN can reactivate an account.'
                        }
                        className="text-accent font-mono text-body-sm hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1 disabled:text-ink-tertiary disabled:cursor-not-allowed disabled:hover:text-ink-tertiary"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => onDeactivate?.(user)}
                        className="text-error font-mono text-body-sm hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded px-1"
                      >
                        Deactivate
                      </button>
                    )}
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