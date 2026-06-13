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
  return `${hours.toFixed(2)} hrs`
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
  <th className="px-4 py-3 text-left text-xs font-sans font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap">
    {children}
  </th>
)

const TD = ({ children, muted = false, mono = false }) => (
  <td
    className={[
      'px-4 py-3 text-sm whitespace-nowrap',
      mono ? 'font-mono' : 'font-sans',
      muted ? 'text-slate-500' : 'text-slate-200',
    ].join(' ')}
  >
    {children}
  </td>
)

const EmptyState = () => (
  <tr>
    <td colSpan={99}>
      <div className="relative flex flex-col items-center justify-center py-14 text-center">
        <span className="absolute top-4 left-6 w-5 h-5 border-t-2 border-l-2 border-yellow-500/30" />
        <span className="absolute bottom-4 right-6 w-5 h-5 border-b-2 border-r-2 border-yellow-500/30" />
        <p className="text-slate-400 text-sm font-sans">
          No attendance records found.
        </p>
        <p className="text-slate-600 text-xs font-sans mt-1">
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
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">

      {/* MERIDIAN corner bracket */}
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-yellow-500 opacity-30 pointer-events-none z-10" />

      {/* Scroll wrapper — table stays intact on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">

          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
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
                  key={record._id || index}
                  className={[
                    'border-b border-slate-800 last:border-b-0',
                    'transition-colors duration-150 hover:bg-slate-800/60',
                    index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30',
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