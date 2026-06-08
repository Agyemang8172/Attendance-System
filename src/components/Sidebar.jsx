import { useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../utils/auth'
import { getCurrentUser } from '../utils/auth'
import { FaHome, FaUser, FaUsers } from 'react-icons/fa'
import { SlCalender } from 'react-icons/sl'
import { FaGear } from 'react-icons/fa6'
import { CiLogout } from 'react-icons/ci'

/*
 * MERIDIAN — Sidebar
 * Pure Tailwind. No custom CSS.
 * Design tokens consistent with Login page.
 *
 * Google Fonts required in index.html <head>:
 * <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
 * General Sans from Fontshare — add @import to index.css
 */

const allNavItems = [
  // Everyone
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <FaHome />,
    roles: ['staff', 'hr', 'superadmin'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <FaGear />,
    roles: ['staff', 'hr', 'superadmin'],
  },

  // Staff only
  {
    label: 'My Profile',
    path: '/profile',
    icon: <FaUser />,
    roles: ['staff'],
  },
  {
    label: 'My Schedule',
    path: '/schedule',
    icon: <SlCalender />,
    roles: ['staff'],
  },

  // HR and superadmin only
  {
    label: 'HR Dashboard',
    path: '/hr-dashboard',
    icon: <FaUsers />,
    roles: ['hr', 'superadmin'],
  },
]

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = getCurrentUser()

  const allowedNavItems = allNavItems.filter((item) =>
    item.roles.includes(currentUser?.role)
  )

  const handleLogOut = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* ─────────────────────────────────────────
          MOBILE OVERLAY
          Sits behind sidebar, above page content.
          Click it to close sidebar.
          Bumped to bg-black/40 — clearer UX signal.
      ───────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ─────────────────────────────────────────
          SIDEBAR SHELL
          Fixed, full height, deep navy.
          Slides in from left on mobile.
          Always visible on desktop (lg:translate-x-0).
      ───────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-64
          bg-[#0D1B2A]
          flex flex-col
          z-30
          transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >

        {/* ── TOP CORNER BRACKET (decorative, ties to Login panel) ── */}
        <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-[#D4A843] opacity-30 rounded-tr-sm pointer-events-none" />

        {/* ─────────────────────────────────────────
            BRAND BLOCK
            AttendPro in gold Fraunces.
            Tagline small, muted, uppercase.
            Gold rule divider beneath.
        ───────────────────────────────────────── */}
        <div className="px-6 pt-10 pb-6">
          <h2
            className="text-2xl font-bold text-[#D4A843] tracking-tight leading-none"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            AttendPro
          </h2>
          <p
            className="text-[10px] text-[#F7F3EE] opacity-40 uppercase tracking-widest mt-2"
            style={{ fontFamily: "'General Sans', sans-serif" }}
          >
            Attendance Management
          </p>

          {/* Gold rule */}
          <div className="mt-5 h-px bg-[#D4A843] opacity-20" />
        </div>

        {/* ─────────────────────────────────────────
            NAV ITEMS
            flex-1 pushes status + logout to bottom.
            gap-1 between items — breathing room
            without wasting vertical space.
        ───────────────────────────────────────── */}
        <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto">
          {allowedNavItems.map((item) => {
            const isActive = location.pathname === item.path

            return (
              <div
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  onClose()
                }}
                className={`
                  flex items-center gap-3
                  px-4 py-3
                  rounded-lg
                  text-sm font-medium
                  cursor-pointer
                  transition duration-150
                  relative
                  ${
                    isActive
                      ? /*
                         * ACTIVE STATE — MERIDIAN signature:
                         * Gold left border bar
                         * Very subtle gold tint background
                         * Gold text
                         * pl-3 compensates for border-l-2
                         * so text doesn't shift on inactive items
                         */
                        'border-l-2 border-[#D4A843] bg-[#D4A843]/10 text-[#D4A843] pl-3'
                      : 'text-[#6B7280] hover:text-[#F7F3EE] hover:bg-white/5 border-l-2 border-transparent'
                  }
                `}
                style={{ fontFamily: "'General Sans', sans-serif" }}
              >
                {/* Icon */}
                <span className={`text-base shrink-0 ${isActive ? 'text-[#D4A843]' : ''}`}>
                  {item.icon}
                </span>

                {/* Label */}
                <span>{item.label}</span>
              </div>
            )
          })}
        </nav>

        {/* ─────────────────────────────────────────
            BOTTOM SECTION
            Status block + Logout pinned to bottom.
            Separated cleanly — not grouped together.
        ───────────────────────────────────────── */}
        <div className="px-6 pb-4 pt-4 border-t border-[#D4A843]/10">
          {/* Status block */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span
              className="text-[#6B7280] text-[10px]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              System Online v1.0
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogOut}
            className="
              flex items-center gap-3
              w-full
              px-4 py-3
              rounded-lg
              text-sm font-medium
              text-[#6B7280]
              border border-[#374151]
              hover:bg-red-600
              hover:text-[#F7F3EE]
              hover:border-red-600
              transition duration-200
            "
            style={{ fontFamily: "'General Sans', sans-serif" }}
          >
            <CiLogout className="text-base shrink-0" />
            <span>Logout</span>
          </button>
        </div>

        {/* ── BOTTOM CORNER BRACKET (decorative) ── */}
        <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-[#D4A843] opacity-30 rounded-br-sm pointer-events-none" />
      </aside>
    </>
  )
}

export default Sidebar