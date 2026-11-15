/**
 * M9 — defensive-guard unit coverage.
 *
 * Every route is behind `authMiddleware`, so the handlers' own
 * `!caller` / `!req.user` / no-business guards are unreachable through
 * supertest: the middleware answers first. They are still the last line of
 * defence if a future route is mounted without the gate, so this file calls
 * the exported handlers directly with a fake req/res and asserts the refusal.
 *
 * Most cases are unit tests and stub the tenant lookup. The account-controller
 * tenant-boundary cases read one existing administrator so they can prove that
 * changing only the business changes a 200 into a 401.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import assignmentController from "../controllers/assignmentController.js";
import auditController from "../controllers/auditController.js";
import businessController from "../controllers/businessController.js";
import calendarController from "../controllers/calendarController.js";
import correctionController from "../controllers/correctionController.js";
import helpRequestController from "../controllers/helpRequestController.js";
import kioskDeviceController from "../controllers/kioskDeviceController.js";
import policyController from "../controllers/policyController.js";
import qrController from "../controllers/qrController.js";
import reportController from "../controllers/reportController.js";
import shiftController from "../controllers/shiftController.js";
import siteController from "../controllers/siteController.js";
import staffProfileController from "../controllers/staffProfileController.js";
import staffScheduleController from "../controllers/staffScheduleController.js";
import userController from "../controllers/userController.js";

// Stub the application client that the tenant proxy delegates to. Spying on
// the outer proxy is unsafe because it creates a new wrapper on every access.
const appPrisma = (globalThis as unknown as { prismaApp?: typeof prisma }).prismaApp;
if (!appPrisma) throw new Error("Prisma application client is unavailable");
import * as attendanceController from "../controllers/attendanceController.js";

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
    get: vi.fn(() => "0"),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send.mockImplementation(() => res);
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function fakeReq(overrides: Record<string, unknown> = {}): Request {
  return {
    method: "GET",
    url: "/test",
    ip: "127.0.0.1",
    headers: {},
    body: {},
    query: {},
    params: {},
    user: undefined,
    kiosk: undefined,
    get: () => "vitest",
    ...overrides,
  } as unknown as Request;
}

const anonymousHandlers: Array<[string, Handler]> = [
  ["assignment.createAssignment", assignmentController.createAssignment],
  ["assignment.listAssignments", assignmentController.listAssignments],
  ["assignment.deactivateAssignment", assignmentController.deactivateAssignment],
  ["audit.getCorrectionTrail", auditController.getCorrectionTrail],
  ["audit.listAudit", auditController.listAudit],
  ["audit.getAuditById", auditController.getAuditById],
  ["business.getBusinessSettings", businessController.getBusinessSettings],
  ["business.updateBusinessSettings", businessController.updateBusinessSettings],
  ["calendar.listCalendars", calendarController.listCalendars],
  ["calendar.updateCalendar", calendarController.updateCalendar],
  ["calendar.createCalendarException", calendarController.createCalendarException],
  ["correction.createCorrection", correctionController.createCorrection],
  ["correction.listMyCorrections", correctionController.listMyCorrections],
  ["correction.getMyCorrection", correctionController.getMyCorrection],
  ["correction.getOwnCorrectionDetail", correctionController.getOwnCorrectionDetail],
  ["correction.listBusinessCorrections", correctionController.listBusinessCorrections],
  ["correction.decideCorrection", correctionController.decideCorrection],
  ["helpRequest.createHelpRequest", helpRequestController.createHelpRequest],
  ["helpRequest.listMyHelpRequests", helpRequestController.listMyHelpRequests],
  ["helpRequest.getMyHelpRequest", helpRequestController.getMyHelpRequest],
  ["helpRequest.listBusinessHelpRequests", helpRequestController.listBusinessHelpRequests],
  ["helpRequest.updateHelpRequest", helpRequestController.updateHelpRequest],
  ["kioskDevice.createPairingCode", kioskDeviceController.createPairingCode],
  ["kioskDevice.listDevices", kioskDeviceController.listDevices],
  ["kioskDevice.revokeDevice", kioskDeviceController.revokeDevice],
  ["policy.listPolicies", policyController.listPolicies],
  ["policy.createPolicy", policyController.createPolicy],
  ["policy.createPolicyVersion", policyController.createPolicyVersion],
  ["qr.issueQrCredential", qrController.issueQrCredential],
  ["qr.revokeQrCredential", qrController.revokeQrCredential],
  ["report.attendanceRegister", reportController.attendanceRegister],
  ["report.punctualitySummary", reportController.punctualitySummary],
  ["report.exceptionsReport", reportController.exceptionsReport],
  ["report.attendanceRegisterCsv", reportController.attendanceRegisterCsv],
  ["shift.listShifts", shiftController.listShifts],
  ["shift.createShift", shiftController.createShift],
  ["shift.updateShift", shiftController.updateShift],
  ["shift.deactivateShift", shiftController.deactivateShift],
  ["site.listSites", siteController.listSites],
  ["site.createSite", siteController.createSite],
  ["site.updateSite", siteController.updateSite],
  ["site.deactivateSite", siteController.deactivateSite],
  ["staffProfile.changePin", staffProfileController.changePin],
  ["staffSchedule.getMySchedule", staffScheduleController.getMySchedule],
  ["staffSchedule.getMyOffDays", staffScheduleController.getMyOffDays],
  ["user.getAllUsers", userController.getAllUsers],
  ["user.getUserById", userController.getUserById],
  ["user.createUser", userController.createUser],
  ["user.updateUser", userController.updateUser],
  ["user.deleteUser", userController.deleteUser],
  ["user.resetPassword", userController.resetPassword],
  ["user.resetPin", userController.resetPin],
  ["attendance.clockIn", attendanceController.clockIn],
  ["attendance.clockOut", attendanceController.clockOut],
  ["attendance.getMyAttendance", attendanceController.getMyAttendance],
  ["attendance.dismissAlert", attendanceController.dismissAlert],
];

describe("handlers refuse an anonymous caller", () => {
  it.each(anonymousHandlers)("%s answers 401", async (_name, handler) => {
    const res = fakeRes();
    await handler(fakeReq(), res);
    expect(res.statusCode).toBe(401);
  });
});

/**
 * The tenant lookup is the one Prisma call these handlers make before their
 * no-business refusal. Returning a row with a null businessId is the only way
 * to reach that guard without corrupting a real account.
 */
const noBusinessHandlers: Array<[string, Handler]> = [
  ["assignment.createAssignment", assignmentController.createAssignment],
  ["assignment.listAssignments", assignmentController.listAssignments],
  ["assignment.deactivateAssignment", assignmentController.deactivateAssignment],
  ["audit.getCorrectionTrail", auditController.getCorrectionTrail],
  ["audit.listAudit", auditController.listAudit],
  ["audit.getAuditById", auditController.getAuditById],
  ["business.getBusinessSettings", businessController.getBusinessSettings],
  ["business.updateBusinessSettings", businessController.updateBusinessSettings],
  ["calendar.listCalendars", calendarController.listCalendars],
  ["calendar.updateCalendar", calendarController.updateCalendar],
  ["calendar.createCalendarException", calendarController.createCalendarException],
  ["correction.createCorrection", correctionController.createCorrection],
  ["correction.listMyCorrections", correctionController.listMyCorrections],
  ["correction.getMyCorrection", correctionController.getMyCorrection],
  ["correction.getOwnCorrectionDetail", correctionController.getOwnCorrectionDetail],
  ["correction.listBusinessCorrections", correctionController.listBusinessCorrections],
  ["correction.decideCorrection", correctionController.decideCorrection],
  ["helpRequest.createHelpRequest", helpRequestController.createHelpRequest],
  ["helpRequest.listMyHelpRequests", helpRequestController.listMyHelpRequests],
  ["helpRequest.getMyHelpRequest", helpRequestController.getMyHelpRequest],
  ["helpRequest.listBusinessHelpRequests", helpRequestController.listBusinessHelpRequests],
  ["helpRequest.updateHelpRequest", helpRequestController.updateHelpRequest],
  ["kioskDevice.createPairingCode", kioskDeviceController.createPairingCode],
  ["kioskDevice.listDevices", kioskDeviceController.listDevices],
  ["kioskDevice.revokeDevice", kioskDeviceController.revokeDevice],
  ["policy.listPolicies", policyController.listPolicies],
  ["policy.createPolicy", policyController.createPolicy],
  ["policy.createPolicyVersion", policyController.createPolicyVersion],
  ["qr.issueQrCredential", qrController.issueQrCredential],
  ["qr.revokeQrCredential", qrController.revokeQrCredential],
  ["report.attendanceRegister", reportController.attendanceRegister],
  ["report.punctualitySummary", reportController.punctualitySummary],
  ["report.exceptionsReport", reportController.exceptionsReport],
  ["report.attendanceRegisterCsv", reportController.attendanceRegisterCsv],
  ["shift.listShifts", shiftController.listShifts],
  ["shift.createShift", shiftController.createShift],
  ["shift.updateShift", shiftController.updateShift],
  ["shift.deactivateShift", shiftController.deactivateShift],
  ["site.listSites", siteController.listSites],
  ["site.createSite", siteController.createSite],
  ["site.updateSite", siteController.updateSite],
  ["site.deactivateSite", siteController.deactivateSite],
  ["staffSchedule.getMySchedule", staffScheduleController.getMySchedule],
  ["staffSchedule.getMyOffDays", staffScheduleController.getMyOffDays],
  // The account controller is absent from this list on purpose. It resolves
  // its tenant by looking the caller up with both the account id and the
  // business the request names, so it has no "account with no business" state
  // to refuse: the business column is not nullable, and a caller whose
  // request names a business the account does not belong to is refused with
  // 401 by that lookup instead. The list below covers the controllers that
  // do resolve the business separately.
];

/**
 * The account controller refuses a caller whose request names a business the
 * account does not belong to. The lookup requires both the id and the
 * business, so a mismatched tenant finds no account and the request is
 * refused as unauthenticated rather than reaching the body check.
 */
const tenantMismatchHandlers: Array<[string, Handler]> = [
  ["user.getAllUsers", userController.getAllUsers],
  ["user.getUserById", userController.getUserById],
  ["user.createUser", userController.createUser],
  ["user.updateUser", userController.updateUser],
  ["user.deleteUser", userController.deleteUser],
  ["user.resetPassword", userController.resetPassword],
  ["user.resetPin", userController.resetPin],
];

/**
 * A body that could not pass validation, so a handler that reads the body
 * before it settles the caller would answer 400 instead of 401.
 */
const malformedBodies: Record<string, Record<string, unknown>> = {
  "user.createUser": { firstName: "Only", lastName: "One", email: "not-an-email", department: "Operations" },
  "user.updateUser": { email: "not-an-email" },
  "user.resetPin": {},
};

describe("the account controller refuses a caller from another business", () => {
  let account: { id: string; businessId: string } | null = null;

  beforeAll(async () => {
    // `findMany` rather than `findFirst`: the failure-path suite spies on
    // `findFirst` and `findUnique` on the shared client, and this lookup must
    // not be the call that a spy intercepts.
    const rows = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["HR", "SUPERADMIN"] } },
      select: { id: true, businessId: true },
      take: 1,
    });
    account = rows[0] ?? null;
  });

  it.each(tenantMismatchHandlers)("%s answers 401", async (_name, handler) => {
    const res = fakeRes();
    await handler(
      fakeReq({
        user: {
          userId: account?.id,
          role: "SUPERADMIN",
          businessId: "00000000-0000-0000-0000-0000000000ff",
        },
        body: { reason: "guard test" },
        params: { id: account?.id },
      }),
      res
    );
    expect(res.statusCode).toBe(401);
  });

  it("finds the same account when the request names its own business", async () => {
    const res = fakeRes();
    await userController.getAllUsers(
      fakeReq({
        user: { userId: account?.id, role: "SUPERADMIN", businessId: account?.businessId },
        query: {},
      }),
      res
    );
    // The refusal above is about the business, not about a missing account.
    expect(res.statusCode).toBe(200);
  });
});

describe("a caller is settled before the request body is judged", () => {
  it.each(Object.entries(malformedBodies))("%s answers 401 for an anonymous caller", async (name, body) => {
    const handler = tenantMismatchHandlers.find(([handlerName]) => handlerName === name)?.[1];
    expect(handler).toBeDefined();
    const res = fakeRes();
    await handler?.(fakeReq({ body }), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("user.changePassword with a body but no session", () => {
  it("answers 401 only after the body check", async () => {
    const res = fakeRes();
    await userController.changePassword(
      fakeReq({ body: { currentPassword: "Current123!", newPassword: "Next12345!" } }),
      res
    );
    expect(res.statusCode).toBe(401);
  });
});

describe("handlers refuse an account with no business", () => {
  it.each(noBusinessHandlers)("%s answers 400", async (_name, handler) => {
    const original = appPrisma.user.findUnique;
    const spy = vi.spyOn(appPrisma.user, "findUnique").mockResolvedValue({ businessId: null } as never);
    try {
      const res = fakeRes();
      const req = fakeReq({
        user: { userId: "00000000-0000-4000-8000-000000000001", role: "SUPERADMIN" },
        body: { reason: "guard test" },
        params: { id: "00000000-0000-4000-8000-000000000002" },
      });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ success: false, message: "Account has no business" });
    } finally {
      spy.mockRestore();
      appPrisma.user.findUnique = original;
    }
  });
});
