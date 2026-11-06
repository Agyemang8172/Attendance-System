import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Landing from './pages/Landing'
import HrDashboard from './pages/HrDashboard'
import HrAttendance from './pages/HrAttendance'
import HrExceptions from './pages/HrExceptions'
import HrHelpRequests from './pages/HrHelpRequests'
import HrCorrections from './pages/HrCorrections'
import HrOwnCorrections from './pages/HrOwnCorrections'
import HrReports from './pages/HrReports'
import HrAudit from './pages/HrAudit'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import SuperAdminSettings from './pages/SuperAdminSettings'
import ShiftManagement from './pages/ShiftManagement'
import Scheduling from './pages/Scheduling'
import Policies from './pages/Policies'
import CalendarSettings from './pages/CalendarSettings'
import Sites from './pages/Sites'
import Devices from './pages/Devices'
import StaffDashboard from './pages/StaffDashboard'
import StaffAttendance from './pages/StaffAttendance'
import StaffAttendanceDetail from './pages/StaffAttendanceDetail'
import StaffSchedule from './pages/StaffSchedule'
import StaffOffDays from './pages/StaffOffDays'
import StaffHelpRequests from './pages/StaffHelpRequests'
import StaffHelpRequestDetail from './pages/StaffHelpRequestDetail'
import StaffHelpRequestNew from './pages/StaffHelpRequestNew'
import StaffCorrections from './pages/StaffCorrections'
import StaffCorrectionDetail from './pages/StaffCorrectionDetail'
import StaffCorrectionNew from './pages/StaffCorrectionNew'
import { isAuthenticated } from './utils/auth'
import { Toaster } from 'react-hot-toast'
import { getCurrentUser, roleHome } from './utils/auth'
import Profile from './pages/Profile'
import StaffChangePin from './pages/StaffChangePin'
import ChangePassword from './pages/ChangePassword'
import Settings from './pages/Settings'
import ManageStaff from './pages/ManageStaff'
import SetPassword from './pages/SetPassword'
import NotFound from './pages/NotFound'
import Forbidden from './pages/Forbidden'

// ── Route Guards ──────────────────────────────────────────

// Staff only — logged in + role is STAFF; any other role bounces to its own home.
const StaffRoute = ({ children }) => {
  const user = getCurrentUser()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (user?.role !== 'STAFF') return <Navigate to={roleHome(user?.role)} replace />
  return children
}

// HR & SUPERADMIN — anyone else bounces, never to login.
// Guards the HR dashboard and the shared staff-management workspace.
const AdminRoute = ({ children }) => {
  const user = getCurrentUser()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (user?.role !== 'HR' && user?.role !== 'SUPERADMIN') return <Navigate to={roleHome(user?.role)} replace />
  return children
}

const HrOwnCorrectionsRoute = () => {
  const user = getCurrentUser()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (user?.role !== 'HR') return <Navigate to={roleHome(user?.role)} replace />
  if (user.mustChangePassword !== false) return <Navigate to="/set-password" replace />
  return <HrOwnCorrections />
}

// SuperAdmin only — everyone else goes to their own home.
const SuperAdminRoute = ({ children }) => {
  const user = getCurrentUser()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (user?.role !== 'SUPERADMIN') return <Navigate to={roleHome(user?.role)} replace />
  return children
}

// Any logged in user — staff, hr, superadmin
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

const OrdinaryPasswordRoute = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (getCurrentUser()?.mustChangePassword !== false) return <Navigate to="/set-password" replace />
  return children
}

// Role-aware landing for "/": an authenticated visitor reaches their own
// role home; an unauthenticated visitor sees the public Landing page
// (PRD §6) instead of being bounced to /login. The role branch is unchanged.
const AuthenticatedHome = () => {
  if (!isAuthenticated()) return <Landing />
  return <Navigate to={roleHome(getCurrentUser()?.role)} replace />
}

// SetPassword only — logged in AND the account still owes a password change.
// S15: an account whose flag is already clear must never reach the password
// screen; it is bounced to its role home instead.
const SetPasswordRoute = ({ children }) => {
  const user = getCurrentUser()
  if (!isAuthenticated()) return <Navigate to="/login" />
  if (user?.mustChangePassword === false) return <Navigate to={roleHome(user?.role)} />
  return children
}


function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        {/* Public route - anyone can access */}
        <Route path="/login" element={<Login />} />

        {/* Forced password change — signed in, flag still set (S15) */}
        <Route
          path="/set-password"
          element={
            <SetPasswordRoute>
              <SetPassword />
            </SetPasswordRoute>
          }
        />

        {/* Staff only */}
        <Route path="/dashboard"
          element={
            <StaffRoute>
              <StaffDashboard />
            </StaffRoute>
          }
        />

        <Route path="/staff/attendance"
          element={
            <StaffRoute>
              <StaffAttendance />
            </StaffRoute>
          }
        />

        <Route path="/staff/attendance/:id"
          element={
            <StaffRoute>
              <StaffAttendanceDetail />
            </StaffRoute>
          }
        />

        <Route path="/schedule"
          element={
            <StaffRoute>
              <StaffSchedule />
            </StaffRoute>
          }
        />

        <Route path="/staff/off-days"
          element={
            <StaffRoute>
              <StaffOffDays />
            </StaffRoute>
          }
        />

        <Route path="/staff/help-requests"
          element={
            <StaffRoute>
              <StaffHelpRequests />
            </StaffRoute>
          }
        />

        <Route path="/staff/help-requests/new"
          element={
            <StaffRoute>
              <StaffHelpRequestNew />
            </StaffRoute>
          }
        />

        <Route path="/staff/help-requests/:id"
          element={
            <StaffRoute>
              <StaffHelpRequestDetail />
            </StaffRoute>
          }
        />

        <Route path="/staff/corrections"
          element={
            <StaffRoute>
              <StaffCorrections />
            </StaffRoute>
          }
        />

        <Route path="/staff/corrections/new"
          element={
            <StaffRoute>
              <StaffCorrectionNew />
            </StaffRoute>
          }
        />

        <Route path="/staff/corrections/:id"
          element={
            <StaffRoute>
              <StaffCorrectionDetail />
            </StaffRoute>
          }
        />

        <Route path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route path="/profile/change-pin"
          element={
            <StaffRoute>
              <StaffChangePin />
            </StaffRoute>
          }
        />

        <Route path="/profile/change-password"
          element={
            <OrdinaryPasswordRoute>
              <ChangePassword />
            </OrdinaryPasswordRoute>
          }
        />

        {/* HR & SUPERADMIN (AdminRoute) */}
        <Route path="/hr-dashboard"
          element={
            <AdminRoute>
              <HrDashboard />
            </AdminRoute>
          }
        />

        <Route path="/hr-attendance"
          element={
            <AdminRoute>
              <HrAttendance />
            </AdminRoute>
          }
        />

        <Route path="/hr-attendance/:id"
          element={
            <AdminRoute>
              <HrAttendance />
            </AdminRoute>
          }
        />

        <Route path="/hr-exceptions"
          element={
            <AdminRoute>
              <HrExceptions />
            </AdminRoute>
          }
        />

        <Route path="/hr-help-requests"
          element={
            <AdminRoute>
              <HrHelpRequests />
            </AdminRoute>
          }
        />

        <Route path="/hr-help-requests/:id"
          element={
            <AdminRoute>
              <HrHelpRequests />
            </AdminRoute>
          }
        />

        <Route path="/hr-corrections"
          element={
            <AdminRoute>
              <HrCorrections />
            </AdminRoute>
          }
        />

        <Route path="/hr-corrections/mine" element={<HrOwnCorrectionsRoute />} />
        <Route path="/hr-corrections/mine/:id" element={<HrOwnCorrectionsRoute />} />

        <Route path="/hr-corrections/:id"
          element={
            <AdminRoute>
              <HrCorrections />
            </AdminRoute>
          }
        />

        <Route path="/hr-reports"
          element={
            <AdminRoute>
              <HrReports />
            </AdminRoute>
          }
        />

        <Route path="/hr-audit"
          element={
            <AdminRoute>
              <HrAudit />
            </AdminRoute>
          }
        />

        {/* HR & SuperAdmin — shared staff-management workspace */}
        <Route path="/manage-staff"
          element={
            <AdminRoute>
              <ManageStaff />
            </AdminRoute>
          }
        />

        {/* SuperAdmin only */}
        <Route path="/superadmin-dashboard"
          element={
            <SuperAdminRoute>
              <SuperAdminDashboard />
            </SuperAdminRoute>
          }
        />

        <Route path="/admin-attendance"
          element={
            <SuperAdminRoute>
              <HrAttendance />
            </SuperAdminRoute>
          }
        />

        <Route path="/settings"
          element={
            <SuperAdminRoute>
              <SuperAdminSettings />
            </SuperAdminRoute>
          }
        />

        <Route path="/shift-management"
          element={
            <SuperAdminRoute>
              <ShiftManagement />
            </SuperAdminRoute>
          }
        />

        <Route path="/scheduling"
          element={
            <SuperAdminRoute>
              <Scheduling />
            </SuperAdminRoute>
          }
        />

        <Route path="/policies"
          element={
            <SuperAdminRoute>
              <Policies />
            </SuperAdminRoute>
          }
        />

        <Route path="/calendar-settings"
          element={
            <SuperAdminRoute>
              <CalendarSettings />
            </SuperAdminRoute>
          }
        />

        <Route path="/sites"
          element={
            <SuperAdminRoute>
              <Sites />
            </SuperAdminRoute>
          }
        />

        <Route path="/devices"
          element={
            <SuperAdminRoute>
              <Devices />
            </SuperAdminRoute>
          }
        />

        {/* All logged in roles - SA can access HR reports */}
        <Route path="/reports"
          element={
            <SuperAdminRoute>
              <HrReports />
            </SuperAdminRoute>
          }
        />

        <Route path="/audit-log"
          element={
            <SuperAdminRoute>
              <HrAudit />
            </SuperAdminRoute>
          }
        />

        {/* Shared states — nav doc §7.6. 403 is reachable at /forbidden
            for "a valid session that lacks a specific permission";
            the guards still bounce a wrong-role session to its own
            home per §9 Unauthorized. */}
        <Route path="/forbidden" element={<Forbidden />} />

        {/* Role-aware landing — authenticated users reach their own home */}
        <Route path="/" element={<AuthenticatedHome />} />

        {/* Unknown addresses get the 404 panel, not a bounce to sign-in */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App
