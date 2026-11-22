/**
 * M10 coverage ratchet — the working screens, rendered against a stubbed API.
 *
 * The suite is deliberately about the page shell and its data path: every
 * screen below loads, leaves its skeleton, and renders its heading with a
 * valid empty page. That is the route a pilot user takes on a quiet day, and
 * it covers the large render functions the earlier suites never mounted.
 *
 * The API mock answers every GET with the same paginated envelope, so each
 * page's own parser is exercised without inventing a different fixture per
 * endpoint. The correction trail test supplies one correction because that
 * page's whole purpose is the timeline inside it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '../api/axios'
import Policies from '../pages/Policies'
import CalendarSettings from '../pages/CalendarSettings'
import HrCorrections from '../pages/HrCorrections'
import HrHelpRequests from '../pages/HrHelpRequests'
import HrAudit from '../pages/HrAudit'
import Sites from '../pages/Sites'
import Scheduling from '../pages/Scheduling'
import ShiftManagement from '../pages/ShiftManagement'
import Devices from '../pages/Devices'
import StaffAttendance from '../pages/StaffAttendance'
import StaffSchedule from '../pages/StaffSchedule'
import HrCorrectionTrail from '../pages/HrCorrectionTrail'
import StaffDashboard from '../pages/StaffDashboard'
import HrDashboard from '../pages/HrDashboard'
import HrAttendance from '../pages/HrAttendance'
import HrExceptions from '../pages/HrExceptions'
import HrReports from '../pages/HrReports'
import SuperAdminDashboard from '../pages/SuperAdminDashboard'
import SuperAdminSettings from '../pages/SuperAdminSettings'
import StaffOffDays from '../pages/StaffOffDays'
import StaffHelpRequests from '../pages/StaffHelpRequests'
import StaffHelpRequestNew from '../pages/StaffHelpRequestNew'
import StaffHelpRequestDetail from '../pages/StaffHelpRequestDetail'
import StaffCorrections from '../pages/StaffCorrections'
import StaffCorrectionNew from '../pages/StaffCorrectionNew'
import StaffCorrectionDetail from '../pages/StaffCorrectionDetail'
import StaffChangePin from '../pages/StaffChangePin'
import Profile from '../pages/Profile'
import Dashboard from '../pages/Dashboard'
import Settings from '../pages/Settings'
import Schedule from '../pages/Schedule'

const get = vi.mocked(api.get)

const emptyPage = {
  data: {
    success: true,
    data: [],
    pagination: { currentPage: 1, totalPages: 1, total: 0, totalRecords: 0 },
  },
}

function signIn(role) {
  localStorage.setItem('token', 'coverage-session')
  localStorage.setItem(
    'user',
    JSON.stringify({
      id: 'user-1',
      email: `${role.toLowerCase()}@attendpro.test`,
      firstName: 'Coverage',
      lastName: 'Tester',
      role,
      mustChangePassword: false,
    })
  )
}

function renderAs(role, ui) {
  signIn(role)
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function renderAdmin(ui) {
  return renderAs('SUPERADMIN', ui)
}

const pages = [
  ['Attendance Policies', <Policies />],
  ['Calendar Settings', <CalendarSettings />],
  ['Corrections', <HrCorrections />],
  ['Help Requests', <HrHelpRequests />],
  ['Audit History', <HrAudit />],
  ['Sites / Geo-fences', <Sites />],
  ['Scheduling', <Scheduling />],
  ['Shift Definitions', <ShiftManagement />],
  ['Kiosk Devices', <Devices />],
]

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue(emptyPage)
})

describe('administrator screens render their working shell', () => {
  it.each(pages)('%s mounts with an empty page', async (title, element) => {
    renderAdmin(element)

    expect(
      await screen.findByRole('heading', { name: title })
    ).toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalled())
  })
})

const hrPages = [
  ['Attendance Register', <HrAttendance />],
  ['Exceptions', <HrExceptions />],
  ['Reports', <HrReports />],
]

const staffPages = [
  ['Holidays & Calendar Overrides', <StaffOffDays />],
  ['Help Requests', <StaffHelpRequests />],
  ['New Request', <StaffHelpRequestNew />],
  ['My Requests', <StaffCorrections />],
  ['New Correction', <StaffCorrectionNew />],
  ['Change PIN', <StaffChangePin />],
  ['My Profile', <Profile />],
]

describe('the remaining working screens mount', () => {
  it.each(hrPages)('%s renders for HR', async (title, element) => {
    renderAs('HR', element)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  })

  it.each(staffPages)('%s renders for staff', async (title, element) => {
    if (element.type === StaffHelpRequests) {
      get.mockResolvedValue({ data: { success: true, data: [], pagination: { currentPage: 1, totalPages: 0, total: 0 } } })
    }
    renderAs('STAFF', element)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('renders the staff dashboard', async () => {
    renderAs('STAFF', <StaffDashboard />)
    expect(
      await screen.findByRole('heading', { name: /coverage/i })
    ).toBeInTheDocument()
  })

  it('renders the HR dashboard', async () => {
    renderAs('HR', <HrDashboard />)
    expect(await screen.findByText(/welcome, coverage/i)).toBeInTheDocument()
  })

  it('renders the SUPERADMIN dashboard and settings', async () => {
    renderAs('SUPERADMIN', <SuperAdminDashboard />)
    expect(await screen.findByText(/welcome, coverage/i)).toBeInTheDocument()
  })

  it('renders the business settings form', async () => {
    renderAs('SUPERADMIN', <SuperAdminSettings />)
    expect(
      await screen.findByRole('heading', { name: 'Business Settings' })
    ).toBeInTheDocument()
  })

  it('renders the account and security screen', async () => {
    renderAs('SUPERADMIN', <Settings />)
    expect(
      await screen.findByRole('heading', { name: 'Account & Security' })
    ).toBeInTheDocument()
  })

  it('renders the legacy dashboard and monthly schedule', async () => {
    renderAs('STAFF', <Dashboard />)
    expect(
      await screen.findByRole('heading', { name: /coverage/i })
    ).toBeInTheDocument()
  })

  it('renders the monthly schedule page', async () => {
    renderAs('STAFF', <Schedule />)
    expect(
      await screen.findByRole('heading', { name: 'Monthly Schedule' })
    ).toBeInTheDocument()
  })
})

describe('staff request and correction detail pages', () => {
  const helpRequest = {
    id: 'help-1',
    requesterId: 'user-1',
    subject: 'The kiosk does not accept my PIN',
    category: 'KIOSK',
    status: 'OPEN',
    createdAt: '2026-10-20T08:00:00.000Z',
    body: 'I entered the PIN three times and the kiosk refused it.',
    updatedAt: '2026-10-20T08:00:00.000Z',
    resolutionNote: null,
    resolvedAt: null,
  }

  const correctionDetail = {
    id: 'corr-1',
    attendanceDate: '2026-10-20',
    tier: 'TIER_1',
    status: 'PENDING',
    createdAt: '2026-10-20T09:00:00.000Z',
    reason: 'The clock-in was recorded two minutes late by mistake.',
    originalValues: {
      clockIn: '2026-10-20T08:02:00.000Z',
      clockOut: null,
      status: 'LATE',
    },
    proposedValues: {
      clockIn: '2026-10-20T08:00:00.000Z',
      clockOut: null,
      status: 'ON_TIME',
    },
    decision: null,
    auditTrail: [],
  }

  it('renders a help request detail route', async () => {
    get.mockResolvedValue({ data: { success: true, data: helpRequest } })
    signIn('STAFF')
    render(
      <MemoryRouter initialEntries={['/staff/help-requests/help-1']}>
        <Routes>
          <Route
            path="/staff/help-requests/:id"
            element={<StaffHelpRequestDetail />}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(
      await screen.findByRole('heading', {
        name: 'The kiosk does not accept my PIN',
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/three times/i)).toBeInTheDocument()
  })

  it('renders a correction detail route', async () => {
    get.mockResolvedValue({ data: { success: true, data: correctionDetail } })
    signIn('STAFF')
    render(
      <MemoryRouter initialEntries={['/staff/corrections/corr-1']}>
        <Routes>
          <Route
            path="/staff/corrections/:id"
            element={<StaffCorrectionDetail />}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Request for 20 Oct 2026',
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/two minutes late/i)).toBeInTheDocument()
  })
})

describe('staff screens render their working shell', () => {
  it('renders the full attendance history', async () => {
    signIn('STAFF')
    render(
      <MemoryRouter>
        <StaffAttendance />
      </MemoryRouter>
    )

    expect(
      await screen.findByRole('heading', { name: 'Full History' })
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('/attendance/my-attendance')
    )
  })

  it('renders the assigned shifts screen when all three lanes answer', async () => {
    signIn('STAFF')
    render(
      <MemoryRouter>
        <StaffSchedule />
      </MemoryRouter>
    )

    expect(
      await screen.findByRole('heading', { name: 'Assigned Shifts & Off-Days' })
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/staff/schedule')
  })
})

describe('HrCorrectionTrail', () => {
  const correction = {
    id: 'corr-1',
    reason: 'The clock-in was recorded at the site gate, not the office.',
    requestedAt: '2026-10-20T08:15:00.000Z',
    reviewTier: 'TIER_1',
    proposedClockIn: '2026-10-20T07:55:00.000Z',
    proposedClockOut: null,
    originalValues: { clockIn: '2026-10-20T08:12:00.000Z' },
    approvedValues: null,
    status: 'PENDING',
    decisionNote: null,
    decidedAt: null,
    requestedBy: { firstName: 'Ama', lastName: 'Boateng' },
    reviewedBy: null,
    attendance: {
      id: 'attendance-1',
      date: '2026-10-20',
      user: { firstName: 'Ama', lastName: 'Boateng' },
    },
    attendanceCorrectionRevisions: [
      {
        id: 'rev-1',
        revisionNo: 1,
        action: 'SUBMITTED',
        reason: 'Initial request',
        createdAt: '2026-10-20T08:15:00.000Z',
        actor: { firstName: 'Ama', lastName: 'Boateng' },
      },
    ],
    audits: [
      {
        id: 'audit-1',
        action: 'correction.submitted',
        actorType: 'USER',
        reason: 'Employee submitted a correction',
        createdAt: '2026-10-20T08:15:00.000Z',
      },
    ],
  }

  function renderTrail() {
    signIn('HR')
    return render(
      <MemoryRouter initialEntries={['/hr-audit/corrections/attendance-1']}>
        <Routes>
          <Route
            path="/hr-audit/corrections/:id"
            element={<HrCorrectionTrail />}
          />
        </Routes>
      </MemoryRouter>
    )
  }

  it('renders the correction, revisions and audit events', async () => {
    get.mockResolvedValue({
      data: { success: true, data: [correction] },
    })

    renderTrail()

    expect(
      await screen.findByRole('heading', { name: 'Correction trail' })
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/recorded at the site gate/i)
    ).toBeInTheDocument()
    expect(screen.getByText('SUBMITTED · #1')).toBeInTheDocument()
    expect(screen.getByText('correction.submitted')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/audit/corrections/attendance-1')
  })

  it('renders the empty state when no correction was filed', async () => {
    get.mockResolvedValue({ data: { success: true, data: [] } })

    renderTrail()

    expect(
      await screen.findByText(/no correction requests were filed/i)
    ).toBeInTheDocument()
  })
})
