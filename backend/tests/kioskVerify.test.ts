/**
 * Kiosk verification integration tests (contracts §7, kiosk §3–§5).
 *
 *   POST /api/kiosk/identify     badge read → candidate session
 *   POST /api/kiosk/verify-pin   PIN → verified session
 *   POST /api/kiosk/cancel       abandon a candidate session
 *
 * Paired terminals are seeded with `seedActiveKiosk` (a real ACTIVE row and a
 * correctly signed device token) so the suite exercises the kiosk middleware
 * without spending the public pairing route's IP-scoped redemption budget.
 *
 * The temporary staff accounts and their badges/sessions are removed in
 * `afterAll`; audit and attempt trail rows are append-only and stay.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomBytes, randomUUID } from "crypto";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import { hashSessionHandle } from "../controllers/kioskVerifyController.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";
import {
  cleanupKiosk,
  createTempStaff,
  seedActiveKiosk,
  seedBadge,
  uniqueTag,
  type SeededBadge,
  type SeededKiosk,
  type TempStaff,
} from "./kioskFixtures.js";

async function tokenFor(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const PIN = "4821";

let staffToken: string;
let businessId: string;

let staffUser: TempStaff;
let noPinStaff: TempStaff;
let inactiveStaff: TempStaff;

let kioskA: SeededKiosk;
let kioskB: SeededKiosk;
let siteId: string;

let badge: SeededBadge;
let revokedBadge: SeededBadge;
let inactiveBadge: SeededBadge;
let noPinBadge: SeededBadge;
let foreignStaff: TempStaff;
let foreignBadge: SeededBadge;
let foreignBusinessId: string;

/** Handles captured as tests progress; cancel re-uses them deliberately. */
let verifiedSessionHandle: string;
let expiredSessionHandle: string;

const kioskIds: string[] = [];

beforeAll(async () => {
  await ensureTestAccounts();
  staffToken = await tokenFor(STAFF_EMAIL);
  const staff = await prisma.user.findUnique({
    where: { email: STAFF_EMAIL },
    select: { businessId: true },
  });
  if (!staff) throw new Error("Fixture STAFF account missing");
  businessId = staff.businessId;

  staffUser = await createTempStaff(businessId, { pin: PIN });
  noPinStaff = await createTempStaff(businessId);
  inactiveStaff = await createTempStaff(businessId, { isActive: false });

  const site = await prisma.site.create({
    data: {
      businessId,
      name: `Verify Site ${uniqueTag()}`,
      latitude: 5.6037,
      longitude: -0.187,
      radiusMeters: 150,
    },
    select: { id: true },
  });
  siteId = site.id;

  kioskA = await seedActiveKiosk(businessId, { label: `Verify A ${uniqueTag()}`, siteId });
  kioskB = await seedActiveKiosk(businessId, { label: `Verify B ${uniqueTag()}` });
  kioskIds.push(kioskA.id, kioskB.id);

  badge = await seedBadge(businessId, staffUser.id);
  revokedBadge = await seedBadge(businessId, staffUser.id, { revoked: true });
  inactiveBadge = await seedBadge(businessId, inactiveStaff.id);
  noPinBadge = await seedBadge(businessId, noPinStaff.id);

  // A badge belonging to another tenant, to hold the "unknown or foreign share
  // one refusal" branch. The business is removed in afterAll.
  const foreignBusiness = await prisma.business.create({
    data: { name: `Foreign ${uniqueTag()}`, slug: `foreign-${uniqueTag()}` },
    select: { id: true },
  });
  foreignBusinessId = foreignBusiness.id;
  foreignStaff = await createTempStaff(foreignBusiness.id);
  foreignBadge = await seedBadge(foreignBusiness.id, foreignStaff.id);
});

afterAll(async () => {
  await prisma.attendance.deleteMany({ where: { userId: staffUser.id } });
  await cleanupKiosk({
    kioskIds,
    employeeIds: [
      staffUser.id,
      noPinStaff.id,
      inactiveStaff.id,
      foreignStaff.id,
    ],
    siteIds: [siteId],
  });
  if (foreignBusinessId) {
    await prisma.business.deleteMany({ where: { id: foreignBusinessId } });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

const identify = (
  qrToken: string,
  options: { kiosk?: SeededKiosk; token?: string | null; extra?: Record<string, unknown> } = {}
) => {
  const req = request(app).post("/api/kiosk/identify");
  const token = options.token === undefined ? (options.kiosk ?? kioskA).token : options.token;
  return (token ? req.set(auth(token)) : req).send({ qrToken, ...options.extra });
};

const verifyPin = (
  sessionId: string,
  pin: string,
  options: { kiosk?: SeededKiosk; token?: string | null } = {}
) => {
  const req = request(app).post("/api/kiosk/verify-pin");
  const token = options.token === undefined ? (options.kiosk ?? kioskA).token : options.token;
  return (token ? req.set(auth(token)) : req).send({ sessionId, pin });
};

const cancel = (
  sessionId: string,
  options: { kiosk?: SeededKiosk; token?: string | null } = {}
) => {
  const req = request(app).post("/api/kiosk/cancel");
  const token = options.token === undefined ? (options.kiosk ?? kioskA).token : options.token;
  return (token ? req.set(auth(token)) : req).send({ sessionId });
};

/** identify() + a 201 assertion, returning the session handle. */
const openSession = async (
  qrToken = badge.token,
  options: { kiosk?: SeededKiosk } = {}
): Promise<string> => {
  const res = await identify(qrToken, options);
  if (res.status !== 201) {
    throw new Error(`identify failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.sessionId as string;
};

const latestAttempt = (reason: string) =>
  prisma.attendanceAttempt.findFirst({
    where: { kioskId: kioskA.id, reason },
    orderBy: { createdAt: "desc" },
    select: { step: true, outcome: true, employeeId: true, reason: true },
  });

const latestAudit = (action: string) =>
  prisma.auditLog.findFirst({
    where: { action, entityType: "verification_session" },
    orderBy: { createdAt: "desc" },
    select: { reason: true, actorKioskId: true },
  });

// ── Identify ────────────────────────────────────────────────────────────────

describe("POST /api/kiosk/identify", () => {
  it("requires a kiosk device token", async () => {
    expect((await identify(badge.token, { token: null })).status).toBe(401);
    expect((await identify(badge.token, { token: "garbage" })).status).toBe(401);
  });

  it("refuses an employee session token", async () => {
    const res = await identify(badge.token, { token: staffToken });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid token");
  });

  it("rejects a badge token that fails transport validation", async () => {
    expect((await identify("short")).status).toBe(400);
  });

  it("rejects malformed location fields", async () => {
    const res = await identify(badge.token, { extra: { accuracyMeters: 900 } });
    expect(res.status).toBe(400);
  });

  it("answers an unknown badge with the generic 404 and records an attempt", async () => {
    const res = await identify(randomBytes(24).toString("base64url"));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: "Badge not recognised. See HR.",
    });

    const attempt = await latestAttempt("badge_unknown_or_foreign");
    expect(attempt).toMatchObject({ step: "IDENTIFY", outcome: "REJECTED" });
  });

  it("shares the same 404 for a badge from another business", async () => {
    const res = await identify(foreignBadge.token);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Badge not recognised. See HR.");
  });

  it("refuses a revoked badge with 403 and records the reason", async () => {
    const res = await identify(revokedBadge.token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("This badge is no longer valid. See HR.");

    const attempt = await latestAttempt("badge_revoked");
    expect(attempt).toMatchObject({
      step: "IDENTIFY",
      outcome: "REJECTED",
      employeeId: staffUser.id,
    });
  });

  it("refuses an inactive employee's badge with 403", async () => {
    const res = await identify(inactiveBadge.token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("This account is not active. See HR.");

    const attempt = await latestAttempt("employee_inactive");
    expect(attempt).toMatchObject({ outcome: "REJECTED", employeeId: inactiveStaff.id });
  });

  it("opens a two-minute session, returns no employee id, and assesses the location", async () => {
    const res = await identify(badge.token, {
      extra: {
        latitude: 5.6037,
        longitude: -0.187,
        accuracyMeters: 12,
        capturedAt: new Date().toISOString(),
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toEqual(expect.any(String));
    expect(res.body.data.sessionId).toHaveLength(32);
    expect(res.body.data.employeeDisplayName).toContain("Tester");
    expect(res.body.data.permittedAction).toBe("CLOCK_IN");
    expect(res.body.data.locationResult).toBe("INSIDE");
    expect(res.body.data).not.toHaveProperty("employeeId");
    expect(JSON.stringify(res.body)).not.toContain(PIN);

    const stored = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(res.body.data.sessionId) },
      select: {
        state: true,
        kioskId: true,
        employeeId: true,
        expiresAt: true,
        sessionIdHash: true,
      },
    });
    expect(stored).toMatchObject({ state: "QR_ACCEPTED", kioskId: kioskA.id });
    expect(stored?.sessionIdHash).not.toBe(res.body.data.sessionId);
    // Two minutes, not a working day.
    const ttlMs = (stored?.expiresAt.getTime() ?? 0) - Date.now();
    expect(ttlMs).toBeGreaterThan(60_000);
    expect(ttlMs).toBeLessThanOrEqual(120_000);

    const attempt = await prisma.attendanceAttempt.findFirst({
      where: { kioskId: kioskA.id, reason: "badge_recognised" },
      orderBy: { createdAt: "desc" },
      select: { step: true, outcome: true, locationResult: true, distanceMeters: true },
    });
    expect(attempt).toMatchObject({
      step: "IDENTIFY",
      outcome: "SUCCESS",
      locationResult: "INSIDE",
    });
    expect(attempt?.distanceMeters).toEqual(expect.any(Number));

    const audit = await latestAudit("verify.session_started");
    expect(audit?.actorKioskId).toBe(kioskA.id);
  });

  it("reports CLOCK_OUT when the employee already has an open attendance session", async () => {
    await prisma.attendance.create({
      data: {
        businessId,
        userId: staffUser.id,
        date: new Date(),
        status: "OPEN_SESSION",
        sessionStatus: "OPEN",
      },
    });

    try {
      const res = await identify(badge.token);
      expect(res.status).toBe(201);
      expect(res.body.data.permittedAction).toBe("CLOCK_OUT");
    } finally {
      await prisma.attendance.deleteMany({ where: { userId: staffUser.id } });
    }
  });

  it("treats an inactive kiosk site as no fence (UNKNOWN location)", async () => {
    await prisma.site.update({ where: { id: siteId }, data: { isActive: false } });
    try {
      const res = await identify(badge.token, {
        extra: { latitude: 5.6037, longitude: -0.187, accuracyMeters: 12 },
      });
      expect(res.status).toBe(201);
      expect(res.body.data.locationResult).toBe("UNKNOWN");
    } finally {
      await prisma.site.update({ where: { id: siteId }, data: { isActive: true } });
    }
  });

  it("fails closed with a 500 when the QR key is missing", async () => {
    const original = process.env.QR_SECRET_KEY;
    delete process.env.QR_SECRET_KEY;
    try {
      const res = await identify(badge.token);
      expect(res.status).toBe(500);
    } finally {
      process.env.QR_SECRET_KEY = original;
    }
  });
});

// ── Verify PIN ──────────────────────────────────────────────────────────────

describe("POST /api/kiosk/verify-pin", () => {
  it("requires a kiosk device token", async () => {
    expect((await verifyPin("any-session", PIN, { token: null })).status).toBe(401);
  });

  it("validates the PIN shape before touching a session", async () => {
    expect((await verifyPin("any-session", "123")).status).toBe(400);
    expect((await verifyPin("any-session", "abcd")).status).toBe(400);
  });

  it("returns 404 for an unknown session handle", async () => {
    const res = await verifyPin(randomBytes(24).toString("base64url"), PIN);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Verification session not found");
  });

  it("refuses a session opened on another kiosk", async () => {
    const handle = await openSession(badge.token);
    const res = await verifyPin(handle, PIN, { kiosk: kioskB });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Verification session not found");

    // The rightful kiosk can still finish it.
    expect((await verifyPin(handle, PIN)).status).toBe(201);
  });

  it("rejects a wrong PIN, counts it, and records the failed attempt", async () => {
    const handle = await openSession(badge.token);
    const res = await verifyPin(handle, "0000");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("That PIN is not correct. Try again.");

    const session = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(handle) },
      select: { state: true, pinAttemptCount: true },
    });
    expect(session).toMatchObject({ state: "QR_ACCEPTED", pinAttemptCount: 1 });

    const user = await prisma.user.findUnique({
      where: { id: staffUser.id },
      select: { pinFailedCount: true, pinLastFailedAt: true },
    });
    expect(user?.pinFailedCount).toBe(1);
    expect(user?.pinLastFailedAt).toBeInstanceOf(Date);

    const attempt = await latestAttempt("pin_mismatch");
    expect(attempt).toMatchObject({ step: "VERIFY", outcome: "REJECTED" });
    expect((await latestAudit("pin.verify_failed"))?.reason).toContain("pin attempt 1");

    // Correct PIN on the same session still succeeds.
    const ok = await verifyPin(handle, PIN);
    expect(ok.status).toBe(201);
    expect(ok.body.data).toEqual({ result: "VERIFIED", action: "CLOCK_IN", status: "VERIFIED" });

    const verified = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(handle) },
      select: { state: true, verifiedAt: true, pinAttemptCount: true },
    });
    expect(verified?.state).toBe("VERIFIED");
    expect(verified?.verifiedAt).toBeInstanceOf(Date);
    expect(verified?.pinAttemptCount).toBe(0);

    const reset = await prisma.user.findUnique({
      where: { id: staffUser.id },
      select: { pinFailedCount: true, pinLockedUntil: true, pinLastFailedAt: true },
    });
    expect(reset).toEqual({ pinFailedCount: 0, pinLockedUntil: null, pinLastFailedAt: null });

    expect((await latestAttempt("pin_matched"))?.outcome).toBe("SUCCESS");
    expect((await latestAudit("verify.succeeded"))?.actorKioskId).toBe(kioskA.id);

    verifiedSessionHandle = handle;
  });

  it("refuses a session that is already verified (409)", async () => {
    const res = await verifyPin(verifiedSessionHandle, PIN);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Verification session was already used");
  });

  it("refuses a session past its expiry and audits the expiry", async () => {
    const handle = await openSession(badge.token);
    expiredSessionHandle = handle;
    await prisma.verificationSession.update({
      where: { sessionIdHash: hashSessionHandle(handle) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await verifyPin(handle, PIN);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Session expired. Scan your badge again.");
    expect((await latestAudit("verify.expired"))?.reason).toBe("session passed its expiry");

    const session = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(handle) },
      select: { state: true },
    });
    expect(session?.state).toBe("QR_ACCEPTED");
  });

  it("refuses a session already marked EXPIRED", async () => {
    const handle = await openSession(badge.token);
    await prisma.verificationSession.update({
      where: { sessionIdHash: hashSessionHandle(handle) },
      data: { state: "EXPIRED" },
    });

    const res = await verifyPin(handle, PIN);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Session expired. Scan your badge again.");
    expect((await latestAudit("verify.expired"))?.reason).toBe("session already expired");
  });

  it("refuses a LOCKED session with 429", async () => {
    const handle = await openSession(badge.token);
    await prisma.verificationSession.update({
      where: { sessionIdHash: hashSessionHandle(handle) },
      data: { state: "LOCKED", lockedAt: new Date() },
    });

    const res = await verifyPin(handle, PIN);
    expect(res.status).toBe(429);
    expect(res.body.message).toBe("Too many tries. Try again later or see HR.");
  });

  it("refuses an employee whose PIN is locked from an earlier session", async () => {
    await prisma.user.update({
      where: { id: staffUser.id },
      data: { pinLockedUntil: new Date(Date.now() + 5 * 60_000) },
    });

    try {
      const handle = await openSession(badge.token);
      const res = await verifyPin(handle, PIN);
      expect(res.status).toBe(429);
      expect(res.body.message).toBe("Try again later or see HR.");
      expect((await latestAttempt("pin_employee_locked"))?.outcome).toBe("REJECTED");
    } finally {
      await prisma.user.update({
        where: { id: staffUser.id },
        data: { pinLockedUntil: null, pinFailedCount: 0, pinLastFailedAt: null },
      });
    }
  });

  it("locks the session and the employee after ten wrong PINs", async () => {
    const handle = await openSession(badge.token);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const res = await verifyPin(handle, "0000");
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("That PIN is not correct. Try again.");
    }

    const session = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(handle) },
      select: { state: true, pinAttemptCount: true, lockedAt: true },
    });
    expect(session?.state).toBe("LOCKED");
    expect(session?.pinAttemptCount).toBe(10);
    expect(session?.lockedAt).toBeInstanceOf(Date);

    const user = await prisma.user.findUnique({
      where: { id: staffUser.id },
      select: { pinFailedCount: true, pinLockedUntil: true },
    });
    expect(user?.pinFailedCount).toBe(10);
    expect(user?.pinLockedUntil?.getTime()).toBeGreaterThan(Date.now());

    expect((await latestAudit("pin.locked"))?.reason).toBe("pin attempt limit reached");

    const lockedRes = await verifyPin(handle, PIN);
    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.message).toBe("Too many tries. Try again later or see HR.");

    await prisma.user.update({
      where: { id: staffUser.id },
      data: { pinLockedUntil: null, pinFailedCount: 0, pinLastFailedAt: null },
    });
  });

  it("locks the account cumulatively across separate verification sessions (SEC-13)", async () => {
    try {
      // Three independent sessions with five, four and one wrong PINs. Each
      // session's own counter stays below ten, so only the user-level count
      // can trip the lock.
      for (const failures of [5, 4, 1]) {
        const handle = await openSession(badge.token);
        for (let attempt = 0; attempt < failures; attempt += 1) {
          const res = await verifyPin(handle, "0000");
          expect(res.status).toBe(400);
          expect(res.body.message).toBe("That PIN is not correct. Try again.");
        }
      }

      const afterTen = await prisma.user.findUnique({
        where: { id: staffUser.id },
        select: { pinFailedCount: true, pinLockedUntil: true },
      });
      expect(afterTen?.pinFailedCount).toBe(10);
      expect(afterTen?.pinLockedUntil?.getTime()).toBeGreaterThan(Date.now());
      expect((await latestAudit("pin.locked"))?.reason).toBe("pin attempt limit reached");

      // A fresh session must not reset the lock: even the correct PIN is
      // refused while the five-minute window holds.
      const freshHandle = await openSession(badge.token);
      const blocked = await verifyPin(freshHandle, PIN);
      expect(blocked.status).toBe(429);
      expect(blocked.body.message).toBe("Try again later or see HR.");
      expect((await latestAttempt("pin_employee_locked"))?.outcome).toBe("REJECTED");

      // Once the lock lapses, the correct PIN is accepted and clears the
      // cumulative counter, so the employee is not locked out forever.
      await prisma.user.update({
        where: { id: staffUser.id },
        data: { pinLockedUntil: new Date(Date.now() - 60_000) },
      });
      const recoveredHandle = await openSession(badge.token);
      const recovered = await verifyPin(recoveredHandle, PIN);
      expect(recovered.status).toBe(201);

      const cleared = await prisma.user.findUnique({
        where: { id: staffUser.id },
        select: { pinFailedCount: true, pinLockedUntil: true, pinLastFailedAt: true },
      });
      expect(cleared).toEqual({
        pinFailedCount: 0,
        pinLockedUntil: null,
        pinLastFailedAt: null,
      });
    } finally {
      await prisma.user.update({
        where: { id: staffUser.id },
        data: { pinLockedUntil: null, pinFailedCount: 0, pinLastFailedAt: null },
      });
    }
  });

  it("treats a never-set PIN as a mismatch without creating a lock", async () => {
    const handle = await openSession(noPinBadge.token);
    const res = await verifyPin(handle, "1234");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("That PIN is not correct. Try again.");

    const user = await prisma.user.findUnique({
      where: { id: noPinStaff.id },
      select: { pinHash: true, pinSalt: true, pinFailedCount: true, pinLockedUntil: true },
    });
    expect(user?.pinHash).toBeNull();
    expect(user?.pinSalt).toBeNull();
    expect(user?.pinFailedCount).toBe(1);
    expect(user?.pinLockedUntil).toBeNull();
  });

  it("refuses a session whose employee went inactive after the badge was read", async () => {
    const handle = await openSession(badge.token);
    await prisma.user.update({ where: { id: staffUser.id }, data: { isActive: false } });

    try {
      const res = await verifyPin(handle, PIN);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Verification session not found");
      expect((await latestAttempt("employee_unavailable"))?.outcome).toBe("REJECTED");
    } finally {
      await prisma.user.update({ where: { id: staffUser.id }, data: { isActive: true } });
    }
  });

  it("fails closed with a 500 when the PIN key is missing", async () => {
    const handle = await openSession(badge.token);
    const original = process.env.PIN_HMAC_KEY;
    delete process.env.PIN_HMAC_KEY;
    try {
      const res = await verifyPin(handle, PIN);
      expect(res.status).toBe(500);
    } finally {
      process.env.PIN_HMAC_KEY = original;
    }
  });
});

// ── Cancel ──────────────────────────────────────────────────────────────────

describe("POST /api/kiosk/cancel", () => {
  it("requires a kiosk device token and a session id", async () => {
    expect((await cancel("any-session", { token: null })).status).toBe(401);
    expect(
      (await request(app).post("/api/kiosk/cancel").set(auth(kioskA.token)).send({})).status
    ).toBe(400);
  });

  it("returns 404 for an unknown or foreign session", async () => {
    const unknown = await cancel(randomBytes(24).toString("base64url"));
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe("Verification session not found");

    const handle = await openSession(badge.token);
    const foreign = await cancel(handle, { kiosk: kioskB });
    expect(foreign.status).toBe(404);

    // Cancelling from the right kiosk still works afterwards.
    expect((await cancel(handle)).status).toBe(200);
  });

  it("expires a candidate session and is idempotent afterwards", async () => {
    const candidateSessionHandle = await openSession(badge.token);
    const res = await cancel(candidateSessionHandle);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Verification session cancelled");

    const stored = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(candidateSessionHandle) },
      select: { state: true },
    });
    expect(stored?.state).toBe("EXPIRED");

    const again = await cancel(candidateSessionHandle);
    expect(again.status).toBe(200);
  });

  it("does not rewrite a verified session", async () => {
    const res = await cancel(verifiedSessionHandle);
    expect(res.status).toBe(200);

    const stored = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(verifiedSessionHandle) },
      select: { state: true, verifiedAt: true },
    });
    expect(stored?.state).toBe("VERIFIED");
    expect(stored?.verifiedAt).toBeInstanceOf(Date);
  });

  it("cancels a past-expiry candidate and leaves it EXPIRED", async () => {
    const res = await cancel(expiredSessionHandle);
    expect(res.status).toBe(200);

    const stored = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(expiredSessionHandle) },
      select: { state: true },
    });
    expect(stored?.state).toBe("EXPIRED");
  });
});
