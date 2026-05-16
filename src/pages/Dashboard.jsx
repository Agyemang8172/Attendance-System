import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getCurrentUser } from '../utils/auth';
import api from '../api/axios';
import { FaCircle } from 'react-icons/fa';

function Dashboard() {
  const navigate = useNavigate();
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

  // Logout handler
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 className="flex ">AttendPro</h2>
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-item">Dashboard</div>
          <div className="nav-item">Profile</div>
          <div className="nav-item">Schedule</div>
          <div className="nav-item">Settings</div>
        </nav>
        
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header Section */}
        <header className="header">
          <h1>Good Morning, {user?.firstName} {user?.lastName}</h1>
          <p>Don't watch the clock; do what it does. Keep going.</p>
        </header>

        {/* Clock In/Out Section */}
        <section className="clock-section">
          <div className="status-display">
            <h2>
              Current Status:{' '}
              {isClockedIn ? (
                <>
                  <FaCircle color="green" size={12} /> CLOCKED IN
                </>
              ) : (
                <>
                  <FaCircle color="red" size={12} /> CLOCKED OUT
                </>
              )}
            </h2>
          </div>
          
          <div className="clock-button">
            {isClockedIn ? (
              <button onClick={handleClockOut} disabled={loading} className="btn-clock-out">
                {loading ? 'Processing...' : 'Clock Out'}
              </button>
            ) : (
              <button onClick={handleClockIn} disabled={loading} className="btn-clock-in">
                {loading ? 'Processing...' : 'Clock In'}
              </button>
            )}
          </div>
        </section>

        {/* Attendance History Section */}
        <section className="attendance-section">
          <h2>Attendance History</h2>
          
          {fetchingRecords ? (
            <p>Loading records...</p>
          ) : attendanceRecords.length === 0 ? (
            <p>No attendance records found</p>
          ) : (
            <div className="attendance-list">
              {/* Header Row */}
              <div className="attendance-row header-row">
                <div className="col-date">Date</div>
                <div className="col-clock-in">Clock In</div>
                <div className="col-clock-out">Clock Out</div>
                <div className="col-hours">Hours Worked</div>
                <div className="col-status">Status</div>
              </div>
              
              {/* Data Rows */}
              {attendanceRecords.map((record) => (
                <div key={record._id} className="attendance-row data-row">
                  <div className="col-date">
                    {new Date(record.date).toLocaleDateString()}
                  </div>
                  <div className="col-clock-in">
                    {new Date(record.clockIn).toLocaleTimeString()}
                  </div>
                  <div className="col-clock-out">
                    {record.clockOut 
                      ? new Date(record.clockOut).toLocaleTimeString() 
                      : '--'}
                  </div>
                  <div className="col-hours">
                    {record.hoursWorked?.toFixed(2) || '--'}
                  </div>
                  <div className="col-status">
                    {record.sessionStatus}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;