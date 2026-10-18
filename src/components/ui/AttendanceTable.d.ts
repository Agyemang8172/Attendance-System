// Type declaration for AttendanceTable.jsx — the sortable, paginated
// attendance ledger. Records are the API's attendance shape; the component
// tolerates partial rows, so the fields it reads stay optional here.
import type { AttendanceRecord } from '../../types'

export interface AttendanceTableProps {
  records?: AttendanceRecord[]
  showEmployee?: boolean
  exceptionsFirst?: boolean
  onRowClick?: (record: AttendanceRecord) => void
}

declare const AttendanceTable: import('react').FC<AttendanceTableProps>

export default AttendanceTable
