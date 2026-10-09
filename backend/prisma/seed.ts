import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: resolve(__dirname, "../.env"),
});

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  console.log("🌱 Starting database seed...");

  // ── Read passwords from environment variables ──────────────────────────────
  const superadminPassword = process.env.SUPERADMIN_PASSWORD;
  const hrPassword = process.env.HR_PASSWORD;
  const staffPassword = process.env.STAFF_PASSWORD;

  if (!superadminPassword || !hrPassword || !staffPassword) {
    throw new Error(
      "Missing required environment variables: SUPERADMIN_PASSWORD, HR_PASSWORD, STAFF_PASSWORD"
    );
  }

  // ── Create Shifts ─────────────────────────────────────────────────────────
  const shifts = [
    { id: "shift-morning", name: "Morning", startTime: "06:00", endTime: "14:00" },
    { id: "shift-afternoon", name: "Afternoon", startTime: "14:00", endTime: "22:00" },
  ];

  const createdShifts = [];
  for (const shift of shifts) {
    const created = await prisma.shift.upsert({
      where: { id: shift.id },
      update: {},
      create: shift,
    });
    createdShifts.push(created);
    console.log(`✅ Shift upserted: ${shift.name} (${shift.startTime}–${shift.endTime})`);
  }

  // ── Hash passwords ────────────────────────────────────────────────────────
  const hashedSuperadminPassword = await hashPassword(superadminPassword);
  const hashedHrPassword = await hashPassword(hrPassword);
  const hashedStaffPassword = await hashPassword(staffPassword);

  // ── Create Superadmin ─────────────────────────────────────────────────────
  const superadmin = await prisma.user.upsert({
    where: { email: "superadmin@attendpro.com" },
    update: {},
    create: {
      employeeCode: "EMP-0001",
      firstName: "Super",
      lastName: "Admin",
      email: "superadmin@attendpro.com",
      password: hashedSuperadminPassword,
      role: "SUPERADMIN",
      department: "Administration",
      jobTitle: "System Administrator",
      isActive: true,
      mustChangePassword: true,
      shiftId: createdShifts[0].id,
    },
  });
  console.log(`✅ Superadmin upserted: ${superadmin.email}`);

  // ── Create HR User ────────────────────────────────────────────────────────
  const hr = await prisma.user.upsert({
    where: { email: "hr@attendpro.com" },
    update: {},
    create: {
      employeeCode: "EMP-0002",
      firstName: "HR",
      lastName: "Manager",
      email: "hr@attendpro.com",
      password: hashedHrPassword,
      role: "HR",
      department: "Human Resources",
      jobTitle: "HR Manager",
      isActive: true,
      mustChangePassword: true,
      shiftId: createdShifts[0].id,
    },
  });
  console.log(`✅ HR upserted: ${hr.email}`);

  // ── Create the single staff user ──────────────────────────────────────────
  // One named STAFF fixture instead of the five generic accounts. Backend and
  // frontend suites sign in as this user via STAFF_PASSWORD.
  const staff = await prisma.user.upsert({
    where: { email: "staff@attendpro.com" },
    update: {},
    create: {
      employeeCode: "EMP-0003",
      firstName: "Jordan",
      lastName: "Reed",
      email: "staff@attendpro.com",
      password: hashedStaffPassword,
      role: "STAFF",
      department: "Engineering",
      jobTitle: "Software Engineer",
      isActive: true,
      mustChangePassword: true,
      shiftId: createdShifts[0].id,
    },
  });
  console.log(`✅ Staff upserted: ${staff.email} (${staff.employeeCode})`);

  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Test Accounts (passwords from env vars):");
  console.log(`   Superadmin: superadmin@attendpro.com`);
  console.log(`   HR:         hr@attendpro.com`);
  console.log(`   Staff:      staff@attendpro.com`);
  console.log("\n⚠️  All accounts have mustChangePassword=true");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });