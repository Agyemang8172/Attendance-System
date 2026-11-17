/**
 * Production bootstrap (SSB-2).
 *
 * Creates the first business and its first accounts on an empty production
 * database. It is deliberately separate from `prisma/seed.ts`, which refuses to
 * touch anything outside the development database.
 *
 * Safety rules:
 *   - BOOTSTRAP_CONFIRM must equal "production";
 *   - DATABASE_URL must not name a `_test` database, the test URL, or the
 *     development host;
 *   - the script refuses to run when a business already exists, unless the
 *     operator passes `--force`;
 *   - passwords are read from the environment, validated by the same policy
 *     the API uses, hashed with bcrypt cost 12, and never printed.
 *
 * Run from `backend/`:
 *   npm run db:bootstrap
 *   npm run db:bootstrap -- --force
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { prismaUnscoped as prisma } from "../config/prismaClient.js";
import { passwordString } from "../validators/index.js";

const SALT_ROUNDS = 12;

type BootstrapAccount = {
  emailEnv: string;
  passwordEnv: string;
  employeeCodeEnv: string;
  fallbackCode: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  role: "SUPERADMIN" | "HR";
  required: boolean;
};

const ACCOUNTS: BootstrapAccount[] = [
  {
    emailEnv: "BOOTSTRAP_SUPERADMIN_EMAIL",
    passwordEnv: "BOOTSTRAP_SUPERADMIN_PASSWORD",
    employeeCodeEnv: "BOOTSTRAP_SUPERADMIN_CODE",
    fallbackCode: "EMP-0001",
    firstName: "Business",
    lastName: "Owner",
    department: "Administration",
    jobTitle: "System Administrator",
    role: "SUPERADMIN",
    required: true,
  },
  {
    emailEnv: "BOOTSTRAP_HR_EMAIL",
    passwordEnv: "BOOTSTRAP_HR_PASSWORD",
    employeeCodeEnv: "BOOTSTRAP_HR_CODE",
    fallbackCode: "EMP-0002",
    firstName: "HR",
    lastName: "Manager",
    department: "People",
    jobTitle: "HR Manager",
    role: "HR",
    required: false,
  },
];

const readRequired = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
};

const readPassword = (name: string): string => {
  const value = readRequired(name);
  const parsed = passwordString.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${name} does not meet the password policy: ${parsed.error.issues[0]?.message ?? "invalid password"}`);
  }
  return value;
};

/**
 * Confirms the target is not a test or development database. Returns a
 * sanitized label for the console; the password never appears in the output.
 */
const assertProductionTarget = (): string => {
  const raw = readRequired("DATABASE_URL");
  if ((process.env.BOOTSTRAP_CONFIRM ?? "").trim() !== "production") {
    throw new Error('Set BOOTSTRAP_CONFIRM=production to confirm this is the production database.');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection URL.");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error("DATABASE_URL does not name a database.");
  }
  if (database === "attendpro_test" || database.endsWith("_test")) {
    throw new Error(`Refusing: DATABASE_URL names a test database ("${database}").`);
  }

  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testUrl && testUrl === raw) {
    throw new Error("Refusing: DATABASE_URL equals TEST_DATABASE_URL.");
  }

  const developmentHost = process.env.DEV_DB_HOST?.trim();
  if (developmentHost && parsed.hostname === developmentHost) {
    throw new Error(`Refusing: DATABASE_URL points at the development host "${developmentHost}".`);
  }

  return `${parsed.hostname}:${parsed.port || "5432"}/${database}`;
};

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const target = assertProductionTarget();

  const existingBusinesses = await prisma.business.count();
  if (existingBusinesses > 0 && !force) {
    throw new Error(
      `This database already holds ${existingBusinesses} business row(s). Pass --force only if you intend to add accounts to it.`
    );
  }

  const businessName = process.env.BOOTSTRAP_BUSINESS_NAME?.trim() || "AttendPro";
  const businessSlug = process.env.BOOTSTRAP_BUSINESS_SLUG?.trim() || "attendpro";
  const timezone = process.env.BOOTSTRAP_BUSINESS_TIMEZONE?.trim() || "UTC";

  console.log(`[bootstrap] Target: ${target}`);
  console.log(`[bootstrap] Business: ${businessName} (${businessSlug}, ${timezone})`);

  const business = await prisma.business.upsert({
    where: { slug: businessSlug },
    update: force ? { name: businessName, timezone } : {},
    create: { name: businessName, slug: businessSlug, timezone },
    select: { id: true, slug: true },
  });

  for (const account of ACCOUNTS) {
    const email = process.env[account.emailEnv]?.trim();
    if (!email) {
      if (account.required) throw new Error(`${account.emailEnv} is not set.`);
      console.log(`[bootstrap] ${account.role} skipped (${account.emailEnv} is not set).`);
      continue;
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, businessId: true },
    });

    if (existing && !force) {
      console.log(`[bootstrap] ${account.role} already exists: ${email}. Left unchanged.`);
      continue;
    }

    const password = await bcrypt.hash(readPassword(account.passwordEnv), SALT_ROUNDS);
    const employeeCode =
      process.env[account.employeeCodeEnv]?.trim() || account.fallbackCode;

    await prisma.user.upsert({
      where: { email },
      update: {
        businessId: business.id,
        password,
        role: account.role,
        isActive: true,
        mustChangePassword: true,
        pinFailedCount: 0,
        pinLockedUntil: null,
        pinLastFailedAt: null,
      },
      create: {
        businessId: business.id,
        email,
        password,
        employeeCode,
        firstName: account.firstName,
        lastName: account.lastName,
        department: account.department,
        jobTitle: account.jobTitle,
        role: account.role,
        isActive: true,
        mustChangePassword: true,
      },
    });

    console.log(`[bootstrap] ${account.role} ready: ${email} (must change password on first sign-in).`);
  }

  console.log("[bootstrap] Done. Passwords were read from the environment and never printed.");
}

main()
  .catch((error) => {
    console.error(`[bootstrap] Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
