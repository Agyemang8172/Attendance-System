import {BrowserRouter as Router,Routes,Route,Navigate} from 'react-router-dom'
import Login from './pages/Login'
import HrDashboard from './pages/Hrdashboard'
import Dashboard from './pages/Dashboard'
import { isAuthenticated } from './utils/auth'
import { Toaster } from 'react-hot-toast'
import { getCurrentUser } from './utils/auth'
import Profile from './pages/Profile'



const ProtectedRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to='/login' /> 

}

const  HrRoute= ({children})  => {
  const user = getCurrentUser()

 if (!user) return <Navigate to="/login" />;

 if (!['hr','superadmin'].includes(user.role))  {
  return <Navigate to="/dashboard" />
 }
  return children;
}


function App() {
 return ( 
      
         <Router>
          <Toaster   position = "top-right" />
            <Routes>
                {/* Public route - anyone can access */}
                <Route path="/login"  element= {<Login />} />

                {/* Protected route - requires login */}
                <Route  path="/dashboard"  
                  element= {
                    <ProtectedRoute>
                       <Dashboard />
                    </ProtectedRoute>
                  }
                />


                        <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                      <Profile />
                  </ProtectedRoute>
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

                 {/* Default route - redirect to login */}
                 <Route path='/'  element={<Navigate to="/login"/>}
                 />
            </Routes>
         </Router>

         
        
    
  
  )
}

export default App
 