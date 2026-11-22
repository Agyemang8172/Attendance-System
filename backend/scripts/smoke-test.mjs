// Quick smoke checks against the migrated O14 test database.
// Scratch file for the rehearsal; deleted once the checks pass.
import { PrismaClient } from "../generated/prisma/client.js";

const p = new PrismaClient();

async function main() {
  const [businesses, users, shifts, attendances, policies, versions, auditLogs, kiosks] =
    await Promise.all([
      p.business.count(),
      p.user.count(),
      p.shift.count(),
      p.attendance.count(),
      p.workplacePolicy.count(),
      p.policyVersion.count(),
      p.auditLog.count(),
      p.kioskTerminal.count(),
    ]);
  console.log(
    "businesses:", businesses, "| users:", users, "| shifts:", shifts,
    "| attendances:", attendances, "| policies:", policies, "| versions:", versions,
    "| auditLogs:", auditLogs, "| kiosks:", kiosks,
  );

  const sample = await p.user.findMany({
    select: { email: true, role: true, isActive: true, businessId: true },
    take: 6,
  });
  console.log("sample users:");
  sample.forEach((u) =>
    console.log(" -", u.email, "|", u.role, "| active:", u.isActive, "| business:", u.businessId));
  await p.$disconnect();
}

main().catch((e) => {
  console.error("SMOKE TEST FAILED:", String(e.message).slice(0, 300));
  process.exit(1);
});
