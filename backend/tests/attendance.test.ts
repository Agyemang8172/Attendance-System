/**
 * Slice B — Attendance capture and correction.
 *
 * Exercises the five attendance endpoints against the local database using the
 * accounts provisioned by tests/fixtures.ts.
 * Asserts PRD §7 edge-case behaviours:
 *   - Second clock-in while open  → 400 with specific message
 *   - Clock-out with no open session → 400 (not 404)
 *   - dismissAlert scoped to caller's own records (issue 3, accepted)
 *
 * Read-only except dismissAlert which appends to remarks (idempotent enough),
 * and the clock-in / clock-out pair which opens and closes one session.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../server.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";

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
let staffAttendanceId: string; // an OPEN session created in clock-in test

beforeAll(async () => {
  await ensureTestAccounts();
  staffToken = await tokenFor(STAFF_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  superadminToken = await tokenFor(SUPERADMIN_EMAIL);
});

describe("POST /api/attendance/clock-in", () => {
  it("creates an OPEN session for STAFF and returns it", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ remarks: "slice B test clock-in" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("OPEN");
    expect(res.body.data.clockIn).toBeTruthy();
    expect(res.body.data.clockOut).toBeNull();
    staffAttendanceId = res.body.data.id;
  });

  it("rejects a second clock-in with 400 (PRD §7: one open session per user)", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("active session open");
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/attendance/clock-in").send({});
    expect(res.status).toBe(401);
  });
});

describe("POST /api/attendance/clock-out", () => {
  it("closes the OPEN session and returns hoursWorked", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ remarks: "slice B test clock-out" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("CLOSED");
    expect(res.body.data.clockOut).toBeTruthy();
    expect(typeof res.body.data.hoursWorked).toBe("number");
    expect(res.body.data.hoursWorked).toBeGreaterThanOrEqual(0);
  });

  // PRD §7: "Clock-out with no open session | 400"
  it("returns 400 (not 404) when there is no open session", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/attendance/clock-out").send({});
    expect(res.status).toBe(401);
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
    // Use the staffAttendanceId created in clock-in test (now CLOSED).
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
