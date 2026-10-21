/**
 * M9 — failure-path coverage for the controller catch blocks.
 *
 * Every controller ends with the same pair of arms: an `instanceof Error`
 * branch and a non-Error fallback that exists so a thrown string cannot hang
 * the request. Integration tests reach neither arm for read-only handlers,
 * because nothing in the happy path throws. These tests call the handlers
 * directly with a caller attached and make the first Prisma call reject, once
 * with an Error and once with a string, then assert the 500.
 *
 * No rows are written: the rejection happens before the handler's first write.
 * The spies are static (`prisma.user.findUnique`, `prisma.attendance.find*`)
 * and restored immediately; a dynamic spy on the delegate proxy leaks into
 * later files in the single-fork runner.
 */
import { describe, it, expect, vi } from "vitest";
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
import * as attendanceController from "../controllers/attendanceController.js";

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;
type Failure = () => Error | string;

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ROW_ID = "00000000-0000-4000-8000-000000000002";

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, unknown>,
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
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
  res.setHeader.mockImplementation((name: string, value: unknown) => {
    res.headers[name] = value;
    return res;
  });
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, unknown>;
  };
}

function fakeReq(): Request {
  return {
    method: "GET",
    url: "/test",
    ip: "127.0.0.1",
    headers: {},
    user: { userId: USER_ID, role: "SUPERADMIN" },
    kiosk: undefined,
    body: {
      reason: "failure injection",
      currentPassword: "Current123!",
      newPassword: "Next12345!",
      currentPin: "1234",
      newPin: "5678",
    },
    query: { startDate: "2026-10-01", endDate: "2026-10-31", groupBy: "employee" },
    params: { id: ROW_ID, attendanceId: ROW_ID },
    get: () => "vitest",
  } as unknown as Request;
}

const userLookupHandlers: Array<[string, Handler]> = [
  ["assignment.createAssignment", assignmentController.createAssignment],
  ["assignment.listAssignments", assignmentController.listAssignments],
  ["assignment.deactivateAssignment", assignmentController.deactivateAssignment],
  ["audit.listAudit", auditController.listAudit],
  ["audit.getAuditById", auditController.getAuditById],
  ["audit.getCorrectionTrail", auditController.getCorrectionTrail],
  ["business.getBusinessSettings", businessController.getBusinessSettings],
  ["business.updateBusinessSettings", businessController.updateBusinessSettings],
  ["calendar.listCalendars", calendarController.listCalendars],
  ["calendar.updateCalendar", calendarController.updateCalendar],
  ["calendar.createCalendarException", calendarController.createCalendarException],
  ["correction.createCorrection", correctionController.createCorrection],
  ["correction.listMyCorrections", correctionController.listMyCorrections],
  ["correction.getMyCorrection", correctionController.getMyCorrection],
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
  ["user.changePassword", userController.changePassword],
  ["user.resetPin", userController.resetPin],
];

const attendanceManyHandlers: Array<[string, Handler]> = [
  ["attendance.getMyAttendance", attendanceController.getMyAttendance],
];

const attendanceFirstHandlers: Array<[string, Handler]> = [
  ["attendance.dismissAlert", attendanceController.dismissAlert],
];

const failures: Array<[string, Failure]> = [
  ["Error", () => new Error("injected failure")],
  ["non-Error", () => "injected failure"],
];

describe.each(failures)("controller failures on prisma.user.findUnique (%s arm)", (_label, makeFailure) => {
  it.each(userLookupHandlers)("%s answers 500", async (_name, handler) => {
    const original = prisma.user.findUnique;
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(makeFailure());
    try {
      const res = fakeRes();
      await handler(fakeReq(), res);
      expect(res.statusCode).toBe(500);
    } finally {
      spy.mockRestore();
      // Single-fork runs share the Prisma client; restore the exact original
      // so a spy cannot bleed into the next file.
      (prisma.user as unknown as { findUnique: typeof original }).findUnique = original;
    }
  });
});

describe.each(failures)("controller failures on prisma.attendance.findMany (%s arm)", (_label, makeFailure) => {
  it.each(attendanceManyHandlers)("%s answers 500", async (_name, handler) => {
    const original = prisma.attendance.findMany;
    const spy = vi.spyOn(prisma.attendance, "findMany").mockRejectedValueOnce(makeFailure());
    try {
      const res = fakeRes();
      await handler(fakeReq(), res);
      expect(res.statusCode).toBe(500);
    } finally {
      spy.mockRestore();
      (prisma.attendance as unknown as { findMany: typeof original }).findMany = original;
    }
  });
});

describe.each(failures)("controller failures on prisma.attendance.findFirst (%s arm)", (_label, makeFailure) => {
  it.each(attendanceFirstHandlers)("%s answers 500", async (_name, handler) => {
    const original = prisma.attendance.findFirst;
    const spy = vi.spyOn(prisma.attendance, "findFirst").mockRejectedValueOnce(makeFailure());
    try {
      const res = fakeRes();
      await handler(fakeReq(), res);
      expect(res.statusCode).toBe(500);
    } finally {
      spy.mockRestore();
      (prisma.attendance as unknown as { findFirst: typeof original }).findFirst = original;
    }
  });
});
