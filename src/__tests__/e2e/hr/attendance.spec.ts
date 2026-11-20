import { expect, test } from '@playwright/test'

const id = '11111111-1111-4111-8111-111111111111'
const employee = { id: 'staff-fixture', firstName: 'Ama', lastName: 'Mensah', employeeCode: 'EMP-042', department: 'Operations' }
const record = {
  id, userId: employee.id, user: employee, date: '2026-11-02T00:00:00.000Z',
  clockIn: '2026-11-02T10:00:00.000Z', clockOut: '2026-11-02T18:00:00.000Z', hoursWorked: 8,
  status: 'ON_TIME', sessionStatus: 'CLOSED', closureReason: 'VERIFIED_CLOCK_OUT', requiresReviewReason: null,
  remarks: 'Recorded workplace session.', shiftNameSnapshot: 'Recorded day shift', shiftStartMinuteSnapshot: 600,
  shiftEndMinuteSnapshot: 1080, shiftCrossesMidnightSnapshot: false, timezoneSnapshot: 'Africa/Accra',
  graceEarlyMinutesSnapshot: 10, graceLateMinutesSnapshot: 5, policyVersionId: 'internal-policy-id',
  policySnapshot: { versionNumber: 3, correctionWindowDays: 2, autoClockOutEnabled: true },
  checkInLat: 5.6037, checkInLng: -0.187, createdByKiosk: { id: 'internal-terminal-id', label: 'Reception terminal', publicId: 'public-terminal-id' },
}
const context = new URLSearchParams({ status: 'ON_TIME', sessionStatus: 'CLOSED', startDate: '2026-11-01', endDate: '2026-11-02', page: '2' })
// Non-UTC browser deliberately verifies deterministic UTC query conversion.
test.use({ timezoneId: 'America/New_York' })

for (const [width, role] of [[375, 'HR'], [1440, 'SUPERADMIN']] as const) {
  test(`${role} Attendance register and direct detail at ${width}px with intercepted API`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(user => {
      localStorage.setItem('token', 'isolated-browser-fixture')
      localStorage.setItem('user', JSON.stringify(user))
    }, { id: 'operator-fixture', email: 'operator@example.test', firstName: 'Esi', lastName: 'Owusu', role, mustChangePassword: false })
    let writes = 0
    let detailReads = 0
    let listReads = 0
    await page.route('**/*', async route => {
      const outgoing = route.request()
      if (!['fetch', 'xhr'].includes(outgoing.resourceType())) { await route.continue(); return }
      if (outgoing.method() !== 'GET') { writes += 1; await route.fulfill({ status: 405, json: { success: false } }); return }
      const url = new URL(outgoing.url())
      if (url.pathname.endsWith(`/attendance/${id}`)) {
        detailReads += 1
        await route.fulfill({ json: { success: true, data: record } })
      } else if (url.pathname.endsWith('/attendance/all-attendance')) {
        listReads += 1
        expect(url.searchParams.has('search')).toBe(false)
        expect(url.searchParams.get('startDate')).toBe('2026-11-01T00:00:00.000Z')
        expect(url.searchParams.get('endDate')).toBe('2026-11-02T23:59:59.999Z')
        // The one row is the final record on page two of thirteen total records.
        await route.fulfill({ json: { success: true, count: 1, total: 13, page: 2, data: [record] } })
      } else { await route.fulfill({ json: { success: true, data: [] } }) }
    })
    const listRoute = role === 'SUPERADMIN' ? '/admin-attendance' : '/hr-attendance'
    await page.goto(`${listRoute}?${context}`)
    await expect(page.getByText('13 records', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Classification')).toHaveValue('ON_TIME')
    await expect(page.getByLabel('Session state')).toHaveValue('CLOSED')
    await expect(page.getByText(/Page 2 of 2/i)).toBeVisible()
    await expect(page.getByPlaceholder(/search/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /next page/i })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`hr-attendance-list-${width}.png`), fullPage: true })
    await page.getByRole('link', { name: /View attendance for Ama Mensah/i }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Attendance detail', exact: true })).toBeVisible()
    await expect(page.getByText(record.remarks, { exact: true })).toBeVisible()
    await expect(page.getByText(record.shiftNameSnapshot, { exact: true })).toBeVisible()
    await expect(page.getByText('Reception terminal', { exact: true })).toBeVisible()
    await expect(page.getByText(/internal-policy-id|internal-terminal-id|public-terminal-id|Inside|Outside/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /dismiss|clock in|clock out/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /View correction trail/i })).toHaveAttribute('href', '/hr-audit/corrections/' + id)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`hr-attendance-detail-${width}.png`), fullPage: true })
    const directUrl = page.url()
    const previousListReads = listReads
    await page.goto(directUrl)
    await expect(page.getByText(record.remarks, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(record.remarks, { exact: true })).toBeVisible()
    expect(detailReads).toBeGreaterThanOrEqual(3)
    expect(listReads).toBe(previousListReads)
    await page.getByRole('link', { name: /Back to Attendance/i }).click()
    await expect(page.getByLabel('Classification')).toHaveValue('ON_TIME')
    await expect(page.getByLabel('Session state')).toHaveValue('CLOSED')
    await expect(page.getByText(/Page 2 of 2/i)).toBeVisible()
    await expect(page.getByLabel(/From.*UTC/i)).toHaveValue('2026-11-01')
    await expect(page.getByLabel(/To.*UTC/i)).toHaveValue('2026-11-02')
    await page.getByRole('link', { name: /View attendance for Ama Mensah/i }).click()
    await expect(page.getByText(record.remarks, { exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel('Classification')).toHaveValue('ON_TIME')
    await expect(page.getByText(/Page 2 of 2/i)).toBeVisible()
    expect(writes).toBe(0)
  })
}

test('HR narrow detail error retry retains unavailable historical evidence', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.addInitScript(() => {
    localStorage.setItem('token', 'isolated-browser-fixture')
    localStorage.setItem('user', JSON.stringify({ id: 'operator-fixture', role: 'HR', firstName: 'Esi', lastName: 'Owusu', email: 'hr@example.test', mustChangePassword: false }))
  })
  let reads = 0
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) { await route.continue(); return }
    expect(route.request().method()).toBe('GET')
    const url = new URL(route.request().url())
    if (!url.pathname.endsWith(`/attendance/${id}`)) { await route.fulfill({ json: { success: true, data: [] } }); return }
    reads += 1
    await route.fulfill(reads === 1 ? { status: 500, json: { success: false } } : { json: { success: true, data: {
      ...record, remarks: 'Partial historical record.', timezoneSnapshot: null, shiftNameSnapshot: null, shiftStartMinuteSnapshot: null,
      shiftEndMinuteSnapshot: null, shiftCrossesMidnightSnapshot: null, policySnapshot: null, checkInLat: null, checkInLng: null, createdByKiosk: null,
    } } })
  })
  await page.goto(`/hr-attendance/${id}`)
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: /Try again/i }).click()
  await expect(page.getByText('Partial historical record.', { exact: true })).toBeVisible()
  await expect(page.getByText(/not recorded|unavailable/i).first()).toBeVisible()
  await expect(page.getByText('Reception terminal', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('hr-attendance-partial-375.png'), fullPage: true })
})
