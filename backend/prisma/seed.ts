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

  if (!superadminPassword || !hrPassword) {
    throw new Error(
      "Missing required environment variables: SUPERADMIN_PASSWORD, HR_PASSWORD"
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

  // ── No staff fixtures ─────────────────────────────────────────────────────
  // The seed provisions the two privileged accounts and nothing else. Staff
  // records are business data: they arrive through POST /api/users, created by
  // HR or SUPERADMIN, each with a real temporary credential handed to a real
  // person. Placeholder accounts seeded here would be indistinguishable from
  // live ones in a backup, in an export, or to whoever reads the attendance
  // figures they accumulate.
  //
  // This also means an upsert run no longer *removes* staff that already
  // exist — it simply stops adding new ones. Cleaning up rows left by earlier
  // seeds is a separate, explicitly approved operation.

  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Accounts (passwords from env vars):");
  console.log(`   Superadmin: superadmin@attendpro.com`);
  console.log(`   HR:         hr@attendpro.com`);
  console.log("\n   Staff accounts are created through the application, not the seed.");
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