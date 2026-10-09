import { useState, ReactNode } from 'react'
import Sidebar from './Sidebar'
import { FaBars } from 'react-icons/fa6'

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

      {/* Mobile topbar — only visible below lg, chrome surface like the sidebar */}
      <div className="lg:hidden bg-chrome px-4 py-3 flex items-center gap-4 border-b border-chrome-line">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          className="text-chrome-ink-muted hover:text-chrome-ink transition-colors text-xl"
        >
          <FaBars />
        </button>
        <span className="text-brass-chrome text-sm font-bold font-serif tracking-wide">
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