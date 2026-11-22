// E2E: staff sign-in and role redirect.
//
// Requires a running backend whose database already holds the fixture accounts
// (backend/tests/fixtures.ts upserts them when the backend suite runs).
// backend/prisma/seed.ts is currently empty (SSB-2), and
// `backend/scripts/test-seed.ts` runs that fixture upsert against a guarded
// database, so run it once before the e2e suite.
import { test, expect } from '@playwright/test'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.describe('Staff portal — login', () => {
  test('staff signs in and lands on the staff dashboard', async ({ page }) => {
    const testPassword = process.env.ATTENDPRO_TEST_PASSWORD
    if (!testPassword) throw new Error('ATTENDPRO_TEST_PASSWORD is required for login tests')
    await page.goto('/login')

    await page.getByLabel(/email/i).fill('staff@test.attendpro.com')
    try {
      await page.getByLabel(/password/i).fill(testPassword)
    } catch {
      throw new Error('Unable to enter the test credential')
    }
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Test')
  })
})
