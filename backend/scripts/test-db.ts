/**
 * Guarded test-database maintenance.
 *
 * Every subcommand verifies the target through tests/dbGuard.ts before it does
 * anything, so a mistake in backend/.env cannot point the Prisma CLI at the
 * development database.
 *
 * Usage, from `backend/`:
 *   npm run test:db:check     verify the target, print it, change nothing
 *   npm run test:db:deploy    apply migrations to the verified test database
 *   npm run test:db:reset     drop and rebuild the test database (see below)
 *
 * The reset is deliberately not automatic. It only runs when the operator also
 * sets TEST_DB_ALLOW_RESET=yes, and it reuses the same guard, so the thing it
 * drops is always the database the guard just verified.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { assertSafeTestDatabase, describeTarget } from "../tests/dbGuard.js";

const command = (process.argv[2] ?? "check").trim();

const verifiedTarget = () =>
  assertSafeTestDatabase(process.env.TEST_DATABASE_URL, {
    developmentUrl: process.env.DATABASE_URL,
    developmentHost: process.env.DEV_DB_HOST,
  });

const runPrisma = (args: string[], databaseUrl: string): void => {
  console.log(`[test-db] Running: prisma ${args.join(" ")}`);
  const result = spawnSync("npx", ["prisma", ...args], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} exited with code ${result.status}`);
  }
};

const main = (): void => {
  const testUrl = process.env.TEST_DATABASE_URL as string;
  const target = verifiedTarget();
  const label = describeTarget(target);

  switch (command) {
    case "check":
      console.log(`[test-db] OK: TEST_DATABASE_URL verified as ${label}`);
      console.log("[test-db] No connection was made and nothing was changed.");
      return;

    case "deploy":
      console.log(`[test-db] Applying migrations to ${label}`);
      runPrisma(["migrate", "deploy"], testUrl);
      console.log(`[test-db] Migrations applied to ${label}`);
      return;

    case "reset":
      if ((process.env.TEST_DB_ALLOW_RESET ?? "").trim() !== "yes") {
        throw new Error(
          "reset is disabled by default. Set TEST_DB_ALLOW_RESET=yes to drop and rebuild the verified test database."
        );
      }
      console.log(`[test-db] Resetting ${label} (drops and recreates only this database)`);
      runPrisma(["migrate", "reset", "--force", "--skip-seed"], testUrl);
      console.log(`[test-db] Reset complete for ${label}`);
      return;

    default:
      throw new Error(`Unknown command "${command}". Use check, deploy or reset.`);
  }
};

try {
  main();
} catch (error) {
  console.error(
    `[test-db] Failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
