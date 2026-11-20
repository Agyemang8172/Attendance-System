// E2E: Super Admin sign-in and role redirect.
//
// Requires a running backend whose database already holds the fixture accounts
// (backend/tests/fixtures.ts upserts them when the backend suite runs).
// backend/prisma/seed.ts is currently empty (SSB-2), and
// `backend/scripts/test-seed.ts` runs that fixture upsert against a guarded
// database, so run it once before the e2e suite.
import { test, expect } from '@playwright/test'

test.describe('Super Admin portal — login', () => {
  test('SUPERADMIN signs in and lands on the Super Admin dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/email/i).fill('superadmin@test.attendpro.com')
    await page.getByLabel(/password/i).fill('devos123')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/superadmin-dashboard$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome, Test')
  })
})
