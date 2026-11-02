import { expect, test } from '@playwright/test'

const replacement = ['River', 'stone', '2026'].join('-')

const account = {
  id: 'employee-account', email: 'staff@example.test', firstName: 'Ama', lastName: 'Mensah',
  role: 'STAFF', mustChangePassword: false,
}

for (const width of [375, 1440]) {
  test(`ordinary password change is usable at ${width}px without a database`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript((user) => {
      localStorage.setItem('token', 'browser-fixture-session')
      localStorage.setItem('user', JSON.stringify(user))
    }, account)

    let requests = 0
    await page.route('**/api/users/change-password', async (route) => {
      requests += 1
      expect(route.request().method()).toBe('PUT')
      expect(route.request().postDataJSON()).toEqual({
        currentPassword: 'devos123', newPassword: replacement,
      })
      await route.fulfill({
        status: requests === 1 ? 401 : 200,
        contentType: 'application/json',
        body: JSON.stringify(requests === 1
          ? { success: false, message: 'Invalid current password' }
          : { success: true, token: 'browser-replacement-session', user: account }),
      })
    })

    await page.goto('/profile/change-password')
    await expect(page.getByRole('heading', { name: /^Change password$/i })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    // Empty form only: no password or credential result appears in the image.
    await page.screenshot({ path: testInfo.outputPath(`empty-password-form-${width}.png`), fullPage: true })

    const current = page.getByLabel(/^Current password$/i)
    await current.fill('devos123')
    await page.getByRole('button', { name: /Show current password/i }).click()
    await expect(current).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: /Hide current password/i }).click()
    await page.getByLabel(/^New password$/i).fill(replacement)
    await page.getByLabel(/^Confirm new password$/i).fill(replacement)
    await page.getByLabel(/^Confirm new password$/i).press('Enter')
    await expect(page.getByText(/Invalid current password/i)).toBeVisible()
    await expect(page).toHaveURL(/\/profile\/change-password$/)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('browser-fixture-session')

    await page.getByRole('button', { name: /^Change password$/i }).click()
    await expect(page.getByText(/Password changed successfully/i)).toBeVisible()
    expect(requests).toBe(2)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('browser-replacement-session')
    const remainingValues = await page.locator('input').evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value))
    expect(remainingValues).not.toContain('devos123')
    expect(remainingValues).not.toContain(replacement)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
