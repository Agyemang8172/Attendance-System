import React from 'react'
import { Link }  from 'react-router-dom'

const Sidebar = () => {
  return (
    <div>
        <div>
            <h2> Finest Supermarket</h2>
        </div>

        <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/inventory">Inventory</Link>
            <Link to="/sales">Sales</Link>
            <Link to="/reports">Reports</Link>
            <Link to="/settings">Settings</Link>
        </nav>
      
    </div>
  )
}

export default Sidebar
