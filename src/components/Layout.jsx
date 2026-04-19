import  { children } from 'react'
import Sidebar from './Sidebar'

const Layout = () => {
  return (
    <div style={{ display: 'flex'}}>
        <Sidebar />
        <div style={{flex: 1}}>
           {children}

        </div>
      
    </div>
  )
}

export default Layout
 