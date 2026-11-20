import { expect, test } from '@playwright/test'

const session = { id: 'fixture-reader', role: 'HR', firstName: 'Ama', lastName: 'Boateng', mustChangePassword: false }
const setSession = (actor: typeof session) => {
  localStorage.setItem('token', 'isolated-browser-fixture')
  localStorage.setItem('user', JSON.stringify(actor))
}

const pad = (value: number) => String(value).padStart(2, '0')
const deviceDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const today = new Date()
const start = new Date(today)
start.setDate(today.getDate() - 6)
const range = { startDate: deviceDate(start), endDate: deviceDate(today) }

const attendanceId = '11111111-1111-4111-8111-111111111111'
const registerId = '22222222-2222-4222-8222-222222222222'

const employee = (firstName: string, lastName: string) => ({
  id: firstName.toLowerCase(),
  employeeCode: 'EMP-1',
  firstName,
  lastName,
})

const punctuality = {
  success: true,
  data: {
    groupBy: 'day',
    startDate: range.startDate,
    endDate: range.endDate,
    rows: [
      {
        group: range.endDate,
        early: 4,
        onTime: 0,
        late: 1,
        openSession: 3,
        autoClosed: 0,
        missing: 0,
        absent: 2,
        requiresReview: 0,
        total: 10,
      },
      {
        group: range.startDate,
        early: 2,
        onTime: 1,
        late: 0,
        openSession: 0,
        autoClosed: 0,
        missing: 0,
        absent: 1,
        requiresReview: 0,
        total: 4,
      },
    ],
  },
}

const exceptions = {
  success: true,
  data: [
    {
      kind: 'ATTENDANCE',
      id: attendanceId,
      date: `${range.endDate}T00:00:00.000Z`,
      employee: employee('Ama', 'Boateng'),
      status: 'REQUIRES_REVIEW',
      sessionStatus: 'CLOSED',
      reason: 'The record needs a human decision.',
    },
    {
      kind: 'ATTEMPT',
      id: 'attempt-1',
      date: `${range.endDate}T08:15:00.000Z`,
      employee: employee('Kojo', 'Mensah'),
      action: 'CLOCK_IN',
      outcome: 'DENIED',
      step: 'LOCATION',
      locationResult: 'OUTSIDE',
      reason: 'Location assessment is outside the site.',
    },
  ],
  pagination: { currentPage: 1, totalPages: 2, total: 7 },
}

const register = {
  success: true,
  data: [
    {
      id: registerId,
      date: `${range.endDate}T00:00:00.000Z`,
      clockIn: `${range.endDate}T08:00:00.000Z`,
      clockOut: `${range.endDate}T17:00:00.000Z`,
      hoursWorked: 9,
      status: 'ON_TIME',
      sessionStatus: 'CLOSED',
      employee: employee('Yaw', 'Osei'),
    },
  ],
  pagination: { currentPage: 1, totalPages: 2, total: 120 },
}

for (const width of [375, 1440]) {
  test(`HR dashboard triage at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(setSession, session)

    let failReports = false
    let writes = 0
    let reportReads = 0

    await page.route('**/*', async route => {
      const req = route.request()
      if (!['fetch', 'xhr'].includes(req.resourceType())) return route.continue()
      if (req.method() !== 'GET') {
        writes++
        return route.fulfill({ status: 405, json: { success: false } })
      }

      const url = new URL(req.url())
      if (url.pathname.endsWith('/reports/punctuality-summary')) {
        reportReads++
        if (failReports) return route.fulfill({ status: 500, json: { success: false } })
        return route.fulfill({ json: punctuality })
      }
      if (url.pathname.endsWith('/reports/exceptions')) {
        reportReads++
        if (failReports) return route.fulfill({ status: 500, json: { success: false } })
        return route.fulfill({ json: exceptions })
      }
      if (url.pathname.endsWith('/reports/attendance-register')) {
        reportReads++
        if (failReports) return route.fulfill({ status: 500, json: { success: false } })
        return route.fulfill({ json: register })
      }
      if (url.pathname.endsWith('/hr/help-requests')) {
        const total = url.searchParams.get('status') === 'OPEN' ? 3 : 2
        return route.fulfill({
          json: { success: true, data: [], pagination: { currentPage: 1, totalPages: 1, total } },
        })
      }
      if (url.pathname.endsWith('/hr/corrections')) {
        return route.fulfill({
          json: { success: true, data: [], pagination: { currentPage: 1, totalPages: 1, total: 4 } },
        })
      }
      return route.fulfill({ json: { success: true, data: [], pagination: { currentPage: 1, totalPages: 0, total: 0 } } })
    })

    await page.goto('/hr-dashboard')
    await expect(page.getByRole('heading', { name: /welcome, ama/i })).toBeVisible()
    await expect(page.getByText(/Business-timezone handling is pending P17/)).toBeVisible()

    await expect(page.getByText('Recorded today')).toBeVisible()
    await expect(page.getByText('active staff rows, not a live headcount')).toBeVisible()
    await expect(page.getByText(/Open sessions:\s*3/)).toBeVisible()
    await expect(page.getByText('Late today')).toBeVisible()
    await expect(page.getByText('Absent today')).toBeVisible()

    await expect(page.getByRole('link', { name: /Help requests · Open/ })).toHaveAttribute(
      'href', '/hr-help-requests?status=OPEN'
    )
    await expect(page.getByRole('link', { name: /Corrections · Awaiting decision/ })).toHaveAttribute(
      'href', '/hr-corrections?status=SUBMITTED'
    )
    await expect(page.getByRole('link', { name: /Review exceptions · Last 7 days/ })).toHaveAttribute(
      'href', `/hr-exceptions?startDate=${range.startDate}&endDate=${range.endDate}`
    )

    const exceptionPreview = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Recent exceptions' }) })
    const visibleRow = width === 375 ? 0 : 1
    await expect(exceptionPreview.getByText('Ama Boateng').nth(visibleRow)).toBeVisible()
    await expect(exceptionPreview.getByText('Requires review').nth(visibleRow)).toBeVisible()
    await expect(exceptionPreview.getByText('Kojo Mensah').nth(visibleRow)).toBeVisible()
    await expect(exceptionPreview.getByText('Location outside').nth(visibleRow)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open queue' })).toHaveAttribute(
      'href', `/hr-exceptions?startDate=${range.startDate}&endDate=${range.endDate}`
    )

    await expect(page.getByText('Recent attendance')).toBeVisible()
    const attendancePreview = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Recent attendance' }) })
    await expect(attendancePreview.getByText('Yaw Osei').nth(visibleRow)).toBeVisible()
    await expect(page.getByRole('link', { name: /View register/ })).toHaveAttribute(
      'href', `/hr-attendance?startDate=${range.startDate}&endDate=${range.endDate}`
    )
    await expect(page.getByRole('heading', { name: /^All Attendance$/i })).toHaveCount(0)
    await expect(page.getByPlaceholder(/search/i)).toHaveCount(0)

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true })

    failReports = true
    await page.reload()
    await expect(page.getByRole('alert')).toContainText(
      'Could not load dashboard data. Check the connection and try again.'
    )
    await expect(page.getByText('Recorded today')).toHaveCount(0)

    failReports = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText('Recorded today')).toBeVisible()

    expect(reportReads).toBeGreaterThanOrEqual(3)
    expect(writes).toBe(0)
  })
}
