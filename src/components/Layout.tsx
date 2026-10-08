import { useState, ReactNode } from 'react'
import Sidebar from './Sidebar'
import { CiMenuBurger } from 'react-icons/ci'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas">

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile topbar — only visible below lg */}
      <div className="lg:hidden bg-canvas px-4 py-3 flex items-center gap-4 border-b border-hairline">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-ink-subtle hover:text-accent transition-colors text-xl"
        >
          <CiMenuBurger />
        </button>
        <span className="text-ink text-sm font-bold font-serif tracking-wide">
          AttendPro
        </span>
      </div>

      {/* Page content — offset for sidebar on desktop */}
      <main className="lg:ml-64 min-h-screen flex flex-col">

        {/* Accent strip — runs across the top of every authenticated page */}
        <div className="h-0.5 w-full bg-accent" />

        <div className="flex-1 p-6 lg:p-10">
          {children}
        </div>

      </main>
    </div>
  )
}

export default Layout