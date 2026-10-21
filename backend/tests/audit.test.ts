/**
 * M9 Phase 1 — audit controller (`auditController.ts`, contracts §11).
 *
 * The only route is the correction trail:
 *   GET /api/audit/corrections/:attendanceId   HR, SUPERADMIN
 *
 * It assembles one attendance record's corrections, each with its append-only
 * revisions (`attendanceCorrectionRevisions`) and the correction audit rows
 * (`audits`) inside it. The trail below is driven through the real submit and
 * decision endpoints, so the rows read back are the ones production wrote.
 *
 * ── M9-B3 (resolved): the M8-R4 generic listing was absent ──────────────────
 * The M8-R4 decision ("Build the listing endpoint": tenant-scoped, paginated,
 * filterable by action/entity) and M1-ROLE-PERMISSION-MATRIX rows 246-248 both
 * name `GET /api/audit`, but M8 shipped without it: the HR audit-history screen
 * and the SUPERADMIN audit-log screen reusing it received a 404. M9 added the
 * route (`listAudit` + `getAuditById`), so the last describe now asserts the
 * real contract instead of characterising its absence.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const utcMidnight = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const todayUtc = (): Date => utcMidnight(new Date());
const daysAgo = (days: number): Date => new Date(todayUtc().getTime() - days * MS_PER_DAY);
const dayAtHour = (date: Date, hour: number): Date =>
  new Date(date.getTime() + hour * 60 * 60 * 1000);

const uniqueEmail = (prefix: string): string =>
  `${prefix}.${Date.now()}${Math.floor(Math.random() * 1000)}@test.attendpro.com`;

async function tokenFor(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

async function seedAttendance(overrides: {
  userId: string;
  businessId: string;
  date: Date;
  clockOut?: Date | null;
}) {
  const clockIn = dayAtHour(overrides.date, 9);
  const clockOut =
    overrides.clockOut === undefined ? dayAtHour(overrides.date, 17) : overrides.clockOut;
  return prisma.attendance.create({
    data: {
      businessId: overrides.businessId,
      userId: overrides.userId,
      date: overrides.date,
      clockIn,
      clockOut,
      sessionStatus: "CLOSED",
      status: "ON_TIME",
      hoursWorked: clockOut ? (clockOut.getTime() - clockIn.getTime()) / (60 * 60 * 1000) : 0,
      shiftNameSnapshot: "M9 Audit Shift",
      shiftStartMinuteSnapshot: 9 * 60,
      shiftEndMinuteSnapshot: 17 * 60,
      shiftCrossesMidnightSnapshot: false,
    },
    select: { id: true },
  });
}

async function submitCorrection(
  token: string,
  body: { attendanceId: string; reason: string; proposedClockOut?: string }
) {
  return request(app)
    .post("/api/attendance/corrections")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

async function decide(token: string, id: string, body: Record<string, unknown>) {
  return request(app)
    .patch(`/api/hr/corrections/${id}/decision`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

const getTrail = (token: string, attendanceId: string) =>
  request(app)
    .get(`/api/audit/corrections/${attendanceId}`)
    .set("Authorization", `Bearer ${token}`);

/** The M8-R4 generic listing: designed, advertised, and (M9-B3) absent. */
const getAudit = (token?: string) => {
  const call = request(app).get("/api/audit");
  return token ? call.set("Authorization", `Bearer ${token}`) : call;
};

let businessId: string;
let staffId: string;
let staffToken: string;
let hrToken: string;
let saToken: string;

beforeAll(async () => {
  await ensureTestAccounts();
  const staff = await prisma.user.findUnique({
    where: { email: STAFF_EMAIL },
    select: { id: true, businessId: true },
  });
  if (!staff) throw new Error("Fixture staff account missing");
  businessId = staff.businessId;
  staffId = staff.id;

  staffToken = await tokenFor(STAFF_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  saToken = await tokenFor(SUPERADMIN_EMAIL);
});

describe("GET /api/audit/corrections/:attendanceId — the trail", () => {
  it("returns the correction with its revisions and audit rows for HR", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const submitted = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Wrong clock-out",
      proposedClockOut: dayAtHour(todayUtc(), 18).toISOString(),
    });
    expect(submitted.status).toBe(201);
    const corrected = await decide(hrToken, submitted.body.data.id, { decision: "APPROVED" });
    expect(corrected.status).toBe(200);

    const res = await getTrail(hrToken, attendance.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const trail = res.body.data[0] as {
      id: string;
      status: string;
      attendanceCorrectionRevisions: Array<{ revisionNo: number; action: string }>;
      audits: Array<{ action: string; actorType: string }>;
    };
    expect(trail.id).toBe(submitted.body.data.id);
    expect(trail.status).toBe("APPROVED");

    expect(trail.attendanceCorrectionRevisions).toHaveLength(2);
    expect(trail.attendanceCorrectionRevisions[0]).toMatchObject({
      revisionNo: 1,
      action: "PROPOSED",
    });
    expect(trail.attendanceCorrectionRevisions[1]).toMatchObject({
      revisionNo: 2,
      action: "APPLIED",
    });

    const actions = trail.audits.map((row) => row.action);
    expect(actions).toContain("correction.submitted");
    expect(actions).toContain("correction.decided");
  });

  it("includes the backstop and escalation audit rows on a SUPERADMIN backstop decision", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: daysAgo(2) });
    const submitted = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Escalated backstop trail",
    });
    expect(submitted.body.data.reviewTier).toBe("ESCALATED");

    const decided = await decide(saToken, submitted.body.data.id, {
      decision: "APPROVED",
      backstopCondition: "EXPLICIT_HANDOFF",
      backstopReason: "requester asked supervised",
    });
    expect(decided.status).toBe(200);

    const res = await getTrail(saToken, attendance.id);
    expect(res.status).toBe(200);
    const actions = (res.body.data[0].audits as Array<{ action: string }>).map((row) => row.action);
    expect(actions).toContain("correction.submitted");
    expect(actions).toContain("correction.decided.backstop");
    expect(actions).toContain("correction.escalated");
  });

  it("returns an empty array for an attendance row with no corrections", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const res = await getTrail(hrToken, attendance.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 404 for an unknown id and a cross-business id, 400 for a malformed id", async () => {
    const unknown = await getTrail(hrToken, "00000000-0000-4000-8000-0000000000ff");
    expect(unknown.status).toBe(404);

    const otherBusiness = await prisma.business.create({
      data: { name: "M9 Audit Other", slug: `m9-audit-other-${Date.now()}` },
      select: { id: true },
    });
    const otherUser = await prisma.user.create({
      data: {
        businessId: otherBusiness.id,
        employeeCode: `M9-AUD-${Date.now()}`,
        firstName: "Other",
        lastName: "Tenant",
        email: uniqueEmail("m9.audit.other"),
        password: await bcrypt.hash(TEST_PASSWORD, 12),
        role: "STAFF",
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    const foreign = await seedAttendance({
      userId: otherUser.id,
      businessId: otherBusiness.id,
      date: todayUtc(),
    });
    const crossTenant = await getTrail(hrToken, foreign.id);
    expect(crossTenant.status).toBe(404);

    const malformed = await getTrail(hrToken, "not-a-uuid");
    expect(malformed.status).toBe(400);
  });

  it("refuses STAFF with 403 and an anonymous caller with 401", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const asStaff = await getTrail(staffToken, attendance.id);
    expect(asStaff.status).toBe(403);

    const anon = await request(app).get(`/api/audit/corrections/${attendance.id}`);
    expect(anon.status).toBe(401);
  });
});

describe("GET /api/audit — the M8-R4 generic listing", () => {
  // M9-B3 fixed: the route exists, is auth-gated, and tenant-scoped. An
  // anonymous caller is refused before any row is read.
  it("refuses an anonymous caller with 401", async () => {
    expect((await getAudit()).status).toBe(401);
  });

  it("lists the caller's business audit rows, paginated [M9-B3]", async () => {
    const res = await getAudit(hrToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeTruthy();
    expect(typeof res.body.pagination.currentPage).toBe("number");
    // The rows are this tenant's only.
    for (const row of res.body.data as Array<{ businessId?: string }>) {
      if (row.businessId !== undefined) expect(row.businessId).toBe(businessId);
    }
  });
});
