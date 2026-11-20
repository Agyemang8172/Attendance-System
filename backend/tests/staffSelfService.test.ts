/**
 * M9 Phase 1 — staff self-service and background-job HTTP lanes.
 *
 * Covers four surfaces that had no request-level tests:
 *   POST /api/staff/profile/change-pin   own kiosk PIN, STAFF only
 *   GET  /api/staff/schedule             own shift assignments
 *   GET  /api/staff/off-days             business holidays in a range
 *   POST /api/jobs/auto-clock-out/run    service token only
 *   GET  /api/jobs/status                service token or SUPERADMIN
 *
 * The PIN is written directly with the same HMAC the controller uses, then the
 * original columns are restored. The schedule fixture (one shift, one open
 * assignment, one holiday) is created for the fixture STAFF account and removed
 * afterwards. The job run is pointed at a random business id so it cannot close
 * sessions other suites leave behind.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createHmac, randomBytes, randomUUID } from "crypto";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import { writeAudit } from "../utils/auditWriter.js";
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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const dayOffset = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
};

const hmacPin = (userId: string, pin: string, salt: string): string => {
  const key = process.env.PIN_HMAC_KEY;
  if (!key) throw new Error("PIN_HMAC_KEY must be set by tests/setup.ts");
  return createHmac("sha256", key).update(`${userId}${pin}${salt}`).digest("hex");
};

let saToken: string;
let hrToken: string;
let staffToken: string;
let businessId: string;
let staffUserId: string;
let staffOriginalShiftId: string | null;
let originalPin: {
  pinHash: string | null;
  pinSalt: string | null;
  pinUpdatedAt: Date | null;
  pinFailedCount: number;
  pinLockedUntil: Date | null;
  pinLastFailedAt: Date | null;
  mustChangePin: boolean;
};

let shiftId: string;
let assignmentId: string;
let calendarId: string;
let exceptionId: string;
let exceptionDate: string;
const jobAuditEntityId = randomUUID();

beforeAll(async () => {
  await ensureTestAccounts();
  saToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);

  const staff = await prisma.user.findUnique({
    where: { email: STAFF_EMAIL },
    select: {
      id: true,
      businessId: true,
      shiftId: true,
      pinHash: true,
      pinSalt: true,
      pinUpdatedAt: true,
      pinFailedCount: true,
      pinLockedUntil: true,
      pinLastFailedAt: true,
      mustChangePin: true,
    },
  });
  if (!staff) throw new Error("Fixture STAFF account missing");
  staffUserId = staff.id;
  businessId = staff.businessId;
  staffOriginalShiftId = staff.shiftId;
  originalPin = {
    pinHash: staff.pinHash,
    pinSalt: staff.pinSalt,
    pinUpdatedAt: staff.pinUpdatedAt,
    pinFailedCount: staff.pinFailedCount,
    pinLockedUntil: staff.pinLockedUntil,
    pinLastFailedAt: staff.pinLastFailedAt,
    mustChangePin: staff.mustChangePin,
  };

  const salt = randomBytes(16).toString("hex");
  await prisma.user.update({
    where: { id: staffUserId },
    data: {
      pinHash: hmacPin(staffUserId, "1234", salt),
      pinSalt: salt,
      pinUpdatedAt: new Date(),
      pinFailedCount: 0,
      pinLockedUntil: null,
      pinLastFailedAt: null,
      mustChangePin: false,
    },
  });

  const shift = await prisma.shift.create({
    data: {
      businessId,
      name: `Self Service Shift ${Date.now()}`,
      startMinute: 8 * 60,
      endMinute: 17 * 60,
      startTime: "08:00",
      endTime: "17:00",
    },
    select: { id: true },
  });
  shiftId = shift.id;

  const assignment = await prisma.shiftAssignment.create({
    data: {
      businessId,
      userId: staffUserId,
      shiftId,
      effectiveFrom: new Date(Date.now() - 3 * 86_400_000),
      assignedByUserId: staffUserId,
    },
    select: { id: true },
  });
  assignmentId = assignment.id;
  await prisma.user.update({ where: { id: staffUserId }, data: { shiftId } });

  const calendar = await prisma.workCalendar.findFirst({
    where: { businessId, isDefault: true },
    select: { id: true },
  });
  if (!calendar) throw new Error("Default calendar missing");
  calendarId = calendar.id;

  exceptionDate = dayOffset(5);
  const exception = await prisma.calendarException.create({
    data: {
      businessId,
      calendarId,
      date: new Date(`${exceptionDate}T00:00:00.000Z`),
      kind: "HOLIDAY",
      name: `Self Service Holiday ${Date.now()}`,
    },
    select: { id: true },
  });
  exceptionId = exception.id;
});

afterAll(async () => {
  await prisma.calendarException.deleteMany({ where: { id: exceptionId } });
  await prisma.shiftAssignment.deleteMany({ where: { id: assignmentId } });
  await prisma.user
    .update({ where: { id: staffUserId }, data: { shiftId: staffOriginalShiftId } })
    .catch(() => undefined);
  await prisma.shift.deleteMany({ where: { id: shiftId } });
  // audit_logs is append-only (a database trigger rejects deletes). The rows
  // written by the PIN change and the job-status fixture stay in the test
  // database; that is the same durability guarantee production relies on.
  if (originalPin) {
    await prisma.user
      .update({ where: { id: staffUserId }, data: originalPin })
      .catch(() => undefined);
  }
});

describe("POST /api/staff/profile/change-pin", () => {
  const changePin = (token: string, body: Record<string, unknown>) =>
    request(app).post("/api/staff/profile/change-pin").set(auth(token)).send(body);

  it("rejects a new PIN identical to the current one", async () => {
    const res = await changePin(staffToken, { currentPin: "1234", newPin: "1234" });
    expect(res.status).toBe(400);
  });

  it("rejects a wrong current PIN", async () => {
    const res = await changePin(staffToken, { currentPin: "0000", newPin: "5678" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid current pin/i);
  });

  it("rejects a PIN that is not exactly four digits", async () => {
    const res = await changePin(staffToken, { currentPin: "12", newPin: "5678" });
    expect(res.status).toBe(400);
  });

  it("changes the PIN, resets the lock counters and stores only a hash", async () => {
    const res = await changePin(staffToken, { currentPin: "1234", newPin: "5678" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stored = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { pinHash: true, pinSalt: true, pinFailedCount: true, pinLockedUntil: true, mustChangePin: true },
    });
    expect(stored?.pinHash).toBe(hmacPin(staffUserId, "5678", stored!.pinSalt!));
    expect(stored?.pinHash).not.toBe(hmacPin(staffUserId, "1234", stored!.pinSalt!));
    expect(stored?.pinFailedCount).toBe(0);
    expect(stored?.pinLockedUntil).toBeNull();
    expect(stored?.mustChangePin).toBe(false);
  });

  it("refuses to change a PIN that was never set", async () => {
    await prisma.user.update({
      where: { id: staffUserId },
      data: { pinHash: null, pinSalt: null },
    });
    try {
      const res = await changePin(staffToken, { currentPin: "5678", newPin: "9012" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no pin is set/i);
    } finally {
      const salt = randomBytes(16).toString("hex");
      await prisma.user.update({
        where: { id: staffUserId },
        data: { pinHash: hmacPin(staffUserId, "5678", salt), pinSalt: salt },
      });
    }
  });

  it("fails closed when the server PIN key is missing", async () => {
    const key = process.env.PIN_HMAC_KEY;
    delete process.env.PIN_HMAC_KEY;
    try {
      const res = await changePin(staffToken, { currentPin: "5678", newPin: "9012" });
      expect(res.status).toBe(500);
    } finally {
      if (key) process.env.PIN_HMAC_KEY = key;
    }
  });

  it("refuses HR and SUPERADMIN sessions", async () => {
    expect((await changePin(hrToken, { currentPin: "5678", newPin: "9012" })).status).toBe(403);
    expect((await changePin(saToken, { currentPin: "5678", newPin: "9012" })).status).toBe(403);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/staff/profile/change-pin")
      .send({ currentPin: "5678", newPin: "9012" });
    expect(res.status).toBe(401);
  });
});

describe("Staff schedule and off-days", () => {
  const range = () => `startDate=${dayOffset(-10)}&endDate=${dayOffset(10)}`;

  it("returns the caller's assignments in the range", async () => {
    const res = await request(app).get(`/api/staff/schedule?${range()}`).set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const assignment = res.body.data.find((row: { id: string }) => row.id === assignmentId);
    expect(assignment).toBeTruthy();
    expect(assignment.shift.name).toContain("Self Service Shift");
  });

  it("returns the business holidays in the range", async () => {
    const res = await request(app).get(`/api/staff/off-days?${range()}`).set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(res.body.data.some((row: { id: string }) => row.id === exceptionId)).toBe(true);
  });

  it("rejects an inverted, oversized or malformed range", async () => {
    const inverted = await request(app)
      .get(`/api/staff/schedule?startDate=${dayOffset(10)}&endDate=${dayOffset(-10)}`)
      .set(auth(staffToken));
    expect(inverted.status).toBe(400);

    const oversized = await request(app)
      .get(`/api/staff/off-days?startDate=${dayOffset(-200)}&endDate=${dayOffset(10)}`)
      .set(auth(staffToken));
    expect(oversized.status).toBe(400);

    const malformed = await request(app)
      .get("/api/staff/schedule?startDate=2026-1-1&endDate=2026-12-31")
      .set(auth(staffToken));
    expect(malformed.status).toBe(400);
  });

  it("refuses HR and SUPERADMIN sessions", async () => {
    expect((await request(app).get(`/api/staff/schedule?${range()}`).set(auth(hrToken))).status).toBe(403);
    expect((await request(app).get(`/api/staff/off-days?${range()}`).set(auth(saToken))).status).toBe(403);
  });

  it("requires authentication", async () => {
    expect((await request(app).get(`/api/staff/schedule?${range()}`)).status).toBe(401);
  });
});

describe("Background jobs over HTTP", () => {
  const jobToken = () => process.env.JOB_TOKEN as string;
  const run = (token?: string, body: Record<string, unknown> = {}) => {
    const req = request(app).post("/api/jobs/auto-clock-out/run");
    return token ? req.set(auth(token)).send(body) : req.send(body);
  };
  const status = (token?: string) => {
    const req = request(app).get("/api/jobs/status");
    return token ? req.set(auth(token)) : req;
  };

  it("runs the sweep for a scoped business with the service token", async () => {
    const res = await run(jobToken(), { businessId: randomUUID() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.closed).toBe(0);
    expect(res.body.data.flagged).toBe(0);
  });

  it("rejects a missing, malformed or wrong service token", async () => {
    expect((await run()).status).toBe(401);
    expect((await run("wrong-token")).status).toBe(401);
  });

  it("rejects a SUPERADMIN session on the run route", async () => {
    expect((await run(saToken)).status).toBe(401);
  });

  it("rejects a non-UUID business id", async () => {
    expect((await run(jobToken(), { businessId: "not-a-uuid" })).status).toBe(400);
  });

  it("fails closed when JOB_TOKEN is unset", async () => {
    const key = process.env.JOB_TOKEN;
    delete process.env.JOB_TOKEN;
    try {
      expect((await run(key)).status).toBe(401);
    } finally {
      if (key) process.env.JOB_TOKEN = key;
    }
  });

  it("reads the latest run for the job token and for SUPERADMIN", async () => {
    await writeAudit({
      businessId,
      actorType: "SYSTEM",
      action: "job.auto_clock_out_closed",
      entityType: "attendance",
      entityId: jobAuditEntityId,
      reason: "Self-service job status fixture",
    });

    const job = await status(jobToken());
    expect(job.status).toBe(200);
    expect(job.body.data.lastRun).not.toBeNull();
    expect(job.body.data.closed).toBeGreaterThanOrEqual(1);

    const sa = await status(saToken);
    expect(sa.status).toBe(200);
    expect(sa.body.data.closed).toBeGreaterThanOrEqual(1);

    expect((await status(hrToken)).status).toBe(403);
    expect((await status(staffToken)).status).toBe(403);
    expect((await status()).status).toBe(401);
  });
});
