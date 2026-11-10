import { expect, test } from '@playwright/test'

const session = { id: 'fixture-admin', role: 'SUPERADMIN', firstName: 'Ama', lastName: 'Boateng', mustChangePassword: false }
const setSession = (actor: typeof session) => {
  localStorage.setItem('token', 'isolated-browser-fixture')
  localStorage.setItem('user', JSON.stringify(actor))
}
const id = '11111111-1111-4111-8111-111111111111'
const archivedId = '55555555-5555-4555-8555-555555555555'
const stamp = '2026-11-05T10:00:00.000Z'

const makeRow = (rowId: string, name: string, isActive: boolean, startMinute = 360, endMinute = 840) => ({
  id: rowId, name, startMinute, endMinute, crossesMidnight: endMinute < startMinute, isActive,
  createdAt: stamp, updatedAt: stamp,
})

// The fixture mirrors the controller's own filtering and ordering: name
// contains (case insensitive), isActive equality, then name/id ordering with a
// bounded page — so a combined filter proves what the request actually asked
// for rather than what the route handler wanted to return.
const seed = [
  makeRow('55555555-5555-4555-8555-555555555555', 'Archived night shift', false, 1320, 360),
  makeRow('66666666-6666-4666-8666-666666666666', 'Alpha day cover', true),
  makeRow('77777777-7777-4777-8777-777777777777', 'Beta day cover', true),
  makeRow('88888888-8888-4888-8888-888888888888', 'Day porter', true),
  makeRow('99999999-9999-4999-8999-999999999999', 'Evening ledger', true),
  makeRow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Gatehouse cover', true),
  makeRow('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Grocery early', true),
  makeRow('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Inventory late', true),
  makeRow(id, 'Night coverage', true, 1320, 360),
  makeRow('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Night relief', true, 1380, 420),
  makeRow('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Receiving desk', true),
]

const filterRows = (records: typeof seed, search: string | null, isActive: string | null) => records
  .filter((row) => (search ? row.name.toLowerCase().includes(search.toLowerCase()) : true))
  .filter((row) => (isActive === null ? true : row.isActive === (isActive === 'true')))
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

for (const width of [375, 1440]) {
  test(`shift definitions at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(setSession, session)
    const reads: URL[] = []
    const writes: Array<{ url: string; method: string; body: Record<string, unknown> }> = []
    let records = seed.map(row => ({ ...row }))
    let failReads = false

    await page.route('**/*', async route => {
      const req = route.request()
      if (!['fetch', 'xhr'].includes(req.resourceType())) return route.continue()
      const url = new URL(req.url())
      if (url.pathname.endsWith('/business/shifts') && req.method() === 'GET') {
        reads.push(url)
        if (failReads) return route.fulfill({ status: 500, json: { success: false } })
        const pageNumber = Number(url.searchParams.get('page') || 1)
        const limit = Number(url.searchParams.get('limit') || 10)
        const search = url.searchParams.get('search')
        const isActive = url.searchParams.get('isActive')
        const matched = filterRows(records, search, isActive)
        const rows = matched.slice((pageNumber - 1) * limit, pageNumber * limit)
        return route.fulfill({ json: {
          success: true, data: rows,
          pagination: {
            currentPage: pageNumber,
            totalPages: Math.ceil(matched.length / limit),
            totalRecords: matched.length,
          },
        } })
      }
      if (url.pathname.includes('/business/shifts') && ['POST', 'PATCH'].includes(req.method())) {
        const body = req.postData() ? req.postDataJSON() as Record<string, unknown> : {}
        writes.push({ url: url.pathname, method: req.method(), body })
        const targetId = url.pathname.split('/')[4]
        const existing = records.find(row => row.id === targetId)
        const saved = existing
          ? { ...existing, ...body, ...(url.pathname.endsWith('/deactivate') ? { isActive: false } : {}) }
          : { ...makeRow('12345678-1234-4234-8234-123456789012', 'Weekend watch', true), ...body }
        records = existing ? records.map(row => row.id === existing.id ? saved : row) : [...records, saved]
        return route.fulfill({ json: { success: true, data: saved } })
      }
      return route.fulfill({ status: 404, json: { success: false } })
    })

    await page.goto('/shift-management')
    await expect(page.getByRole('heading', { name: 'Shift Definitions' })).toBeVisible()
    const nightRow = page.getByRole('row', { name: /Night coverage/ })
    await expect(nightRow).toBeVisible()
    await expect(nightRow.getByText('22:00')).toBeVisible()
    await expect(nightRow.getByText('06:00')).toBeVisible()
    await expect(page.getByText('Page 1 of 2')).toBeVisible()

    // Search narrows the list to matching names only.
    await page.getByRole('textbox', { name: 'Search shifts' }).fill('night')
    await expect.poll(() => reads.some(url => url.searchParams.get('search') === 'night')).toBe(true)
    await expect(page.getByText('Night relief')).toBeVisible()
    await expect(page.getByText('Archived night shift')).toBeVisible()
    await expect(page.getByText('Day porter')).toHaveCount(0)

    // The status filter combines with the search term — inactive rows only.
    await page.getByRole('combobox', { name: 'Status' }).selectOption('false')
    await expect.poll(() => reads.some(url => url.searchParams.get('search') === 'night'
      && url.searchParams.get('isActive') === 'false')).toBe(true)
    await expect(page.getByText('Archived night shift')).toBeVisible()
    await expect(page.getByText('Night coverage')).toHaveCount(0)

    // A term with no inactive match is an empty result, not a broken table.
    await page.getByRole('textbox', { name: 'Search shifts' }).fill('relief')
    await expect(page.getByText('No shifts match these filters.')).toBeVisible()

    await page.getByRole('textbox', { name: 'Search shifts' }).fill('')
    await page.getByRole('combobox', { name: 'Status' }).selectOption('')
    await expect(page.getByText('Night coverage')).toBeVisible()

    await page.getByRole('button', { name: 'Create Shift' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Weekend watch')
    await dialog.getByLabel('Start Time').fill('23:00')
    await dialog.getByLabel('End Time').fill('07:00')
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('select Overnight')
    expect(writes).toHaveLength(0)
    await dialog.getByRole('checkbox', { name: /Crosses midnight/ }).check()
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0]).toEqual({
      url: '/api/business/shifts', method: 'POST',
      body: { name: 'Weekend watch', startMinute: 1380, endMinute: 420, crossesMidnight: true },
    })
    await expect(dialog).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Search shifts' }).fill('Weekend watch')
    const createdRow = page.getByRole('row', { name: /Weekend watch/ })
    await expect(createdRow).toBeVisible()
    await expect(createdRow.getByText('23:00')).toBeVisible()
    await expect(createdRow.getByText('07:00')).toBeVisible()
    await expect(createdRow.getByText('Active', { exact: true })).toBeVisible()
    await expect(page.getByText('Weekend watch created.', { exact: true })).toHaveCount(0, { timeout: 8000 })
    await page.screenshot({ path: testInfo.outputPath(`shift-created-${width}.png`), fullPage: true })

    await page.getByRole('combobox', { name: 'Status' }).selectOption('false')
    await page.getByRole('textbox', { name: 'Search shifts' }).fill('archived')
    await expect(page.getByRole('button', { name: 'Activate Archived night shift' })).toBeVisible()
    await page.getByRole('button', { name: 'Activate Archived night shift' }).click()
    await expect.poll(() => writes.length).toBe(2)
    expect(writes[1]).toEqual({ url: `/api/business/shifts/${archivedId}`, method: 'PATCH', body: { isActive: true } })
    await expect(page.getByText('No shifts match these filters.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Activate Archived night shift' })).toHaveCount(0)

    await page.getByRole('combobox', { name: 'Status' }).selectOption('true')
    await expect(page.getByRole('button', { name: 'Deactivate Archived night shift' })).toBeVisible()
    await expect(page.getByRole('row', { name: /Archived night shift/ }).getByText('Active', { exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: 'Search shifts' }).fill('')
    await expect(page.getByRole('button', { name: 'Deactivate Night coverage' })).toBeVisible()
    await page.getByRole('button', { name: 'Deactivate Night coverage' }).click()
    await expect(page.getByRole('dialog').getByText(/Historical attendance records will be preserved/)).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate', exact: true }).click()
    await expect.poll(() => writes.length).toBe(3)
    expect(writes[2]).toEqual({ url: `/api/business/shifts/${id}/deactivate`, method: 'POST', body: {} })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('Night coverage', { exact: true })).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Status' }).selectOption('false')
    const deactivatedRow = page.getByRole('row', { name: /Night coverage/ })
    await expect(deactivatedRow).toBeVisible()
    await expect(deactivatedRow.getByText('Inactive', { exact: true })).toBeVisible()
    await expect(deactivatedRow.getByRole('button', { name: 'Activate Night coverage' })).toBeVisible()
    await expect(page.getByText('Archived night shift', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Night coverage deactivated.', { exact: true })).toHaveCount(0, { timeout: 8000 })
    await expect(page.getByText('Archived night shift activated.', { exact: true })).toHaveCount(0, { timeout: 8000 })

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`shift-definitions-${width}.png`), fullPage: true })

    failReads = true
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('Could not load shifts')
    failReads = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText('Night coverage')).toBeVisible()
  })
}
