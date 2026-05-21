  import { useState, useEffect } from 'react';
  import Sidebar  from '../Component/sidebar'
  import { getCurrentUser } from '../utils/auth';
  import api from '../api/axios';
  import { FaCircle } from 'react-icons/fa';
  import Layout from '../Component/Layout';
 

  

  function Dashboard() {
   
    const user = getCurrentUser();
    
    // State management
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [fetchingRecords, setFetchingRecords] = useState(true);



    // Fetch attendance records when component loads
    useEffect(() => {
      fetchAttendance();
    }, []);



    // Function to fetch user's attendance from backend
    const fetchAttendance = async () => {
      try {
        const response = await api.get('/attendance/my-attendance');
        setAttendanceRecords(response.data.data);
        
        // Check if user has an open session (currently clocked in)
        const openSession = response.data.data.find(
          record => record.sessionStatus === 'open'
        );
        setIsClockedIn(!!openSession);
        
        setFetchingRecords(false);
      } catch (error) {
        console.error('Error fetching attendance:', error);
        setFetchingRecords(false);
      }
    };

    // Clock In handler
    const handleClockIn = async () => {
      setLoading(true);
      try {
        await api.post('/attendance/clock-in');
        alert('Clocked in successfully');
        fetchAttendance(); // Refresh records after clocking in
      } catch (error) {
        alert(error.response?.data?.message || 'Clock in failed');
      }
      setLoading(false);
    };

    // Clock Out handler
    const handleClockOut = async () => {
      setLoading(true);
      try {
        await api.post('/attendance/clock-out');
        alert('Clocked out successfully');
        fetchAttendance(); // Refresh records after clocking out
      } catch (error) {
        alert(error.response?.data?.message || 'Clock out failed');
      }
      setLoading(false);
    };

    

    return (
      <Layout>

        <header className="mb-8">
            <h1 className='text-2xl font-bold text-gray-800'>
              Good Morning, {user?.firstName} {user?.lastName}
            </h1>
            <p className='text-gray-500 text-sm mt-1'>
              Don't watch the clock; do what it does. Keep going.
            </p>
         </header>

          {/* Clock In/Out Section */}
          
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
              <h2 className='text-lg font-semibold text-gray-700 mb-4'>
                Current Status:{'   '}
                {isClockedIn ? (
                  <span className='text-green-600'>
                    <FaCircle color="green" size={12} /> CLOCKED IN
                  </span>
                ) : (
                  <span className='text-red-500'>
                    <FaCircle color="red" size={12} /> CLOCKED OUT
                  </span>
                )}
              </h2>
         
            
            
              {isClockedIn ? (
                <button onClick={handleClockOut} disabled={loading} 
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition disabled:bg-gray-400">
                  {loading ? 'Processing...' : 'Clock Out'}
                </button>
              ) : (
                <button onClick={handleClockIn} disabled={loading} className="bg-blue-500 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition disabled:bg-gray-400">
                  {loading ? 'Processing...' : 'Clock In'}
                </button>
              )}
            </div>
       

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
                className={`grid grid-cols-5 px-4 py-3 text-sm text-gray-800 {
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div>{new Date(record.date).toLocaleDateString()}</div>
                <div>{new Date(record.clockIn).toLocaleTimeString()}</div>
                <div>
                  {record.clockOut
                    ? new Date(record.clockOut).toLocaleTimeString()
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
    );
  }

  export default Dashboard