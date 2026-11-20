/**
 * Attendance capture and correction.
 *
 * Since the M5 kiosk rework the punch lane is device-authenticated: an
 * employee session token can no longer reach `clock-in` / `clock-out`. The
 * old version of this file still posted a staff bearer token and expected a
 * 201, which is why it failed after the rework. This version drives the real
 * flow: pair a device, issue a badge, identify, verify the 4-digit PIN, then
 * punch with the single-use verified session.
 *
 * Asserts:
 *   - a kiosk token is required (an employee token is refused)
 *   - a second clock-in while open is refused
 *   - clock-out with no open session is 400 (not 404)
 *   - dismissAlert stays scoped to the caller's own records (issue 3, accepted)
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createHmac, randomBytes } from "crypto";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";

const STAFF_PIN = "1234";

async function signIn(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

async function tokenFor(email: string): Promise<string> {
  const res = await signIn(email, TEST_PASSWORD);
  if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status}`);
  return res.body.token as string;
}

let staffToken: string;
let hrToken: string;
let superadminToken: string;
let staffUserId: string;
let kioskToken: string;
let qrPayload: string;
let staffAttendanceId: string; // an OPEN session created in the clock-in test

/**
 * Set the staff member's kiosk PIN to a known value using the same HMAC shape
 * the reset-pin controller writes. `POST /api/users/:id/reset-pin` generates a
 * random PIN but does not return it, so a test cannot learn the credential it
 * just reset — see the M9 findings.
 */
async function setKnownPin(): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: STAFF_EMAIL },
    select: { id: true },
  });
  staffUserId = user.id;

  const pinSalt = randomBytes(16).toString("hex");
  const pinHash = createHmac("sha256", process.env.PIN_HMAC_KEY as string)
    .update(`${user.id}${STAFF_PIN}${pinSalt}`)
    .digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      pinHash,
      pinSalt,
      pinUpdatedAt: new Date(),
      pinFailedCount: 0,
      pinLockedUntil: null,
      pinLastFailedAt: null,
    },
  });
}

/** Pair a throwaway kiosk and issue the staff member one badge. */
async function provisionKioskAndBadge(): Promise<void> {
  const pairing = await request(app)
    .post("/api/kiosk/pairing-codes")
    .set("Authorization", `Bearer ${superadminToken}`)
    .send({ label: `Attendance test kiosk ${Date.now()}` });

  if (pairing.status !== 201) {
    throw new Error(`Pairing code failed: ${pairing.status} ${JSON.stringify(pairing.body)}`);
  }

  const paired = await request(app)
    .post("/api/kiosk/pair")
    .send({ pairingCode: pairing.body.data.pairingCode });

  if (paired.status !== 200) {
    throw new Error(`Pair failed: ${paired.status} ${JSON.stringify(paired.body)}`);
  }
  kioskToken = paired.body.data.token as string;

  const badge = await request(app)
    .post(`/api/business/employees/${staffUserId}/qr-credential`)
    .set("Authorization", `Bearer ${superadminToken}`)
    .send({});

  if (badge.status !== 201) {
    throw new Error(`Badge issue failed: ${badge.status} ${JSON.stringify(badge.body)}`);
  }
  qrPayload = badge.body.data.qrPayload as string;
}

/** Identify + verify, returning the single-use session handle. */
async function openVerifiedSession(): Promise<string> {
  const identify = await request(app)
    .post("/api/kiosk/identify")
    .set("Authorization", `Bearer ${kioskToken}`)
    .send({ qrToken: qrPayload });

  expect(identify.status).toBe(201);
  const sessionId = identify.body.data.sessionId as string;
  expect(sessionId).toBeTruthy();

  const verified = await request(app)
    .post("/api/kiosk/verify-pin")
    .set("Authorization", `Bearer ${kioskToken}`)
    .send({ sessionId, pin: STAFF_PIN });

  expect(verified.status).toBe(201);
  expect(verified.body.data.result).toBe("VERIFIED");

  return sessionId;
}

beforeAll(async () => {
  await ensureTestAccounts();
  superadminToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);

  await setKnownPin();

  // A run that crashed before its clock-out leaves an OPEN row behind, and the
  // next run's clock-in would be refused. Close those first so the suite is
  // repeatable; the row this file opens is closed by its own clock-out test.
  await prisma.attendance.updateMany({
    where: { userId: staffUserId, sessionStatus: "OPEN" },
    data: { sessionStatus: "CLOSED", clockOut: new Date() },
  });

  await provisionKioskAndBadge();
});

describe("POST /api/attendance/clock-in (kiosk token + VERIFIED session)", () => {
  it("refuses an employee session token before it reaches the punch lane", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ verificationSessionId: "not-a-kiosk-session" });

    expect(res.status).toBe(401);
  });

  it("creates an OPEN session for STAFF and returns it", async () => {
    const sessionId = await openVerifiedSession();

    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${kioskToken}`)
      .send({ verificationSessionId: sessionId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("OPEN");
    expect(res.body.data.clockIn).toBeTruthy();
    expect(res.body.data.clockOut).toBeNull();
    staffAttendanceId = res.body.data.id;
  });

  it("rejects a second clock-in while a session is open", async () => {
    const sessionId = await openVerifiedSession();

    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${kioskToken}`)
      .send({ verificationSessionId: sessionId });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("active session open");
  });

  it("rejects an unauthenticated punch with 401", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .send({ verificationSessionId: "anything" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/attendance/clock-out (kiosk token + VERIFIED session)", () => {
  it("closes the OPEN session and returns hoursWorked", async () => {
    // Closes the row opened by the clock-in test above.
    const sessionId = await openVerifiedSession();

    const res = await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${kioskToken}`)
      .send({ verificationSessionId: sessionId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("CLOSED");
    expect(res.body.data.clockOut).toBeTruthy();
    expect(typeof res.body.data.hoursWorked).toBe("number");
    expect(res.body.data.hoursWorked).toBeGreaterThanOrEqual(0);
  });

  it("returns 400 (not 404) when there is no open session", async () => {
    const sessionId = await openVerifiedSession();

    const res = await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${kioskToken}`)
      .send({ verificationSessionId: sessionId });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("rejects a reused verification session with 409", async () => {
    // Open a session, spend it on a clock-in, then replay the same handle.
    const sessionId = await openVerifiedSession();

    const first = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${kioskToken}`)
      .send({ verificationSessionId: sessionId });
    expect(first.status).toBe(201);

    const replay = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${kioskToken}`)
      .send({ verificationSessionId: sessionId });
    expect(replay.status).toBe(409);

    // Leave the suite tidy: close the row this test opened.
    const closingSession = await openVerifiedSession();
    await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${kioskToken}`)
      .send({ verificationSessionId: closingSession });
  });
});

describe("GET /api/attendance/my-attendance", () => {
  it("returns the caller's attendance with pagination defaults", async () => {
    const res = await request(app)
      .get("/api/attendance/my-attendance")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].userId).toBeTruthy();
  });

  it("respects startDate/endDate query params", async () => {
    const res = await request(app)
      .get("/api/attendance/my-attendance?startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T23:59:59.999Z")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("applies the status, session and search filters (SEC-19)", async () => {
    const all = await request(app)
      .get("/api/attendance/my-attendance?limit=100")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(all.status).toBe(200);
    const sample = all.body.data[0] as { status: string; sessionStatus: string };

    const byStatus = await request(app)
      .get(`/api/attendance/my-attendance?status=${encodeURIComponent(sample.status)}&limit=100`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(byStatus.status).toBe(200);
    expect(
      (byStatus.body.data as Array<{ status: string }>).every(
        (row) => row.status === sample.status
      )
    ).toBe(true);

    const bySession = await request(app)
      .get(`/api/attendance/my-attendance?sessionStatus=${sample.sessionStatus}&limit=100`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(bySession.status).toBe(200);
    expect(
      (bySession.body.data as Array<{ sessionStatus: string }>).every(
        (row) => row.sessionStatus === sample.sessionStatus
      )
    ).toBe(true);

    const noMatch = await request(app)
      .get("/api/attendance/my-attendance?search=zzz-no-such-remark")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.total).toBe(0);
  });

  it("rejects an unknown status filter with 400", async () => {
    const res = await request(app)
      .get("/api/attendance/my-attendance?status=PRESENT")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/attendance/my-attendance");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/attendance/all-attendance (HR / SUPERADMIN)", () => {
  it("returns all attendance for HR", async () => {
    const res = await request(app)
      .get("/api/attendance/all-attendance")
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });

  it("returns all attendance for SUPERADMIN", async () => {
    const res = await request(app)
      .get("/api/attendance/all-attendance")
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects STAFF with 403", async () => {
    const res = await request(app)
      .get("/api/attendance/all-attendance")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/attendance/all-attendance");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/attendance/:id/dismiss-alert", () => {
  // Issue 3 (accepted): dismissAlert is scoped to caller's own records.
  // HR/SUPERADMIN calling on a staff record gets 404 (not 403) — that is the accepted design.

  it("dismisses the caller's own alert and appends to remarks", async () => {
    // Use the staffAttendanceId created in the clock-in test (now CLOSED).
    const res = await request(app)
      .patch(`/api/attendance/${staffAttendanceId}/dismiss-alert`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 404 when HR tries to dismiss a STAFF record (issue 3 — accepted)", async () => {
    const res = await request(app)
      .patch(`/api/attendance/${staffAttendanceId}/dismiss-alert`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Record not found");
  });

  it("returns 404 when SUPERADMIN tries to dismiss a STAFF record (issue 3 — accepted)", async () => {
    const res = await request(app)
      .patch(`/api/attendance/${staffAttendanceId}/dismiss-alert`)
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Record not found");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).patch(`/api/attendance/${staffAttendanceId}/dismiss-alert`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-existent UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await request(app)
      .patch(`/api/attendance/${fakeId}/dismiss-alert`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(404);
  });
});
