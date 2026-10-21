// E2E: kiosk — deferred, because the kiosk UI does not exist yet.
//
// src/App.jsx has no /kiosk route and src/pages has no kiosk screens (M8 gap
// register, row B/Kiosk). The backend kiosk lanes (pair, identify, verify PIN,
// punch, renew, revoke) are covered by the backend suite. This spec stays
// skipped so the e2e run does not invent selectors for screens nobody built.
//
// Requires a running backend whose database already holds the fixture accounts
// once the UI lands (backend/tests/fixtures.ts upserts them when the backend
// suite runs). backend/prisma/seed.ts is currently empty (SSB-2), and
// `backend/scripts/test-seed.ts` runs that fixture upsert against a guarded
// database, so run it once before the e2e suite.
import { test } from '@playwright/test'

test.describe('Kiosk portal — device pairing', () => {
  test.skip(
    'Kiosk UI is not built: /kiosk has no route in src/App.jsx (M8 gap).',
    async () => {
      // No selectors until the kiosk screens exist.
    }
  )
})
