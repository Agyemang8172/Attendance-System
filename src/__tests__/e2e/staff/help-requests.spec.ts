import { expect, test } from '@playwright/test'

const id = '11111111-1111-4111-8111-111111111111'
const account = { id: 'staff-fixture', email: 'staff@example.test', firstName: 'Ama', lastName: 'Mensah', role: 'STAFF', mustChangePassword: false }
const requestRecord = {
  id, requesterId: account.id, businessId: 'fixture-business', assignedToId: 'internal-assignee',
  category: 'kiosk', subject: 'Terminal scanner assistance', body: 'The terminal camera needs attention.',
  status: 'RESOLVED', resolutionNote: 'Scanner settings checked.', resolvedAt: '2026-11-03T09:20:00.000Z',
  createdAt: '2026-11-03T08:15:00.000Z', updatedAt: '2026-11-03T09:20:00.000Z',
}
const query = new URLSearchParams({ status: 'RESOLVED', page: '2' })

// These isolated browser fixtures are not real credentials or database rows.
// Existing frontend is reused; every fetch/XHR is intercepted, including writes.
for (const width of [375, 1440]) {
  test(`Staff Help list and detail at ${width}px with intercepted API`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(user => {
      localStorage.setItem('token', 'isolated-browser-fixture')
      localStorage.setItem('user', JSON.stringify(user))
    }, account)
    let writes = 0
    let detailReads = 0
    await page.route('**/*', async route => {
      const outgoing = route.request()
      if (!['fetch', 'xhr'].includes(outgoing.resourceType())) { await route.continue(); return }
      if (outgoing.method() !== 'GET') { writes += 1; await route.fulfill({ status: 405, json: { success: false } }); return }
      const url = new URL(outgoing.url())
      if (url.pathname.endsWith(`/staff/help-requests/${id}`)) {
        detailReads += 1
        await route.fulfill({ json: { success: true, data: requestRecord } })
      } else if (url.pathname.endsWith('/staff/help-requests')) {
        expect(url.searchParams.has('search')).toBe(false)
        await route.fulfill({ json: { success: true, data: [requestRecord], pagination: { currentPage: Number(url.searchParams.get('page')) || 1, totalPages: 3, total: 25 } } })
      } else { await route.fulfill({ json: { success: true, data: [] } }) }
    })
    await page.goto(`/staff/help-requests?${query}`)
    await expect(page.getByText(/25 requests/i)).toBeVisible()
    await expect(page.getByLabel(/Filter by status/i)).toHaveValue('RESOLVED')
    await expect(page.getByRole('textbox', { name: /Search requests/i })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`staff-help-list-${width}.png`), fullPage: true })
    await page.getByRole('link', { name: `View help request: ${requestRecord.subject}` }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: requestRecord.subject, exact: true })).toBeVisible()
    await expect(page.getByText(requestRecord.resolutionNote, { exact: true })).toBeVisible()
    await expect(page.getByText(/Resolution Timeline|Resolved By/i)).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`staff-help-detail-${width}.png`), fullPage: true })
    const detailUrl = page.url()
    await page.goto(detailUrl)
    await expect(page.getByText(requestRecord.body, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(requestRecord.body, { exact: true })).toBeVisible()
    expect(detailReads).toBeGreaterThanOrEqual(3)
    await page.getByRole('link', { name: /Back to Help Requests/i }).click()
    await expect(page.getByLabel(/Filter by status/i)).toHaveValue('RESOLVED')
    await expect(page.getByText(/Page 2 of 3/i)).toBeVisible()
    await page.getByRole('link', { name: `View help request: ${requestRecord.subject}` }).click()
    await expect(page.getByText(requestRecord.body, { exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel(/Filter by status/i)).toHaveValue('RESOLVED')
    await expect(page.getByText(/Page 2 of 3/i)).toBeVisible()
    expect(writes).toBe(0)
  })
}

test('Staff Help narrow failure retry preserves unavailable resolution evidence', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.addInitScript(user => {
    localStorage.setItem('token', 'isolated-browser-fixture')
    localStorage.setItem('user', JSON.stringify(user))
  }, account)
  let reads = 0
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) { await route.continue(); return }
    expect(route.request().method()).toBe('GET')
    reads += 1
    await route.fulfill(reads === 1
      ? { status: 500, json: { success: false } }
      : { json: { success: true, data: { ...requestRecord, status: 'CLOSED', resolutionNote: null, resolvedAt: null } } })
  })
  await page.goto(`/staff/help-requests/${id}`)
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: /Try again/i }).click()
  await expect(page.getByText(requestRecord.body, { exact: true })).toBeVisible()
  await expect(page.getByText(/Resolution Timeline|Resolved By|Updates will appear/i)).toHaveCount(0)
  await expect(page.getByText(requestRecord.resolutionNote, { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('staff-help-partial-375.png'), fullPage: true })
})
