// StaffTable — employee list for superadmin user management.
//
// Mirrors AttendanceTable's MERIDIAN surface (navy card, zebra rows, single
// top-right corner bracket) but renders USERS, not attendance records.
//
// Props:
//   users        → array of active user objects from getAllUsers
//   onDeactivate → (user) => void · fired when a row's "Deactivate" is clicked.
//                  The parent page owns the confirm modal; this table only
//                  signals intent. It does not call the API itself.

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getFullName = (user) => {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim()
  return name || 'Unnamed user'
}

// ─── Role pill — same tint + border recipe as StatBadge ─────────────────────────

const roleConfig = {
  staff:      { label: 'Staff',      classes: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  hr:         { label: 'HR',         classes: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  superadmin: { label: 'Superadmin', classes: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
}

const RolePill = ({ role }) => {
  // Fallback keeps an unknown/missing role from breaking the row.
  const config = roleConfig[role] || {
    label: role || 'Unknown',
    classes: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium font-mono ${config.classes}`}
    >
      {config.label}
    </span>
  )
}

// ─── Table sub-components (matched to AttendanceTable) ──────────────────────────

const TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs font-sans font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap">
    {children}
  </th>
)

const EmptyState = () => (
  <tr>
    <td colSpan={99}>
      <div className="relative flex flex-col items-center justify-center py-14 text-center">
        <span className="absolute top-4 left-6 w-5 h-5 border-t-2 border-l-2 border-yellow-500/30" />
        <span className="absolute bottom-4 right-6 w-5 h-5 border-b-2 border-r-2 border-yellow-500/30" />
        <p className="text-slate-400 text-sm font-sans">No employees found.</p>
        <p className="text-slate-600 text-xs font-sans mt-1">
          Add an employee to get started.
        </p>
      </div>
    </td>
  </tr>
)

// ─── StaffTable ─────────────────────────────────────────────────────────────────

const StaffTable = ({ users = [], onDeactivate }) => {
  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">

      {/* MERIDIAN corner bracket */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-yellow-500 opacity-30 pointer-events-none z-10" />

      {/* Scroll wrapper — table stays intact on mobile, same as AttendanceTable */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">

          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
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
                  key={user._id || index}
                  className={[
                    'border-b border-slate-800 last:border-b-0',
                    'transition-colors duration-150 hover:bg-slate-800/60',
                    index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 text-sm whitespace-nowrap font-sans text-slate-200">
                    {getFullName(user)}
                  </td>

                  <td className="px-4 py-3 text-sm whitespace-nowrap font-mono text-slate-500">
                    {user.email || '--'}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <RolePill role={user.role} />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => onDeactivate?.(user)}
                      className="text-red-400 font-mono text-sm hover:text-red-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 rounded px-1"
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