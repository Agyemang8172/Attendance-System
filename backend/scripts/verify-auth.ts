/**
 * Local test-database authentication verifier.
 *
 * Runs against TEST_DATABASE_URL only. It positively verifies the target with
 * the same guard the suite uses, provisions the three canonical test accounts
 * (one per role), then calls the real POST /api/auth/login handler for each
 * account. Finally it lists every user in the database and attempts the same
 * universal test password for each one, so inactive accounts and accounts with
 * a different password are visible instead of assumed.
 *
 * No password hash, JWT, database password, or full connection URL is printed.
 *
 * Run from backend/:
 *   npx tsx scripts/verify-auth.ts
 */
import "dotenv/config";
import { assertSafeTestDatabase, describeTarget } from "../tests/dbGuard.js";

process.env.NODE_ENV = "test";
process.env.PORT = "0";

const originalDevelopmentUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const target = assertSafeTestDatabase(testDatabaseUrl, {
  developmentUrl: originalDevelopmentUrl,
  developmentHost: process.env.DEV_DB_HOST,
});
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DEV_DATABASE_URL = originalDevelopmentUrl;

console.log(`[verify-auth] Verified test database target: ${describeTarget(target)}`);

const main = async (): Promise<void> => {
  const fixtures = await import("../tests/fixtures.js");
  const { default: request } = await import("supertest");
  const { default: app } = await import("../server.js");
  const { default: prisma } = await import("../config/prismaClient.js");

  await fixtures.ensureTestAccounts();

  const canonical = [
    { role: "SUPERADMIN", email: fixtures.TEST_SUPERADMIN_EMAIL },
    { role: "HR", email: fixtures.TEST_HR_EMAIL },
    { role: "STAFF", email: fixtures.TEST_STAFF_EMAIL },
  ];

  type LoginResult = {
    email: string;
    role: string;
    status: number;
    returnedRole?: string;
    token: boolean;
    mustChangePassword?: boolean;
  };

  const login = async (email: string): Promise<LoginResult> => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: fixtures.TEST_PASSWORD });
    return {
      email,
      role: "unknown",
      status: res.status,
      returnedRole: res.body?.user?.role,
      token: typeof res.body?.token === "string" && res.body.token.length > 0,
      mustChangePassword: res.body?.user?.mustChangePassword,
    };
  };

  console.log("[verify-auth] canonical role accounts:");
  for (const account of canonical) {
    const result = await login(account.email);
    result.role = account.role;
    console.log(
      `  ${account.role.padEnd(10)} ${account.email.padEnd(38)} status=${result.status} role=${result.returnedRole ?? "-"} token=${result.token ? "yes" : "no"} mustChangePassword=${result.mustChangePassword ?? "-"}`
    );
    if (result.status !== 200 || result.returnedRole !== account.role || !result.token) {
      process.exitCode = 1;
    }
  }

  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      business: { select: { slug: true } },
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  const byRole = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] ?? 0) + 1;
    return acc;
  }, {});
  const active = users.filter((user) => user.isActive).length;
  const forcedChange = users.filter((user) => user.mustChangePassword).length;

  console.log(
    `[verify-auth] users in database: ${users.length} (${Object.entries(byRole)
      .map(([role, count]) => `${role}=${count}`)
      .join(", ")}), active=${active}, inactive=${users.length - active}, mustChangePassword=true=${forcedChange}`
  );

  const statusCounts: Record<number, number> = {};
  const non200: LoginResult[] = [];

  for (const user of users) {
    const result = await login(user.email);
    result.role = user.role;
    statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
    if (result.status !== 200) non200.push(result);
  }

  console.log(
    `[verify-auth] login with the universal test password: ${Object.entries(statusCounts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([status, count]) => `${status}=${count}`)
      .join(", ")}`
  );

  if (non200.length > 0) {
    console.log("[verify-auth] accounts that did not return 200 (expected for inactive or differently provisioned fixtures):");
    for (const result of non200) {
      const reason =
        result.status === 401
          ? "wrong password or unknown account"
          : result.status === 403
            ? "account deactivated"
            : `unexpected status ${result.status}`;
      console.log(`  ${result.role.padEnd(10)} ${result.email.padEnd(46)} ${reason}`);
    }
  }

  console.log("[verify-auth] local test credentials:");
  for (const account of canonical) {
    console.log(`  ${account.email} / ${fixtures.TEST_PASSWORD} (${account.role})`);
  }

  await prisma.$disconnect();
};

main()
  .then(() => {
    process.exit(process.exitCode ?? 0);
  })
  .catch((error) => {
    console.error(`[verify-auth] Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
