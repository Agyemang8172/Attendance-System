/**
 * Test accounts.
 *
 * The suite used to depend on whatever `prisma/seed.ts` had put in the database
 * — `john.doe@company.com` and friends, with passwords read from the
 * environment. That coupling meant the seed could not be trimmed without
 * breaking every suite, and it meant a test run silently depended on rows it
 * neither created nor cleaned up.
 *
 * These three accounts are created here instead. They use the universal test
 * credential from Hard Rule 17, they carry names no human will ever be issued,
 * and they are the only accounts this suite touches. The real seeded
 * `superadmin@attendpro.com` and `hr@attendpro.com` are left exactly as the
 * developer left them.
 *
 * `mustChangePassword` is set false deliberately. It stays true for every real
 * account until that person sets their own password; here it would stop the
 * suite one request in, because the forced-change gate now guards every
 * application route. The gate itself is exercised by its own tests rather than
 * by every other test in the file.
 */
import bcrypt from "bcrypt";
import prisma from "../config/prismaClient.js";

/** Hard Rule 17 — one universal password for development and test accounts. */
export const TEST_PASSWORD = "devos123";

export const TEST_SUPERADMIN_EMAIL = "superadmin@test.attendpro.com";
export const TEST_HR_EMAIL = "hr@test.attendpro.com";
export const TEST_STAFF_EMAIL = "staff@test.attendpro.com";

const SALT_ROUNDS = 12;

type TestAccount = {
  email: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  role: "SUPERADMIN" | "HR" | "STAFF";
  department: string;
  jobTitle: string;
};

/**
 * Fixed employee codes rather than generated ones: `generateEmployeeCode`
 * reads the highest existing code, and having tests insert EMP-0008 before a
 * human creates their first real account would be a confusing way to start.
 */
const ACCOUNTS: TestAccount[] = [
  {
    email: TEST_SUPERADMIN_EMAIL,
    employeeCode: "EMP-9001",
    firstName: "Test",
    lastName: "Superadmin",
    role: "SUPERADMIN",
    department: "Testing",
    jobTitle: "Test Administrator",
  },
  {
    email: TEST_HR_EMAIL,
    employeeCode: "EMP-9002",
    firstName: "Test",
    lastName: "Human Resources",
    role: "HR",
    department: "Testing",
    jobTitle: "Test HR Manager",
  },
  {
    email: TEST_STAFF_EMAIL,
    employeeCode: "EMP-9003",
    firstName: "Test",
    lastName: "Staff",
    role: "STAFF",
    department: "Testing",
    jobTitle: "Test Staff Member",
  },
];

let ensured = false;

/**
 * Idempotent, and safe to call from every suite's `beforeAll` — the first call
 * does the work and the rest see the flag. Writes: three upserts, each setting
 * the password and clearing `mustChangePassword`. Creates nothing if the
 * accounts already exist.
 */
export const ensureTestAccounts = async (): Promise<void> => {
  if (ensured) return;

  const password = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);

  for (const account of ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        password,
        isActive: true,
        mustChangePassword: false,
        role: account.role,
      },
      create: {
        ...account,
        password,
        isActive: true,
        mustChangePassword: false,
      },
    });
  }

  ensured = true;
};
