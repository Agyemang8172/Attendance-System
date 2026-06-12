import {BrowserRouter as Router,Routes,Route,Navigate} from 'react-router-dom'
import Login from './pages/Login'
import HrDashboard from './pages/HrDashboard'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Dashboard from './pages/Dashboard'
import { isAuthenticated } from './utils/auth'
import { Toaster } from 'react-hot-toast'
import { getCurrentUser } from './utils/auth'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Schedule from './pages/Schedule'

// ── Route Guards ──────────────────────────────────────────

// Staff only — logged in + role is staff
const StaffRoute = ({ children }) => {
    const user = getCurrentUser()
    if (!isAuthenticated()) return <Navigate to="/login" />
    if (user?.role !== 'staff') return <Navigate to="/login" />
    return children
}

// HR only — logged in + role is hr
const HrRoute = ({ children }) => {
    const user = getCurrentUser()
    if (!isAuthenticated()) return <Navigate to="/login" />
    if (user?.role !== 'hr') return <Navigate to="/hr-dashboard" />
    return children
}

// SuperAdmin only — logged in + role is superadmin
const SuperAdminRoute = ({ children }) => {
    const user = getCurrentUser()
    if (!isAuthenticated()) return <Navigate to="/login" />
    if (user?.role !== 'superadmin') return <Navigate to="/login" />
    return children
}

// Any logged in user — staff, hr, superadmin
const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated()) return <Navigate to="/login" />
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

                {/* Fallback — catch everything else */}
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="*" element={<Navigate to="/login" />} />

            </Routes>
         </Router>

         
        
    
  
  )
}

export default App
 