import {BrowserRouter as Router,Routes,Route,Navigate} from 'react-router-dom'
import Login from './pages/Login'
import HrDashboard from './pages/HrDashboard'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Dashboard from './pages/Dashboard'
import { isAuthenticated } from './utils/auth'
import { Toaster } from 'react-hot-toast'
import { getCurrentUser, roleHome } from './utils/auth'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Schedule from './pages/Schedule'
import ManageStaff from './pages/ManageStaff'
import SetPassword from './pages/SetPassword'

// ── Route Guards ──────────────────────────────────────────

// Staff only — logged in + role is STAFF
const StaffRoute = ({ children }) => {
    const user = getCurrentUser()
    if (!isAuthenticated()) return <Navigate to="/login" />
    if (user?.role !== 'STAFF') return <Navigate to="/login" />
    return children
}

// HR only — logged in + role is HR or SUPERADMIN
const HrRoute = ({ children }) => {
    const user = getCurrentUser()
    if (!isAuthenticated()) return <Navigate to="/login" />
   if (user?.role !== 'HR' && user?.role !== 'SUPERADMIN') return <Navigate to="/login" />
    return children
}

// SuperAdmin only — logged in + role is SUPERADMIN
const SuperAdminRoute = ({ children }) => {
    const user = getCurrentUser()
    if (!isAuthenticated()) return <Navigate to="/login" />
    if (user?.role !== 'SUPERADMIN') return <Navigate to="/login" />
    return children
}

// Any logged in user — staff, hr, superadmin
const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated()) return <Navigate to="/login" />
    return children
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
          <Toaster   position = "top-right" />
            <Routes>
                {/* Public route - anyone can access */}
                <Route path="/login"  element= {<Login />} />

                {/* Staff only */}
                <Route path="/dashboard"
                    element={
                        <StaffRoute>
                            <Dashboard />
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

        <Route path="/schedule"
                    element={
                        <StaffRoute>
                            <Schedule />
                        </StaffRoute>
                    }
                />

         <Route
            path="/hr-dashboard"
            element={
              <HrRoute>
                <HrDashboard />
              </HrRoute>
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

                {/* SuperAdmin only */}
        <Route path="/manage-staff"
            element={
                <SuperAdminRoute>
                    <ManageStaff />
                </SuperAdminRoute>
            }
        />
  

                 {/* All logged in roles */}
                <Route path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />

                <Route path="/settings"
                    element={
                        <ProtectedRoute>
                            <Settings />
                        </ProtectedRoute>
                    }
                />

                <Route path="/set-password"
                    element={
                        <SetPasswordRoute>
                            <SetPassword />
                        </SetPasswordRoute>
                    }
                 />

                {/* Fallback — catch everything else */}
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="*" element={<Navigate to="/login" />} />

            </Routes>
         </Router>

         
        
    
  
  )
}

export default App
 