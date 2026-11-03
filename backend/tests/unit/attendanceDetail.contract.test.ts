import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";

const fixtures = vi.hoisted(() => ({
  findFirst: vi.fn(),
  logError: vi.fn(),
  businessId: "11111111-1111-4111-8111-111111111111",
  actorId: "22222222-2222-4222-8222-222222222222",
}));

vi.mock("../../config/prismaClient.js", () => ({
  default: { attendance: { findFirst: fixtures.findFirst } },
}));
vi.mock("../../utils/logger.js", () => ({
  attendanceLogger: { error: fixtures.logError },
  logError: fixtures.logError,
}));
// Only the existing punch/list handlers are seams here. Their placement must
// remain intact when the real router gains its real direct-detail handler.
vi.mock("../../controllers/attendanceController.js", () => ({
  clockIn: (_req: Request, res: Response) => res.status(202).json({ lane: "clock-in" }),
  clockOut: (_req: Request, res: Response) => res.status(202).json({ lane: "clock-out" }),
  getMyAttendance: (_req: Request, res: Response) => res.json({ lane: "my-attendance" }),
  getAllAttendance: (_req: Request, res: Response) => res.json({ lane: "all-attendance" }),
  dismissAlert: (_req: Request, res: Response) => res.json({ lane: "existing-alert" }),
}));
vi.mock("../../controllers/correctionController.js", () => ({
  createCorrection: (_req: Request, res: Response) => res.status(202).json({ lane: "corrections" }),
}));
vi.mock("../../middleware/authMiddleware.js", () => ({
  default: (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers["x-test-role"]) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    req.user = {
      userId: fixtures.actorId,
      businessId: req.headers["x-test-missing-business"] === "true" ? "" : fixtures.businessId,
      role: String(req.headers["x-test-role"]),
      isActive: req.headers["x-test-inactive"] !== "true",
      mustChangePassword: req.headers["x-test-forced"] === "true",
      tokenVersion: 1,
    } as Request["user"];
    next();
  },
}));
vi.mock("../../middleware/kioskAuthMiddleware.js", () => ({
  default: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const attendanceRoutes = (await import("../../routes/attendanceRoutes.js")).default;
const correctionRoutes = (await import("../../routes/correctionRoutes.js")).default;
const app = express();
app.use(express.json());
app.use("/api/attendance", attendanceRoutes);
// Same outer mount order as server.ts. Real correction middleware must remain
// reachable; only its persistence handler is replaced by a no-database seam.
app.use("/api/attendance/corrections", correctionRoutes);

const RECORD_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ID = "44444444-4444-4444-8444-444444444444";
const KIOSK_ID = "55555555-5555-4555-8555-555555555555";
const now = new Date("2026-11-02T08:00:00.000Z");

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID, businessId: fixtures.businessId, userId: fixtures.actorId,
    date: new Date("2026-11-02T00:00:00.000Z"), clockIn: now, clockOut: null,
    status: "ON_TIME", sessionStatus: "OPEN", closureReason: null,
    hoursWorked: 0, requiresReviewReason: null, remarks: null,
    shiftId: OTHER_ID, shiftNameSnapshot: "Early service", shiftStartMinuteSnapshot: 480,
    shiftEndMinuteSnapshot: 960, shiftCrossesMidnightSnapshot: false,
    timezoneSnapshot: "Africa/Accra", graceEarlyMinutesSnapshot: 5,
    graceLateMinutesSnapshot: 5, policyVersionId: OTHER_ID,
    policySnapshot: {
      versionNumber: 3, effectiveFrom: "2026-10-01T00:00:00.000Z",
      graceEarlyMinutes: 5, graceLateMinutes: 5, autoClockOutEnabled: true,
      autoClockOutBufferMinutes: 30, autoClockOutMaxOpenMinutes: 900,
      correctionWindowDays: 3, geoFenceRadiusMeters: 150,
      locationAccuracyThresholdMeters: 50, gpsFreshnessSeconds: 60,
      arbitraryFutureSetting: "private-fixture-marker",
    },
    checkInLat: 5.6037, checkInLng: -0.1870, checkInIp: "192.0.2.10",
    sourceVerificationSessionId: "private-fixture-handle", createdByKioskId: KIOSK_ID,
    createdAt: now, updatedAt: now,
    user: { id: fixtures.actorId, businessId: fixtures.businessId,
      employeeCode: "EMP-0007", firstName: "Ama", lastName: "Mensah", password: "excluded-fixture" },
    createdByKiosk: { id: KIOSK_ID, businessId: fixtures.businessId,
      label: "Reception terminal", publicId: "KT-EXAMPLE", tokenHash: "excluded-fixture" },
    ...overrides,
  };
}

type Selection = Record<string, boolean | { select: Selection }>;
function project(row: Record<string, unknown>, select: Selection): Record<string, unknown> {
  return Object.fromEntries(Object.entries(select).filter(([, value]) => Boolean(value)).map(([key, value]) => {
    const entry = row[key];
    return [key, typeof value === "object" && entry && typeof entry === "object"
      ? project(entry as Record<string, unknown>, value.select) : entry];
  }));
}

let currentRecord = record();
beforeEach(() => {
  vi.clearAllMocks();
  currentRecord = record();
  fixtures.findFirst.mockImplementation(async (args: { where: Record<string, unknown>; select: Selection }) => {
    if (args.where.id !== currentRecord.id || args.where.businessId !== currentRecord.businessId) return null;
    return project(currentRecord, args.select);
  });
});

const detail = (role = "STAFF", id = RECORD_ID) => request(app)
  .get(`/api/attendance/${id}`).set("x-test-role", role);

describe("attendance detail through real routes without a database", () => {
  it("requires the authentication middleware seam", async () => {
    await request(app).get(`/api/attendance/${RECORD_ID}`).expect(401);
    expect(fixtures.findFirst).not.toHaveBeenCalled();
  });

  it("keeps the real forced-password gate before the detail read", async () => {
    const response = await detail().set("x-test-forced", "true").expect(403);
    expect(response.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(fixtures.findFirst).not.toHaveBeenCalled();
  });

  it("refuses an unsupported role before reading a record", async () => {
    await detail("UNSUPPORTED").expect(403);
    expect(fixtures.findFirst).not.toHaveBeenCalled();
  });

  it.each(["x-test-inactive", "x-test-missing-business"])("fails closed for invalid caller context: %s", async (header) => {
    await detail().set(header, "true").expect(401);
    expect(fixtures.findFirst).not.toHaveBeenCalled();
  });

  it("validates a malformed ID before the detail handler", async () => {
    const response = await detail("STAFF", "not-a-uuid").expect(400);
    expect(response.body.message).toBe("Invalid parameters");
    expect(fixtures.findFirst).not.toHaveBeenCalled();
  });

  it.each(["STAFF", "HR", "SUPERADMIN"])("returns an authorized direct record for %s", async (role) => {
    const response = await detail(role).expect(200);
    expect(response.body).toMatchObject({ success: true, data: {
      id: RECORD_ID, userId: fixtures.actorId, sessionStatus: "OPEN", status: "ON_TIME",
      shiftNameSnapshot: "Early service", timezoneSnapshot: "Africa/Accra",
      user: { id: fixtures.actorId, employeeCode: "EMP-0007", firstName: "Ama", lastName: "Mensah" },
      createdByKiosk: { id: KIOSK_ID, label: "Reception terminal", publicId: "KT-EXAMPLE" },
    } });
    expect(fixtures.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: RECORD_ID, businessId: fixtures.businessId }),
    }));
  });

  it("refuses STAFF another person's record in the same business", async () => {
    currentRecord = record({ userId: OTHER_ID });
    await detail().expect(403);
  });

  it.each(["HR", "SUPERADMIN"])("permits %s another employee's own-business record", async (role) => {
    currentRecord = record({ userId: OTHER_ID });
    await detail(role).expect(200);
  });

  it("makes missing and foreign records indistinguishable", async () => {
    const missing = await detail("HR", OTHER_ID).expect(404);
    currentRecord = record({ businessId: OTHER_ID });
    const foreign = await detail("HR").expect(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it("uses a safe explicit projection and sanitizes stored policy JSON", async () => {
    const response = await detail().expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const selection = fixtures.findFirst.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty("sourceVerificationSessionId");
    expect(selection).not.toHaveProperty("checkInIp");
    expect(selection).not.toHaveProperty("alertDismissedAt");
    expect(selection.user.select).not.toHaveProperty("password");
    expect(selection.createdByKiosk.select).not.toHaveProperty("tokenHash");
    expect(response.body.data.policySnapshot).toMatchObject({ versionNumber: 3, graceLateMinutes: 5 });
    expect(response.body.data.policySnapshot).not.toHaveProperty("arbitraryFutureSetting");
    expect(JSON.stringify(response.body)).not.toMatch(/private-fixture|excluded-fixture|checkInIp|businessId/);
    expect(response.body.data).not.toHaveProperty("locationResult");
    expect(response.body.data).not.toHaveProperty("checkOutLocation");
    expect(response.body.data).not.toHaveProperty("attempts");
  });

  it("preserves missing historical evidence without current-setting fallback", async () => {
    currentRecord = record({ shiftId: null, shiftNameSnapshot: null, timezoneSnapshot: null,
      policySnapshot: null, checkInLat: null, checkInLng: null, user: null, createdByKiosk: null });
    const response = await detail().expect(200);
    expect(response.body.data).toMatchObject({ shiftId: null, shiftNameSnapshot: null,
      timezoneSnapshot: null, policySnapshot: null, checkInLat: null, checkInLng: null,
      user: null, createdByKiosk: null });
    expect(fixtures.findFirst).toHaveBeenCalledTimes(1);
  });

  it("does not disclose a related user or terminal from a different business", async () => {
    currentRecord = record({ user: { id: OTHER_ID, businessId: OTHER_ID, firstName: "Foreign" },
      createdByKiosk: { id: KIOSK_ID, businessId: OTHER_ID, label: "Foreign" } });
    const response = await detail("HR").expect(200);
    expect(response.body.data.user).toBeNull();
    expect(response.body.data.createdByKiosk).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain("Foreign");
  });

  it("omits malformed policy values rather than manufacturing defaults", async () => {
    currentRecord = record({ policySnapshot: { versionNumber: "not-a-number",
      autoClockOutEnabled: "yes", graceLateMinutes: { unknown: true } } });
    const response = await detail().expect(200);
    expect(response.body.data.policySnapshot ?? {}).not.toHaveProperty("versionNumber");
    expect(response.body.data.policySnapshot ?? {}).not.toHaveProperty("autoClockOutEnabled");
    expect(response.body.data.policySnapshot ?? {}).not.toHaveProperty("graceLateMinutes");
  });

  it("keeps static list routes ahead of the ID route", async () => {
    await request(app).get("/api/attendance/my-attendance").set("x-test-role", "STAFF")
      .expect(200, { lane: "my-attendance" });
    await request(app).get("/api/attendance/all-attendance").set("x-test-role", "HR")
      .expect(200, { lane: "all-attendance" });
    expect(fixtures.findFirst).not.toHaveBeenCalled();
  });

  it("yields the corrections namespace without treating it as a record ID", async () => {
    await request(app).get("/api/attendance/corrections").set("x-test-role", "STAFF").expect(404);
    await request(app).get(`/api/attendance/corrections/${RECORD_ID}`)
      .set("x-test-role", "STAFF").expect(404);
    await request(app).get("/api/attendance/corrections?status=SUBMITTED")
      .set("x-test-role", "STAFF").expect(404);
    await request(app).post("/api/attendance/corrections").set("x-test-role", "STAFF")
      .send({ attendanceId: RECORD_ID, reason: "Review the recorded punch time" })
      .expect(202, { lane: "corrections" });
    expect(fixtures.findFirst).not.toHaveBeenCalled();
  });

  it("retains the actual correction submission validator", async () => {
    const response = await request(app).post("/api/attendance/corrections")
      .set("x-test-role", "STAFF").send({}).expect(400);
    expect(response.body.message).toBe("Validation failed");
    expect(response.body.errors).toContainEqual(expect.objectContaining({ field: "attendanceId" }));
    expect(fixtures.findFirst).not.toHaveBeenCalled();
  });

  it("returns a generic failure without leaking database messages", async () => {
    fixtures.findFirst.mockRejectedValue(new Error("private-fixture-database-error"));
    const response = await detail().expect(500);
    expect(response.body).toMatchObject({ success: false, message: "Server error" });
    expect(JSON.stringify(response.body)).not.toContain("private-fixture");
    expect(JSON.stringify(fixtures.logError.mock.calls)).not.toContain("private-fixture");
  });
});
