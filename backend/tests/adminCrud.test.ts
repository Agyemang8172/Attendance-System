/**
 * M9 Phase 1 — admin configuration CRUD.
 *
 * These four controllers were the largest untested block in the backend:
 *   /api/business/policies          workplace policies and versions
 *   /api/business/calendars         working weeks and calendar exceptions
 *   /api/sites                      geo-fenced sites
 *   /api/business/assignments       shift assignments
 *
 * They share the same tenant rules: SUPERADMIN writes, HR may read the
 * scheduling data, STAFF is refused. The tests exercise the happy path, the
 * role boundaries, validation failures and the conflict branches that the
 * controllers answer with 409/400 rather than 500.
 *
 * Every row created here is named with a run-specific suffix and removed in
 * `afterAll`; the shared default calendar and the fixture staff account are
 * restored rather than deleted.
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

const unique = (prefix: string) => `${prefix} ${Date.now()}${Math.floor(Math.random() * 10000)}`;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let saToken: string;
let hrToken: string;
let staffToken: string;
let businessId: string;
let staffUserId: string;
let staffOriginalShiftId: string | null;
let policiesAtStart = 0;

let calendarId: string;
let policyShiftId: string;
const policyIds: string[] = [];
const siteIds: string[] = [];
const shiftIds: string[] = [];
const assignmentIds: string[] = [];

beforeAll(async () => {
  await ensureTestAccounts();
  saToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);

  const staff = await prisma.user.findUnique({
    where: { email: STAFF_EMAIL },
    select: { id: true, businessId: true, shiftId: true },
  });
  if (!staff) throw new Error("Fixture STAFF account missing");
  staffUserId = staff.id;
  businessId = staff.businessId;
  staffOriginalShiftId = staff.shiftId;

  policiesAtStart = await prisma.workplacePolicy.count({ where: { businessId } });

  // The product has no create-calendar endpoint: every business is bootstrapped
  // with one. A second calendar is created directly so update and exception
  // tests do not rename or pollute the shared default.
  const calendar = await prisma.workCalendar.create({
    data: {
      businessId,
      name: unique("Test Calendar"),
      timezone: "UTC",
      isDefault: false,
    },
    select: { id: true },
  });
  calendarId = calendar.id;

  // A business may hold only one policy with a null shiftId (the default
  // policy). Additional policies are shift-specific, so every test after the
  // first needs a shift to attach to.
  const policyShift = await prisma.shift.create({
    data: {
      businessId,
      name: unique("Policy Shift"),
      startMinute: 8 * 60,
      endMinute: 17 * 60,
      startTime: "08:00",
      endTime: "17:00",
    },
    select: { id: true },
  });
  policyShiftId = policyShift.id;
  shiftIds.push(policyShift.id);
});

afterAll(async () => {
  if (assignmentIds.length) {
    await prisma.shiftAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  }
  if (staffUserId) {
    await prisma.user
      .update({ where: { id: staffUserId }, data: { shiftId: staffOriginalShiftId } })
      .catch(() => undefined);
  }
  // Policies reference the policy shift with onDelete: SetNull. Clearing the
  // reference on several policies at once would collide with the partial
  // unique index on (business_id) WHERE shift_id IS NULL, so delete policies
  // before their shift.
  if (policyIds.length) {
    await prisma.policyVersion.deleteMany({ where: { policyId: { in: policyIds } } });
    await prisma.workplacePolicy.deleteMany({ where: { id: { in: policyIds } } });
  }
  if (shiftIds.length) {
    await prisma.shift.deleteMany({ where: { id: { in: shiftIds } } });
  }
  if (siteIds.length) {
    await prisma.site.deleteMany({ where: { id: { in: siteIds } } });
  }
  if (calendarId) {
    await prisma.calendarException.deleteMany({ where: { calendarId } });
    await prisma.workCalendar.deleteMany({ where: { id: calendarId } });
  }
});

const createPolicy = (token: string, body: Record<string, unknown>) =>
  request(app).post("/api/business/policies").set(auth(token)).send(body);

const policyBody = (name: string, shiftId?: string) => ({
  name,
  ...(shiftId ? { shiftId } : {}),
  graceEarlyMinutes: 5,
  graceLateMinutes: 10,
  effectiveFrom: iso(0),
});

describe("Workplace policies", () => {
  it("creates a policy with version 1 and the first policy becomes the default", async () => {
    const name = unique("Test Policy");
    const res = await createPolicy(
      saToken,
      policiesAtStart === 0 ? policyBody(name) : policyBody(name, policyShiftId)
    );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version.versionNumber).toBe(1);
    expect(res.body.data.policy.businessId).toBe(businessId);
    if (policiesAtStart === 0) {
      expect(res.body.data.policy.isDefault).toBe(true);
    }
    policyIds.push(res.body.data.policy.id);
  });

  it("lists policies with their version history for SUPERADMIN only", async () => {
    const created = await createPolicy(saToken, policyBody(unique("Test Policy"), policyShiftId));
    expect(created.status).toBe(201);
    policyIds.push(created.body.data.policy.id);

    const res = await request(app).get("/api/business/policies").set(auth(saToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const listed = res.body.data.find(
      (policy: { id: string }) => policy.id === created.body.data.policy.id
    );
    expect(listed).toBeTruthy();
    expect(listed.versions).toHaveLength(1);
    expect(listed.versions[0].versionNumber).toBe(1);

    expect((await request(app).get("/api/business/policies").set(auth(hrToken))).status).toBe(403);
    expect((await request(app).get("/api/business/policies").set(auth(staffToken))).status).toBe(403);
  });

  it("refuses policy creation to HR and STAFF", async () => {
    const body = policyBody(unique("Test Policy"), policyShiftId);
    expect((await createPolicy(hrToken, body)).status).toBe(403);
    expect((await createPolicy(staffToken, body)).status).toBe(403);
  });

  it("rejects a duplicate policy name with 409", async () => {
    const name = unique("Test Policy");
    const first = await createPolicy(saToken, policyBody(name, policyShiftId));
    expect(first.status).toBe(201);
    policyIds.push(first.body.data.policy.id);

    const duplicate = await createPolicy(saToken, policyBody(name, policyShiftId));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.success).toBe(false);
  });

  it("closes the current version and opens the next one", async () => {
    const created = await createPolicy(saToken, policyBody(unique("Test Policy"), policyShiftId));
    expect(created.status).toBe(201);
    const policyId = created.body.data.policy.id;
    policyIds.push(policyId);

    const next = await request(app)
      .post(`/api/business/policies/${policyId}/versions`)
      .set(auth(saToken))
      .send({ graceLateMinutes: 15, effectiveFrom: iso(2) });

    expect(next.status).toBe(201);
    expect(next.body.data.version.versionNumber).toBe(2);

    const firstVersion = await prisma.policyVersion.findFirst({
      where: { policyId, versionNumber: 1 },
      select: { effectiveTo: true },
    });
    expect(firstVersion?.effectiveTo).not.toBeNull();
  });

  it("rejects a version that starts before the current one", async () => {
    const created = await createPolicy(saToken, policyBody(unique("Test Policy"), policyShiftId));
    expect(created.status).toBe(201);
    const policyId = created.body.data.policy.id;
    policyIds.push(policyId);

    const res = await request(app)
      .post(`/api/business/policies/${policyId}/versions`)
      .set(auth(saToken))
      .send({ graceLateMinutes: 20, effectiveFrom: iso(-1) });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the policy id is unknown", async () => {
    const res = await request(app)
      .post("/api/business/policies/00000000-0000-4000-8000-000000000099/versions")
      .set(auth(saToken))
      .send({ graceLateMinutes: 5, effectiveFrom: iso(1) });

    expect(res.status).toBe(404);
  });
});

describe("Work calendars", () => {
  it("lists calendars to SUPERADMIN and HR, but not STAFF", async () => {
    const sa = await request(app).get("/api/business/calendars").set(auth(saToken));
    expect(sa.status).toBe(200);
    expect(sa.body.data.some((calendar: { id: string }) => calendar.id === calendarId)).toBe(true);

    expect((await request(app).get("/api/business/calendars").set(auth(hrToken))).status).toBe(200);
    expect((await request(app).get("/api/business/calendars").set(auth(staffToken))).status).toBe(403);
  });

  it("updates the working week and timezone", async () => {
    const res = await request(app)
      .patch(`/api/business/calendars/${calendarId}`)
      .set(auth(saToken))
      .send({ name: unique("Test Calendar"), saturday: true, timezone: "Africa/Accra" });

    expect(res.status).toBe(200);
    expect(res.body.data.saturday).toBeUndefined(); // the select returns only id/name/isDefault/updatedAt

    const stored = await prisma.workCalendar.findUnique({
      where: { id: calendarId },
      select: { saturday: true, timezone: true },
    });
    expect(stored?.saturday).toBe(true);
    expect(stored?.timezone).toBe("Africa/Accra");
  });

  it("rejects an invalid IANA timezone and refuses HR writes", async () => {
    const bad = await request(app)
      .patch(`/api/business/calendars/${calendarId}`)
      .set(auth(saToken))
      .send({ timezone: "Not/AZone" });
    expect(bad.status).toBe(400);

    const hr = await request(app)
      .patch(`/api/business/calendars/${calendarId}`)
      .set(auth(hrToken))
      .send({ name: unique("Denied Calendar") });
    expect(hr.status).toBe(403);
  });

  it("returns 404 for an unknown calendar", async () => {
    const res = await request(app)
      .patch("/api/business/calendars/00000000-0000-4000-8000-000000000098")
      .set(auth(saToken))
      .send({ name: unique("Missing Calendar") });
    expect(res.status).toBe(404);
  });

  it("creates a holiday exception, refuses a duplicate and rejects impossible dates", async () => {
    const date = "2026-12-25";
    const created = await request(app)
      .post(`/api/business/calendars/${calendarId}/exceptions`)
      .set(auth(saToken))
      .send({ date, kind: "HOLIDAY", name: "Christmas" });

    expect(created.status).toBe(201);
    expect(created.body.data.date.startsWith(date)).toBe(true);

    const duplicate = await request(app)
      .post(`/api/business/calendars/${calendarId}/exceptions`)
      .set(auth(saToken))
      .send({ date, kind: "HOLIDAY", name: "Christmas again" });
    expect(duplicate.status).toBe(409);

    // Passes the YYYY-MM-DD regex but JavaScript would roll it into March.
    const rolled = await request(app)
      .post(`/api/business/calendars/${calendarId}/exceptions`)
      .set(auth(saToken))
      .send({ date: "2026-02-30", kind: "HOLIDAY", name: "Impossible" });
    expect(rolled.status).toBe(400);

    const malformed = await request(app)
      .post(`/api/business/calendars/${calendarId}/exceptions`)
      .set(auth(saToken))
      .send({ date: "2026-2-3", kind: "HOLIDAY", name: "Malformed" });
    expect(malformed.status).toBe(400);

    const hr = await request(app)
      .post(`/api/business/calendars/${calendarId}/exceptions`)
      .set(auth(hrToken))
      .send({ date: "2026-12-26", kind: "HOLIDAY", name: "Boxing Day" });
    expect(hr.status).toBe(403);
  });
});

describe("Sites", () => {
  it("creates a site with the policy radius and refuses a duplicate name", async () => {
    const name = unique("Test Site");
    const created = await request(app)
      .post("/api/sites")
      .set(auth(saToken))
      .send({ name, latitude: 5.6037, longitude: -0.187 });

    expect(created.status).toBe(201);
    expect(created.body.data.isActive).toBe(true);
    expect(created.body.data.radiusMeters).toBeGreaterThan(0);
    siteIds.push(created.body.data.id);

    const duplicate = await request(app)
      .post("/api/sites")
      .set(auth(saToken))
      .send({ name, latitude: 5.6037, longitude: -0.187 });
    expect(duplicate.status).toBe(409);
  });

  it("lists and filters sites for SUPERADMIN and HR, but not STAFF", async () => {
    const name = unique("Test Site");
    const created = await request(app)
      .post("/api/sites")
      .set(auth(saToken))
      .send({ name, latitude: 5.61, longitude: -0.19, radiusMeters: 200 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    siteIds.push(id);

    const active = await request(app).get("/api/sites?isActive=true").set(auth(hrToken));
    expect(active.status).toBe(200);
    expect(active.body.meta.total).toBeGreaterThan(0);
    expect(active.body.data.some((site: { id: string }) => site.id === id)).toBe(true);

    const inactive = await request(app).get("/api/sites?isActive=false").set(auth(hrToken));
    expect(inactive.body.data.some((site: { id: string }) => site.id === id)).toBe(false);

    expect((await request(app).get("/api/sites").set(auth(staffToken))).status).toBe(403);
    expect((await request(app).post("/api/sites").set(auth(hrToken)).send({ name: unique("Denied Site"), latitude: 0, longitude: 0 })).status).toBe(403);
  });

  it("updates and deactivates a site without deleting it", async () => {
    const created = await request(app)
      .post("/api/sites")
      .set(auth(saToken))
      .send({ name: unique("Test Site"), latitude: 5.62, longitude: -0.2 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    siteIds.push(id);

    const updated = await request(app)
      .patch(`/api/sites/${id}`)
      .set(auth(saToken))
      .send({ name: unique("Test Site"), latitude: 5.63, radiusMeters: 300 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.radiusMeters).toBe(300);

    const deactivated = await request(app).post(`/api/sites/${id}/deactivate`).set(auth(saToken));
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.isActive).toBe(false);

    const again = await request(app).post(`/api/sites/${id}/deactivate`).set(auth(saToken));
    expect(again.status).toBe(200);

    const stored = await prisma.site.findUnique({ where: { id }, select: { isActive: true } });
    expect(stored?.isActive).toBe(false);
  });

  it("returns 404 for an unknown site", async () => {
    const res = await request(app)
      .patch("/api/sites/00000000-0000-4000-8000-000000000097")
      .set(auth(saToken))
      .send({ name: unique("Missing Site") });
    expect(res.status).toBe(404);
  });
});

describe("Shift assignments", () => {
  it("assigns a staff member, closes the previous assignment and keeps the user pointer in sync", async () => {
    const shift = await request(app)
      .post("/api/business/shifts")
      .set(auth(saToken))
      .send({ name: unique("Assign Shift"), startMinute: 8 * 60, endMinute: 17 * 60 });
    expect(shift.status).toBe(201);
    const shiftId = shift.body.data.id;
    shiftIds.push(shiftId);

    const first = await request(app)
      .post(`/api/business/shifts/${shiftId}/assignments`)
      .set(auth(saToken))
      .send({ employeeId: staffUserId, effectiveFrom: iso(0) });
    expect(first.status).toBe(201);
    assignmentIds.push(first.body.data.id);

    const user = await prisma.user.findUnique({ where: { id: staffUserId }, select: { shiftId: true } });
    expect(user?.shiftId).toBe(shiftId);

    const second = await request(app)
      .post(`/api/business/shifts/${shiftId}/assignments`)
      .set(auth(saToken))
      .send({ employeeId: staffUserId, effectiveFrom: iso(1) });
    expect(second.status).toBe(201);
    assignmentIds.push(second.body.data.id);

    const previous = await prisma.shiftAssignment.findUnique({
      where: { id: first.body.data.id },
      select: { effectiveTo: true },
    });
    expect(previous?.effectiveTo).not.toBeNull();

    const listed = await request(app)
      .get(`/api/business/assignments?employeeId=${staffUserId}`)
      .set(auth(hrToken));
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((row: { id: string }) => row.id === second.body.data.id)).toBe(true);

    expect((await request(app).get("/api/business/assignments").set(auth(staffToken))).status).toBe(403);
  });

  it("soft-closes an assignment once and reports the second close", async () => {
    const shift = await request(app)
      .post("/api/business/shifts")
      .set(auth(saToken))
      .send({ name: unique("Close Shift"), startMinute: 9 * 60, endMinute: 18 * 60 });
    expect(shift.status).toBe(201);
    const shiftId = shift.body.data.id;
    shiftIds.push(shiftId);

    const created = await request(app)
      .post(`/api/business/shifts/${shiftId}/assignments`)
      .set(auth(saToken))
      .send({ employeeId: staffUserId, effectiveFrom: iso(2) });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    assignmentIds.push(id);

    const closed = await request(app).delete(`/api/business/assignments/${id}`).set(auth(saToken));
    expect(closed.status).toBe(200);
    expect(closed.body.data.effectiveTo).not.toBeNull();

    const again = await request(app).delete(`/api/business/assignments/${id}`).set(auth(saToken));
    expect(again.status).toBe(400);

    const missing = await request(app)
      .delete("/api/business/assignments/00000000-0000-4000-8000-000000000096")
      .set(auth(saToken));
    expect(missing.status).toBe(404);
  });

  it("rejects a non-UUID employee id before the controller runs", async () => {
    const shift = await request(app)
      .post("/api/business/shifts")
      .set(auth(saToken))
      .send({ name: unique("Reject Shift"), startMinute: 10 * 60, endMinute: 19 * 60 });
    expect(shift.status).toBe(201);
    shiftIds.push(shift.body.data.id);

    const res = await request(app)
      .post(`/api/business/shifts/${shift.body.data.id}/assignments`)
      .set(auth(saToken))
      .send({ employeeId: "not-a-uuid", effectiveFrom: iso(0) });
    expect(res.status).toBe(400);
  });
});
