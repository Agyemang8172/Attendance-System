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

// Staff only — logged in + role is STAFF; any other role bounces to its own home.
const StaffRoute = ({ children }) => {
    const user = getCurrentUser()
    if (!isAuthenticated()) return <Navigate to="/login" replace />
    if (user?.role !== 'STAFF') return <Navigate to={roleHome(user?.role)} replace />
    return children
}

// HR & SUPERADMIN — anyone else bounces, never to login.
const HrRoute = ({ children }) => {
    const user = getCurrentUser()
    if (!isAuthenticated()) return <Navigate to="/login" replace />
   if (user?.role !== 'HR' && user?.role !== 'SUPERADMIN') return <Navigate to={roleHome(user?.role)} replace />
    return children
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

// Role-aware landing for "/": authenticated users reach their own home.
const AuthenticatedHome = () => {
    if (!isAuthenticated()) return <Navigate to="/login" replace />
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

                {/* Role-aware landing — authenticated users reach their own home */}
                <Route path="/" element={<AuthenticatedHome />} />
                <Route path="*" element={<Navigate to="/login" />} />

            </Routes>
         </Router>

         
        
    
  
  )
}

export default App
 