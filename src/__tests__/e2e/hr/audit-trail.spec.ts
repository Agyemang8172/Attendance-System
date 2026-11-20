import { expect, test } from '@playwright/test'

const attendanceId = '11111111-1111-4111-8111-111111111111'
const auditId = '33333333-3333-4333-8333-333333333333'
const correctionId = '22222222-2222-4222-8222-222222222222'
const session = { id: 'fixture-reader', role: 'HR', firstName: 'Ama', lastName: 'Boateng', mustChangePassword: false }
const setSession = (actor: typeof session) => {
  localStorage.setItem('token', 'isolated-browser-fixture')
  localStorage.setItem('user', JSON.stringify(actor))
}

const auditRow = {
  id: auditId,
  action: 'correction.decided',
  entityType: 'correction',
  entityId: null,
  actorType: 'USER',
  actor: { id: 'reader-1', firstName: 'Ama', lastName: 'Boateng', email: 'ama@example.test', role: 'HR' },
  before: { status: 'SUBMITTED' },
  after: { status: 'APPROVED' },
  reason: 'Approved after review',
  createdAt: '2026-11-06T10:00:00.000Z',
}

const trailRow = {
  id: correctionId,
  reason: 'The recorded punch was late.',
  requestedAt: '2026-11-06T08:15:00.000Z',
  reviewTier: 'SAME_DAY',
  proposedClockIn: '2026-11-06T07:55:00.000Z',
  proposedClockOut: null,
  originalValues: { clockIn: '2026-11-06T08:00:00.000Z' },
  approvedValues: { clockIn: '2026-11-06T07:56:00.000Z' },
  status: 'APPROVED',
  decisionNote: 'Confirmed against the site log.',
  decidedAt: '2026-11-06T09:00:00.000Z',
  requestedBy: { firstName: 'Ama', lastName: 'Boateng' },
  reviewedBy: { firstName: 'Kojo', lastName: 'Mensah' },
  attendance: { id: attendanceId, date: '2026-11-06T00:00:00.000Z', user: { firstName: 'Ama', lastName: 'Boateng' } },
  attendanceCorrectionRevisions: [{
    id: 'revision-1', revisionNo: 1, action: 'PROPOSED', reason: 'Initial request',
    valuesBefore: { clockIn: '2026-11-06T08:00:00.000Z' }, valuesAfter: { clockIn: '2026-11-06T07:55:00.000Z' },
    createdAt: '2026-11-06T08:15:00.000Z', actor: { firstName: 'Ama', lastName: 'Boateng' },
  }],
  audits: [{
    id: auditId, action: 'correction.submitted', actorType: 'USER', reason: 'Employee submitted a correction',
    createdAt: '2026-11-06T08:15:00.000Z', actor: { firstName: 'Ama', lastName: 'Boateng' },
  }],
}

for (const width of [375, 1440]) {
  test(`HR audit history and correction trail at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(setSession, session)
    let writes = 0
    let listReads = 0
    let trailReads = 0

    await page.route('**/*', async route => {
      const req = route.request()
      if (!['fetch', 'xhr'].includes(req.resourceType())) return route.continue()
      if (req.method() !== 'GET') {
        writes++
        return route.fulfill({ status: 405, json: { success: false } })
      }
      const url = new URL(req.url())
      if (url.pathname.endsWith('/audit/corrections/' + attendanceId)) {
        trailReads++
        return route.fulfill({ json: { success: true, data: [trailRow] } })
      }
      if (url.pathname.endsWith('/audit')) {
        listReads++
        return route.fulfill({
          json: { success: true, data: [auditRow], pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 } },
        })
      }
      return route.fulfill({ json: { success: true, data: [], pagination: { currentPage: 1, totalPages: 0, totalRecords: 0 } } })
    })

    await page.goto('/hr-audit')
    await expect(page.getByRole('heading', { name: /audit history/i })).toBeVisible()
    await expect(page.getByText('correction.decided')).toBeVisible()
    await expect(page.getByRole('cell', { name: /Ama Boateng \(HR\)/ })).toBeVisible()
    await expect(page.getByText(/\{entry\.actor/)).toHaveCount(0)

    const endDate = '2026-11-07T23:59:59.999Z'
    const ranged = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/audit') && url.searchParams.get('endDate') === endDate
    })
    await page.getByLabel(/from \(utc\)/i).fill('2026-11-01')
    await page.getByLabel(/to \(utc\)/i).fill('2026-11-07')
    const request = await ranged
    expect(new URL(request.url()).searchParams.get('startDate')).toBe('2026-11-01T00:00:00.000Z')

    await page.getByRole('button', { name: /view/i }).first().click()
    await expect(page.getByRole('dialog', { name: /audit entry detail/i })).toBeVisible()
    await expect(page.getByText('Approved after review')).toBeVisible()
    await expect(page.getByText('Before')).toBeVisible()
    await page.getByRole('button', { name: /close detail/i }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`audit-${width}.png`), fullPage: true })

    await page.goto('/hr-audit/corrections/' + attendanceId)
    await expect(page.getByRole('heading', { name: /correction trail/i })).toBeVisible()
    await expect(page.getByText('Approved', { exact: true })).toBeVisible()
    await expect(page.getByText('Approved values')).toBeVisible()
    await expect(page.getByText('PROPOSED · #1')).toBeVisible()
    await expect(page.getByRole('link', { name: /back to record/i })).toHaveAttribute(
      'href', '/hr-attendance/' + attendanceId
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`trail-${width}.png`), fullPage: true })

    expect(listReads).toBeGreaterThan(1)
    expect(trailReads).toBeGreaterThanOrEqual(1)
    expect(writes).toBe(0)
  })
}
