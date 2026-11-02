import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { logout, getToken, getCurrentUser } from '../utils/auth'
import api from '../api/axios'
import type { Role } from '../types'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  FaCalendarDays,
  FaGear,
  FaAnglesDown,
  FaHouse,
  FaRightFromBracket,
  FaUser,
  FaUsers,
  FaUsersGear,
  FaClipboardList,
  FaCalendar,
  FaLifeRing,
  FaPenToSquare,
  FaShield,
  FaKey,
  FaChartBar,
  FaDatabase,
  FaGears,
  FaLocationDot,
  FaDesktop,
  FaFileLines,
  FaClockRotateLeft,
  FaBell,
  FaArrowsRotate,
  FaPenToSquare as FaEdit,
} from 'react-icons/fa6'

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
  // Staff portal
  {
    label: 'Overview',
    path: '/dashboard',
    icon: <FaHouse />,
    roles: ['STAFF'],
  },
  {
    label: 'My Attendance',
    path: '/staff/attendance',
    icon: <FaClipboardList />,
    roles: ['STAFF'],
  },
  {
    label: 'My Schedule',
    path: '/schedule',
    icon: <FaCalendarDays />,
    roles: ['STAFF'],
  },
  {
    label: 'Off-Days',
    path: '/staff/off-days',
    icon: <FaCalendar />,
    roles: ['STAFF'],
  },
  {
    label: 'Help Requests',
    path: '/staff/help-requests',
    icon: <FaLifeRing />,
    roles: ['STAFF'],
  },
  {
    label: 'Corrections',
    path: '/staff/corrections',
    icon: <FaPenToSquare />,
    roles: ['STAFF'],
  },

  // HR portal
  {
    label: 'HR Dashboard',
    path: '/hr-dashboard',
    icon: <FaUsers />,
    roles: ['HR', 'SUPERADMIN'],
  },
  {
    label: 'Attendance',
    path: '/hr-attendance',
    icon: <FaClipboardList />,
    roles: ['HR', 'SUPERADMIN'],
  },
  {
    label: 'Exceptions',
    path: '/hr-exceptions',
    icon: <FaBell />,
    roles: ['HR', 'SUPERADMIN'],
  },
  {
    label: 'Manage Staff',
    path: '/manage-staff',
    icon: <FaUsersGear />,
    roles: ['SUPERADMIN', 'HR'],
  },
  {
    label: 'Help Requests',
    path: '/hr-help-requests',
    icon: <FaLifeRing />,
    roles: ['HR', 'SUPERADMIN'],
  },
  {
    label: 'Corrections',
    path: '/hr-corrections',
    icon: <FaPenToSquare />,
    roles: ['HR', 'SUPERADMIN'],
  },
  {
    label: 'Reports',
    path: '/hr-reports',
    icon: <FaChartBar />,
    roles: ['HR', 'SUPERADMIN'],
  },
  {
    label: 'Audit History',
    path: '/hr-audit',
    icon: <FaClockRotateLeft />,
    roles: ['HR', 'SUPERADMIN'],
  },

  // SUPERADMIN area (PRD §9)
  {
    label: 'Overview',
    path: '/superadmin-dashboard',
    icon: <FaShield />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Attendance',
    path: '/admin-attendance',
    icon: <FaClipboardList />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Shift Management',
    path: '/shift-management',
    icon: <FaArrowsRotate />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Scheduling',
    path: '/scheduling',
    icon: <FaCalendarDays />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Attendance Policies',
    path: '/policies',
    icon: <FaGears />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Calendar Settings',
    path: '/calendar-settings',
    icon: <FaCalendar />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Sites',
    path: '/sites',
    icon: <FaLocationDot />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Devices',
    path: '/devices',
    icon: <FaDesktop />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Help & Corrections',
    path: '/admin-help-corrections',
    icon: <FaBell />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: <FaChartBar />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Audit Log',
    path: '/audit-log',
    icon: <FaClockRotateLeft />,
    roles: ['SUPERADMIN'],
  },
  {
    label: 'Business Settings',
    path: '/settings',
    icon: <FaGear />,
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

  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const allowedNavItems = allNavItems.filter((item) =>
    item.roles.includes(currentUser?.role as Role)
  )

  const initials = [
    currentUser?.firstName,
    currentUser?.lastName,
  ]
    .filter((n): n is string => Boolean(n))
    .map((n) => n[0].toUpperCase())
    .join('')

  const closeMenu = () => setMenuOpen(false)

  const handleLogOut = () => {
    const token = getToken()
    void Promise.resolve(
      api.post(
        '/auth/logout',
        {},
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      )
    ).catch(() => {})
    logout()
    closeMenu()
    navigate('/login')
  }

  const goTo = (path: string) => {
    closeMenu()
    navigate(path)
    onClose()
  }

  useEffect(() => {
    if (menuOpen) {
      itemRefs.current[0]?.focus()
    } else {
      triggerRef.current?.focus()
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        closeMenu()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [menuOpen])

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const current = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement)
    const delta = e.key === 'ArrowDown' ? 1 : -1
    const nextIndex =
      (current + delta + itemRefs.current.length) % itemRefs.current.length
    itemRefs.current[nextIndex]?.focus()
  }

  const menuItems = [
    { label: 'Profile & Security', path: '/profile', icon: <FaUser /> },
    // The kiosk PIN belongs to STAFF accounts; the endpoint refuses the other
    // roles, so the shared account menu must not offer a dead-end action.
    ...(currentUser?.role === 'STAFF'
      ? [{ label: 'Change PIN', path: '/profile/change-pin', icon: <FaKey /> }]
      : []),
    { label: 'Settings', path: '/settings', icon: <FaGear /> },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 overlay-scrim z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* The chrome surface — the Login brand panel continues into the app.
          Same tokens, same ledger grid, same brass signature. */}
      <aside
        className={
          'fixed top-0 left-0 h-screen w-64 ' +
          'bg-chrome ' +
          'border-r border-chrome-line ' +
          'flex flex-col ' +
          'z-30 ' +
          'transition-transform duration-200 ' +
          (isOpen ? 'translate-x-0' : '-translate-x-full') + ' ' +
          'lg:translate-x-0'
        }
      >
        {/* Fine 1px ledger grid — continuity with the Login brand panel */}
        <div className="absolute inset-0 chrome-grid opacity-10 pointer-events-none" />

        {/* Top-right corner bracket — Linear signature */}
        <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-brass-chrome opacity-30 rounded-tr-sm pointer-events-none" />

        {/* ── BRAND BLOCK ────────────────────────────────────────────────── */}
        <div className="px-6 pt-10 pb-6">
          {/* Brass strip at very top — mirrors the Login brand panel's gold rule */}
          <div className="absolute top-0 left-0 w-full h-0.5 bg-brass-chrome" />

          <h2 className="text-2xl font-semibold text-brass-chrome tracking-tight leading-none font-serif">
            AttendPro
          </h2>
          <p className="text-xs text-chrome-ink-muted uppercase tracking-widest mt-2 font-sans">
            Attendance Management
          </p>
          <div className="mt-5 h-px bg-chrome-line" />
        </div>

        {/* ── NAV ITEMS ──────────────────────────────────────────────────── */}
        <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto">
          {allowedNavItems.map((item) => {
            const isActive = location.pathname === item.path

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  navigate(item.path)
                  onClose()
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  flex items-center gap-3
                  px-4 py-3
                  rounded-lg
                  text-sm font-medium font-sans text-left
                  w-full
                  cursor-pointer
                  transition-all duration-150
                  focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:ring-offset-2 focus-visible:ring-offset-chrome focus-visible:outline-none
                  ${
                    isActive
                      ? 'bg-chrome-elevated text-brass-chrome border-l-2 border-brass-chrome pl-3'
                      : 'text-chrome-ink-muted hover:text-chrome-ink hover:bg-chrome-elevated border-l-2 border-transparent pl-3'
                  }
                `}
              >
                <span className={'text-base shrink-0 ' + (isActive ? 'text-brass-chrome' : 'text-chrome-ink-subtle')}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* ── ACCOUNT MENU (O23) ────────────────────────────────────────── */}
        <div className="px-3 pb-6 pt-4 border-t border-chrome-line">
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-controls="account-menu"
              onClick={() => setMenuOpen((o) => !o)}
              className={
                'flex items-center gap-3 w-full ' +
                'px-2 py-3 rounded-lg text-left ' +
                'hover:bg-chrome-elevated transition-colors duration-150 ' +
                'focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:ring-offset-2 focus-visible:ring-offset-chrome focus-visible:outline-none'
              }
            >
              <span className="w-9 h-9 rounded-lg bg-chrome-elevated border border-chrome-line flex items-center justify-center shrink-0">
                <span className="text-brass-chrome text-xs font-bold font-sans">
                  {initials || '??'}
                </span>
              </span>
              <span className="flex flex-col min-w-0 flex-1">
                <span className="text-chrome-ink text-sm font-medium truncate font-sans">
                  {currentUser?.firstName} {currentUser?.lastName}
                </span>
                <span className="text-xs text-chrome-ink-muted mt-0.5 font-sans">
                  {roleLabel[currentUser?.role as Role] || currentUser?.role}
                </span>
              </span>
              <FaAnglesDown
                aria-hidden="true"
                className={
                  'text-chrome-ink-subtle shrink-0 transition-transform duration-200 ' +
                  (menuOpen ? 'rotate-180' : '')
                }
              />
            </button>

            {menuOpen && (
              <div
                id="account-menu"
                ref={menuRef}
                role="menu"
                aria-label="Account menu"
                className="absolute bottom-full left-0 right-0 mb-2 rounded-lg bg-chrome-elevated border border-chrome-line shadow-elevated py-1.5"
                onKeyDown={onMenuKeyDown}
              >
                {menuItems.map((item, index) => (
                  <button
                    key={item.path}
                    ref={(el) => { itemRefs.current[index] = el }}
                    type="button"
                    role="menuitem"
                    onClick={() => goTo(item.path)}
                    className={
                      'flex items-center gap-3 w-full ' +
                      'px-4 py-2.5 text-sm font-medium font-sans text-chrome-ink ' +
                      'hover:bg-chrome transition-colors duration-150 ' +
                      'focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:ring-offset-2 focus-visible:ring-offset-chrome-elevated focus-visible:outline-none'
                    }
                  >
                    <span className="text-chrome-ink-subtle text-sm shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                ))}

                <div className="mx-3 my-1 h-px bg-chrome-line" />

                <button
                  ref={(el) => { itemRefs.current[menuItems.length] = el }}
                  type="button"
                  role="menuitem"
                  onClick={handleLogOut}
                  className={
                    'flex items-center gap-3 w-full ' +
                    'px-4 py-2.5 text-sm font-medium font-sans text-chrome-ink-muted ' +
                    'hover:bg-chrome transition-colors duration-150 ' +
                    'focus-visible:ring-2 focus-visible:ring-brass-chrome focus-visible:ring-offset-2 focus-visible:ring-offset-chrome-elevated focus-visible:outline-none'
                  }
                >
                  <span className="text-chrome-ink-subtle text-sm shrink-0" aria-hidden="true">
                    <FaRightFromBracket />
                  </span>
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Status line */}
          <div className="flex items-center gap-2 mt-4 px-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
            <span className="text-caption text-chrome-ink-subtle font-mono">
              System Online v1.0
            </span>
          </div>
        </div>

        {/* Bottom-right corner bracket */}
        <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-brass-chrome opacity-30 rounded-br-sm pointer-events-none" />
      </aside>
    </>
  )
}

export default Sidebar