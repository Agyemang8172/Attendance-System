import { http, HttpResponse, HttpHandler } from 'msw'

// Helper to simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Type definitions for request bodies
interface LoginRequest {
  email: string
  password: string
}

interface ClockInRequest {
  employeeId?: string
  shiftId?: string
  siteId?: string
}

interface ClockOutRequest {
  attendanceId: string
}

interface CreateEmployeeRequest {
  email: string
  name: string
  role: string
  department?: string
  position?: string
}

interface CreateShiftRequest {
  name: string
  startTime: string
  endTime: string
  timezone: string
  gracePeriodMinutes: number
}

interface CreateSiteRequest {
  name: string
  address: string
  latitude: number
  longitude: number
  radiusMeters: number
}

interface CreatePolicyRequest {
  name: string
  autoClockOutEnabled: boolean
  autoClockOutHours: number
  requirePhoto: boolean
  requireLocation: boolean
}

interface CreateHelpRequestRequest {
  employeeId: string
  subject: string
  message: string
}

interface CreateCorrectionRequest {
  employeeId: string
  date: string
  requestedClockIn: string
  requestedClockOut: string
  reason: string
}

interface VerifyPinRequest {
  pin: string
}

interface KioskClockInRequest {
  employeeId: string
}

interface KioskClockOutRequest {
  attendanceId: string
}

interface PairKioskRequest {
  code: string
}

interface UpdateSettingsRequest {
  timezone?: string
  dateFormat?: string
  timeFormat?: string
  language?: string
}

// Mock user type
interface MockUser {
  id: string
  email: string
  name: string
  role: 'SUPERADMIN' | 'HR' | 'STAFF'
  tenantId: string
  employeeId?: string
}

// Mock shift type
interface MockShift {
  id: string
  name: string
  startTime: string
  endTime: string
  timezone: string
  gracePeriodMinutes: number
  tenantId: string
}

// Mock site type
interface MockSite {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radiusMeters: number
  tenantId: string
}

// Mock policy type
interface MockPolicy {
  id: string
  name: string
  autoClockOutEnabled: boolean
  autoClockOutHours: number
  requirePhoto: boolean
  requireLocation: boolean
  tenantId: string
}

// Mock calendar type
interface MockCalendar {
  id: string
  name: string
  year: number
  holidays: unknown[]
  tenantId: string
}

// Mock attendance type
interface MockAttendance {
  id: string
  employeeId: string
  date: string
  status: 'PRESENT'
  clockIn: string
  clockOut: string
  shiftId: string
  siteId: string
}

// Mock help request type
interface MockHelpRequest {
  id: string
  employeeId: string
  subject: string
  message: string
  status: 'OPEN'
  createdAt: string
}

// Mock correction type
interface MockCorrection {
  id: string
  employeeId: string
  date: string
  requestedClockIn: string
  requestedClockOut: string
  reason: string
  status: 'PENDING'
  createdAt: string
}

// Helper to merge mock object with updates
function mergeMock<T extends object>(mock: T, updates: Partial<T>): T {
  return { ...mock, ...updates } as T
}

// Mock user data
const mockUsers = {
  superadmin: {
    id: '1',
    email: 'superadmin@attendpro.com',
    name: 'Super Admin',
    role: 'SUPERADMIN' as const,
    tenantId: '1',
  } satisfies MockUser,
  hr: {
    id: '2',
    email: 'hr@attendpro.com',
    name: 'HR Manager',
    role: 'HR' as const,
    tenantId: '1',
  } satisfies MockUser,
  staff1: {
    id: '3',
    email: 'staff1@attendpro.com',
    name: 'John Doe',
    role: 'STAFF' as const,
    tenantId: '1',
    employeeId: 'EMP001',
  } satisfies MockUser,
  staff2: {
    id: '4',
    email: 'staff2@attendpro.com',
    name: 'Jane Smith',
    role: 'STAFF' as const,
    tenantId: '1',
    employeeId: 'EMP002',
  } satisfies MockUser,
}

// Mock shifts
const mockShifts: MockShift[] = [
  {
    id: '1',
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'UTC',
    gracePeriodMinutes: 15,
    tenantId: '1',
  },
  {
    id: '2',
    name: 'Night Shift',
    startTime: '22:00',
    endTime: '06:00',
    timezone: 'UTC',
    gracePeriodMinutes: 15,
    tenantId: '1',
  },
]

// Mock sites
const mockSites: MockSite[] = [
  {
    id: '1',
    name: 'Main Office',
    address: '123 Business Ave',
    latitude: 40.7128,
    longitude: -74.006,
    radiusMeters: 100,
    tenantId: '1',
  },
]

// Mock policies
const mockPolicies: MockPolicy[] = [
  {
    id: '1',
    name: 'Standard Policy',
    autoClockOutEnabled: true,
    autoClockOutHours: 10,
    requirePhoto: false,
    requireLocation: true,
    tenantId: '1',
  },
]

// Mock calendar
const mockCalendars: MockCalendar[] = [
  {
    id: '1',
    name: '2026 Calendar',
    year: 2026,
    holidays: [],
    tenantId: '1',
  },
]

// Mock attendance records
const mockAttendance: MockAttendance[] = [
  {
    id: '1',
    employeeId: '3',
    date: new Date().toISOString().split('T')[0],
    status: 'PRESENT',
    clockIn: '09:00',
    clockOut: '17:00',
    shiftId: '1',
    siteId: '1',
  },
]

// Mock help requests
const mockHelpRequests: MockHelpRequest[] = [
  {
    id: '1',
    employeeId: '3',
    subject: 'Cannot clock in',
    message: 'QR code not scanning',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  },
]

// Mock corrections
const mockCorrections: MockCorrection[] = [
  {
    id: '1',
    employeeId: '3',
    date: new Date().toISOString().split('T')[0],
    requestedClockIn: '08:55',
    requestedClockOut: '17:05',
    reason: 'Forgot to clock in on time',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
]

function findUserByEmail(email: string) {
  const entries = Object.entries(mockUsers) as [string, typeof mockUsers.superadmin][]
  return entries.find(([, user]) => user.email === email)?.[1] || null
}

function findAttendanceById(id: string) {
  return mockAttendance.find((a) => a.id === id)
}

function findHelpRequestById(id: string) {
  return mockHelpRequests.find((h) => h.id === id)
}

function findCorrectionById(id: string) {
  return mockCorrections.find((c) => c.id === id)
}

function findShiftById(id: string) {
  return mockShifts.find((s) => s.id === id)
}

function findSiteById(id: string) {
  return mockSites.find((s) => s.id === id)
}

function findPolicyById(id: string) {
  return mockPolicies.find((p) => p.id === id)
}

function findCalendarById(id: string) {
  return mockCalendars.find((c) => c.id === id)
}

export const handlers: HttpHandler[] = [
  // Auth endpoints
  http.post('/api/auth/login', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as LoginRequest
    const { email, password } = body

    if (password !== 'devos123') {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const user = findUserByEmail(email)
    if (!user) {
      return HttpResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return HttpResponse.json({
      user,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    })
  }),

  http.post('/api/auth/refresh', async () => {
    await delay(50)
    return HttpResponse.json({
      accessToken: 'mock-new-access-token',
      refreshToken: 'mock-new-refresh-token',
    })
  }),

  http.post('/api/auth/logout', async () => {
    await delay(50)
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(50)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json(mockUsers.staff1)
  }),

  // Employee endpoints
  http.get('/api/employees', async ({ request }) => {
    await delay(100)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({
      data: [mockUsers.staff1, mockUsers.staff2],
      meta: { total: 2, page: 1, pageSize: 20 },
    })
  }),

  http.get('/api/employees/:id', async ({ params }) => {
    await delay(50)
    const { id } = params
    if (id === '3') return HttpResponse.json(mockUsers.staff1)
    if (id === '4') return HttpResponse.json(mockUsers.staff2)
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  http.post('/api/employees', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as CreateEmployeeRequest
    const newEmployee = { ...body, id: String(Date.now()), tenantId: '1' }
    return HttpResponse.json(newEmployee, { status: 201 })
  }),

  http.patch('/api/employees/:id', async ({ params, request }) => {
    await delay(100)
    const { id } = params
    const body = (await request.json()) as Partial<MockUser>
    if (id === '3') return HttpResponse.json(mergeMock(mockUsers.staff1, body))
    if (id === '4') return HttpResponse.json(mergeMock(mockUsers.staff2, body))
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  http.delete('/api/employees/:id', async ({ params }) => {
    await delay(50)
    return HttpResponse.json({ success: true })
  }),

  // Attendance endpoints
  http.get('/api/attendance', async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]
    return HttpResponse.json({
      data: mockAttendance.filter((a) => a.date === date),
      meta: { total: mockAttendance.length, page: 1, pageSize: 20 },
    })
  }),

  http.post('/api/attendance/clock-in', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as ClockInRequest
    const record = {
      id: String(Date.now()),
      employeeId: body.employeeId || '3',
      date: new Date().toISOString().split('T')[0],
      status: 'PRESENT' as const,
      clockIn: new Date().toTimeString().slice(0, 5),
      shiftId: body.shiftId || '1',
      siteId: body.siteId || '1',
    }
    return HttpResponse.json(record, { status: 201 })
  }),

  http.post('/api/attendance/clock-out', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as ClockOutRequest
    return HttpResponse.json({
      id: body.attendanceId,
      clockOut: new Date().toTimeString().slice(0, 5),
      status: 'PRESENT',
    })
  }),

  http.get('/api/attendance/records/:employeeId', async ({ params }) => {
    await delay(100)
    const { employeeId } = params
    return HttpResponse.json({
      data: mockAttendance.filter((a) => a.employeeId === employeeId),
      meta: { total: mockAttendance.length, page: 1, pageSize: 20 },
    })
  }),

  // Shifts endpoints
  http.get('/api/shifts', async () => {
    await delay(50)
    return HttpResponse.json({ data: mockShifts, meta: { total: mockShifts.length } })
  }),

  http.get('/api/shifts/:id', async ({ params }) => {
    await delay(50)
    const shift = findShiftById(params.id as string)
    if (!shift) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(shift)
  }),

  http.post('/api/shifts', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as CreateShiftRequest
    const newShift = { ...body, id: String(Date.now()), tenantId: '1' }
    return HttpResponse.json(newShift, { status: 201 })
  }),

  http.patch('/api/shifts/:id', async ({ params, request }) => {
    await delay(100)
    const { id } = params
    const body = (await request.json()) as Partial<MockShift>
    const shift = findShiftById(id as string)
    if (!shift) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(mergeMock(shift, body))
  }),

  http.delete('/api/shifts/:id', async ({ params }) => {
    await delay(50)
    return HttpResponse.json({ success: true })
  }),

  // Sites endpoints
  http.get('/api/sites', async () => {
    await delay(50)
    return HttpResponse.json({ data: mockSites, meta: { total: mockSites.length } })
  }),

  http.get('/api/sites/:id', async ({ params }) => {
    await delay(50)
    const site = findSiteById(params.id as string)
    if (!site) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(site)
  }),

  http.post('/api/sites', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as CreateSiteRequest
    const newSite = { ...body, id: String(Date.now()), tenantId: '1' }
    return HttpResponse.json(newSite, { status: 201 })
  }),

  http.patch('/api/sites/:id', async ({ params, request }) => {
    await delay(100)
    const { id } = params
    const body = (await request.json()) as Partial<MockSite>
    const site = findSiteById(id as string)
    if (!site) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(mergeMock(site, body))
  }),

  http.delete('/api/sites/:id', async ({ params }) => {
    await delay(50)
    return HttpResponse.json({ success: true })
  }),

  // Policies endpoints
  http.get('/api/policies', async () => {
    await delay(50)
    return HttpResponse.json({ data: mockPolicies, meta: { total: mockPolicies.length } })
  }),

  http.get('/api/policies/:id', async ({ params }) => {
    await delay(50)
    const policy = findPolicyById(params.id as string)
    if (!policy) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(policy)
  }),

  http.post('/api/policies', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as CreatePolicyRequest
    const newPolicy = { ...body, id: String(Date.now()), tenantId: '1' }
    return HttpResponse.json(newPolicy, { status: 201 })
  }),

  http.patch('/api/policies/:id', async ({ params, request }) => {
    await delay(100)
    const { id } = params
    const body = (await request.json()) as Partial<MockPolicy>
    const policy = findPolicyById(id as string)
    if (!policy) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(mergeMock(policy, body))
  }),

  http.delete('/api/policies/:id', async ({ params }) => {
    await delay(50)
    return HttpResponse.json({ success: true })
  }),

  // Calendar endpoints
  http.get('/api/calendars', async () => {
    await delay(50)
    return HttpResponse.json({ data: mockCalendars, meta: { total: mockCalendars.length } })
  }),

  http.get('/api/calendars/:id', async ({ params }) => {
    await delay(50)
    const cal = findCalendarById(params.id as string)
    if (!cal) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(cal)
  }),

  // Help requests endpoints
  http.get('/api/help-requests', async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    let data = mockHelpRequests
    if (status) data = data.filter((h) => h.status === status)
    return HttpResponse.json({ data, meta: { total: data.length, page: 1, pageSize: 20 } })
  }),

  http.post('/api/help-requests', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as CreateHelpRequestRequest
    const newRequest = {
      ...body,
      id: String(Date.now()),
      status: 'OPEN' as const,
      createdAt: new Date().toISOString(),
    }
    return HttpResponse.json(newRequest, { status: 201 })
  }),

  http.patch('/api/help-requests/:id', async ({ params, request }) => {
    await delay(100)
    const { id } = params
    const body = (await request.json()) as Partial<MockHelpRequest>
    const request_ = findHelpRequestById(id as string)
    if (!request_) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(mergeMock(request_, body))
  }),

  // Corrections endpoints
  http.get('/api/corrections', async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    let data = mockCorrections
    if (status) data = data.filter((c) => c.status === status)
    return HttpResponse.json({ data, meta: { total: data.length, page: 1, pageSize: 20 } })
  }),

  http.post('/api/corrections', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as CreateCorrectionRequest
    const newCorrection = {
      ...body,
      id: String(Date.now()),
      status: 'PENDING' as const,
      createdAt: new Date().toISOString(),
    }
    return HttpResponse.json(newCorrection, { status: 201 })
  }),

  http.patch('/api/corrections/:id', async ({ params, request }) => {
    await delay(100)
    const { id } = params
    const body = (await request.json()) as Partial<MockCorrection>
    const correction = findCorrectionById(id as string)
    if (!correction) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(mergeMock(correction, body))
  }),

  // Reports endpoints
  http.get('/api/reports/attendance', async ({ request }) => {
    await delay(100)
    return HttpResponse.json({
      data: mockAttendance,
      summary: { total: mockAttendance.length, present: mockAttendance.length, absent: 0, late: 0 },
    })
  }),

  http.get('/api/reports/export', async () => {
    await delay(100)
    return HttpResponse.text('Employee,Date,Status,Clock In,Clock Out\nJohn Doe,2026-01-15,PRESENT,09:00,17:00')
  }),

  // Audit endpoints
  http.get('/api/audit', async ({ request }) => {
    await delay(100)
    return HttpResponse.json({
      data: [
        { id: '1', action: 'LOGIN', userId: '3', timestamp: new Date().toISOString(), details: {} },
        { id: '2', action: 'CLOCK_IN', userId: '3', timestamp: new Date().toISOString(), details: {} },
      ],
      meta: { total: 2, page: 1, pageSize: 20 },
    })
  }),

  // Settings endpoints
  http.get('/api/settings', async () => {
    await delay(50)
    return HttpResponse.json({
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm',
      language: 'en',
    })
  }),

  http.patch('/api/settings', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as UpdateSettingsRequest
    return HttpResponse.json(body)
  }),

  // Kiosk endpoints
  http.post('/api/kiosk/pair', async ({ request }) => {
    await delay(100)
    const _body = (await request.json()) as PairKioskRequest
    return HttpResponse.json({
      deviceToken: 'mock-device-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    })
  }),

  http.post('/api/kiosk/verify-pin', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as VerifyPinRequest
    if (body.pin === '1234') {
      return HttpResponse.json({ success: true, employeeId: '3' })
    }
    return HttpResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }),

  http.post('/api/kiosk/clock-in', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as KioskClockInRequest
    return HttpResponse.json({
      id: String(Date.now()),
      employeeId: body.employeeId,
      clockIn: new Date().toTimeString().slice(0, 5),
      status: 'PRESENT',
    })
  }),

  http.post('/api/kiosk/clock-out', async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as KioskClockOutRequest
    return HttpResponse.json({
      id: body.attendanceId,
      clockOut: new Date().toTimeString().slice(0, 5),
      status: 'PRESENT',
    })
  }),
]