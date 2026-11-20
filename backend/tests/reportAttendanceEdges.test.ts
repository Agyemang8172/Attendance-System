/**
 * M9 Phase 1 — attendance list and report read filters.
 *
 * Both lanes have wide query surfaces that the existing tests only touch at
 * the default. This file walks the branches: each date-bound variant, the
 * optional employee/shift/status/department filters, the three punctuality
 * groupings, and the CSV export's optional filters. It reads only; nothing is
 * created or mutated.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import app from "../server.js";
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
const RANGE = "startDate=2026-10-01&endDate=2026-10-31";

let hrToken: string;
let staffToken: string;
let staffId: string;

beforeAll(async () => {
  await ensureTestAccounts();
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);

  const staff = await request(app)
    .get(`/api/users?search=${encodeURIComponent(STAFF_EMAIL)}`)
    .set(auth(await tokenFor(SUPERADMIN_EMAIL)));
  staffId = staff.body.data[0]?.id;
  if (!staffId) throw new Error("Fixture staff account missing");
});

describe("GET /api/attendance/my-attendance filters", () => {
  it("returns the default page without a date bound", async () => {
    const res = await request(app).get("/api/attendance/my-attendance").set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.page).toBe(1);
  });

  it("accepts a start-only, an end-only and a bounded range", async () => {
    const start = await request(app)
      .get("/api/attendance/my-attendance?startDate=2026-10-01T00:00:00.000Z")
      .set(auth(staffToken));
    expect(start.status).toBe(200);

    const end = await request(app)
      .get("/api/attendance/my-attendance?endDate=2026-10-31T23:59:59.000Z")
      .set(auth(staffToken));
    expect(end.status).toBe(200);

    const both = await request(app)
      .get(
        "/api/attendance/my-attendance?startDate=2026-10-01T00:00:00.000Z&endDate=2026-10-31T23:59:59.000Z&page=1&limit=5"
      )
      .set(auth(staffToken));
    expect(both.status).toBe(200);
    expect(both.body.page).toBe(1);
  });

  it("refuses the HR lane to STAFF", async () => {
    const res = await request(app).get("/api/attendance/all-attendance").set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/attendance/all-attendance filters", () => {
  it("returns the unfiltered page", async () => {
    const res = await request(app).get("/api/attendance/all-attendance").set(auth(hrToken));
    expect(res.status).toBe(200);
  });

  it("applies each optional filter", async () => {
    const byUser = await request(app)
      .get(`/api/attendance/all-attendance?userId=${staffId}`)
      .set(auth(hrToken));
    expect(byUser.status).toBe(200);

    const byDepartment = await request(app)
      .get("/api/attendance/all-attendance?department=Testing")
      .set(auth(hrToken));
    expect(byDepartment.status).toBe(200);

    const byState = await request(app)
      .get("/api/attendance/all-attendance?sessionStatus=OPEN&status=ON_TIME")
      .set(auth(hrToken));
    expect(byState.status).toBe(200);
  });

  it("accepts each date-bound variant", async () => {
    const start = await request(app)
      .get("/api/attendance/all-attendance?startDate=2026-10-01T00:00:00.000Z")
      .set(auth(hrToken));
    expect(start.status).toBe(200);

    const end = await request(app)
      .get("/api/attendance/all-attendance?endDate=2026-10-31T23:59:59.000Z")
      .set(auth(hrToken));
    expect(end.status).toBe(200);

    const both = await request(app)
      .get(
        "/api/attendance/all-attendance?startDate=2026-10-01T00:00:00.000Z&endDate=2026-10-31T23:59:59.000Z&page=1&limit=5"
      )
      .set(auth(hrToken));
    expect(both.status).toBe(200);
  });
});

describe("PATCH /api/attendance/:id/dismiss-alert", () => {
  it("returns 404 for a record the caller does not own", async () => {
    const res = await request(app)
      .patch(`/api/attendance/${randomUUID()}/dismiss-alert`)
      .set(auth(staffToken));
    expect(res.status).toBe(404);
  });
});

describe("Report read filters", () => {
  it("returns the attendance register with and without optional filters", async () => {
    const plain = await request(app)
      .get(`/api/reports/attendance-register?${RANGE}`)
      .set(auth(hrToken));
    expect(plain.status).toBe(200);

    const filtered = await request(app)
      .get(
        `/api/reports/attendance-register?${RANGE}&employeeId=${staffId}&shiftId=${randomUUID()}&page=1&limit=5`
      )
      .set(auth(hrToken));
    expect(filtered.status).toBe(200);
    expect(filtered.body.pagination.currentPage).toBe(1);
  });

  it("returns each punctuality grouping", async () => {
    for (const groupBy of ["employee", "shift", "day"]) {
      const res = await request(app)
        .get(`/api/reports/punctuality-summary?${RANGE}&groupBy=${groupBy}`)
        .set(auth(hrToken));
      expect(res.status).toBe(200);
      expect(res.body.data.groupBy).toBe(groupBy);
    }
  });

  it("returns the exceptions report", async () => {
    const res = await request(app).get(`/api/reports/exceptions?${RANGE}`).set(auth(hrToken));
    expect(res.status).toBe(200);
  });

  it("streams the CSV export with optional filters and refuses another format", async () => {
    const csv = await request(app)
      .get(
        `/api/reports/attendance-register/export?${RANGE}&employeeId=${staffId}&shiftId=${randomUUID()}&format=csv`
      )
      .set(auth(hrToken));
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);

    const bad = await request(app)
      .get(`/api/reports/attendance-register/export?${RANGE}&format=xlsx`)
      .set(auth(hrToken));
    expect(bad.status).toBe(400);
  });

  it("keeps reports off the STAFF role", async () => {
    const res = await request(app).get(`/api/reports/attendance-register?${RANGE}`).set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});
