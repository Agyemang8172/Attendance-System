import StatBadge from './StatBadge'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatTime = (dateStr) => {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatHours = (hours) => {
  if (hours == null || hours === 0) return '--'
  return `${Number(hours).toFixed(2)} hrs`
}

const getEmployeeName = (record) => {
  if (!record.user) return 'Former Employee'
  return `${record.user.firstName} ${record.user.lastName}`
}

const getDepartment = (record) => {
  return record.user?.department || '--'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-widest text-ink-muted whitespace-nowrap">
    {children}
  </th>
)

const TD = ({ children, muted = false, mono = false }) => (
  <td
    className={[
      'px-4 py-3 text-body-sm whitespace-nowrap',
      mono ? 'font-mono' : 'font-sans',
      muted ? 'text-ink-subtle' : 'text-ink',
    ].join(' ')}
  >
    {children}
  </td>
)

const EmptyState = () => (
  <tr>
    <td colSpan={99}>
      <div className="relative flex flex-col items-center justify-center py-14 text-center">
        <span className="absolute top-4 left-6 w-5 h-5 border-t-2 border-l-2 border-accent opacity-30" />
        <span className="absolute bottom-4 right-6 w-5 h-5 border-b-2 border-r-2 border-accent opacity-30" />
        <p className="text-body-sm font-sans text-ink-muted">
          No attendance records found.
        </p>
        <p className="text-caption font-sans text-ink-tertiary mt-1">
          Records will appear here once attendance is logged.
        </p>
      </div>
    </td>
  </tr>
)

// ─── AttendanceTable ──────────────────────────────────────────────────────────
//
//  Props:
//    records      → attendance array from API
//    showEmployee → false = staff view (5 cols)
//                   true  = HR/admin view (7 cols)
//
// ─────────────────────────────────────────────────────────────────────────────

const AttendanceTable = ({ records = [], showEmployee = false }) => {
  return (
    <div className="relative card overflow-hidden">

      {/* Linear corner bracket */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none z-10" />

      {/* Scroll wrapper — table stays intact on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">

          <thead>
            <tr className="bg-surface-2 border-b border-hairline">
              {showEmployee && (
                <>
                  <TH>Employee</TH>
                  <TH>Department</TH>
                </>
              )}
              <TH>Date</TH>
              <TH>Clock In</TH>
              <TH>Clock Out</TH>
              <TH>Hours</TH>
              <TH>Status</TH>
            </tr>
          </thead>

          <tbody>
            {records.length === 0 ? (
              <EmptyState />
            ) : (
              records.map((record, index) => (
                <tr
                  key={record.id || record._id || index}
                  className={[
                    'border-b border-hairline last:border-b-0',
                    'transition-colors duration-150 hover:bg-surface-2',
                    index % 2 === 0 ? 'bg-surface-1' : 'bg-surface-2/50',
                  ].join(' ')}
                >
                  {showEmployee && (
                    <>
                      <TD muted={!record.user}>
                        {getEmployeeName(record)}
                      </TD>
                      <TD muted>{getDepartment(record)}</TD>
                    </>
                  )}

                  <TD mono>{formatDate(record.date)}</TD>
                  <TD mono>{formatTime(record.clockIn)}</TD>
                  <TD mono muted={!record.clockOut}>
                    {formatTime(record.clockOut)}
                  </TD>
                  <TD mono muted={!record.hoursWorked}>
                    {formatHours(record.hoursWorked)}
                  </TD>

                  <td className="px-4 py-3">
                    <StatBadge status={record.sessionStatus} />
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

export default AttendanceTable