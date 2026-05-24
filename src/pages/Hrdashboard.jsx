import { useState, useEffect } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import Layout from '../Component/Layout'

function HrDashboard() {
  const currentUser = getCurrentUser()
  const [records, setRecords] = useState([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    fetchAllAttendance()
  }, [])

  const fetchAllAttendance = async () => {
    try {
      const response = await api.get('/attendance/all-attendance')
      setRecords(response.data.data)
      setFetching(false)
    } catch (error) {
      console.error('Error fetching all attendance:', error)
      setFetching(false)
    }
  }

  return (
    <Layout>
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            HR Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome, {currentUser?.firstName}. Here is the full attendance overview.
          </p>
        </div>
      </header>

      {/* All Attendance Table */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          All Employee Attendance
        </h2>

        {fetching ? (
          <p className="text-gray-400 text-sm">Loading records...</p>
        ) : records.length === 0 ? (
          <p className="text-gray-400 text-sm">No attendance records found</p>
        ) : (
          <div className="rounded-lg overflow-hidden border border-gray-200">
            {/* Header Row */}
            <div className="grid grid-cols-6 bg-[#0f172a] text-white text-sm font-medium px-4 py-3">
              <div>Employee</div>
              <div>Department</div>
              <div>Date</div>
              <div>Clock In</div>
              <div>Clock Out</div>
              <div>Hours</div>
            </div>

            {/* Data Rows */}
            {records.map((record, index) => (
              <div
                key={record._id}
                className={`grid grid-cols-6 px-4 py-3 text-sm text-gray-700 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div>
                  {record.user
                    ? `${record.user.firstName} ${record.user.lastName}`
                    : 'Deleted User'}
                </div>
                <div>{record.user?.department || '--'}</div>
                <div>{new Date(record.date).toLocaleDateString()}</div>
                <div>{new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div>
                  {record.clockOut
                    ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--'}
                </div>
                <div>{record.hoursWorked?.toFixed(2) || '--'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default HrDashboard 