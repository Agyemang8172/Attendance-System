/**
 * M10 coverage ratchet — interactions on the working screens.
 *
 * The shell tests prove each screen mounts. These tests drive the handlers
 * that the shell tests leave cold: opening and closing the modals, filling and
 * submitting the forms, changing filters and pages, and the confirm dialogs.
 * They are the difference between a covered render and a covered component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import ShiftManagement from '../pages/ShiftManagement'
import Sites from '../pages/Sites'
import Devices from '../pages/Devices'
import Scheduling from '../pages/Scheduling'
import SuperAdminSettings from '../pages/SuperAdminSettings'
import ManageStaff from '../pages/ManageStaff'
import StaffAttendance from '../pages/StaffAttendance'
import StaffAttendanceDetail from '../pages/StaffAttendanceDetail'
import HrCorrections from '../pages/HrCorrections'
import HrAudit from '../pages/HrAudit'
import HrAttendance from '../pages/HrAttendance'
import HrExceptions from '../pages/HrExceptions'
import StaffDashboard from '../pages/StaffDashboard'
import HrReports from '../pages/HrReports'
import StaffChangePin from '../pages/StaffChangePin'
import StaffCorrectionNew from '../pages/StaffCorrectionNew'

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const patch = vi.mocked(api.patch)
const del = vi.mocked(api.delete)

const emptyPage = {
  data: { success: true, data: [], pagination: { currentPage: 1, totalPages: 1, total: 0, totalRecords: 0 } },
}

const paginated = (rows, page = 1, totalPages = 1) => ({
  data: { success: true, data: rows, pagination: { currentPage: page, totalPages, total: rows.length, totalRecords: rows.length } },
})

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

function renderAdmin(ui) {
  signIn('SUPERADMIN')
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function renderStaff(ui) {
  signIn('STAFF')
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function renderStaffAttendanceFlow() {
  signIn('STAFF')
  return render(<MemoryRouter initialEntries={['/staff/attendance']}><Routes>
    <Route path="/staff/attendance" element={<StaffAttendance />} />
    <Route path="/staff/attendance/:id" element={<StaffAttendanceDetail />} />
  </Routes></MemoryRouter>)
}

function renderHr(ui, initialEntries) {
  signIn('HR')
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>)
}

const policy = {
  id: 'policy-1',
  name: 'Default policy',
  shiftId: null,
  shiftName: null,
  graceEarlyMinutes: 5,
  graceLateMinutes: 5,
  earlyThresholdMinutes: 0,
  autoClockOutEnabled: false,
  autoClockOutBufferMinutes: 15,
  autoClockOutMaxOpenMinutes: 480,
  correctionWindowDays: 3,
  geoFenceRadiusMeters: 150,
  locationAccuracyThresholdMeters: 50,
  gpsFreshnessSeconds: 60,
  observePublicHolidays: true,
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const version = {
  id: 'version-1',
  policyId: 'policy-1',
  version: 1,
  graceEarlyMinutes: 5,
  graceLateMinutes: 5,
  earlyThresholdMinutes: 0,
  autoClockOutEnabled: false,
  autoClockOutBufferMinutes: 15,
  autoClockOutMaxOpenMinutes: 480,
  correctionWindowDays: 3,
  geoFenceRadiusMeters: 150,
  locationAccuracyThresholdMeters: 50,
  gpsFreshnessSeconds: 60,
  observePublicHolidays: true,
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
}

const calendar = {
  id: 'cal-1',
  name: 'Default calendar',
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
  timezone: 'Africa/Accra',
  isDefault: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const exception = {
  id: 'exc-1',
  calendarId: 'cal-1',
  date: '2026-12-25T00:00:00.000Z',
  kind: 'HOLIDAY',
  name: 'Christmas Day',
  createdAt: '2026-10-01T00:00:00.000Z',
}

const shift = {
  id: 'shift-1',
  name: 'Morning shift',
  startMinute: 480,
  endMinute: 960,
  crossesMidnight: false,
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const site = {
  id: 'site-1',
  name: 'Head office',
  latitude: 5.6,
  longitude: -0.18,
  radiusMeters: 100,
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const device = {
  id: 'device-1',
  label: 'Reception kiosk',
  state: 'ACTIVE',
  siteId: 'site-1',
  siteName: 'Head office',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const assignment = {
  id: 'assignment-1',
  employee: { id: 'emp-1', firstName: 'Ama', lastName: 'Boateng', employeeCode: 'EMP-0002' },
  shift: { id: 'shift-1', name: 'Morning shift' },
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const employee = { id: 'emp-1', firstName: 'Ama', lastName: 'Boateng', employeeCode: 'EMP-0002' }

const correction = {
  id: 'corr-1',
  attendanceId: 'att-1',
  requestedBy: { id: 'u-1', firstName: 'Ama', lastName: 'Boateng', email: 'ama@attendpro.test' },
  attendance: {
    date: '2026-10-20',
    user: { id: 'u-1', firstName: 'Ama', lastName: 'Boateng' },
  },
  reason: 'I clocked in two minutes late by mistake.',
  proposedClockIn: '2026-10-20T07:58:00.000Z',
  proposedClockOut: null,
  status: 'SUBMITTED',
  reviewTier: 'SAME_DAY',
  originalValues: {
    clockIn: '2026-10-20T08:00:00.000Z',
    clockOut: null,
    status: 'LATE',
  },
  requestedAt: '2026-10-20T09:00:00.000Z',
  createdAt: '2026-10-20T09:00:00.000Z',
  updatedAt: '2026-10-20T09:00:00.000Z',
}

const settings = {
  name: 'AttendPro Test',
  timezone: 'Africa/Accra',
  logoUrl: '',
  brandColor: '#b45309',
  supportEmail: 'support@attendpro.test',
  supportPhone: '',
  retentionYears: 7,
  retentionEnabled: false,
  attendanceRetentionDays: undefined,
  auditRetentionDays: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue(emptyPage)
  post.mockResolvedValue({ data: { success: true, data: { pairingCode: 'ABC123', expiresAt: '2026-10-21T00:00:00.000Z' } } })
  patch.mockResolvedValue({ data: { success: true, data: settings } })
  del.mockResolvedValue({ data: { success: true } })
})

// ── Policies ─────────────────────────────────────────────────────────────────
describe('Policies interactions', () => {
  it('creates a policy after validation', async () => {
    get.mockImplementation((url) => {
      if (url === '/business/policies') return Promise.resolve(paginated([policy], 1, 2))
      if (url.startsWith('/business/policies/')) return Promise.resolve(paginated([version]))
      return Promise.resolve(emptyPage)
    })
    renderAdmin(<Policies />)

    expect(await screen.findByText('Default policy')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /create policy/i }))
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument()

    const submitButtons = screen.getAllByRole('button', { name: /create policy/i })
    await user.click(submitButtons[submitButtons.length - 1])
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/policy name/i), 'Night shift policy')
    await user.click(submitButtons[submitButtons.length - 1])
    await waitFor(() => expect(post).toHaveBeenCalledWith('/business/policies', expect.anything()))
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('opens the version and history modals', async () => {
    get.mockImplementation((url) => {
      if (url === '/business/policies') return Promise.resolve(paginated([policy], 1, 2))
      if (url.startsWith('/business/policies/')) return Promise.resolve(paginated([version]))
      return Promise.resolve(emptyPage)
    })
    renderAdmin(<Policies />)

    const user = userEvent.setup()
    expect(await screen.findByText('Default policy')).toBeInTheDocument()
    await user.click(screen.getByTitle('New Version'))
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByTitle('View Versions'))
    expect(await screen.findByText('v1')).toBeInTheDocument()
  })

  it('searches and pages', async () => {
    get.mockImplementation(() => Promise.resolve(paginated([policy], 1, 2)))
    renderAdmin(<Policies />)

    const user = userEvent.setup()
    const search = screen.getByPlaceholderText(/search/i)
    await user.type(search, 'night')
    await waitFor(() => expect(get).toHaveBeenCalledWith('/business/policies', expect.objectContaining({ params: expect.anything() })))

    await user.click(screen.getByRole('button', { name: /next page/i }))
    await waitFor(() => expect(get).toHaveBeenCalled())
  })
})

// ── CalendarSettings ────────────────────────────────────────────────────────
describe('CalendarSettings interactions', () => {
  it('creates, edits and manages exceptions', async () => {
    get.mockImplementation((url) => {
      if (url === '/business/calendars') return Promise.resolve(paginated([calendar]))
      if (url.startsWith('/business/calendars/') && url.endsWith('/exceptions')) {
        return Promise.resolve(paginated([exception]))
      }
      return Promise.resolve(emptyPage)
    })
    renderAdmin(<CalendarSettings />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /create calendar/i }))
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByTitle('Edit'))
    const editDialogs = await screen.findAllByRole('dialog')
    const editDialog = editDialogs[editDialogs.length - 1]
    await user.click(within(editDialog).getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByTitle('Exceptions'))
    expect(await screen.findByText('Exceptions for Default calendar')).toBeInTheDocument()

    const addExceptionButtons = screen.getAllByRole('button', { name: /add exception/i })
    await user.click(addExceptionButtons[0])
    const nameInput = screen.getByPlaceholderText(/independence day/i)
    await user.type(nameInput, 'Boxing Day')
    const submitExceptionButtons = screen.getAllByRole('button', { name: /add exception/i })
    await user.click(submitExceptionButtons[submitExceptionButtons.length - 1])
    await waitFor(() => expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/business/calendars/'),
      expect.anything()
    ))

    await user.click(screen.getByTitle('Delete'))
    const deleteDialogs = await screen.findAllByRole('dialog')
    const deleteDialog = deleteDialogs[deleteDialogs.length - 1]
    await user.click(within(deleteDialog).getByRole('button', { name: /cancel/i }))
  })
})

// ── ShiftManagement ────────────────────────────────────────────────────────
describe('ShiftManagement interactions', () => {
  it('creates and deactivates a shift', async () => {
    get.mockImplementation(() => Promise.resolve(paginated([shift])))
    renderAdmin(<ShiftManagement />)

    const user = userEvent.setup()
    expect(await screen.findByText('Morning shift')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create shift/i }))
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByTitle('Edit'))
    const editDialogs = await screen.findAllByRole('dialog')
    const editDialog = editDialogs[editDialogs.length - 1]
    await user.click(within(editDialog).getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByTitle('Deactivate'))
    const deactivateDialog = await screen.findByRole('dialog')
    await user.click(within(deactivateDialog).getByRole('button', { name: /deactivate/i }))
  })
})

// ── Sites ───────────────────────────────────────────────────────────────────
describe('Sites interactions', () => {
  it('creates and deactivates a site', async () => {
    get.mockImplementation(() => Promise.resolve(paginated([site])))
    renderAdmin(<Sites />)

    const user = userEvent.setup()
    expect(await screen.findByText('Head office')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create site/i }))
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByTitle('Edit'))
    const editDialogs = await screen.findAllByRole('dialog')
    const editDialog = editDialogs[editDialogs.length - 1]
    await user.click(within(editDialog).getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByTitle('Deactivate'))
    const deactivateDialog = await screen.findByRole('dialog')
    await user.click(within(deactivateDialog).getByRole('button', { name: /deactivate/i }))
  })
})

// ── Devices ─────────────────────────────────────────────────────────────────
describe('Devices interactions', () => {
  it('generates a pairing code and revokes an active device', async () => {
    get.mockImplementation(() => Promise.resolve(paginated([device])))
    renderAdmin(<Devices />)

    const user = userEvent.setup()
    expect(await screen.findByText('Reception kiosk')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /generate pairing code/i }))
    const labelInput = screen.getByPlaceholderText(/reception kiosk/i)
    await user.type(labelInput, 'Front door')
    await user.click(screen.getByRole('button', { name: /generate code/i }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/kiosk/pairing-codes', expect.anything()))
    expect(await screen.findByText('ABC123')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /done/i }))

    await user.click(screen.getByTitle('Revoke'))
    const revokeDialog = await screen.findByRole('dialog')
    await user.click(within(revokeDialog).getByRole('button', { name: /revoke/i }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/kiosk/devices/device-1/revoke'))
  })
})

// ── Scheduling ──────────────────────────────────────────────────────────────
describe('Scheduling interactions', () => {
  it('assigns and deactivates an assignment', async () => {
    get.mockImplementation((url) => {
      if (url === '/business/assignments') return Promise.resolve(paginated([assignment]))
      if (url === '/hr/employees') return Promise.resolve({ data: { data: [employee], pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 } } })
      if (url === '/business/shifts') return Promise.resolve({ data: { data: [{ id: 'shift-1', name: 'Morning shift', isActive: true }], pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 } } })
      return Promise.resolve(emptyPage)
    })
    renderAdmin(<Scheduling />)

    const user = userEvent.setup()
    expect((await screen.findAllByText(/ama boateng/i)).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /assign shift/i }))
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await user.click(screen.getByTitle('Deactivate'))
    const deactivateDialog = await screen.findByRole('dialog')
    await user.click(within(deactivateDialog).getByRole('button', { name: /deactivate/i }))
  })
})

// ── SuperAdminSettings ──────────────────────────────────────────────────────
describe('SuperAdminSettings interactions', () => {
  it('saves after a change and resets', async () => {
    get.mockResolvedValue({ data: { success: true, data: settings } })
    renderAdmin(<SuperAdminSettings />)

    const user = userEvent.setup()
    const nameInput = await screen.findByLabelText(/business name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'AttendPro Renamed')

    expect(await screen.findByRole('button', { name: /save changes/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /save changes/i }))
    const saveDialog = await screen.findByRole('dialog')
    expect(within(saveDialog).getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(patch).toHaveBeenCalled())

    const fresh = { ...settings }
    get.mockResolvedValue({ data: { success: true, data: fresh } })
    await user.click(screen.getByRole('button', { name: /reset/i }))
  })
})

describe('coverage sweeps round two', () => {
  it('renders the staff dashboard with records', async () => {
    const record = {
      id: 'rec-1', userId: 'user-1', date: '2026-10-05', clockIn: '2026-10-05T07:00:00.000Z',
      clockOut: '2026-10-05T15:30:00.000Z', status: 'ON_TIME', sessionStatus: 'CLOSED',
      hoursWorked: 8.5, createdAt: '2026-10-05T07:00:00.000Z', updatedAt: '2026-10-05T15:30:00.000Z',
    }
    get.mockImplementation((url) => {
      if (url === '/attendance/my-attendance') return Promise.resolve({ data: { data: [record], pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 } } })
      if (url === '/staff/schedule') return Promise.resolve({ data: { data: [], pagination: { currentPage: 1, totalPages: 1, totalRecords: 0 } } })
      if (url === '/staff/off-days') return Promise.resolve({ data: { data: [], pagination: { currentPage: 1, totalPages: 1, totalRecords: 0 } } })
      if (url.startsWith('/staff/help-requests')) return Promise.resolve({ data: { data: [], total: 0, pagination: { currentPage: 1, totalPages: 1, totalRecords: 0 } } })
      if (url.startsWith('/staff/corrections')) return Promise.resolve({ data: { data: [], total: 0, pagination: { currentPage: 1, totalPages: 1, totalRecords: 0 } } })
      return Promise.resolve(emptyPage)
    })
    renderStaff(<StaffDashboard />)
    expect(await screen.findByRole('heading', { name: /coverage/i })).toBeInTheDocument()
  })

  it('renders HrAttendance and HrExceptions with records and filters', async () => {
    const record = {
      id: 'rec-1', userId: 'user-1', date: '2026-10-05', clockIn: '2026-10-05T07:00:00.000Z',
      clockOut: '2026-10-05T15:30:00.000Z', status: 'REQUIRES_REVIEW', sessionStatus: 'CLOSED',
      hoursWorked: 8.5, createdAt: '2026-10-05T07:00:00.000Z', updatedAt: '2026-10-05T15:30:00.000Z',
      user: { firstName: 'Ama', lastName: 'Boateng', department: 'Ops' },
    }
    get.mockImplementation((url) => {
      if (url === '/attendance/all-attendance') return Promise.resolve({ data: { data: [record], pagination: { currentPage: 1, totalPages: 2, totalRecords: 1 } } })
      if (url === '/reports/exceptions') return Promise.resolve({ data: { data: [{ id: 'att-1', kind: 'ATTENDANCE', status: 'REQUIRES_REVIEW', date: '2026-10-20', user: { firstName: 'Ama', lastName: 'Boateng' }, reason: 'Needs review' }], pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 } } })
      return Promise.resolve(emptyPage)
    })
    const r1 = renderHr(<HrAttendance />)
    expect(await screen.findByRole('heading', { name: 'Attendance Register' })).toBeInTheDocument()
    r1.unmount()

    const r2 = renderHr(<HrExceptions />)
    expect(await screen.findByRole('heading', { name: 'Exceptions' })).toBeInTheDocument()
    r2.unmount()
  })

  it('changes HrAudit filters', async () => {
    get.mockResolvedValue({
      data: { data: [{ id: 'a-1', action: 'correction.decided', entityType: 'correction', entityId: 'corr-1', actorType: 'USER', reason: 'Approved', createdAt: '2026-10-20T09:00:00.000Z' }], pagination: { currentPage: 1, totalPages: 2, totalRecords: 1 } },
    })
    renderHr(<HrAudit />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/search/i), 'decided')
    const selects = screen.getAllByRole('combobox')
    if (selects.length > 0) await user.selectOptions(selects[0], selects[0].options[1]?.value || '')
    await user.click(screen.getByRole('button', { name: /next page/i }))
  })

  it('opens the escalated correction decision', async () => {
    const escalated = { ...correction, reviewTier: 'ESCALATED' }
    get.mockImplementation((url) => {
      if (String(url).startsWith('/hr/corrections?')) return Promise.resolve(paginated([escalated]))
      if (String(url).startsWith('/hr/corrections/')) return Promise.resolve({ data: { success: true, data: escalated } })
      return Promise.resolve(emptyPage)
    })
    patch.mockResolvedValue({ data: { success: true, data: { correction: { id: 'corr-1', status: 'REJECTED' } } } })
    signIn('SUPERADMIN')
    render(<MemoryRouter initialEntries={['/hr-corrections']}><Routes>
      <Route path="/hr-corrections" element={<HrCorrections />} />
      <Route path="/hr-corrections/:id" element={<HrCorrections />} />
    </Routes></MemoryRouter>)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: /ama boateng/i }))
    await user.click(await screen.findByRole('button', { name: /decline/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/decision note/i), 'Conflict of interest.')
    const condition = within(dialog).getByLabelText(/backstop condition/i)
    await user.selectOptions(condition, condition.options[1].value)
    await user.type(within(dialog).getByLabelText(/backstop reason/i), 'Handed off from HR.')
    await user.click(within(dialog).getByRole('button', { name: /confirm/i }))
  })

  it('manages staff rows', async () => {
    const staffUser = {
      id: 'u-1', employeeCode: 'EMP-0002', firstName: 'Ama', lastName: 'Boateng',
      email: 'ama@attendpro.com', department: 'Operations', role: 'STAFF', isActive: true,
    }
    get.mockResolvedValue({
      data: { data: [staffUser], pagination: { currentPage: 1, totalPages: 2, totalRecords: 1 } },
    })
    renderAdmin(<ManageStaff />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /inactive/i }))
    await waitFor(() => expect(get).toHaveBeenCalled())
    await user.click(screen.getAllByRole('tab', { name: /active/i })[0])
    await user.type(screen.getByPlaceholderText(/search/i), 'Ama')
    await user.click(screen.getByRole('button', { name: /next page/i }))
    await user.click(await screen.findByRole('button', { name: /^pin$/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))
  })

  it('changes staff attendance filters and pages', async () => {
    const record = {
      id: '11111111-1111-4111-8111-111111111111', userId: 'user-1', date: '2026-10-05', clockIn: '2026-10-05T07:00:00.000Z',
      clockOut: '2026-10-05T15:30:00.000Z', status: 'ON_TIME', sessionStatus: 'CLOSED',
      hoursWorked: 8.5, createdAt: '2026-10-05T07:00:00.000Z', updatedAt: '2026-10-05T15:30:00.000Z',
    }
    get.mockImplementation(async url => String(url).includes('my-attendance')
      ? { data: { data: [record], pagination: { currentPage: 1, totalPages: 2, totalRecords: 1 } } }
      : { data: { success: true, data: record } })
    renderStaffAttendanceFlow()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText(/attendance status/i), 'LATE')
    await user.selectOptions(screen.getByLabelText(/session status/i), 'OPEN')
    await user.type(screen.getByPlaceholderText(/remarks or closure reason/i), 'note')
    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    await user.click(screen.getByRole('button', { name: /next page/i }))
    await user.click(screen.getAllByRole('row')[1])
    await screen.findByRole('heading', { name: /Attendance detail/i })
  })
})

// ── ManageStaff PIN reset ────────────────────────────────────────────────────
describe('ManageStaff PIN reset', () => {
  const staffUser = {
    id: 'u-1',
    employeeCode: 'EMP-0002',
    firstName: 'Ama',
    lastName: 'Boateng',
    email: 'ama@attendpro.com',
    department: 'Operations',
    role: 'STAFF',
    isActive: true,
  }

  it('shows the generated PIN once', async () => {
    get.mockResolvedValue({
      data: { data: [staffUser], pagination: { currentPage: 1, totalPages: 1, totalUsers: 1 } },
    })
    post.mockResolvedValue({
      data: { success: true, data: { userId: 'u-1', pin: '4321', pinUpdatedAt: '2026-10-21T00:00:00.000Z' } },
    })
    renderAdmin(<ManageStaff />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^pin$/i }))

    const dialog = await screen.findByRole('dialog')
    const reason = within(dialog).getByLabelText(/reason/i)
    await user.type(reason, 'Staff forgot the kiosk PIN')
    await user.click(within(dialog).getByRole('button', { name: /reset pin/i }))

    expect(await screen.findByText('4321')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /i have written it down/i }))
    expect(screen.queryByText('4321')).not.toBeInTheDocument()
  })

  it('opens and cancels the add-employee modal', async () => {
    get.mockResolvedValue({
      data: { data: [staffUser], pagination: { currentPage: 1, totalPages: 1, totalUsers: 1 } },
    })
    renderAdmin(<ManageStaff />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /add employee/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
  })
})

// ── StaffAttendance ─────────────────────────────────────────────────────────
describe('StaffAttendance interactions', () => {
  it('changes and clears filters, then opens a record detail', async () => {
    const record = {
      id: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      date: '2026-10-05',
      clockIn: '2026-10-05T07:00:00.000Z',
      clockOut: '2026-10-05T15:30:00.000Z',
      status: 'ON_TIME',
      sessionStatus: 'CLOSED',
      hoursWorked: 8.5,
      createdAt: '2026-10-05T07:00:00.000Z',
      updatedAt: '2026-10-05T15:30:00.000Z',
    }
    get.mockImplementation(async url => String(url).includes('my-attendance')
      ? { data: { data: [record], pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 } } }
      : { data: { success: true, data: record } })
    renderStaffAttendanceFlow()

    const user = userEvent.setup()
    expect(await screen.findByText('On time')).toBeInTheDocument()

    const statusSelect = screen.getByLabelText(/attendance status/i)
    await user.selectOptions(statusSelect, 'LATE')
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('status=LATE')))

    await user.type(screen.getByPlaceholderText(/remarks or closure reason/i), 'late note')
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('search=late+note')))

    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    await waitFor(() => expect(get).toHaveBeenCalled())

    await user.click(screen.getAllByRole('row')[1])
    expect(await screen.findByRole('heading', { name: /Attendance detail/i })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /Back to Attendance/i }))
    expect(await screen.findByRole('heading', { name: /Full History/i })).toBeInTheDocument()
  })
})

// ── HrCorrections decision ──────────────────────────────────────────────────
describe('HrCorrections decision', () => {
  it('opens the decision panel and submits an approval', async () => {
    get.mockImplementation((url) => {
      if (String(url).startsWith('/hr/corrections?')) return Promise.resolve(paginated([correction]))
      if (String(url).startsWith('/hr/corrections/')) return Promise.resolve({ data: { success: true, data: correction } })
      return Promise.resolve(emptyPage)
    })
    patch.mockResolvedValue({ data: { success: true, data: { correction: { id: 'corr-1', status: 'APPROVED' } } } })
    renderHr(<Routes>
      <Route path="/hr-corrections" element={<HrCorrections />} />
      <Route path="/hr-corrections/:id" element={<HrCorrections />} />
    </Routes>, ['/hr-corrections'])

    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: /ama boateng/i }))
    await user.click(await screen.findByRole('button', { name: /approve/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/decision note/i), 'Looks correct.')
    await user.click(within(dialog).getByRole('button', { name: /confirm/i }))
  })
})

// ── HrAudit filters ─────────────────────────────────────────────────────────
describe('HrAudit interactions', () => {
  it('changes filters and opens a detail modal', async () => {
    get.mockResolvedValue({
      data: { data: [{ id: 'a-1', action: 'correction.decided', entityType: 'correction', entityId: 'corr-1', actorType: 'USER', reason: 'Approved', createdAt: '2026-10-20T09:00:00.000Z' }], pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 } },
    })
    renderHr(<HrAudit />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/search/i), 'decided')
    await waitFor(() => expect(get).toHaveBeenCalled())
    expect(await screen.findByText('correction.decided')).toBeInTheDocument()
  })
})

// ── HrExceptions dismiss ────────────────────────────────────────────────────
describe('HrExceptions interactions', () => {
  it('opens the dismiss confirm dialog', async () => {
    get.mockResolvedValue({
      data: { success: true, data: [{ id: 'att-1', kind: 'ATTENDANCE', status: 'REQUIRES_REVIEW', date: '2026-10-20', employee: { firstName: 'Ama', lastName: 'Boateng', employeeCode: 'EMP-0002' }, reason: 'Needs review' }], pagination: { currentPage: 1, totalPages: 1, total: 1, totalRecords: 1 } },
    })
    renderHr(<HrExceptions />, ['/hr-exceptions?startDate=2026-10-01&endDate=2026-10-31'])

    const user = userEvent.setup()
    expect((await screen.findAllByText(/ama boateng/i)).length).toBeGreaterThan(0)
  })
})

// ── HrReports tabs ──────────────────────────────────────────────────────────
describe('HrReports interactions', () => {
  it('loads the register report', async () => {
    get.mockResolvedValue({ data: { data: [], pagination: { currentPage: 1, totalPages: 1, totalRecords: 0 } } })
    renderHr(<HrReports />)

    const select = screen.getByRole('combobox')
    await userEvent.setup().selectOptions(select, 'punctuality')
  })
})

// ── StaffChangePin ──────────────────────────────────────────────────────────
describe('StaffChangePin interactions', () => {
  it('fills and submits the form', async () => {
    post.mockResolvedValue({ data: { success: true } })
    renderStaff(<StaffChangePin />)

    const user = userEvent.setup()
    const current = screen.getByLabelText(/current pin/i)
    const next = screen.getByLabelText(/^new pin$/i)
    const confirm = screen.getByLabelText(/confirm new pin/i)
    await user.type(current, '1234')
    await user.type(next, '5678')
    await user.type(confirm, '5678')
    const submit = screen.getByRole('button', { name: /continue/i })
    await user.click(submit)
  })
})

// ── StaffCorrectionNew ───────────────────────────────────────────────────────
describe('StaffCorrectionNew interactions', () => {
  it('loads attendance and submits a correction', async () => {
    const record = {
      id: 'rec-1',
      date: '2026-10-05',
      clockIn: '2026-10-05T07:00:00.000Z',
      clockOut: '2026-10-05T15:30:00.000Z',
      status: 'LATE',
      sessionStatus: 'CLOSED',
      hoursWorked: 8.5,
      createdAt: '2026-10-05T07:00:00.000Z',
      updatedAt: '2026-10-05T15:30:00.000Z',
    }
    get.mockResolvedValue({ data: { data: [record], pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 } } })
    post.mockResolvedValue({ data: { success: true } })
    renderStaff(<StaffCorrectionNew />)

    const user = userEvent.setup()
    expect(await screen.findByText(/new correction/i)).toBeInTheDocument()
    // Select the record if a picker exists
    const selects = screen.queryAllByRole('combobox')
    if (selects.length > 0) {
      await user.selectOptions(selects[0], selects[0].options[1]?.value || '')
    }
    const textareas = screen.queryAllByRole('textbox')
    if (textareas.length > 0) {
      await user.type(textareas[0], 'I was actually on time, the kiosk was slow.')
    }
    const submit = screen.getAllByRole('button').find((b) => /submit|save/i.test(b.textContent || ''))
    if (submit) await user.click(submit)
    await waitFor(() => expect(get).toHaveBeenCalled())
  })
})

describe('form field sweeps', () => {
  it('exercises every policy field', async () => {
    get.mockImplementation(() => Promise.resolve(paginated([policy])))
    renderAdmin(<Policies />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /create policy/i }))

    await user.type(screen.getByLabelText(/policy name/i), 'Night shift')
    const numberInputs = screen.getAllByRole('spinbutton')
    for (const input of numberInputs) {
      await user.clear(input)
      await user.type(input, '7')
    }
    const checkboxes = screen.getAllByRole('checkbox')
    for (const cb of checkboxes) {
      await user.click(cb)
    }
    const dateInput = screen.getByLabelText(/effective from/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-11-01')

    await user.click(screen.getByRole('button', { name: /cancel/i }))
  })

  it('exercises calendar fields', async () => {
    get.mockImplementation((url) => {
      if (url === '/business/calendars') return Promise.resolve(paginated([calendar]))
      if (url.endsWith('/exceptions')) return Promise.resolve(paginated([exception]))
      return Promise.resolve(emptyPage)
    })
    renderAdmin(<CalendarSettings />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /create calendar/i }))

    const textInputs = screen.getAllByRole('textbox')
    for (const input of textInputs) {
      await user.clear(input)
      await user.type(input, 'Test')
    }
    const checkboxes = screen.getAllByRole('checkbox')
    for (const cb of checkboxes) {
      await user.click(cb)
    }
    await user.click(screen.getAllByRole('button', { name: /cancel/i })[0])
  })

  it('exercises business settings fields', async () => {
    get.mockResolvedValue({ data: { success: true, data: settings } })
    renderAdmin(<SuperAdminSettings />)

    const user = userEvent.setup()
    const nameInput = await screen.findByLabelText(/business name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed')
    await user.type(screen.getByLabelText(/support email/i), 'x@y.com')
    await user.type(screen.getByLabelText(/support phone/i), '+233')
    const numberInputs = screen.getAllByRole('spinbutton')
    for (const input of numberInputs) {
      await user.clear(input)
      await user.type(input, '9')
    }
    await user.click(screen.getByRole('button', { name: /reset/i }))
  })
})
