import { expect, test } from '@playwright/test'
const attendanceId = '11111111-1111-4111-8111-111111111111'
const attemptId = '22222222-2222-4222-8222-222222222222'
const employee = { id: 'staff-fixture', firstName: 'Ama', lastName: 'Mensah', employeeCode: 'EMP-042' }
const attendance = { kind: 'ATTENDANCE', id: attendanceId, date: '2026-11-03T00:00:00.000Z', employee, status: 'CLOCK_OUT_MISSING', sessionStatus: 'OPEN', reason: 'Open session needs review.' }
const attempt = { kind: 'ATTEMPT', id: attemptId, date: '2026-11-03T08:00:00.000Z', employee: null, action: 'CLOCK_IN', outcome: 'REJECTED', step: 'LOCATION', kiosk: 'Front terminal', site: 'Reception', locationResult: 'UNKNOWN', reason: 'Location could not be assessed.' }
const context = 'startDate=2026-11-01&endDate=2026-11-04&page=2'
const record = { id: attendanceId, userId: employee.id, user: employee, date: attendance.date, clockIn: '2026-11-03T08:00:00.000Z', clockOut: null, hoursWorked: null, status: attendance.status, sessionStatus: 'OPEN', closureReason: null, requiresReviewReason: 'Recorded review reason.', shiftNameSnapshot: null, timezoneSnapshot: null, policySnapshot: null, createdByKiosk: null, checkInLat: null, checkInLng: null }
test.use({ timezoneId: 'America/New_York' })
for (const [width, role] of [[375, 'HR'], [1440, 'SUPERADMIN']] as const) {
  test(`${role} Exceptions mixed rows and attendance return at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(user => { localStorage.setItem('token', 'isolated-browser-fixture'); localStorage.setItem('user', JSON.stringify(user)) }, { id: 'operator-fixture', role, firstName: 'Esi', lastName: 'Owusu', mustChangePassword: false })
    let writes = 0, listReads = 0
    await page.route('**/*', async route => {
      const request = route.request()
      if (!['fetch', 'xhr'].includes(request.resourceType())) { await route.continue(); return }
      if (request.method() !== 'GET') { writes++; await route.fulfill({ status: 405, json: { success: false } }); return }
      const url = new URL(request.url())
      if (url.pathname.endsWith('/reports/exceptions')) {
        listReads++
        expect(url.searchParams.has('search')).toBe(false); expect(url.searchParams.has('type')).toBe(false)
        expect(url.searchParams.get('startDate')).toBe('2026-11-01'); expect(url.searchParams.get('endDate')).toBe('2026-11-04')
        const currentPage = Number(url.searchParams.get('page'))
        const rows = currentPage === 2 ? [attendance, attempt] : Array.from({ length: 12 }, (_, index) => ({ ...attendance, id: `first-page-attendance-${index}`, employee: { ...employee, firstName: 'Kojo', lastName: `Owusu ${index + 1}` } }))
        await route.fulfill({ json: { success: true, data: rows, pagination: { currentPage, totalPages: 2, total: 14 } } })
      } else if (url.pathname.endsWith(`/attendance/${attendanceId}`)) await route.fulfill({ json: { success: true, data: record } })
      else await route.fulfill({ json: { success: true, data: [] } })
    })
    await page.goto(`/hr-exceptions?${context}`)
    await expect(page.getByText('14 exception rows', { exact: true })).toBeVisible()
    await expect(page.getByText(/Page 2 of 2/)).toBeVisible()
    await expect(page.getByText('Front terminal', { exact: true })).toBeVisible()
    await expect(page.getByText('UNKNOWN', { exact: true })).toBeVisible()
    await expect(page.getByText(/unidentified employee/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /dismiss/i })).toHaveCount(0)
    await expect(page.locator(`a[href*="${attemptId}"]`)).toHaveCount(0)
    await expect(page.getByPlaceholder(/search/i)).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`exceptions-list-${width}.png`), fullPage: true })
    const beforeDraft = listReads
    await page.getByLabel(/^From/).fill('2026-11-02')
    expect(listReads).toBe(beforeDraft)
    await page.getByLabel(/^From/).fill('2026-11-01')
    await page.getByRole('link', { name: /View attendance/i }).focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Attendance detail', exact: true })).toBeVisible()
    await expect(page.getByText('Recorded review reason.', { exact: true })).toBeVisible()
    const direct = page.url(); expect(direct).toContain('origin=exceptions')
    await page.goto(direct); await expect(page.getByText('Recorded review reason.', { exact: true })).toBeVisible()
    await page.reload(); await expect(page.getByText('Recorded review reason.', { exact: true })).toBeVisible()
    expect(listReads).toBe(beforeDraft)
    await page.screenshot({ path: testInfo.outputPath(`exceptions-attendance-detail-${width}.png`), fullPage: true })
    await page.getByRole('link', { name: /Back to Exceptions/i }).click()
    await expect(page.getByText(/Page 2 of 2/)).toBeVisible(); await expect(page.getByLabel(/^From/)).toHaveValue('2026-11-01'); await expect(page.getByLabel(/^To/)).toHaveValue('2026-11-04')
    await page.getByRole('button', { name: /previous page/i }).click()
    await expect(page.getByText(/Page 1 of 2/)).toBeVisible()
    await page.getByRole('button', { name: /next page/i }).click(); await expect(page.getByText('Front terminal', { exact: true })).toBeVisible()
    expect(writes).toBe(0)
  })
}

test('Exceptions initial range and inline error retry with partial evidence', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.addInitScript(() => { localStorage.setItem('token', 'isolated-browser-fixture'); localStorage.setItem('user', JSON.stringify({ id: 'operator-fixture', role: 'HR', firstName: 'Esi', lastName: 'Owusu', mustChangePassword: false })) })
  let reads = 0
  await page.route('**/*', async route => {
    const request = route.request()
    if (!['fetch', 'xhr'].includes(request.resourceType())) { await route.continue(); return }
    expect(request.method()).toBe('GET')
    if (!new URL(request.url()).pathname.endsWith('/reports/exceptions')) { await route.fulfill({ json: { success: true, data: [] } }); return }
    reads++
    await route.fulfill(reads === 1 ? { status: 500, json: { success: false } } : { json: { success: true, data: [{ ...attempt, kiosk: null, site: null }], pagination: { currentPage: 1, totalPages: 1, total: 1 } } })
  })
  await page.goto('/hr-exceptions'); await expect(page.getByText(/Choose a date range/i)).toBeVisible(); expect(reads).toBe(0)
  await page.getByLabel(/^From/).fill('2026-11-01'); await page.getByLabel(/^To/).fill('2026-11-04'); await page.getByRole('button', { name: /apply/i }).click()
  await expect(page.getByRole('alert')).toBeVisible(); await page.getByRole('button', { name: /try again/i }).click()
  await expect(page.getByText('UNKNOWN', { exact: true })).toBeVisible()
  await expect(page.getByText(/unidentified employee/i)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('exceptions-partial-375.png'), fullPage: true })
})
