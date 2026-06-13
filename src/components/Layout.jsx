import { useState } from 'react'
import Sidebar from './Sidebar'
import { CiMenuBurger } from 'react-icons/ci'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-stone-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile topbar — only visible below lg */}
      <div className="lg:hidden bg-slate-900 px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-slate-400 hover:text-yellow-500 transition-colors text-xl"
        >
          <CiMenuBurger />
        </button>
        <span className="text-slate-100 text-sm font-medium font-sans">
          AttendPro
        </span>
      </div>

      {/* Page content — offset for sidebar on desktop */}
      <main className="p-6 lg:p-8 lg:ml-64">
        {children}
      </main>
    </div>
  )
}

export default Layout