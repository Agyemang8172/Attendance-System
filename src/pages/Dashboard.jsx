import { useState, useEffect } from 'react'
import { getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import { FaCircle } from 'react-icons/fa'
import { FaClock, FaFire, FaChartLine } from 'react-icons/fa'
import Layout from '../component/Layout'
import toast from 'react-hot-toast'

function Dashboard() {
  const user = getCurrentUser()
  
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [fetchingRecords, setFetchingRecords] = useState(true)

  useEffect(() => {
    fetchAttendance()
  }, [])

  
  const fetchAttendance = async () => {
    try {
      const response = await api.get('/attendance/my-attendance')
      setAttendanceRecords(response.data.data)
      
      const openSession = response.data.data.find(
        record => record.sessionStatus === 'open'
      )
      setIsClockedIn(!!openSession)
      setFetchingRecords(false)
    } catch (error) {
      console.error('Error fetching attendance:', error)
      setFetchingRecords(false)
    }
  }

  const handleClockIn = async () => {
    setLoading(true)
    try {
      await api.post('/attendance/clock-in')
     toast.success('Clocked in Successful')
      fetchAttendance()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Clock in failed')
    }
    setLoading(false)
  }

  const handleClockOut = async () => {
    setLoading(true)
    try {
      await api.post('/attendance/clock-out')
      toast.success('Clocked out Successful')
      fetchAttendance()
    } catch (error) {
      alert(error.response?.data?.message || 'Clock out failed')
    }
    setLoading(false)
  }

  // ── KPI Calculations ──────────────────────────────────────
  
  // 1. Weekly Hours
  const weeklyHours = attendanceRecords
    .filter(record => {
      const recordDate = new Date(record.date)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return recordDate >= sevenDaysAgo
    })
    .reduce((total, record) => total + (record.hoursWorked || 0), 0)
    .toFixed(1)

  // 2. Punctuality Streak - clocked in before 8AM
  const streak = attendanceRecords
    .filter(record => record.sessionStatus === 'closed')
    .filter(record => {
      const clockInHour = new Date(record.clockIn).getHours()
      return clockInHour < 8
    }).length

  // 3. Attendance Rate
  const totalDays = attendanceRecords
    .filter(record => record.sessionStatus === 'closed').length
  const workingDaysThisMonth = 22
  const attendanceRate = totalDays > 0
    ? Math.min(Math.round((totalDays / workingDaysThisMonth) * 100), 100)
    : 0

  // ─────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        {/* Left Side */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Good Morning, {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Don't watch the clock; do what it does. Keep going.
          </p>
        </div>

        {/* Right Side - Clock In/Out Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <FaCircle
              size={10}
              color={isClockedIn ? 'green' : 'red'}
            />
            {isClockedIn ? 'Clocked In' : 'Clocked Out'}
          </div>

          {isClockedIn ? (
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:bg-gray-400"
            >
              {loading ? 'Processing...' : 'Clock Out'}
            </button>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:bg-gray-400"
            >
              {loading ? 'Processing...' : 'Clock In'}
            </button>
          )}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Card 1: Weekly Hours */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-xl">
            <FaClock className="text-blue-600 text-xl" />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">
              Weekly Hours
            </p>
            <p className="text-2xl font-bold text-gray-800">
              {weeklyHours} <span className="text-sm font-normal text-gray-400">/ 40 hrs</span>
            </p>
          </div>
        </div>

        {/* Card 2: Punctuality Streak */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-xl">
            <FaFire className="text-orange-500 text-xl" />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">
              Punctuality Streak
            </p>
            <p className="text-2xl font-bold text-gray-800">
              {streak} <span className="text-sm font-normal text-gray-400">days on time</span>
            </p>
          </div>
        </div>

        {/* Card 3: Attendance Rate */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-xl">
            <FaChartLine className="text-green-600 text-xl" />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">
              Attendance Rate
            </p>
            <p className="text-2xl font-bold text-gray-800">
              {attendanceRate}% <span className="text-sm font-normal text-gray-400">this month</span>
            </p>
          </div>
        </div>
      </div>

      {/* Attendance History */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Attendance History
        </h2>

        {fetchingRecords ? (
          <p className="text-gray-400 text-sm">Loading records...</p>
        ) : attendanceRecords.length === 0 ? (
          <p className="text-gray-400 text-sm">No attendance records found</p>
        ) : (
          <div className="rounded-lg overflow-hidden border border-gray-200">
            {/* Header Row */}
            <div className="grid grid-cols-5 bg-[#0f172a] text-white text-sm font-medium px-4 py-3">
              <div>Date</div>
              <div>Clock In</div>
              <div>Clock Out</div>
              <div>Hours Worked</div>
              <div>Status</div>
            </div>

            {/* Data Rows */}
            {attendanceRecords.map((record, index) => (
              <div
                key={record._id}
                className={`grid grid-cols-5 px-4 py-3 text-sm text-gray-700 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div>{new Date(record.date).toLocaleDateString()}</div>
                <div>{new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div>
                  {record.clockOut
                    ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--'}
                </div>
                <div>{record.hoursWorked?.toFixed(2) || '--'}</div>
                <div>{record.sessionStatus}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Dashboard