/**
 * M9 Phase 1 — report controller (`reportController.ts`, contracts §10, O9).
 *
 * Four rows, all HR/SUPERADMIN:
 *   GET /api/reports/attendance-register          paginated JSON register
 *   GET /api/reports/punctuality-summary          status buckets by employee|shift|day
 *   GET /api/reports/exceptions                   review rows + OUTSIDE/UNKNOWN attempts
 *   GET /api/reports/attendance-register/export   streamed CSV (O9)
 *
 * All four share the same range validation (required `YYYY-MM-DD` pair,
 * end >= start, ≤190 days). Two of them read `page`/`limit` through the
 * validator and are hit by M9-B1 (see the file header in correction.test.ts):
 * the register JSON answers 500 (Prisma rejects `take: "50"`), while the
 * exceptions report silently answers 200 with an EMPTY page — its `Math.max`
 * guards turn the NaN `skip`/`take` into "no rows to fetch" instead of an
 * error, which quietly drops every exception. The two xfail tripwires assert
 * the intended 200 contract; the two characterisation tests pin the two
 * observed shapes. The punctuality summary and the CSV export read only dates,
 * so they answer normally and carry the real coverage here.
 *
 * The report rows are business-scoped, and the shared default business
 * accumulates rows from every other suite, so a dedicated business with a
 * controlled STAFF head-count is used: every count below is knowable.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import { TEST_PASSWORD } from "./fixtures.js";

const uniqueEmail = (prefix: string): string =>
  `${prefix}.${Date.now()}${Math.floor(Math.random() * 1000)}@test.attendpro.com`;

const dateOf = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string, hour: number, minute = 0): Date =>
  new Date(`${iso}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);

async function tokenFor(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

type SeedOverrides = {
  userId?: string;
  date: string;
  clockIn?: Date;
  clockOut?: Date | null;
  status?:
    | "EARLY"
    | "ON_TIME"
    | "LATE"
    | "OPEN_SESSION"
    | "CLOCK_OUT_MISSING"
    | "AUTO_CLOSED"
    | "ABSENT"
    | "REQUIRES_REVIEW";
  sessionStatus?: "OPEN" | "CLOSED";
  hoursWorked?: number;
  shiftId?: string | null;
  shiftNameSnapshot?: string | null;
  requiresReviewReason?: string | null;
  closureReason?: "AUTO_CLOCK_OUT" | "CORRECTION" | "HR_ASSISTED" | null;
  createdByKioskId?: string | null;
};

async function seedAttendance(overrides: SeedOverrides) {
  const day = dateOf(overrides.date);
  return prisma.attendance.create({
    data: {
      businessId: repBizId,
      userId: overrides.userId ?? staffAId,
      date: day,
      clockIn: overrides.clockIn ?? at(overrides.date, 9),
      clockOut:
        overrides.clockOut === undefined ? at(overrides.date, 17) : overrides.clockOut,
      status: overrides.status ?? "ON_TIME",
      sessionStatus: overrides.sessionStatus ?? "CLOSED",
      hoursWorked: overrides.hoursWorked ?? 8,
      shiftId: overrides.shiftId === undefined ? null : overrides.shiftId,
      shiftNameSnapshot:
        overrides.shiftNameSnapshot === undefined ? "Rep Shift" : overrides.shiftNameSnapshot,
      requiresReviewReason:
        overrides.requiresReviewReason === undefined ? null : overrides.requiresReviewReason,
      closureReason: overrides.closureReason === undefined ? null : overrides.closureReason,
      createdByKioskId:
        overrides.createdByKioskId === undefined ? null : overrides.createdByKioskId,
    },
    select: { id: true },
  });
}

/** Polls for a durable audit row: the CSV export writes it after `res.end()`. */
async function waitForAuditCount(
  where: { businessId: string; action: string },
  atLeast: number,
  timeoutMs = 8000
): Promise<number> {
  const start = Date.now();
  for (;;) {
    const count = await prisma.auditLog.count({ where });
    if (count >= atLeast) return count;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`audit row ${where.action} never reached ${atLeast} (last ${count})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

let repBizId: string;
let repHrId: string;
let staffAId: string;
let staffBId: string;
let repShiftId: string;
let repHrToken: string;
let staffToken: string;

beforeAll(async () => {
  const biz = await prisma.business.create({
    data: { name: "M9 Reports", slug: `m9-reports-${Date.now()}` },
    select: { id: true },
  });
  repBizId = biz.id;

  const password = await bcrypt.hash(TEST_PASSWORD, 12);
  const mkUser = (code: string, first: string, last: string, role: "HR" | "STAFF") =>
    prisma.user.create({
      data: {
        businessId: repBizId,
        employeeCode: code,
        firstName: first,
        lastName: last,
        email: uniqueEmail(`m9.rep.${code.toLowerCase()}`),
        password,
        role,
        department: "Testing",
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true, email: true },
    });

  const hr = await mkUser("REP-HR", "Rep", "Hr", "HR");
  const a = await mkUser("REP-A", "Rep", "StaffA", "STAFF");
  const b = await mkUser("REP-B", "Rep", "StaffB", "STAFF");
  repHrId = hr.id;
  staffAId = a.id;
  staffBId = b.id;

  repHrToken = await tokenFor(hr.email);

  const shift = await prisma.shift.create({
    data: {
      businessId: repBizId,
      name: "Rep Morning",
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      // The migrated `shifts` table keeps the deprecated `start_time`/`end_time`
      // columns NOT NULL (the Prisma client marks them optional), so a create
      // that omits them is refused by the database. Production `createShift`
      // omits them too — recorded as M9-B2 — so the seed must supply them.
      startTime: "09:00",
      endTime: "17:00",
    },
    select: { id: true },
  });
  repShiftId = shift.id;

  // Staff fixture accounts in the shared business, for the 403 checks.
  staffToken = await tokenFor("staff@test.attendpro.com");

  expect(repHrId).not.toBe(staffAId);
  expect(staffBId).not.toBe(staffAId);
});

describe("reports — the shared range gate", () => {
  it("refuses a missing range with 400", async () => {
    const res = await request(app)
      .get("/api/reports/punctuality-summary?groupBy=employee")
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid query parameters");
  });

  it("refuses a reversed range and a span over 190 days with 400", async () => {
    const reversed = await request(app)
      .get("/api/reports/punctuality-summary?startDate=2026-02-01&endDate=2026-01-01&groupBy=day")
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(reversed.status).toBe(400);

    const tooLong = await request(app)
      .get("/api/reports/punctuality-summary?startDate=2026-01-01&endDate=2026-07-11&groupBy=day")
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(tooLong.status).toBe(400);

    const registerTooLong = await request(app)
      .get("/api/reports/attendance-register?startDate=2026-01-01&endDate=2026-07-11")
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(registerTooLong.status).toBe(400);
  });

  it("refuses a malformed date with 400", async () => {
    const res = await request(app)
      .get("/api/reports/punctuality-summary?startDate=01-01-2026&endDate=2026-01-31&groupBy=day")
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(res.status).toBe(400);
  });

  it("refuses an unknown groupBy with 400", async () => {
    const res = await request(app)
      .get("/api/reports/punctuality-summary?startDate=2026-01-01&endDate=2026-01-31&groupBy=week")
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(res.status).toBe(400);
  });

  it("refuses STAFF with 403 on every report row and anon with 401", async () => {
    const rows = [
      "/api/reports/attendance-register?startDate=2026-01-01&endDate=2026-01-31",
      "/api/reports/punctuality-summary?startDate=2026-01-01&endDate=2026-01-31&groupBy=day",
      "/api/reports/exceptions?startDate=2026-01-01&endDate=2026-01-31",
      "/api/reports/attendance-register/export?startDate=2026-01-01&endDate=2026-01-31&format=csv",
    ];
    for (const row of rows) {
      const asStaff = await request(app).get(row).set("Authorization", `Bearer ${staffToken}`);
      expect(asStaff.status).toBe(403);

      const anon = await request(app).get(row);
      expect(anon.status).toBe(401);
    }
  });
});

describe("GET /api/reports/punctuality-summary — employee grouping", () => {
  it("counts status buckets and computes absence from active STAFF", async () => {
    await seedAttendance({ userId: staffAId, date: "2026-01-01", status: "ON_TIME" });
    await seedAttendance({ userId: staffAId, date: "2026-01-02", status: "LATE" });
    await seedAttendance({ userId: staffBId, date: "2026-01-01", status: "EARLY" });

    const res = await request(app)
      .get("/api/reports/punctuality-summary?startDate=2026-01-01&endDate=2026-01-03&groupBy=employee")
      .set("Authorization", `Bearer ${repHrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.groupBy).toBe("employee");
    const rows = res.body.data.rows as Array<Record<string, number | string>>;
    const a = rows.find((row) => row.group === "Rep StaffA");
    const b = rows.find((row) => row.group === "Rep StaffB");

    // StaffA punched on 2 of the 3 days → one absence; buckets split ON_TIME/LATE.
    expect(a).toMatchObject({ onTime: 1, late: 1, absent: 1, total: 3 });
    // StaffB punched once → two absences.
    expect(b).toMatchObject({ early: 1, absent: 2, total: 3 });
  });
});

describe("GET /api/reports/punctuality-summary — day grouping", () => {
  it("tallies per day and counts a missing staff day as absent", async () => {
    await seedAttendance({ userId: staffAId, date: "2026-03-01", status: "ON_TIME" });
    await seedAttendance({ userId: staffBId, date: "2026-03-01", status: "EARLY" });
    await seedAttendance({ userId: staffBId, date: "2026-03-02", status: "LATE" });

    const res = await request(app)
      .get("/api/reports/punctuality-summary?startDate=2026-03-01&endDate=2026-03-02&groupBy=day")
      .set("Authorization", `Bearer ${repHrToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.data.rows as Array<Record<string, number | string>>;
    const day1 = rows.find((row) => row.group === "2026-03-01");
    const day2 = rows.find((row) => row.group === "2026-03-02");

    // Both staff punched on day 1 → no absence; one staffer missing on day 2.
    expect(day1).toMatchObject({ onTime: 1, early: 1, absent: 0, total: 2 });
    expect(day2).toMatchObject({ late: 1, absent: 1, total: 2 });
  });
});

describe("GET /api/reports/punctuality-summary — shift grouping", () => {
  it("labels groups from the row's shift-name snapshot and buckets a no-shift row", async () => {
    await seedAttendance({
      userId: staffAId,
      date: "2026-04-01",
      status: "ON_TIME",
      shiftId: repShiftId,
      shiftNameSnapshot: "Rep Morning",
    });
    await seedAttendance({
      userId: staffBId,
      date: "2026-04-01",
      status: "LATE",
      shiftId: null,
      shiftNameSnapshot: null,
    });

    const res = await request(app)
      .get("/api/reports/punctuality-summary?startDate=2026-04-01&endDate=2026-04-01&groupBy=shift")
      .set("Authorization", `Bearer ${repHrToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.data.rows as Array<Record<string, number | string>>;
    const named = rows.find((row) => row.group === "Rep Morning");
    const noShift = rows.find((row) => row.group === "No shift");
    expect(named).toMatchObject({ onTime: 1, total: 1 });
    expect(noShift).toMatchObject({ late: 1, total: 1 });
  });
});

describe("GET /api/reports/attendance-register — the JSON register", () => {
  // xfail — see M9-B1. Asserts the intended 200 contract.
  it("returns register rows with employee and snapshot shift name [M9-B1]", async () => {
    await seedAttendance({
      userId: staffAId,
      date: "2026-05-01",
      status: "ON_TIME",
      shiftId: repShiftId,
      shiftNameSnapshot: "Rep Morning",
    });

    const res = await request(app)
      .get("/api/reports/attendance-register?startDate=2026-05-01&endDate=2026-05-01&limit=50")
      .set("Authorization", `Bearer ${repHrToken}`);

    expect(res.status).toBe(200);
    const row = (res.body.data as Array<{ employee: { id: string }; shiftName: string }>)[0];
    expect(row.employee.id).toBe(staffAId);
    expect(row.shiftName).toBe("Rep Morning");
  });

});

describe("GET /api/reports/exceptions", () => {
  it("returns REQUIRES_REVIEW rows with their reason [M9-B1]", async () => {
    await seedAttendance({
      userId: staffAId,
      date: "2026-06-01",
      status: "REQUIRES_REVIEW",
      requiresReviewReason: "Escalated by the auto-close sweep",
    });

    const res = await request(app)
      .get("/api/reports/exceptions?startDate=2026-06-01&endDate=2026-06-01&limit=50")
      .set("Authorization", `Bearer ${repHrToken}`);

    expect(res.status).toBe(200);
    const row = (res.body.data as Array<{ kind: string; reason: string }>)[0];
    expect(row.kind).toBe("ATTENDANCE");
    expect(row.reason).toBe("Escalated by the auto-close sweep");
  });

});

describe("GET /api/reports/attendance-register/export — the CSV (O9)", () => {
  it("streams the O9 columns, guards formula cells and audits the export once", async () => {
    await seedAttendance({
      userId: staffAId,
      date: "2026-02-10",
      clockIn: at("2026-02-10", 9),
      clockOut: at("2026-02-10", 17, 30),
      hoursWorked: 8.5,
      status: "ON_TIME",
      shiftId: repShiftId,
      shiftNameSnapshot: "Rep Shift",
    });
    await seedAttendance({
      userId: staffBId,
      date: "2026-02-10",
      clockIn: at("2026-02-10", 8),
      clockOut: at("2026-02-10", 16),
      hoursWorked: 8,
      status: "REQUIRES_REVIEW",
      requiresReviewReason: "=SUM(A1:A2)",
      shiftNameSnapshot: "Rep, Shift",
    });

    const before = await prisma.auditLog.count({
      where: { businessId: repBizId, action: "report.exported" },
    });

    const res = await request(app)
      .get(
        "/api/reports/attendance-register/export?startDate=2026-02-10&endDate=2026-02-10&format=csv"
      )
      .set("Authorization", `Bearer ${repHrToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attendance-register-2026-02-10");

    const lines = res.text.split("\r\n");
    expect(lines[0]).toBe("staff id,name,date,shift,clock-in,clock-out,total hours,status,source,flags");
    // Row for StaffA, oldest-first, business timezone = UTC.
    expect(res.text).toContain(
      "REP-A,Rep StaffA,2026-02-10,Rep Shift,2026-02-10 09:00,2026-02-10 17:30,8.5,ON_TIME,UNSPECIFIED,"
    );
    // Formula-injection guard: a leading "=" gets the apostrophe prefix.
    expect(res.text).toContain("'=SUM(A1:A2)");
    expect(res.text).not.toContain(",=SUM(A1:A2)");
    // A comma in a cell forces quoting.
    expect(res.text).toContain('"Rep, Shift"');

    // The durable egress record is written after res.end(), so poll for it.
    const after = await waitForAuditCount(
      { businessId: repBizId, action: "report.exported" },
      before + 1
    );
    expect(after).toBe(before + 1);
  });

  it("guards every formula trigger (+ - @ as well as =) with the apostrophe prefix", async () => {
    // O9's guard is /^[=+@-]/. The streaming test above proves "="; these three
    // rows prove the rest of the class, since a sheet treats all four the same.
    await seedAttendance({
      userId: staffAId,
      date: "2026-09-01",
      status: "REQUIRES_REVIEW",
      requiresReviewReason: "+SUM(1,1)",
    });
    await seedAttendance({
      userId: staffAId,
      date: "2026-09-02",
      status: "REQUIRES_REVIEW",
      requiresReviewReason: "-2+3",
    });
    await seedAttendance({
      userId: staffAId,
      date: "2026-09-03",
      status: "REQUIRES_REVIEW",
      requiresReviewReason: "@SUM(A1:A2)",
    });

    const res = await request(app)
      .get(
        "/api/reports/attendance-register/export?startDate=2026-09-01&endDate=2026-09-03&format=csv"
      )
      .set("Authorization", `Bearer ${repHrToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("'+SUM(1,1)");
    expect(res.text).toContain("'-2+3");
    expect(res.text).toContain("'@SUM(A1:A2)");
    // The raw (unguarded) cell must never appear.
    expect(res.text).not.toContain(",+SUM(1,1)");
    expect(res.text).not.toContain(",-2+3");
    expect(res.text).not.toContain(",@SUM(A1:A2)");
  });

  it("refuses a non-csv format with 400", async () => {
    const res = await request(app)
      .get(
        "/api/reports/attendance-register/export?startDate=2026-02-10&endDate=2026-02-10&format=json"
      )
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(res.status).toBe(400);
  });

  it("refuses a malformed employeeId filter with 400 (not a 500), and exports an empty register cleanly", async () => {
    const malformed = await request(app)
      .get(
        "/api/reports/attendance-register/export?startDate=2026-02-10&endDate=2026-02-10&employeeId=not-a-uuid"
      )
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(malformed.status).toBe(400);

    const empty = await request(app)
      .get("/api/reports/attendance-register/export?startDate=2026-08-01&endDate=2026-08-01")
      .set("Authorization", `Bearer ${repHrToken}`);
    expect(empty.status).toBe(200);
    expect(empty.text.split("\r\n")[0]).toContain("staff id,name,date,shift");
    expect(empty.text).toBe(
      "staff id,name,date,shift,clock-in,clock-out,total hours,status,source,flags\r\n"
    );
  });
});
