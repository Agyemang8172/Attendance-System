/**
 * Test fixture seed.
 *
 * The backend suite already upserts its fixture accounts through
 * `backend/tests/fixtures.ts`. This script exposes that same, idempotent upsert
 * to a clean environment so Playwright and a manual walkthrough have a known
 * sign-in. It never deletes rows.
 *
 * The target is `TEST_DATABASE_URL`, verified by `tests/dbGuard.ts` against
 * `TEST_DB_HOST` and `TEST_DB_NAME`. The development database named by
 * `DATABASE_URL` is refused by the guard.
 *
 * The real seed (`backend/prisma/seed.ts`) stays empty until the owner rules on
 * which personnel accounts to persist (SSB-2). This script is test data only.
 *
 * Usage, from `backend/`:
 *   npx tsx scripts/test-seed.ts
 */
import "dotenv/config";
import { assertSafeTestDatabase, describeTarget } from "../tests/dbGuard.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const target = assertSafeTestDatabase(testDatabaseUrl, {
  developmentUrl: process.env.DATABASE_URL,
  developmentHost: process.env.DEV_DB_HOST,
});

// Prisma Client reads DATABASE_URL. Point it at the verified test target before
// the client module is evaluated.
process.env.DATABASE_URL = testDatabaseUrl!;

const { default: prisma } = await import("../config/prismaClient.js");
const {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL,
  TEST_HR_EMAIL,
  TEST_STAFF_EMAIL,
} = await import("../tests/fixtures.js");

async function main(): Promise<void> {
  console.log(`[test-seed] Verified test target: ${describeTarget(target)}`);
  await ensureTestAccounts();

  console.log("[test-seed] Fixture accounts ready:");
  console.log(`  SUPERADMIN  ${TEST_SUPERADMIN_EMAIL}`);
  console.log(`  HR          ${TEST_HR_EMAIL}`);
  console.log(`  STAFF       ${TEST_STAFF_EMAIL}`);
  console.log(`  Password    ${TEST_PASSWORD}`);
  console.log("");
  console.log("[test-seed] The accounts have no kiosk PIN or badge yet; issue them from");
  console.log("[test-seed] the Staff screen, or let the backend suite create them.");
}

await main()
  .catch((error) => {
    console.error("[test-seed] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
