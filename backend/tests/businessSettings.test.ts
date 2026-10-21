/**
 * M9 Phase 1 — business settings (`businessController.ts`, contracts §5, O10).
 *
 *   GET   /api/business/settings   SUPERADMIN  read the caller's own business
 *   PATCH /api/business/settings   SUPERADMIN  update it, audited
 *
 * The caller's own business is the shared default business (the SUPERADMIN
 * fixture lives there), so every mutation below is written back to the value
 * it had at the start of the run — the suite must not leave the tenant renamed
 * or its support email moved for other suites. Retention is config-only here:
 * O10 keeps `retentionEnabled` false, so the validator refuses `true` outright.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";

async function tokenFor(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

const getSettings = (token: string) =>
  request(app).get("/api/business/settings").set("Authorization", `Bearer ${token}`);

const patchSettings = (token: string, body: Record<string, unknown>) =>
  request(app)
    .patch("/api/business/settings")
    .set("Authorization", `Bearer ${token}`)
    .send(body);

let businessId: string;
let saToken: string;
let hrToken: string;
let staffToken: string;
let original: {
  supportEmail: string | null;
  brandColor: string | null;
  attendanceRetentionDays: number | null;
  auditRetentionDays: number | null;
};

beforeAll(async () => {
  await ensureTestAccounts();
  const sa = await prisma.user.findUnique({
    where: { email: SUPERADMIN_EMAIL },
    select: { businessId: true },
  });
  if (!sa) throw new Error("Fixture SUPERADMIN missing");
  businessId = sa.businessId;

  const row = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      supportEmail: true,
      brandColor: true,
      attendanceRetentionDays: true,
      auditRetentionDays: true,
    },
  });
  original = {
    supportEmail: row?.supportEmail ?? null,
    brandColor: row?.brandColor ?? null,
    attendanceRetentionDays: row?.attendanceRetentionDays ?? null,
    auditRetentionDays: row?.auditRetentionDays ?? null,
  };

  saToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);
});

afterAll(async () => {
  // Restore whatever the shared tenant looked like before this file ran.
  await prisma.business.update({
    where: { id: businessId },
    data: {
      supportEmail: original.supportEmail,
      brandColor: original.brandColor,
      attendanceRetentionDays: original.attendanceRetentionDays,
      auditRetentionDays: original.auditRetentionDays,
    },
  });
});

describe("GET /api/business/settings", () => {
  it("returns the caller's own settings with branding grouped", async () => {
    const res = await getSettings(saToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Record<string, unknown>;
    expect(typeof data.name).toBe("string");
    expect(typeof data.timezone).toBe("string");
    expect(typeof data.retentionYears).toBe("number");
    expect(typeof data.retentionEnabled).toBe("boolean");
    expect(data).toHaveProperty("attendanceRetentionDays");
    expect(data).toHaveProperty("auditRetentionDays");
    expect(data.branding).toBeTruthy();
    const branding = data.branding as Record<string, unknown>;
    expect(branding).toHaveProperty("logoUrl");
    expect(branding).toHaveProperty("brandColor");
    expect(branding).toHaveProperty("supportEmail");
    expect(branding).toHaveProperty("supportPhone");
  });

  it("refuses HR and STAFF with 403 and an anonymous caller with 401", async () => {
    expect((await getSettings(hrToken)).status).toBe(403);
    expect((await getSettings(staffToken)).status).toBe(403);
    expect((await request(app).get("/api/business/settings")).status).toBe(401);
  });
});

describe("PATCH /api/business/settings — the O10 guard and strict validation", () => {
  it("refuses retentionEnabled: true with 400 (O10)", async () => {
    const res = await patchSettings(saToken, { retentionEnabled: true });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("retentionEnabled must stay false");
  });

  it("refuses an invalid IANA timezone with 400", async () => {
    const res = await patchSettings(saToken, { timezone: "Not/AZone" });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("Timezone must be a valid IANA name");
  });

  it("refuses an unknown key with 400 (strict schema)", async () => {
    const res = await patchSettings(saToken, { retentionYear: 3 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("refuses an out-of-range retention window and an over-long name with 400", async () => {
    const badWindow = await patchSettings(saToken, { attendanceRetentionDays: 99999 });
    expect(badWindow.status).toBe(400);

    const badName = await patchSettings(saToken, { name: "n".repeat(81) });
    expect(badName.status).toBe(400);
  });

  it("refuses HR and STAFF with 403", async () => {
    expect((await patchSettings(hrToken, { brandColor: "#123456" })).status).toBe(403);
    expect((await patchSettings(staffToken, { brandColor: "#123456" })).status).toBe(403);
  });
});

describe("PATCH /api/business/settings — accepted writes", () => {
  it("updates supportEmail, persists it, and audits the before/after diff", async () => {
    const nextEmail = `support.${Date.now()}@test.attendpro.com`;
    const res = await patchSettings(saToken, { supportEmail: nextEmail });

    expect(res.status).toBe(200);
    expect(res.body.data.branding.supportEmail).toBe(nextEmail);

    const row = await prisma.business.findUnique({
      where: { id: businessId },
      select: { supportEmail: true },
    });
    expect(row?.supportEmail).toBe(nextEmail);

    const audit = await prisma.auditLog.findFirst({
      where: { businessId, action: "settings.updated", entityId: businessId },
      orderBy: { createdAt: "desc" },
      select: { reason: true },
    });
    expect(audit).toBeTruthy();
    const reason = JSON.parse(audit!.reason ?? "{}") as {
      fields: string[];
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    };
    expect(reason.fields).toContain("supportEmail");
    expect(reason.before?.supportEmail).toBe(original.supportEmail);
    expect(reason.after?.supportEmail).toBe(nextEmail);

    // Restore immediately (via Prisma — a null supportEmail is not a valid
    // PATCH body) so later files see the tenant as it was.
    await prisma.business.update({
      where: { id: businessId },
      data: { supportEmail: original.supportEmail },
    });
  });

  it("accepts a no-op PATCH and records an empty diff with a note", async () => {
    const current = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    const res = await patchSettings(saToken, { name: current?.name });
    expect(res.status).toBe(200);

    const audit = await prisma.auditLog.findFirst({
      where: { businessId, action: "settings.updated", entityId: businessId },
      orderBy: { createdAt: "desc" },
      select: { reason: true },
    });
    const reason = JSON.parse(audit!.reason ?? "{}") as { fields: string[]; note?: string };
    expect(reason.fields).toEqual([]);
    expect(reason.note).toContain("no effective change");
  });
});
