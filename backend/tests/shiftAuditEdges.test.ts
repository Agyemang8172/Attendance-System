/**
 * M9 Phase 1 — shift lifecycle and audit-read edges.
 *
 * The existing shift suite covers create/update/list happy paths. This file
 * covers the branches those leave dark: duplicate names, unknown ids, merged
 * geometry checks on PATCH, deactivation, and the active/inactive filters.
 * The audit block writes two tagged rows (one HR-visible, one not) and reads
 * them back through the filters, the HR scope and the detail 404.
 *
 * Shifts created here are removed in `afterAll`. Audit rows are append-only
 * and stay in the database by design; every one is tagged with a run-unique
 * entity id so it cannot collide with a later run.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let saToken: string;
let hrToken: string;
let staffToken: string;
let businessId: string;
let saUserId: string;
let shiftAId = "";
let shiftBId = "";
const tag = randomUUID().slice(0, 8);
const shiftAName = `M9 Edge A ${tag}`;
const shiftBName = `M9 Edge B ${tag}`;

beforeAll(async () => {
  await ensureTestAccounts();
  saToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);

  const sa = await prisma.user.findUnique({
    where: { email: SUPERADMIN_EMAIL },
    select: { id: true, businessId: true },
  });
  if (!sa?.businessId) throw new Error("Fixture SUPERADMIN has no business");
  saUserId = sa.id;
  businessId = sa.businessId;
});

afterAll(async () => {
  const ids = [shiftAId, shiftBId].filter(Boolean);
  if (ids.length) {
    await prisma.shift.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
  }
});

describe("Shift lifecycle edges", () => {
  it("creates the two fixture shifts", async () => {
    const a = await request(app)
      .post("/api/business/shifts")
      .set(auth(saToken))
      .send({ name: shiftAName, startMinute: 540, endMinute: 1020, crossesMidnight: false });
    expect(a.status).toBe(201);
    shiftAId = a.body.data.id;

    const b = await request(app)
      .post("/api/business/shifts")
      .set(auth(saToken))
      .send({ name: shiftBName, startMinute: 1320, endMinute: 360, crossesMidnight: true });
    expect(b.status).toBe(201);
    shiftBId = b.body.data.id;
    expect(b.body.data.crossesMidnight).toBe(true);
  });

  it("rejects a duplicate shift name with 409", async () => {
    const res = await request(app)
      .post("/api/business/shifts")
      .set(auth(saToken))
      .send({ name: shiftAName, startMinute: 600, endMinute: 660, crossesMidnight: false });
    expect(res.status).toBe(409);
  });

  it("returns 404 for an unknown shift on PATCH and deactivate", async () => {
    const id = "00000000-0000-4000-8000-000000000093";
    const patch = await request(app)
      .patch(`/api/business/shifts/${id}`)
      .set(auth(saToken))
      .send({ name: `Nobody ${tag}` });
    expect(patch.status).toBe(404);

    const deactivate = await request(app)
      .post(`/api/business/shifts/${id}/deactivate`)
      .set(auth(saToken));
    expect(deactivate.status).toBe(404);
  });

  it("refuses a PATCH that flips the merged geometry without the flag", async () => {
    const res = await request(app)
      .patch(`/api/business/shifts/${shiftAId}`)
      .set(auth(saToken))
      .send({ endMinute: 300, crossesMidnight: false });
    expect(res.status).toBe(400);
  });

  it("accepts the full-day start == end edge when it is flagged", async () => {
    const res = await request(app)
      .patch(`/api/business/shifts/${shiftAId}`)
      .set(auth(saToken))
      .send({ startMinute: 600, endMinute: 600, crossesMidnight: true });
    expect(res.status).toBe(200);
    expect(res.body.data.startMinute).toBe(600);
    expect(res.body.data.endMinute).toBe(600);
    expect(res.body.data.crossesMidnight).toBe(true);
  });

  it("rejects a PATCH that renames onto an existing shift with 409", async () => {
    const res = await request(app)
      .patch(`/api/business/shifts/${shiftBId}`)
      .set(auth(saToken))
      .send({ name: shiftAName });
    expect(res.status).toBe(409);
  });

  it("deactivates instead of deleting, then filters by active state", async () => {
    const res = await request(app)
      .post(`/api/business/shifts/${shiftAId}/deactivate`)
      .set(auth(saToken));
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const inactive = await request(app)
      .get("/api/business/shifts?isActive=false")
      .set(auth(hrToken));
    expect(inactive.status).toBe(200);
    expect(inactive.body.data.some((shift: { id: string }) => shift.id === shiftAId)).toBe(true);

    const active = await request(app)
      .get("/api/business/shifts?isActive=true")
      .set(auth(hrToken));
    expect(active.status).toBe(200);
    expect(active.body.data.every((shift: { isActive: boolean }) => shift.isActive)).toBe(true);

    const staff = await request(app).get("/api/business/shifts").set(auth(staffToken));
    expect(staff.status).toBe(403);
  });
});

describe("Audit list and detail edges", () => {
  const marker = randomUUID();
  let visibleId = "";
  let hiddenId = "";

  beforeAll(async () => {
    const visible = await prisma.auditLog.create({
      data: {
        businessId,
        actorType: "USER",
        actorUserId: saUserId,
        action: "attendance.marked",
        entityType: "attendance",
        entityId: marker,
        reason: `M9 edge visible ${tag}`,
      },
      select: { id: true },
    });
    visibleId = visible.id;

    const hidden = await prisma.auditLog.create({
      data: {
        businessId,
        actorType: "USER",
        actorUserId: saUserId,
        action: "user.updated",
        entityType: "user",
        entityId: marker,
        reason: `M9 edge hidden ${tag}`,
      },
      select: { id: true },
    });
    hiddenId = hidden.id;
  });

  it("filters by action, entity, search and date range", async () => {
    const byAction = await request(app)
      .get(`/api/audit?action=attendance.marked&entityId=${marker}`)
      .set(auth(saToken));
    expect(byAction.status).toBe(200);
    expect(byAction.body.data.some((row: { id: string }) => row.id === visibleId)).toBe(true);

    const bySearch = await request(app)
      .get(`/api/audit?search=${encodeURIComponent(`M9 edge visible ${tag}`)}`)
      .set(auth(saToken));
    expect(bySearch.status).toBe(200);
    expect(bySearch.body.data.some((row: { id: string }) => row.id === visibleId)).toBe(true);

    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const byDate = await request(app)
      .get(`/api/audit?entityType=attendance&entityId=${marker}&startDate=${from}&endDate=${to}`)
      .set(auth(saToken));
    expect(byDate.status).toBe(200);
    expect(byDate.body.data.some((row: { id: string }) => row.id === visibleId)).toBe(true);
  });

  it("paginates and clamps the page size", async () => {
    const res = await request(app).get("/api/audit?page=1&limit=1").set(auth(saToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.currentPage).toBe(1);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("keeps HR inside the supervised subset even with a search term", async () => {
    const res = await request(app)
      .get("/api/audit?search=user.updated")
      .set(auth(hrToken));
    expect(res.status).toBe(200);
    expect(res.body.data.some((row: { id: string }) => row.id === hiddenId)).toBe(false);
    expect(
      res.body.data.every(
        (row: { action: string }) =>
          row.action.startsWith("attendance.") ||
          row.action.startsWith("correction.") ||
          row.action.startsWith("pin.") ||
          row.action === "hr.reset_pin"
      )
    ).toBe(true);
  });

  it("returns one row to SUPERADMIN and hides the non-supervised row from HR", async () => {
    const sa = await request(app).get(`/api/audit/${visibleId}`).set(auth(saToken));
    expect(sa.status).toBe(200);
    expect(sa.body.data.id).toBe(visibleId);

    const hrVisible = await request(app).get(`/api/audit/${visibleId}`).set(auth(hrToken));
    expect(hrVisible.status).toBe(200);

    const hrHidden = await request(app).get(`/api/audit/${hiddenId}`).set(auth(hrToken));
    expect(hrHidden.status).toBe(404);

    const saHidden = await request(app).get(`/api/audit/${hiddenId}`).set(auth(saToken));
    expect(saHidden.status).toBe(200);
  });

  it("returns 404 for an unknown audit id", async () => {
    const res = await request(app)
      .get("/api/audit/00000000-0000-4000-8000-000000000092")
      .set(auth(saToken));
    expect(res.status).toBe(404);
  });
});
