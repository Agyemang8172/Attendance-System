import { expect, test } from '@playwright/test'

const id = '11111111-1111-4111-8111-111111111111'
const attendanceId = '22222222-2222-4222-8222-222222222222'
const base = '/hr-corrections'
const row = {
  id, attendanceId, status: 'SUBMITTED', reason: 'The kiosk recorded my start late.',
  requestedAt: '2026-11-04T10:00:00Z', createdAt: '2026-11-04T10:00:00Z',
  requestedBy: { id: 'test-requester', firstName: 'Ama', lastName: 'Mensah' },
  attendance: { id: attendanceId, date: '2026-11-03T00:00:00Z', user: { firstName: 'Kojo', lastName: 'Mensah' } },
  originalValues: { clockIn: '2026-11-03T08:00:00Z', clockOut: '2026-11-03T16:00:00Z', status: 'LATE' },
  proposedClockIn: '2026-11-03T07:55:00Z', proposedClockOut: null,
  decisionNote: null as string | null, decidedAt: null as string | null,
  approvedValues: null as Record<string, unknown> | null,
}

for (const [width, role, reviewTier] of [[375, 'HR', 'SAME_DAY'], [1440, 'SUPERADMIN', 'ESCALATED']] as const) {
  test(`${role} correction queue and decision at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(actor => {
      localStorage.setItem('token', 'isolated-browser-fixture')
      localStorage.setItem('user', JSON.stringify(actor))
    }, { id: 'test-reviewer', role, firstName: 'Esi', lastName: 'Owusu', mustChangePassword: false })
    const query = `?status=SUBMITTED&reviewTier=${reviewTier}&page=2`
    let current = { ...row, reviewTier }
    let queueReads = 0
    let detailReads = 0
    let writes = 0

    await page.route('**/*', async route => {
      const request = route.request()
      if (!['fetch', 'xhr'].includes(request.resourceType())) {
        await route.continue()
        return
      }
      const url = new URL(request.url())
      if (url.pathname.endsWith(`/hr/corrections/${id}/decision`)) {
        expect(request.method()).toBe('PATCH')
        writes++
        const backstop = role === 'SUPERADMIN'
          ? { backstopCondition: 'EXPLICIT_HANDOFF', backstopReason: 'Requested by HR.' } : {}
        expect(request.postDataJSON()).toEqual({ decision: 'APPROVED', note: 'Checked attendance.', ...backstop })
        current = {
          ...current, status: 'APPROVED', decisionNote: 'Checked attendance.', decidedAt: row.createdAt,
          approvedValues: { clockIn: row.proposedClockIn, clockOut: row.originalValues.clockOut, status: 'ON_TIME' },
        }
        await route.fulfill({ json: {
          success: true, data: { correction: { id, status: current.status }, attendance: { id: attendanceId } },
        } })
        return
      }
      if (url.pathname.endsWith(`/hr/corrections/${id}`)) {
        expect(request.method()).toBe('GET')
        detailReads++
        await route.fulfill({ json: { success: true, data: current } })
        return
      }
      if (url.pathname.endsWith('/hr/corrections')) {
        expect(request.method()).toBe('GET')
        queueReads++
        expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'SUBMITTED', reviewTier, page: '2', limit: '12' })
        const visible = current.status === 'SUBMITTED'
        await route.fulfill({ json: {
          success: true, data: visible ? [current] : [],
          pagination: { currentPage: 2, totalPages: visible ? 2 : 1, total: visible ? 13 : 12 },
        } })
        return
      }
      await route.fulfill({ status: request.method() === 'GET' ? 200 : 405, json: { success: true, data: [] } })
    })

    await page.goto(base + query)
    await expect(page.getByText(/Page 2 of 2/i)).toBeVisible()
    await expect(page.getByText('Kojo Mensah')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`queue-${width}.png`), fullPage: true })

    const link = page.locator(`a[href*="${base}/${id}"]`)
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(row.reason)).toBeVisible()
    await page.reload()
    await expect(page.getByText(row.reason)).toBeVisible()
    expect(queueReads).toBe(1)
    expect(detailReads).toBe(2)
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const confirm = dialog.getByRole('button', { name: /^Confirm/ })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox', { name: /Decision note/i }).fill('  Checked attendance.  ')
    if (role === 'SUPERADMIN') {
      await expect(confirm).toBeDisabled()
      await dialog.getByLabel(/Backstop condition/i).selectOption('EXPLICIT_HANDOFF')
      await dialog.getByRole('textbox', { name: /Backstop reason/i }).fill('  Requested by HR.  ')
    }
    await expect(confirm).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`decision-${width}.png`), fullPage: true })
    await confirm.click()
    await expect(page.getByText('Checked attendance.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
    expect(writes).toBe(1)
    expect(detailReads).toBe(3)
    await page.getByRole('link', { name: /Back to queue/i }).click()
    await expect(page).toHaveURL(base + query)
    await expect(page.getByRole('combobox', { name: /Review tier/i })).toHaveValue(reviewTier)
    await expect.poll(() => queueReads).toBe(2)
  })
}
