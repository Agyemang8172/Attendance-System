/**
 * Shift CRUD — the SUPERADMIN scheduling foundation.
 *
 * Regression cover for M9-B2: `shiftController.createShift` wrote only the
 * minute-of-day pair, but the legacy `start_time` / `end_time` TEXT columns are
 * still NOT NULL in the database (even though the Prisma model marks them
 * optional). Every create therefore died with a not-null violation. The
 * controller now mirrors the minutes into the legacy columns on create and
 * update, and these tests hold that behaviour in place.
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
  if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status}`);
  return res.body.token as string;
}

let saToken: string;
let hrToken: string;
let staffToken: string;
let businessId: string;
const createdIds: string[] = [];

const uniqueName = (prefix: string) =>
  `${prefix} ${Date.now()}${Math.floor(Math.random() * 10000)}`;

beforeAll(async () => {
  await ensureTestAccounts();
  saToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);

  const staff = await prisma.user.findUnique({
    where: { email: STAFF_EMAIL },
    select: { businessId: true },
  });
  if (!staff) throw new Error("Fixture staff account missing");
  businessId = staff.businessId;
});

afterAll(async () => {
  // Only the rows this file created; shifts are soft-deleted in the product,
  // but a test database should not accumulate fixtures forever.
  if (createdIds.length) {
    await prisma.shift.deleteMany({ where: { id: { in: createdIds } } });
  }
});

const createShift = (token: string, body: Record<string, unknown>) =>
  request(app)
    .post("/api/business/shifts")
    .set("Authorization", `Bearer ${token}`)
    .send(body);

describe("POST /api/business/shifts", () => {
  it("creates a shift and mirrors the minutes into the legacy TEXT columns (M9-B2)", async () => {
    const name = uniqueName("Morning");
    const res = await createShift(saToken, {
      name,
      startMinute: 8 * 60,
      endMinute: 17 * 60,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.startMinute).toBe(480);
    expect(res.body.data.endMinute).toBe(1020);
    createdIds.push(res.body.data.id);

    // The NOT NULL legacy columns are the reason the create used to fail.
    const stored = await prisma.shift.findUnique({
      where: { id: res.body.data.id },
      select: { startTime: true, endTime: true },
    });
    expect(stored?.startTime).toBe("08:00");
    expect(stored?.endTime).toBe("17:00");
  });

  it("creates an overnight shift without a not-null violation", async () => {
    const res = await createShift(saToken, {
      name: uniqueName("Night"),
      startMinute: 22 * 60,
      endMinute: 6 * 60,
      crossesMidnight: true,
    });

    expect(res.status).toBe(201);
    createdIds.push(res.body.data.id);

    const stored = await prisma.shift.findUnique({
      where: { id: res.body.data.id },
      select: { startTime: true, endTime: true },
    });
    expect(stored?.startTime).toBe("22:00");
    expect(stored?.endTime).toBe("06:00");
  });

  it("rejects a geometry that contradicts crossesMidnight", async () => {
    const res = await createShift(saToken, {
      name: uniqueName("Bad"),
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      crossesMidnight: true,
    });

    expect(res.status).toBe(400);
  });

  it("refuses HR and STAFF (SUPERADMIN only)", async () => {
    const body = { name: uniqueName("Denied"), startMinute: 60, endMinute: 120 };
    expect((await createShift(hrToken, body)).status).toBe(403);
    expect((await createShift(staffToken, body)).status).toBe(403);
  });
});

describe("PATCH /api/business/shifts/:id", () => {
  it("updates the minutes and keeps the legacy columns in step", async () => {
    const created = await createShift(saToken, {
      name: uniqueName("Editable"),
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    });
    expect(created.status).toBe(201);
    createdIds.push(created.body.data.id);

    const res = await request(app)
      .patch(`/api/business/shifts/${created.body.data.id}`)
      .set("Authorization", `Bearer ${saToken}`)
      .send({ startMinute: 10 * 60, endMinute: 18 * 60 });

    expect(res.status).toBe(200);

    const stored = await prisma.shift.findUnique({
      where: { id: created.body.data.id },
      select: { startTime: true, endTime: true, startMinute: true, endMinute: true },
    });
    expect(stored).toMatchObject({
      startTime: "10:00",
      endTime: "18:00",
      startMinute: 600,
      endMinute: 1080,
    });
  });
});

describe("GET /api/business/shifts", () => {
  it("returns the business's shifts to HR and SUPERADMIN but not STAFF", async () => {
    expect(
      (await request(app).get("/api/business/shifts").set("Authorization", `Bearer ${hrToken}`)).status
    ).toBe(200);
    expect(
      (await request(app).get("/api/business/shifts").set("Authorization", `Bearer ${saToken}`)).status
    ).toBe(200);
    expect(
      (await request(app).get("/api/business/shifts").set("Authorization", `Bearer ${staffToken}`)).status
    ).toBe(403);
  });

  it("scopes the list to the caller's business", async () => {
    const res = await request(app)
      .get("/api/business/shifts")
      .set("Authorization", `Bearer ${saToken}`);

    expect(res.status).toBe(200);
    for (const shift of res.body.data as Array<{ businessId: string }>) {
      expect(shift.businessId).toBe(businessId);
    }
  });
});
