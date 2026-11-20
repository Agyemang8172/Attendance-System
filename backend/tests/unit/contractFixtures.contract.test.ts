/**
 * P03 — verified contract fixtures and boundaries.
 *
 * Every fixture in this file was copied from the controller's own Prisma
 * `select`/`include` and from the response object the handler writes. The
 * assertions compare the emitted key set with that fixture, so a controller
 * that adds, drops or renames a field fails here before a screen does.
 *
 * Two lanes:
 *   1. HTTP route boundaries through the real routers and real `validate()`
 *      middleware. Unmounted reads answer 404; malformed UUIDs and dates
 *      answer 400 with the validator's message.
 *   2. Direct handler calls with a mocked Prisma client. These assert the
 *      envelope and nested shapes only; they make no claim about SQL, RLS or
 *      PostgreSQL serialisation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  userCount: vi.fn(),
  policyFindMany: vi.fn(),
  calendarFindMany: vi.fn(),
  businessFindUnique: vi.fn(),
  attendanceFindMany: vi.fn(),
  attendanceCount: vi.fn(),
  correctionFindMany: vi.fn(),
  correctionCount: vi.fn(),
  kioskFindMany: vi.fn(),
  kioskCount: vi.fn(),
  auditFindFirst: vi.fn(),
  auditGroupBy: vi.fn(),
  businessId: "11111111-1111-4111-8111-111111111111",
  actorId: "22222222-2222-4222-8222-222222222222",
}));

vi.mock("../../config/prismaClient.js", () => ({
  default: {
    user: { findFirst: mocks.userFindFirst, findMany: mocks.userFindMany, count: mocks.userCount },
    workplacePolicy: { findMany: mocks.policyFindMany },
    workCalendar: { findMany: mocks.calendarFindMany },
    business: { findUnique: mocks.businessFindUnique },
    attendance: { findMany: mocks.attendanceFindMany, count: mocks.attendanceCount },
    attendanceCorrection: { findMany: mocks.correctionFindMany, count: mocks.correctionCount },
    kioskTerminal: { findMany: mocks.kioskFindMany, count: mocks.kioskCount },
    auditLog: { findFirst: mocks.auditFindFirst, groupBy: mocks.auditGroupBy },
    $transaction: vi.fn(),
  },
  prismaUnscoped: {
    auditLog: { findFirst: mocks.auditFindFirst, groupBy: mocks.auditGroupBy },
  },
}));

vi.mock("../../utils/tenant.js", () => ({
  callerBusinessId: vi.fn(async () => mocks.businessId),
}));

vi.mock("../../utils/logger.js", () => {
  const noop = () => {};
  const auditLog = new Proxy({}, { get: () => noop });
  return {
    auditLog,
    logger: { info: noop, warn: noop, error: noop },
    userLogger: { info: noop, warn: noop, error: noop },
    logError: noop,
  };
});

vi.mock("../../utils/auditWriter.js", () => ({ writeAudit: vi.fn() }));
vi.mock("../../utils/tenantContext.js", () => ({ currentTenant: () => undefined }));

// Production middleware is an integration concern; these lanes test routing,
// validation and response shape. The injected user is what authMiddleware
// would have produced after verifying a session.
vi.mock("../../middleware/authMiddleware.js", () => ({
  default: (req: Request, _res: Response, next: () => void) => {
    req.user = {
      userId: mocks.actorId,
      role: "SUPERADMIN",
      businessId: mocks.businessId,
      isActive: true,
      mustChangePassword: false,
      tokenVersion: 1,
    } as never;
    next();
  },
}));
vi.mock("../../middleware/roleMiddleware.js", () => ({
  default: () => (_req: Request, _res: Response, next: () => void) => next(),
}));
vi.mock("../../middleware/requirePasswordChange.js", () => ({
  default: () => (_req: Request, _res: Response, next: () => void) => next(),
}));
vi.mock("../../middleware/kioskAuthMiddleware.js", () => ({
  default: (_req: Request, _res: Response, next: () => void) => next(),
}));
vi.mock("../../middleware/jobAuthMiddleware.js", () => ({
  jobAuthMiddleware: (_req: Request, _res: Response, next: () => void) => next(),
  requireJobOrSuperadmin: (_req: Request, _res: Response, next: () => void) => next(),
}));

const policyController = await import("../../controllers/policyController.js");
const calendarController = await import("../../controllers/calendarController.js");
const businessController = await import("../../controllers/businessController.js");
const attendanceController = await import("../../controllers/attendanceController.js");
const reportController = await import("../../controllers/reportController.js");
const correctionController = await import("../../controllers/correctionController.js");
const kioskDeviceController = await import("../../controllers/kioskDeviceController.js");
const jobController = await import("../../controllers/jobController.js");
const userController = await import("../../controllers/userController.js");

const policyRoutes = (await import("../../routes/policyRoutes.js")).default;
const calendarRoutes = (await import("../../routes/calendarRoutes.js")).default;
const businessRoutes = (await import("../../routes/businessRoutes.js")).default;
const attendanceRoutes = (await import("../../routes/attendanceRoutes.js")).default;
const hrRoutes = (await import("../../routes/hrRoutes.js")).default;
const jobRoutes = (await import("../../routes/jobRoutes.js")).default;

const app = express();
app.use(express.json());
app.use("/api/business/policies", policyRoutes);
app.use("/api/business/calendars", calendarRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/jobs", jobRoutes);

const UUID = "33333333-3333-4333-8333-333333333333";
const ISO = "2026-10-01T00:00:00.000Z";

function requestFor(query: Record<string, unknown> = {}, body: Record<string, unknown> = {}) {
  return {
    user: {
      userId: mocks.actorId,
      role: "SUPERADMIN",
      businessId: mocks.businessId,
      isActive: true,
      mustChangePassword: false,
      tokenVersion: 1,
    },
    params: {},
    query,
    body,
    ip: "127.0.0.1",
  } as unknown as Request;
}

function response() {
  const result = { statusCode: 200, body: undefined as unknown };
  const res = {
    status: vi.fn((code: number) => {
      result.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
    setHeader: vi.fn(),
  };
  return { res: res as unknown as Response, result };
}

const keysOf = (value: object) => Object.keys(value).sort();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditFindFirst.mockResolvedValue(null);
  mocks.auditGroupBy.mockResolvedValue([]);
});

// ── 1. Mounted and absent routes ────────────────────────────────────────────

describe("route boundaries", () => {
  it("answers the mounted policy, calendar, settings and job reads", async () => {
    mocks.policyFindMany.mockResolvedValue([]);
    mocks.calendarFindMany.mockResolvedValue([]);
    mocks.businessFindUnique.mockResolvedValue({
      name: "AttendPro",
      timezone: "Africa/Accra",
      logoUrl: null,
      brandColor: null,
      supportEmail: null,
      supportPhone: null,
      retentionYears: 7,
      retentionEnabled: false,
      attendanceRetentionDays: null,
      auditRetentionDays: null,
    });

    await request(app).get("/api/business/policies").expect(200);
    await request(app).get("/api/business/calendars").expect(200);
    await request(app).get("/api/business/settings").expect(200);
    await request(app).get("/api/jobs/status").expect(200);
  });

  it("does not mount a GET policy-versions read", async () => {
    await request(app).get(`/api/business/policies/${UUID}/versions`).expect(404);
  });

  it("does not mount a GET calendar-exceptions read or a calendar create", async () => {
    await request(app).get(`/api/business/calendars/${UUID}/exceptions`).expect(404);
    await request(app).post("/api/business/calendars").send({ name: "New" }).expect(404);
  });

  it("rejects a non-UUID calendar id before the handler runs", async () => {
    const res = await request(app)
      .patch("/api/business/calendars/not-a-uuid")
      .send({ name: "Renamed" })
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      message: "Invalid parameters",
      errors: [{ field: "id", message: "Invalid calendar ID format" }],
    });
  });

  it("rejects an exception date that is not YYYY-MM-DD", async () => {
    const res = await request(app)
      .post(`/api/business/calendars/${UUID}/exceptions`)
      .send({ date: "25-12-2026", kind: "HOLIDAY", name: "Christmas" })
      .expect(400);

    expect(res.body.errors).toContainEqual({
      field: "date",
      message: "Date must be YYYY-MM-DD",
    });
  });

  it("rejects a policy version with a malformed effectiveFrom", async () => {
    const res = await request(app)
      .post(`/api/business/policies/${UUID}/versions`)
      .send({ effectiveFrom: "not-a-date" })
      .expect(400);

    expect(res.body.errors).toContainEqual({
      field: "effectiveFrom",
      message: "Invalid effective from date",
    });
  });
});

// ── 2. Nested policy versions ───────────────────────────────────────────────

describe("policy contract", () => {
  const policyRow = {
    id: UUID,
    businessId: mocks.businessId,
    shiftId: null,
    name: "Default policy",
    isDefault: true,
    createdAt: new Date(ISO),
    updatedAt: new Date(ISO),
    shift: null,
    versions: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        businessId: mocks.businessId,
        policyId: UUID,
        versionNumber: 1,
        effectiveFrom: new Date(ISO),
        effectiveTo: null,
        graceEarlyMinutes: 5,
        graceLateMinutes: 5,
        earlyThresholdMinutes: 0,
        autoClockOutEnabled: false,
        autoClockOutBufferMinutes: 15,
        autoClockOutMaxOpenMinutes: 480,
        correctionWindowDays: 3,
        geoFenceRadiusMeters: 150,
        locationAccuracyThresholdMeters: 50,
        gpsFreshnessSeconds: 60,
        observePublicHolidays: true,
        createdAt: new Date(ISO),
      },
    ],
  };

  it("returns versions nested on the policy, not a paginated flat row", async () => {
    mocks.policyFindMany.mockResolvedValue([policyRow]);
    const { res, result } = response();

    await policyController.listPolicies(requestFor(), res);

    expect(result.body).toEqual({ success: true, data: [policyRow] });
    const policy = (result.body as { data: typeof policyRow[] }).data[0];
    expect(keysOf(policy)).toEqual(
      ["businessId", "createdAt", "id", "isDefault", "name", "shift", "shiftId", "updatedAt", "versions"].sort()
    );
    expect(keysOf(policy.versions[0])).toEqual(
      [
        "autoClockOutBufferMinutes",
        "autoClockOutEnabled",
        "autoClockOutMaxOpenMinutes",
        "businessId",
        "correctionWindowDays",
        "createdAt",
        "earlyThresholdMinutes",
        "effectiveFrom",
        "effectiveTo",
        "geoFenceRadiusMeters",
        "gpsFreshnessSeconds",
        "graceEarlyMinutes",
        "graceLateMinutes",
        "id",
        "locationAccuracyThresholdMeters",
        "observePublicHolidays",
        "policyId",
        "versionNumber",
      ].sort()
    );
    expect(policy).not.toHaveProperty("pagination");
    expect(policy).not.toHaveProperty("graceLateMinutes");
    expect(policy.versions[0]).not.toHaveProperty("version");
  });
});

// ── 3. Nested calendar exceptions ───────────────────────────────────────────

describe("calendar contract", () => {
  const calendarRow = {
    id: UUID,
    businessId: mocks.businessId,
    name: "Default calendar",
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    timezone: "Africa/Accra",
    isDefault: true,
    createdAt: new Date(ISO),
    updatedAt: new Date(ISO),
    exceptions: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        calendarId: UUID,
        date: new Date("2026-12-25T00:00:00.000Z"),
        kind: "HOLIDAY",
        name: "Christmas Day",
        createdAt: new Date(ISO),
      },
    ],
  };

  it("returns exceptions nested on the calendar, not a paginated flat row", async () => {
    mocks.calendarFindMany.mockResolvedValue([calendarRow]);
    const { res, result } = response();

    await calendarController.listCalendars(requestFor(), res);

    expect(result.body).toEqual({ success: true, data: [calendarRow] });
    const calendar = (result.body as { data: typeof calendarRow[] }).data[0];
    expect(keysOf(calendar)).toEqual(
      [
        "businessId",
        "createdAt",
        "exceptions",
        "friday",
        "id",
        "isDefault",
        "monday",
        "name",
        "saturday",
        "sunday",
        "thursday",
        "timezone",
        "tuesday",
        "updatedAt",
        "wednesday",
      ].sort()
    );
    expect(keysOf(calendar.exceptions[0])).toEqual(
      ["calendarId", "createdAt", "date", "id", "kind", "name"].sort()
    );
    expect(calendar).not.toHaveProperty("pagination");
  });
});

// ── 4. Nested branding ──────────────────────────────────────────────────────

describe("business settings contract", () => {
  it("groups the four branding columns under data.branding", async () => {
    mocks.businessFindUnique.mockResolvedValue({
      name: "AttendPro Test",
      timezone: "Africa/Accra",
      logoUrl: "",
      brandColor: "#b45309",
      supportEmail: "support@attendpro.test",
      supportPhone: "",
      retentionYears: 7,
      retentionEnabled: false,
      attendanceRetentionDays: null,
      auditRetentionDays: null,
    });
    const { res, result } = response();

    await businessController.getBusinessSettings(requestFor(), res);

    const data = (result.body as { data: Record<string, unknown> }).data;
    expect(keysOf(data)).toEqual(
      [
        "attendanceRetentionDays",
        "auditRetentionDays",
        "branding",
        "name",
        "retentionEnabled",
        "retentionYears",
        "timezone",
      ].sort()
    );
    expect(data.branding).toEqual({
      logoUrl: "",
      brandColor: "#b45309",
      supportEmail: "support@attendpro.test",
      supportPhone: "",
    });
    expect(data).not.toHaveProperty("logoUrl");
    expect(data).not.toHaveProperty("brandColor");
  });
});

// ── 5. Flat attendance envelope ─────────────────────────────────────────────

describe("attendance contract", () => {
  const record = {
    id: UUID,
    userId: mocks.actorId,
    date: new Date("2026-10-05T00:00:00.000Z"),
    clockIn: new Date("2026-10-05T07:00:00.000Z"),
    clockOut: new Date("2026-10-05T15:30:00.000Z"),
    hoursWorked: 8.5,
    status: "ON_TIME",
    sessionStatus: "CLOSED",
    closureReason: null,
    requiresReviewReason: null,
    remarks: null,
    shiftId: null,
    shiftNameSnapshot: "Morning shift",
  };

  it("uses the flat count/total/page envelope, not a pagination object", async () => {
    mocks.attendanceFindMany.mockResolvedValue([record]);
    mocks.attendanceCount.mockResolvedValue(1);
    const { res, result } = response();

    await attendanceController.getMyAttendance(requestFor({ page: "2", limit: "10" }), res);

    const body = result.body as Record<string, unknown>;
    expect(keysOf(body)).toEqual(["count", "data", "page", "success", "total"].sort());
    expect(body).toMatchObject({ success: true, count: 1, total: 1, page: 2 });
    expect(body).not.toHaveProperty("pagination");
    expect(keysOf((body.data as typeof record[])[0])).toEqual(keysOf(record));
  });

  it("keeps the register's employee rename and shift snapshot precedence", async () => {
    mocks.attendanceFindMany.mockResolvedValue([
      {
        ...record,
        user: {
          id: mocks.actorId,
          employeeCode: "EMP-0002",
          firstName: "Ama",
          lastName: "Boateng",
        },
        shift: { id: "shift-1", name: "Live shift name" },
      },
    ]);
    mocks.attendanceCount.mockResolvedValue(1);
    const { res, result } = response();

    await reportController.attendanceRegister(
      requestFor({ startDate: "2026-10-01", endDate: "2026-10-31", page: 1, limit: 10 }),
      res
    );

    const body = result.body as { data: Array<Record<string, unknown>>; pagination: Record<string, unknown> };
    expect(body.pagination).toEqual({ currentPage: 1, totalPages: 1, total: 1 });
    expect(keysOf(body.data[0])).toEqual(
      [
        "clockIn",
        "clockOut",
        "closureReason",
        "date",
        "employee",
        "hoursWorked",
        "id",
        "requiresReviewReason",
        "sessionStatus",
        "shiftId",
        "shiftName",
        "status",
      ].sort()
    );
    expect(body.data[0].employee).toMatchObject({ employeeCode: "EMP-0002" });
    expect(body.data[0].shiftName).toBe("Morning shift");
    expect(body.data[0]).not.toHaveProperty("user");
  });
});

// ── 6. Pagination key variants ──────────────────────────────────────────────

describe("pagination contract", () => {
  it("uses totalUsers for the account directory", async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: mocks.actorId,
      businessId: mocks.businessId,
      role: "SUPERADMIN",
      isActive: true,
      mustChangePassword: false,
    });
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userCount.mockResolvedValue(0);
    const { res, result } = response();

    await userController.getAllUsers(requestFor(), res);

    const body = result.body as { pagination: Record<string, unknown> };
    // The directory handler does not clamp an empty page: 0 rows → 0 pages.
    expect(body.pagination).toEqual({ currentPage: 1, totalPages: 0, totalUsers: 0 });
  });

  it("uses total for the HR correction queue", async () => {
    mocks.correctionFindMany.mockResolvedValue([]);
    mocks.correctionCount.mockResolvedValue(0);
    const { res, result } = response();

    await correctionController.listBusinessCorrections(requestFor({ page: 1, limit: 10 }), res);

    const body = result.body as { pagination: Record<string, unknown> };
    expect(keysOf(body.pagination)).toEqual(["currentPage", "total", "totalPages"].sort());
    expect(body.pagination).not.toHaveProperty("totalRecords");
  });

  it("uses totalDevices for the kiosk device list", async () => {
    mocks.kioskFindMany.mockResolvedValue([]);
    mocks.kioskCount.mockResolvedValue(0);
    const { res, result } = response();

    await kioskDeviceController.listDevices(requestFor({ page: "1", limit: "10" }), res);

    const body = result.body as { pagination: Record<string, unknown> };
    expect(body.pagination).toEqual({ currentPage: 1, totalPages: 0, totalDevices: 0 });
    expect(body.pagination).not.toHaveProperty("totalRecords");
  });
});

// ── 7. Jobs object ──────────────────────────────────────────────────────────

describe("job status contract", () => {
  it("returns the lastRun/closed/flagged object", async () => {
    const { res, result } = response();

    await jobController.jobStatus(requestFor(), res);

    expect(result.body).toEqual({
      success: true,
      message: "Job status",
      data: { lastRun: null, closed: 0, flagged: 0 },
    });
    expect(keysOf((result.body as { data: object }).data)).toEqual(
      ["closed", "flagged", "lastRun"].sort()
    );
  });
});
