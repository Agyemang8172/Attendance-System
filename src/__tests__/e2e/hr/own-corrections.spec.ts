import { expect, test } from '@playwright/test'

const id = '11111111-1111-4111-8111-111111111111'
const attendanceId = '22222222-2222-4222-8222-222222222222'
const base = '/hr-corrections/mine'
const endpoint = '/attendance/corrections'
const row = {
  id, attendanceId, status: 'APPROVED', reviewTier: 'SAME_DAY',
  reason: 'The recorded punch was late.', requestedAt: '2026-11-04T10:00:00Z', createdAt: '2026-11-04T10:00:00Z',
  proposedClockIn: '2026-11-03T07:55:00Z', proposedClockOut: null,
  decidedAt: '2026-11-04T11:00:00Z', decisionNote: 'Confirmed.',
}
const detail = {
  ...row, attendance: { id: attendanceId, date: '2026-11-03T00:00:00Z' },
  originalValues: { clockIn: '2026-11-03T08:00:00Z' },
  approvedValues: { clockIn: '2026-11-03T07:56:00Z' },
}
const session = (role: string) => ({ id: 'fixture-requester', role, firstName: 'Esi', lastName: 'Owusu', mustChangePassword: false })
const setSession = (actor: ReturnType<typeof session>) => {
  localStorage.setItem('token', 'isolated-browser-fixture')
  localStorage.setItem('user', JSON.stringify(actor))
}

for (const width of [375, 1440]) {
  test(`HR own correction tracking at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(setSession, session('HR'))
    let writes = 0
    let listReads = 0
    let detailReads = 0
    const query = '?status=APPROVED&page=2'
    await page.route('**/*', async route => {
      const req = route.request()
      if (!['fetch', 'xhr'].includes(req.resourceType())) return route.continue()
      if (req.method() !== 'GET') {
        writes++
        return route.fulfill({ status: 405, json: { success: false } })
      }
      const url = new URL(req.url())
      if (url.pathname.endsWith(endpoint + '/' + id)) {
        detailReads++
        return route.fulfill({ json: { success: true, data: detail } })
      }
      if (url.pathname.endsWith(endpoint)) {
        listReads++
        expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'APPROVED', page: '2', limit: '12' })
        return route.fulfill({ json: { success: true, data: [row], pagination: { currentPage: 2, totalPages: 2, total: 13 } } })
      }
      return route.fulfill({ json: { success: true, data: [], pagination: { currentPage: 1, totalPages: 0, total: 0 } } })
    })

    await page.goto('/hr-corrections')
    const nav = page.getByRole('link', { name: /my corrections/i })
    await expect(nav).toHaveAttribute('href', base)
    await page.goto(base + query)
    await expect(page.getByRole('heading', { name: /my corrections/i })).toBeVisible()
    await expect(page.getByText(/Page 2 of 2/i)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`mine-list-${width}.png`), fullPage: true })

    const link = page.locator(`a[href*="${base}/${id}"]`)
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Confirmed.')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Confirmed.')).toBeVisible()
    expect(detailReads).toBe(2)
    expect(listReads).toBe(1)
    await expect(page.getByRole('button', { name: /submit|approve|reject|decline|withdraw|edit/i })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`mine-detail-${width}.png`), fullPage: true })
    await page.getByRole('link', { name: /back to my corrections/i }).click()
    await expect(page).toHaveURL(base + query)
    await expect(page.getByRole('combobox', { name: /status/i })).toHaveValue('APPROVED')
    await expect.poll(() => listReads).toBe(2)
    expect(writes).toBe(0)
  })
}

test('Superadmin cannot open the HR own tracking route', async ({ page }) => {
  await page.addInitScript(setSession, session('SUPERADMIN'))
  let ownRequests = 0
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue()
    if (new URL(route.request().url()).pathname.includes(endpoint)) ownRequests++
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto(base + '/' + id)
  await expect(page).not.toHaveURL(base + '/' + id)
  await expect(page.getByRole('heading', { name: /my corrections|correction details/i })).toHaveCount(0)
  expect(ownRequests).toBe(0)
})

test('a forced password change blocks the own tracking route before any read', async ({ page }) => {
  await page.addInitScript(setSession, { ...session('HR'), mustChangePassword: true })
  let ownRequests = 0
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue()
    if (new URL(route.request().url()).pathname.includes(endpoint)) ownRequests++
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto(base)
  await expect(page).toHaveURL(/\/set-password/)
  await expect(page.getByRole('heading', { name: /my corrections/i })).toHaveCount(0)
  expect(ownRequests).toBe(0)
})
