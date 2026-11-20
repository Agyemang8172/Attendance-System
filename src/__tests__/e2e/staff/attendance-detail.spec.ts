import { expect, test } from '@playwright/test'

const id = '11111111-1111-4111-8111-111111111111'
const account = { id: 'staff-fixture', email: 'staff@example.test', firstName: 'Ama', lastName: 'Mensah', role: 'STAFF', mustChangePassword: false }
const record = {
  id, userId: account.id, date: '2026-11-01T00:00:00.000Z',
  clockIn: '2026-11-01T07:00:00.000Z', clockOut: '2026-11-01T15:00:00.000Z',
  status: 'ON_TIME', sessionStatus: 'CLOSED', hoursWorked: 8, closureReason: null,
  remarks: 'Recorded fixture evidence', requiresReviewReason: null,
  shiftNameSnapshot: 'Morning coverage', shiftStartMinuteSnapshot: 960,
  shiftEndMinuteSnapshot: 0, shiftCrossesMidnightSnapshot: true, timezoneSnapshot: 'Asia/Tokyo',
  graceEarlyMinutesSnapshot: 0, graceLateMinutesSnapshot: 5, policySnapshot: { versionNumber: 2 },
  checkInLat: 0, checkInLng: 0,
  user: { id: account.id, employeeCode: 'EMP-0021', firstName: 'Ama', lastName: 'Mensah' },
  createdByKiosk: { id: 'terminal-fixture', label: 'Reception terminal', publicId: 'KT-EXAMPLE' },
  createdAt: '2026-11-01T07:00:00.000Z', updatedAt: '2026-11-01T15:00:00.000Z',
}
const filters = new URLSearchParams({ startDate: '2026-11-01', endDate: '2026-11-03', status: 'ON_TIME', sessionStatus: 'CLOSED', search: 'coverage', page: '2' })

// Runtime verification only: the local session and every API response below are
// fabricated browser fixtures. This never creates credentials or database rows.
for (const width of [375, 1440]) {
  test(`Attendance detail and return context at ${width}px with intercepted API`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(user => {
      localStorage.setItem('token', 'isolated-browser-fixture')
      localStorage.setItem('user', JSON.stringify(user))
    }, account)
    let writes = 0
    let detailReads = 0
    await page.route('**/*', async route => {
      const request = route.request()
      if (!['fetch', 'xhr'].includes(request.resourceType())) {
        await route.continue()
        return
      }
      if (request.method() !== 'GET') {
        writes += 1
        await route.fulfill({ status: 405, json: { success: false } })
        return
      }
      const path = new URL(request.url()).pathname
      if (path.endsWith('/attendance/my-attendance')) {
        await route.fulfill({ json: { success: true, data: [record], total: 40, page: 2, count: 1 } })
      } else if (path.endsWith(`/attendance/${id}`)) {
        detailReads += 1
        await route.fulfill({ json: { success: true, data: record } })
      } else {
        await route.fulfill({ status: 404, json: { success: false } })
      }
    })

    await page.goto(`/staff/attendance?${filters}`)
    await expect(page.getByLabel('Search attendance', { exact: true })).toHaveValue('coverage')
    const row = page.getByRole('row', { name: /View details for/i })
    await row.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: /Attendance detail/i })).toBeVisible()
    const detailUrl = page.url()
    await expect(page.getByText('Morning coverage', { exact: true })).toBeVisible()
    await expect(page.getByText('Reception terminal', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`attendance-detail-${width}.png`), fullPage: true })

    await page.goto(detailUrl)
    await expect(page.getByText('Recorded fixture evidence', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Morning coverage', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: /Back to Attendance/i }).click()
    await expect(page.getByLabel('Search attendance', { exact: true })).toHaveValue('coverage')
    await expect(page.getByRole('combobox', { name: 'Attendance status' })).toHaveValue('ON_TIME')
    await expect(page.getByRole('combobox', { name: 'Session status' })).toHaveValue('CLOSED')
    await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2026-11-01')
    const restored = new URL(page.url())
    for (const [key, value] of filters) expect(restored.searchParams.get(key)).toBe(value)

    await page.getByRole('row', { name: /View details for/i }).click()
    await expect(page.getByRole('heading', { name: /Attendance detail/i })).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel('Search attendance', { exact: true })).toHaveValue('coverage')
    expect(new URL(page.url()).searchParams.get('page')).toBe('2')
    expect(detailReads).toBeGreaterThanOrEqual(4)
    expect(writes).toBe(0)
  })
}

test('partial evidence and retry remain usable on narrow Staff detail', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.addInitScript(user => {
    localStorage.setItem('token', 'isolated-browser-fixture')
    localStorage.setItem('user', JSON.stringify(user))
  }, account)
  let reads = 0
  const partial = { ...record, timezoneSnapshot: null, shiftNameSnapshot: null,
    shiftStartMinuteSnapshot: null, shiftEndMinuteSnapshot: null, shiftCrossesMidnightSnapshot: null,
    policySnapshot: null, checkInLat: null, checkInLng: null, createdByKiosk: null }
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) { await route.continue(); return }
    if (route.request().method() !== 'GET') { await route.fulfill({ status: 405 }); return }
    reads += 1
    await route.fulfill(reads === 1
      ? { status: 500, json: { success: false } }
      : { json: { success: true, data: partial } })
  })
  await page.goto(`/staff/attendance/${id}`)
  await expect(page.getByRole('alert')).toContainText('Unable to load this attendance record')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText(record.clockIn, { exact: true })).toBeVisible()
  await expect(page.getByText(/Recorded timezone unavailable/)).toBeVisible()
  await expect(page.getByText('Morning coverage', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Reception terminal', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/^Inside$|^Outside$/i)).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('attendance-detail-partial-375.png'), fullPage: true })
})
