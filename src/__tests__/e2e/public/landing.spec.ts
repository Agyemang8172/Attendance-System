// E2E: public landing page at "/" (seen only while signed out).
//
// Requires a running backend whose database already holds the fixture accounts
// (backend/tests/fixtures.ts upserts them when the backend suite runs). The
// landing page itself needs no backend. `backend/prisma/seed.ts` is empty
// (SSB-2), and `backend/scripts/test-seed.ts` runs the fixture upsert against a
// guarded database, so run that once before the e2e suite.
import { test, expect } from '@playwright/test'

test.describe('Public — landing page', () => {
  test('shows the hero, the sample-data caption and the single sign-in link', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: /attendance that starts at the kiosk/i })
    ).toBeVisible()
    await expect(page.getByText('Sample data — not real records').first()).toBeVisible()

    const signIn = page.getByRole('link', {
      name: /sign in to your attendpro workspace/i,
    })
    await expect(signIn).toBeVisible()
    await expect(signIn).toHaveAttribute('href', '/login')
  })

  test('sign-in link opens the login form', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('link', { name: /sign in to your attendpro workspace/i })
      .click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })
})
