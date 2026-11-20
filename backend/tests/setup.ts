/**
 * Executes before any test file imports Prisma, so the database target and the
 * run flags are all in place before the client module body runs.
 *
 * NODE_ENV=test — server.ts skips its rate limiters under test. The login
 * limiter allows 10 attempts per 15 minutes per IP, so a second test run inside
 * that window would fail with 429 instead of exercising the code under test.
 *
 * PORT=0 — `app.listen("0")` binds an ephemeral port, so importing the app for
 * supertest never contends with a real server on 8000.
 *
 * Database isolation — the suite runs against TEST_DATABASE_URL, never the
 * development database. tests/dbGuard.ts verifies the target positively (exact
 * host and name) and fails closed before any fixture or test write. The value
 * is copied into DATABASE_URL because Prisma Client reads that name. The app
 * client prefers DATABASE_URL_APP, so that override is removed after verification
 * to force both clients onto the guarded test target. No database connection is
 * made before this setup runs; dotenv cannot restore a deleted override.
 *
 * None of these values is written back to .env.
 */
import "dotenv/config";
import { assertSafeTestDatabase, describeTarget } from "./dbGuard.js";

process.env.NODE_ENV = "test";
process.env.PORT = "0";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

/**
 * setup.ts runs before every test file, but the worker process keeps its
 * environment between files. The assignment below replaces DATABASE_URL with
 * the test URL, so without this snapshot the second file would compare the test
 * URL against itself and the guard would correctly refuse. DEV_DATABASE_URL is
 * test-process state only; it is never written to an env file.
 */
const originalDevelopmentUrl =
  process.env.DEV_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.DEV_DATABASE_URL = originalDevelopmentUrl;

const target = assertSafeTestDatabase(testDatabaseUrl, {
  developmentUrl: originalDevelopmentUrl,
  developmentHost: process.env.DEV_DB_HOST,
});

process.env.DATABASE_URL = testDatabaseUrl;
// An externally supplied DATABASE_URL_APP must not bypass the verified target.
// Keep the test-only owner fallback; dedicated RLS checks use their own role.
delete process.env.DATABASE_URL_APP;
console.log(`[tests] Verified test database target: ${describeTarget(target)}`);

/**
 * Kiosk secrets. The middleware fails closed with a 500 when a key is unset
 * (`kioskAuthMiddleware`, `createPairingCode`, `resetPin`, `issueQrCredential`),
 * which is correct for production but makes every kiosk test fail for a
 * configuration reason instead of a behaviour one. These are test-only,
 * deterministic values; they are never written to a real env file.
 *
 * Only set when absent so a developer can point the suite at a key of their
 * own without the harness overwriting it.
 */
const TEST_SECRETS = {
  KIOSK_TOKEN_KEY: "test-kiosk-token-key",
  KIOSK_PAIRING_KEY: "test-kiosk-pairing-key",
  PIN_HMAC_KEY: "test-pin-hmac-key",
  QR_SECRET_KEY: "test-qr-secret-key",
  JOB_TOKEN: "test-job-token",
} as const;

for (const [name, value] of Object.entries(TEST_SECRETS)) {
  if (!process.env[name]) process.env[name] = value;
}
