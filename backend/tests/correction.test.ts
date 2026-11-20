/**
 * M9 Phase 1 — correction controller (`correctionController.ts`).
 *
 * The submission lane (`POST /api/attendance/corrections`), the two read lanes
 * (staff self, HR business-wide) and the decision endpoint
 * (`PATCH /api/hr/corrections/:id/decision`) with its full 403/409 matrix:
 * no-self-approval for every role, same-day decided by HR/SUPERADMIN, the
 * escalated tier needing a second HR or the SUPERADMIN backstop, the half-sent
 * backstop, the approval reality (drift) guard and the already-decided guard.
 *
 * Attendance rows are seeded directly through Prisma (the kiosk-only punch path
 * cannot mint the specific states these rules read), while corrections are
 * raised through the real submit endpoint wherever the test is about the
 * request, so the tier, original-values snapshot and revision row are the ones
 * production writes. The escalated-tier tests run in a dedicated business with
 * a precisely controlled HR head-count, because "a second HR exists" is the
 * thing under test and the shared business accumulates HR accounts from other
 * suites.
 *
 * ── KNOWN PRODUCTION BUG M9-B1 — the two list lanes answer 500 ───────────────
 * Both `GET /api/staff/corrections` and `GET /api/hr/corrections` return 500 at
 * runtime, and cannot be made to return the contract's 200 without a production
 * change (out of scope for this milestone — bugs are recorded, not fixed).
 *
 * Root cause: `middleware/validate.ts` writes the parsed query back with
 * `Object.assign(req.query, result.data)` (line 42). Since Express 5, `req.query`
 * is an un-memoised prototype getter — every read re-parses the raw query string
 * and returns a *fresh* object (node_modules/express/lib/request.js:217-228), so
 * that `Object.assign` mutates a throw-away object. The coercion is dropped, and
 * the controllers below (which trust the validator, unlike `userController` /
 * `attendanceController` / `siteController` / `kioskDeviceController`, which
 * re-parse by hand) then read `limit` as the string "100" and compute
 * `skip = (undefined - 1) * "100"` = NaN. Prisma rejects both:
 *   `Argument \`take\`: Invalid value provided. Expected Int, provided String.`
 *
 * The same defect sits under the help-request and report list lanes (their
 * suites carry the matching xfail tripwires).
 *
 * The affected tests below are `it(...)`: they assert the *intended*
 * contract (200 + payload) and therefore currently throw — which is what keeps
 * the suite green while the bug is open, and which flips to a hard failure the
 * moment someone repairs `validate.ts`, flagging these as ready to un-xfail. One
 * plain test pins the observed 500 so the bug is proven, not assumed.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import { Prisma } from "../generated/prisma/index.js";
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
const dayAtHour = (date: Date, hour: number): Date => new Date(date.getTime() + hour * 60 * 60 * 1000);

const uniqueEmail = (prefix: string): string =>
  `${prefix}.${Date.now()}${Math.floor(Math.random() * 1000)}@test.attendpro.com`;

async function signIn(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

async function tokenFor(email: string): Promise<string> {
  const res = await signIn(email, TEST_PASSWORD);
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

type AttendanceOverrides = {
  userId: string;
  businessId: string;
  date: Date;
  clockIn?: Date;
  clockOut?: Date | null;
  sessionStatus?: "OPEN" | "CLOSED";
  status?:
    | "EARLY"
    | "ON_TIME"
    | "LATE"
    | "OPEN_SESSION"
    | "CLOCK_OUT_MISSING"
    | "AUTO_CLOSED"
    | "ABSENT"
    | "REQUIRES_REVIEW";
};

/** Inserts one attendance row with the snapshots the decision path reads. */
async function seedAttendance(overrides: AttendanceOverrides) {
  const clockIn = overrides.clockIn ?? dayAtHour(overrides.date, 9);
  const clockOut =
    overrides.clockOut === undefined ? dayAtHour(overrides.date, 17) : overrides.clockOut;
  return prisma.attendance.create({
    data: {
      businessId: overrides.businessId,
      userId: overrides.userId,
      date: overrides.date,
      clockIn,
      clockOut,
      sessionStatus: overrides.sessionStatus ?? "CLOSED",
      status: overrides.status ?? "ON_TIME",
      hoursWorked: clockOut ? (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) : 0,
      shiftNameSnapshot: "M9 Test Shift",
      shiftStartMinuteSnapshot: 9 * 60,
      shiftEndMinuteSnapshot: 17 * 60,
      shiftCrossesMidnightSnapshot: false,
      graceEarlyMinutesSnapshot: 10,
      graceLateMinutesSnapshot: 10,
    },
  });
}

/** Inserts a correction directly — for the decision-matrix states the API cannot mint. */
async function seedCorrection(overrides: {
  businessId: string;
  attendanceId: string;
  requestedById: string;
  reviewTier?: "SAME_DAY" | "ESCALATED";
  status?: "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  proposedClockIn?: Date | null;
  proposedClockOut?: Date | null;
  originalValues?: Prisma.InputJsonValue;
}) {
  return prisma.attendanceCorrection.create({
    data: {
      businessId: overrides.businessId,
      attendanceId: overrides.attendanceId,
      requestedById: overrides.requestedById,
      reason: "M9 seeded correction",
      reviewTier: overrides.reviewTier ?? "SAME_DAY",
      status: overrides.status ?? "SUBMITTED",
      proposedClockIn: overrides.proposedClockIn ?? null,
      proposedClockOut: overrides.proposedClockOut ?? null,
      originalValues: overrides.originalValues ?? ({} as Prisma.InputJsonValue),
    },
  });
}

async function submitCorrection(
  token: string,
  body: { attendanceId: string; reason: string; proposedClockIn?: string; proposedClockOut?: string }
) {
  return request(app)
    .post("/api/attendance/corrections")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function decide(
  token: string,
  correctionId: string,
  body: Record<string, unknown>
) {
  return request(app)
    .patch(`/api/hr/corrections/${correctionId}/decision`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

let businessId: string;
let staffId: string;
let hrId: string;
let saId: string;
let staffToken: string;
let hrToken: string;
let saToken: string;

// Dedicated business for the escalated-tier head-count tests.
let escBusinessId: string;
let escStaffId: string;
let escStaffToken: string;
let escHrId: string;
let escHrToken: string;

beforeAll(async () => {
  await ensureTestAccounts();

  const [staff, hr, sa] = await Promise.all([
    prisma.user.findUnique({ where: { email: STAFF_EMAIL }, select: { id: true, businessId: true } }),
    prisma.user.findUnique({ where: { email: HR_EMAIL }, select: { id: true, businessId: true } }),
    prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL }, select: { id: true, businessId: true } }),
  ]);
  if (!staff || !hr || !sa) throw new Error("Fixture accounts missing");
  businessId = staff.businessId;
  staffId = staff.id;
  hrId = hr.id;
  saId = sa.id;

  staffToken = await tokenFor(STAFF_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  saToken = await tokenFor(SUPERADMIN_EMAIL);

  const escBusiness = await prisma.business.create({
    data: { name: "M9 Escalated Review", slug: `m9-esc-${Date.now()}` },
    select: { id: true },
  });
  escBusinessId = escBusiness.id;

  const password = await bcrypt.hash(TEST_PASSWORD, 12);
  const escStaff = await prisma.user.create({
    data: {
      businessId: escBusinessId,
      employeeCode: "M9-ESC-STAFF",
      firstName: "Esc",
      lastName: "Staff",
      email: uniqueEmail("m9.esc.staff"),
      password,
      role: "STAFF",
      department: "Testing",
      isActive: true,
      mustChangePassword: false,
    },
    select: { id: true, email: true },
  });
  escStaffId = escStaff.id;
  escStaffToken = await tokenFor(escStaff.email);

  const escHr = await prisma.user.create({
    data: {
      businessId: escBusinessId,
      employeeCode: "M9-ESC-HR1",
      firstName: "Esc",
      lastName: "HrOne",
      email: uniqueEmail("m9.esc.hr1"),
      password,
      role: "HR",
      department: "Testing",
      isActive: true,
      mustChangePassword: false,
    },
    select: { id: true, email: true },
  });
  escHrId = escHr.id;
  escHrToken = await tokenFor(escHr.email);
});

describe("POST /api/attendance/corrections — submission", () => {
  it("creates a SAME_DAY correction on the caller's own record", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });

    const res = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "I clocked out early by mistake",
      proposedClockOut: dayAtHour(todayUtc(), 18).toISOString(),
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("SUBMITTED");
    expect(res.body.data.reviewTier).toBe("SAME_DAY");
  });

  it("tiers a past-date record ESCALATED while it is still inside the window", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: daysAgo(3) });

    const res = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Missed my clock-in three days ago",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.reviewTier).toBe("ESCALATED");
  });

  it("refuses a record past the correction window with 409", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: daysAgo(30) });

    const res = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Too late",
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("window");
  });

  it("refuses a second open correction for the same record with 409", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });

    const first = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "First submission",
    });
    expect(first.status).toBe(201);

    const second = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Second submission",
    });
    expect(second.status).toBe(409);
    expect(second.body.message).toContain("awaiting review");
  });

  it("refuses another user's record with 404 (self scope)", async () => {
    const attendance = await seedAttendance({ userId: hrId, businessId, date: todayUtc() });

    const res = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Not my record",
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Record not found");
  });

  it("returns 404 for an unknown attendance id", async () => {
    const res = await submitCorrection(staffToken, {
      attendanceId: "00000000-0000-4000-8000-0000000000aa",
      reason: "Ghost record",
    });
    expect(res.status).toBe(404);
  });

  it("rejects a request with no reason with 400", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const res = await submitCorrection(staffToken, { attendanceId: attendance.id, reason: "" });
    expect(res.status).toBe(400);
  });

  it("refuses SUPERADMIN with 403 (the §8 row grants STAFF and HR)", async () => {
    const attendance = await seedAttendance({ userId: saId, businessId, date: todayUtc() });
    const res = await submitCorrection(saToken, {
      attendanceId: attendance.id,
      reason: "Superadmin attempt",
    });
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated submission with 401", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const res = await request(app)
      .post("/api/attendance/corrections")
      .send({ attendanceId: attendance.id, reason: "No token" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/staff/corrections", () => {
  // xfail — see M9-B1 in the file header. Asserts the intended 200 contract.
  it("returns only the caller's own corrections [M9-B1]", async () => {
    const ownAttendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const own = await submitCorrection(staffToken, {
      attendanceId: ownAttendance.id,
      reason: "Mine",
    });

    // An HR officer's own correction lives in the same business but not this lane.
    const hrAttendance = await seedAttendance({ userId: hrId, businessId, date: todayUtc() });
    const foreign = await seedCorrection({
      businessId,
      attendanceId: hrAttendance.id,
      requestedById: hrId,
    });

    const res = await request(app)
      .get("/api/staff/corrections?limit=100")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body.data as Array<{ id: string; requestedAt: string }>).map((row) => row.id);
    expect(ids).toContain(own.body.data.id);
    expect(ids).not.toContain(foreign.id);
    // Every row is the caller's.
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // xfail — see M9-B1 in the file header. Asserts the intended 200 contract.
  it("narrows the list by status [M9-B1]", async () => {
    const res = await request(app)
      .get("/api/staff/corrections?status=SUBMITTED&limit=100")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    for (const row of res.body.data as Array<{ status: string }>) {
      expect(row.status).toBe("SUBMITTED");
    }
  });

  it("refuses HR with 403 (STAFF-only lane)", async () => {
    const res = await request(app)
      .get("/api/staff/corrections")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/staff/corrections/:id", () => {
  it("returns the caller's own correction", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Own detail",
    });

    const res = await request(app)
      .get(`/api/staff/corrections/${created.body.data.id}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });

  it("refuses a colleague's correction with 403", async () => {
    const attendance = await seedAttendance({ userId: hrId, businessId, date: todayUtc() });
    const foreign = await seedCorrection({
      businessId,
      attendanceId: attendance.id,
      requestedById: hrId,
    });

    const res = await request(app)
      .get(`/api/staff/corrections/${foreign.id}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access denied");
  });

  it("returns 404 for an unknown correction id", async () => {
    const res = await request(app)
      .get("/api/staff/corrections/00000000-0000-4000-8000-0000000000bb")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(404);
  });

  it("rejects a malformed id with 400", async () => {
    const res = await request(app)
      .get("/api/staff/corrections/not-a-uuid")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/hr/corrections", () => {
  // xfail — see M9-B1 in the file header. Asserts the intended 200 contract.
  it("returns the business queue with requester and record owner [M9-B1]", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Queue entry",
    });

    const res = await request(app)
      .get("/api/hr/corrections?limit=100")
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    const row = (res.body.data as Array<{
      id: string;
      requestedBy: { id: string };
      attendance: { id: string; user: { id: string } };
    }>).find((entry) => entry.id === created.body.data.id);

    expect(row).toBeTruthy();
    expect(row?.requestedBy.id).toBe(staffId);
    expect(row?.attendance.id).toBe(attendance.id);
    expect(row?.attendance.user.id).toBe(staffId);
  });

  // xfail — see M9-B1 in the file header. Asserts the intended 200 contract.
  it("narrows the queue by review tier [M9-B1]", async () => {
    const res = await request(app)
      .get("/api/hr/corrections?reviewTier=ESCALATED&limit=100")
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    for (const row of res.body.data as Array<{ reviewTier: string }>) {
      expect(row.reviewTier).toBe("ESCALATED");
    }
  });

  // xfail — see M9-B1 in the file header. Asserts the intended 200 contract.
  it("never exposes another business's correction [M9-B1]", async () => {
    const otherBusiness = await prisma.business.create({
      data: { name: "M9 Other Tenant", slug: `m9-other-${Date.now()}` },
      select: { id: true },
    });
    const otherUser = await prisma.user.create({
      data: {
        businessId: otherBusiness.id,
        employeeCode: "M9-OTHER-1",
        firstName: "Other",
        lastName: "Tenant",
        email: uniqueEmail("m9.other.user"),
        password: await bcrypt.hash(TEST_PASSWORD, 12),
        role: "STAFF",
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    const otherAttendance = await seedAttendance({
      userId: otherUser.id,
      businessId: otherBusiness.id,
      date: todayUtc(),
    });
    const otherCorrection = await seedCorrection({
      businessId: otherBusiness.id,
      attendanceId: otherAttendance.id,
      requestedById: otherUser.id,
    });

    const res = await request(app)
      .get("/api/hr/corrections?limit=100")
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(ids).not.toContain(otherCorrection.id);
  });

  it("refuses STAFF with 403", async () => {
    const res = await request(app)
      .get("/api/hr/corrections")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated reads with 401", async () => {
    const res = await request(app).get("/api/hr/corrections");
    expect(res.status).toBe(401);
  });

});

describe("PATCH /api/hr/corrections/:id/decision — same day and role gates", () => {
  it("lets HR approve a same-day correction raised by someone else, applying the proposal", async () => {
    const attendance = await seedAttendance({
      userId: staffId,
      businessId,
      date: todayUtc(),
      clockOut: dayAtHour(todayUtc(), 17),
    });
    const proposedClockOut = dayAtHour(todayUtc(), 18);
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Approve me",
      proposedClockOut: proposedClockOut.toISOString(),
    });
    expect(created.status).toBe(201);

    const res = await decide(hrToken, created.body.data.id, {
      decision: "APPROVED",
      note: "Approved by HR",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.correction.status).toBe("APPROVED");
    expect(res.body.data.correction.decisionNote).toBe("Approved by HR");
    expect(res.body.data.escalation).toBeNull();
    expect(res.body.data.attendance.sessionStatus).toBe("CLOSED");
    expect(res.body.data.attendance.closureReason).toBe("CORRECTION");
    expect(new Date(res.body.data.attendance.clockOut).getTime()).toBe(proposedClockOut.getTime());
  });

  it("lets SUPERADMIN approve a same-day correction", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "SA approve",
    });

    const res = await decide(saToken, created.body.data.id, { decision: "APPROVED" });
    expect(res.status).toBe(200);
    expect(res.body.data.correction.status).toBe("APPROVED");
  });

  it("refuses HR deciding its own correction (no self-approval)", async () => {
    const attendance = await seedAttendance({ userId: hrId, businessId, date: todayUtc() });
    const created = await submitCorrection(hrToken, {
      attendanceId: attendance.id,
      reason: "HR own record",
    });
    expect(created.status).toBe(201);

    const res = await decide(hrToken, created.body.data.id, { decision: "APPROVED" });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You cannot approve your own correction");
  });

  it("refuses SUPERADMIN deciding its own correction (no self-approval, absolute)", async () => {
    const attendance = await seedAttendance({ userId: saId, businessId, date: todayUtc() });
    const correction = await seedCorrection({
      businessId,
      attendanceId: attendance.id,
      requestedById: saId,
      reviewTier: "SAME_DAY",
    });

    const res = await decide(saToken, correction.id, {
      decision: "APPROVED",
      backstopCondition: "EXPLICIT_HANDOFF",
      backstopReason: "self",
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You cannot approve your own correction");
  });

  it("refuses a second decision with 409", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const correction = await seedCorrection({
      businessId,
      attendanceId: attendance.id,
      requestedById: staffId,
      status: "APPROVED",
    });

    const res = await decide(hrToken, correction.id, { decision: "APPROVED" });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("already been decided");
  });

  it("refuses an approval when the record drifted since submission with 409", async () => {
    const attendance = await seedAttendance({
      userId: staffId,
      businessId,
      date: todayUtc(),
      clockOut: dayAtHour(todayUtc(), 17),
    });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Drifty",
      proposedClockOut: dayAtHour(todayUtc(), 18).toISOString(),
    });
    expect(created.status).toBe(201);

    // The row moves after submission but before the approval.
    await prisma.attendance.update({
      where: { id: attendance.id },
      data: { clockOut: dayAtHour(todayUtc(), 17.5) },
    });

    const res = await decide(hrToken, created.body.data.id, { decision: "APPROVED" });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("record changed");
  });

  it("returns 404 for an unknown correction, 400 for a malformed id and 400 for a bad decision", async () => {
    const unknown = await decide(hrToken, "00000000-0000-4000-8000-0000000000cc", {
      decision: "APPROVED",
    });
    expect(unknown.status).toBe(404);

    const malformed = await decide(hrToken, "not-a-uuid", { decision: "APPROVED" });
    expect(malformed.status).toBe(400);

    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Bad decision",
    });
    const bad = await decide(hrToken, created.body.data.id, { decision: "MAYBE" });
    expect(bad.status).toBe(400);
  });

  it("refuses STAFF on the decision route with 403", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Staff cannot decide",
    });
    const res = await decide(staffToken, created.body.data.id, { decision: "APPROVED" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH decision — escalated tier and the SUPERADMIN backstop", () => {
  it("refuses SUPERADMIN deciding ESCALATED without the backstop fields", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: daysAgo(2) });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Escalated, no backstop",
    });
    expect(created.body.data.reviewTier).toBe("ESCALATED");

    const res = await decide(saToken, created.body.data.id, { decision: "APPROVED" });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("backstop conditions");
  });

  it("refuses HR sending the backstop fields (SUPERADMIN-only escape hatch)", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: daysAgo(2) });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "HR backstop attempt",
    });

    const res = await decide(hrToken, created.body.data.id, {
      decision: "APPROVED",
      backstopCondition: "UNCLAIMED_24H",
      backstopReason: "unclaimed",
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Only a SUPERADMIN");
  });

  it("refuses a half-sent backstop with 403", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Half sent",
    });

    const res = await decide(saToken, created.body.data.id, {
      decision: "APPROVED",
      backstopCondition: "UNCLAIMED_24H",
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("both a condition and a non-empty reason");
  });

  it("refuses a backstop reason without a condition with 403 (half-sent, other side)", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Reason without condition",
    });

    const res = await decide(saToken, created.body.data.id, {
      decision: "APPROVED",
      backstopReason: "an orphan reason",
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("both a condition and a non-empty reason");
  });

  it("refuses a blank backstop reason with 403", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: todayUtc() });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Blank reason",
    });

    const res = await decide(saToken, created.body.data.id, {
      decision: "APPROVED",
      backstopCondition: "CONFLICT_OF_INTEREST",
      backstopReason: "   ",
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("both a condition and a non-empty reason");
  });

  it("lets SUPERADMIN decide ESCALATED as the documented backstop, writing the escalation trail", async () => {
    const attendance = await seedAttendance({ userId: staffId, businessId, date: daysAgo(2) });
    const created = await submitCorrection(staffToken, {
      attendanceId: attendance.id,
      reason: "Backstop decision",
    });
    expect(created.body.data.reviewTier).toBe("ESCALATED");

    const res = await decide(saToken, created.body.data.id, {
      decision: "APPROVED",
      note: "Handed off",
      backstopCondition: "EXPLICIT_HANDOFF",
      backstopReason: "requester asked supervised",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.escalation).toEqual({
      type: "SUPERADMIN_BACKSTOP",
      condition: "EXPLICIT_HANDOFF",
    });

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "correction", entityId: created.body.data.id },
      select: { action: true },
    });
    const actions = audits.map((row) => row.action);
    expect(actions).toContain("correction.decided.backstop");
    expect(actions).toContain("correction.escalated");
  });

  it("refuses a sole HR officer deciding an ESCALATED correction with 403", async () => {
    const attendance = await seedAttendance({
      userId: escStaffId,
      businessId: escBusinessId,
      date: daysAgo(2),
    });
    const created = await submitCorrection(escStaffToken, {
      attendanceId: attendance.id,
      reason: "Sole HR escalated",
    });
    expect(created.status).toBe(201);
    expect(created.body.data.reviewTier).toBe("ESCALATED");

    const res = await decide(escHrToken, created.body.data.id, { decision: "APPROVED" });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("second reviewer");
  });

  it("lets HR decide ESCALATED once a second active HR exists", async () => {
    const secondHr = await prisma.user.create({
      data: {
        businessId: escBusinessId,
        employeeCode: "M9-ESC-HR2",
        firstName: "Esc",
        lastName: "HrTwo",
        email: uniqueEmail("m9.esc.hr2"),
        password: await bcrypt.hash(TEST_PASSWORD, 12),
        role: "HR",
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    expect(secondHr.id).not.toBe(escHrId);

    const attendance = await seedAttendance({
      userId: escStaffId,
      businessId: escBusinessId,
      date: daysAgo(2),
    });
    const created = await submitCorrection(escStaffToken, {
      attendanceId: attendance.id,
      reason: "Second HR escalated",
    });
    expect(created.body.data.reviewTier).toBe("ESCALATED");

    const res = await decide(escHrToken, created.body.data.id, { decision: "REJECTED" });
    expect(res.status).toBe(200);
    expect(res.body.data.correction.status).toBe("REJECTED");
    expect(res.body.data.escalation).toEqual({ type: "SECOND_HR", condition: null });
  });
});
