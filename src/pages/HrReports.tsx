import { useState, useEffect, useMemo } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionHeader from '../components/ui/SectionHeader'
import FilterBar from '../components/ui/FilterBar'
import { BentoSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import { formatTodayLong, formatShortDate } from '../lib/attendance-format'
import AttendanceTable from '../components/ui/AttendanceTable.tsx'
import Pagination from '../components/ui/Pagination'

const PAGE_SIZE = 12

type ReportType = 'register' | 'punctuality' | 'exceptions'

interface ReportFilters {
  startDate: string
  endDate: string
  groupBy?: 'employee' | 'shift' | 'day'
  employeeId?: string
  shiftId?: string
}

function HrReports() {
  const user = getCurrentUser()

  const [reportType, setReportType] = useState<ReportType>('register')
  const [records, setRecords] = useState<any[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetching, setFetching] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)

  // Filter state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [groupBy, setGroupBy] = useState<'employee' | 'shift' | 'day'>('day')
  const [employeeId, setEmployeeId] = useState('')
  const [shiftId, setShiftId] = useState('')

  const fetchReport = async (targetPage = 1, isExport = false) => {
    setFetching(true)
    if (isExport) setExporting(true)
    try {
      let endpoint = ''
      const params: Record<string, string> = {
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      }

      if (reportType === 'register') {
        endpoint = '/reports/attendance-register'
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
        if (employeeId) params.employeeId = employeeId
        if (shiftId) params.shiftId = shiftId
      } else if (reportType === 'punctuality') {
        endpoint = '/reports/punctuality-summary'
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
        params.groupBy = groupBy
      } else if (reportType === 'exceptions') {
        endpoint = '/reports/exceptions'
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
      }

      if (isExport) {
        params.format = 'csv'
        const res = await api.get(`${endpoint}/export`, { params, responseType: 'blob' })
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const filename = `attendance-${reportType}-${startDate || 'all'}-to-${endDate || 'all'}.csv`
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Export complete.')
        return
      }

      const res = await api.get(endpoint, { params })
      setRecords(res.data.data || [])
      const pag = res.data.pagination
      if (pag) {
        setPage(pag.currentPage)
        setTotalPages(pag.totalPages)
        setTotalRecords(pag.totalRecords || pag.total || 0)
      }
    } catch (_error) {
      toast.error(isExport ? 'Export failed.' : 'Failed to load report.')
    } finally {
      setFetching(false)
      setExporting(false)
    }
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(1)
    }
  }, [reportType, startDate, endDate, groupBy, employeeId, shiftId])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchReport(newPage)
    }
  }

  const handleExport = () => {
    if (!startDate || !endDate) {
      toast.error('Please select a date range before exporting.')
      return
    }
    fetchReport(1, true)
  }

  const showEmployeeColumn = reportType === 'register'
  const showShiftColumn = reportType === 'register'
  const exceptionsFirst = reportType === 'exceptions'

  const filteredRecords = useMemo(() => records, [records])

  return (
    <Layout>
      <PageHeader
        eyebrow={formatTodayLong()}
        title="Reports"
      />

      <SectionHeader title="Report Configuration" />
      <div className="card-elevated relative overflow-hidden p-6 mb-6">
        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-caption text-ink-muted mb-1 font-sans">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="input"
            >
              <option value="register">Attendance Register</option>
              <option value="punctuality">Punctuality Summary</option>
              <option value="exceptions">Exceptions</option>
            </select>
          </div>
          <div>
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="repStartDate">
              From
            </label>
            <input
              id="repStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="repEndDate">
              To
            </label>
            <input
              id="repEndDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          {reportType === 'punctuality' && (
            <div>
              <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="groupBy">
                Group By
              </label>
              <select
                id="groupBy"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'employee' | 'shift' | 'day')}
                className="input"
              >
                <option value="day">Day</option>
                <option value="employee">Employee</option>
                <option value="shift">Shift</option>
              </select>
            </div>
          )}
        </div>

        {(reportType === 'register') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="repEmployeeId">
                Employee (optional)
              </label>
              <input
                id="repEmployeeId"
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Employee UUID"
                className="input"
              />
            </div>
            <div>
              <label className="block text-caption text-ink-muted mb-1 font-sans" htmlFor="repShiftId">
                Shift (optional)
              </label>
              <input
                id="repShiftId"
                type="text"
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                placeholder="Shift UUID"
                className="input"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchReport(1)}
            disabled={fetching || !startDate || !endDate}
            className="btn-primary"
          >
            {fetching ? 'Loading…' : 'Load Report'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !startDate || !endDate || totalRecords === 0}
            className="btn-secondary"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          {totalRecords > 0 && (
            <span className="text-caption font-mono text-ink-muted ml-auto">
              {totalRecords} record{totalRecords !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {fetching ? (
        <TableSkeleton showEmployee={showEmployeeColumn} />
      ) : (
        <>
          {filteredRecords.length > 0 && (
            <AttendanceTable
              records={filteredRecords}
              showEmployee={showEmployeeColumn}
              exceptionsFirst={exceptionsFirst}
            />
          )}
          {filteredRecords.length === 0 && startDate && endDate && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">No records found for the selected filters.</p>
              </div>
            </div>
          )}
          {(!startDate || !endDate) && (
            <div className="card-elevated relative overflow-hidden">
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-accent opacity-30 pointer-events-none" />
              <div className="p-8 text-center">
                <p className="text-ink-muted text-body-sm">Select a date range and click Load Report to view data.</p>
              </div>
            </div>
          )}
        </>
      )}

      {!fetching && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={totalRecords}
          pageSize={PAGE_SIZE}
          ariaLabel="Report pages"
        />
      )}
    </Layout>
  )
}

export default HrReports