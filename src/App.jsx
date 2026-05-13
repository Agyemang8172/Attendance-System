import {BrowserRouter as Router,Routes,Route,Navigate} from 'react-router-dom'
import Login from './Pages/Login'
import Dashboard from './Pages/Dashboard'
import { isAuthenticated } from './utils/auth'

const ProtectedRoute = ({ children }) => {
  return isAuthenticated ? children : <Navigate to='/login' />

}


function App() {
 return ( 
      
         <Router>
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

                 {/* Default route - redirect to login */}
                 <Route path='/'  element={<Navigate to="/login"/>}
                 />
            </Routes>
         </Router>
        
    
  
  )
}

export default App
 