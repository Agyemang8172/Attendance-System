import { useLocation, useNavigate } from 'react-router-dom'
import { logout, getCurrentUser } from '../utils/auth'
import type { Role } from '../types'
import { FaHome, FaUser, FaUsers } from 'react-icons/fa'
import { SlCalender } from 'react-icons/sl'
import { FaGear } from 'react-icons/fa6'
import { CiLogout } from 'react-icons/ci'
import { FaUsersGear } from 'react-icons/fa6'
import { ReactNode } from 'react'

interface NavItem {
  label: string
  path: string
  icon: ReactNode
  roles: Role[]
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const allNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <FaHome />,
    roles: ['STAFF'],
  },
  {
    label: 'HR Dashboard',
    path: '/hr-dashboard',
    icon: <FaUsers />,
    roles: ['HR', 'SUPERADMIN'],
  },
  {
    label: 'My Profile',
    path: '/profile',
    icon: <FaUser />,
    roles: ['STAFF', 'HR', 'SUPERADMIN'],
  },
  {
    label: 'My Schedule',
    path: '/schedule',
    icon: <SlCalender />,
    roles: ['STAFF'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <FaGear />,
    roles: ['STAFF', 'HR', 'SUPERADMIN'],
  },
  {
    label: 'Manage Staff',
    path: '/manage-staff',
    icon: <FaUsersGear />,
    roles: ['SUPERADMIN'],
  },
]

const roleLabel: Record<Role, string> = {
  STAFF: 'Staff',
  HR: 'HR Manager',
  SUPERADMIN: 'Super Admin',
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = getCurrentUser()

  const allowedNavItems = allNavItems.filter((item) =>
    item.roles.includes(currentUser?.role as Role)
  )

  const initials = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join('')

  const handleLogOut = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-canvas/80 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={
          'fixed top-0 left-0 h-screen w-64 ' +
          'bg-canvas ' +
          'border-r border-hairline ' +
          'flex flex-col ' +
          'z-30 ' +
          'transition-transform duration-200 ' +
          (isOpen ? 'translate-x-0' : '-translate-x-full') + ' ' +
          'lg:translate-x-0'
        }
      >
        {/* Top-right corner bracket — Linear signature */}
        <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-accent opacity-30 rounded-tr-sm pointer-events-none" />

        {/* ── BRAND BLOCK ────────────────────────────────────────────────── */}
        <div className="px-6 pt-10 pb-6">
          {/* Accent strip at very top of sidebar — mirrors Layout accent strip */}
          <div className="absolute top-0 left-0 w-full h-0.5 bg-accent" />

          <h2 className="text-2xl font-semibold text-accent tracking-tight leading-none font-serif">
            AttendPro
          </h2>
          <p className="text-xs text-ink-subtle uppercase tracking-widest mt-2 font-sans">
            Attendance Management
          </p>
          <div className="mt-5 h-px bg-hairline" />
        </div>

        {/* ── NAV ITEMS ──────────────────────────────────────────────────── */}
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
                className={
                  'flex items-center gap-3 ' +
                  'px-4 py-3 ' +
                  'rounded-lg ' +
                  'text-sm font-medium font-sans ' +
                  'cursor-pointer ' +
                  'transition-all duration-150 ' +
                  (isActive
                    ? 'bg-surface-2 text-accent border-l-2 border-accent pl-3'
                    : 'text-ink-subtle hover:text-ink hover:bg-surface-1')
                }
              >
                <span className={'text-base shrink-0 ' + (isActive ? 'text-accent' : 'text-ink-subtle')}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
            )
          })}
        </nav>

        {/* ── BOTTOM SECTION ─────────────────────────────────────────────── */}
        <div className="px-4 pb-6 pt-4 border-t border-hairline">

          {/* User identity block */}
          <div className="flex items-center gap-3 px-2 py-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-surface-2 border border-hairline flex items-center justify-center shrink-0">
              <span className="text-accent text-xs font-bold font-sans">
                {initials || '??'}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-ink text-sm font-medium truncate font-sans">
                {currentUser?.firstName} {currentUser?.lastName}
              </span>
              <span className="text-xs text-ink-subtle mt-0.5 font-sans">
                {roleLabel[currentUser?.role as Role] || currentUser?.role}
              </span>
            </div>
          </div>

          {/* Logout */}
          <div
            onClick={handleLogOut}
            className={
              'flex items-center gap-3 ' +
              'px-4 py-3 ' +
              'rounded-lg ' +
              'text-sm font-medium font-sans ' +
              'cursor-pointer ' +
              'transition-all duration-150 ' +
              'text-ink-subtle ' +
              'hover:text-error ' +
              'hover:bg-error/10'
            }
          >
            <CiLogout className="text-base shrink-0" />
            <span>Logout</span>
          </div>

          {/* Status line */}
          <div className="flex items-center gap-2 mt-4 px-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
            <span className="text-caption text-ink-tertiary font-mono">
              System Online v1.0
            </span>
          </div>
        </div>

        {/* Bottom-right corner bracket */}
        <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-accent opacity-30 rounded-br-sm pointer-events-none" />

      </aside>
    </>
  )
}

export default Sidebar