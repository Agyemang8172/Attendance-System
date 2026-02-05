import {Routes,Route} from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Sales from './pages/Sales'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Sidebar from './components/Sidebar'


function App() {
 
  return ( 
        <Layout>
             <Routes>
             <Route path='/' element={<Dashboard/>}/>
             <Route path = '/inventory'  element={<Inventory/>} />
             <Route path = '/sales'  element={<Sales/>} />
             <Route path = '/reports'  element={<Reports/>} />
             <Route path = '/settings'  element={<Settings/>} />
             
          </Routes>
        
        </Layout>
  
  )
}

export default App
 