import { expect, test } from '@playwright/test'

const id = '11111111-1111-4111-8111-111111111111'
const queue = '/hr-help-requests?status=IN_REVIEW&page=2'
const row = {
  id, category: 'kiosk', subject: 'Scanner assistance', body: 'The camera could not read the badge.',
  status: 'IN_REVIEW', resolutionNote: null as string | null, resolvedAt: null as string | null,
  createdAt: '2026-11-04T10:00:00.000Z', updatedAt: '2026-11-04T10:00:00.000Z',
  requester: { id: 'test-requester', firstName: 'Ama', lastName: 'Mensah', email: 'ama@example.test' },
}

for (const [width, role] of [[375, 'HR'], [1440, 'SUPERADMIN']] as const) {
  test(`${role} Help queue, direct detail, and resolution at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(actor => {
      localStorage.setItem('token', 'isolated-browser-fixture')
      localStorage.setItem('user', JSON.stringify(actor))
    }, { id: 'test-reviewer', role, firstName: 'Esi', lastName: 'Owusu', mustChangePassword: false })
    let queueReads = 0
    let detailReads = 0
    let writes = 0
    let current = row
    await page.route('**/*', async route => {
      const request = route.request()
      if (!['fetch', 'xhr'].includes(request.resourceType())) {
        await route.continue()
        return
      }
      const url = new URL(request.url())
      if (url.pathname.endsWith(`/hr/help-requests/${id}`)) {
        if (request.method() === 'PATCH') {
          writes++
          expect(request.postDataJSON()).toEqual({ status: 'RESOLVED', resolutionNote: 'Scanner fixed.' })
          current = { ...row, status: 'RESOLVED', resolutionNote: 'Scanner fixed.', resolvedAt: row.createdAt }
          await route.fulfill({ json: { success: true, data: { id, status: current.status, resolutionNote: current.resolutionNote } } })
          return
        }
        expect(request.method()).toBe('GET')
        detailReads++
        await route.fulfill({ json: { success: true, data: current } })
        return
      }
      if (url.pathname.endsWith('/hr/help-requests') && request.method() === 'GET') {
        queueReads++
        expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'IN_REVIEW', page: '2', limit: '12' })
        const visible = current.status === 'IN_REVIEW'
        await route.fulfill({ json: {
          success: true, data: visible ? [row] : [],
          pagination: { currentPage: 2, totalPages: visible ? 2 : 1, total: visible ? 13 : 12 },
        } })
        return
      }
      await route.fulfill({ status: request.method() === 'GET' ? 200 : 405, json: { success: true, data: [] } })
    })

    await page.goto(queue)
    await expect(page.getByText(/Page 2 of 2/i)).toBeVisible()
    await expect(page.getByText(row.subject)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`queue-${width}.png`), fullPage: true })

    const detail = page.locator(`a[href*="${id}"]`)
    await detail.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(row.body)).toBeVisible()
    await page.reload()
    await expect(page.getByText(row.body)).toBeVisible()
    expect(queueReads).toBe(1)
    expect(detailReads).toBe(2)
    await expect(page.getByRole('button', { name: 'Start review', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Resolve', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const confirm = dialog.getByRole('button', { name: 'Confirm' })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox', { name: /Resolution note/i }).fill('  Scanner fixed.  ')
    await expect(confirm).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`resolution-${width}.png`), fullPage: true })
    await confirm.click()
    await expect(page.getByText('Scanner fixed.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resolve', exact: true })).toHaveCount(0)
    expect(writes).toBe(1)
    expect(detailReads).toBe(3)
    await page.getByRole('link', { name: /Back to queue/i }).click()
    await expect(page).toHaveURL(new RegExp(`${queue.replace('?', '\\?')}$`))
    await expect(page.getByRole('combobox', { name: /Status/i })).toHaveValue('IN_REVIEW')
    expect(queueReads).toBe(2)
  })
}
