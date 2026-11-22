import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  assignmentFindFirst: vi.fn(), shiftFindFirst: vi.fn(), attendanceFindFirst: vi.fn(),
  attendanceCreate: vi.fn(), sessionFindUnique: vi.fn(), sessionUpdateMany: vi.fn(),
  userFindUnique: vi.fn(), policyFindFirst: vi.fn(), businessFindUnique: vi.fn(),
  attemptCreate: vi.fn(), transaction: vi.fn(), writeAudit: vi.fn(),
}));
vi.mock("../../config/prismaClient.js", () => ({ default: {
  shiftAssignment: { findFirst: mocks.assignmentFindFirst }, shift: { findFirst: mocks.shiftFindFirst },
  attendance: { findFirst: mocks.attendanceFindFirst }, verificationSession: { findUnique: mocks.sessionFindUnique },
  user: { findUnique: mocks.userFindUnique }, workplacePolicy: { findFirst: mocks.policyFindFirst },
  business: { findUnique: mocks.businessFindUnique }, $transaction: mocks.transaction,
} }));
vi.mock("../../controllers/kioskVerifyController.js", () => ({
  hashSessionHandle: () => "hashed", resolveKioskSite: async () => ({ siteId: null, site: null }),
  SESSION_EXPIRED: {}, SESSION_LOCKED: {}, SESSION_UNKNOWN: {}, SESSION_USED: {},
}));
vi.mock("../../utils/location.js", () => ({ assessLocation: () => ({ result: "INSIDE", reason: "within site", distanceMeters: 0 }) }));
vi.mock("../../utils/auditWriter.js", () => ({ writeAudit: mocks.writeAudit }));
vi.mock("../../utils/logger.js", () => ({ auditLog: { attendanceRecorded: vi.fn() }, logError: vi.fn() }));

const { clockIn } = await import("../../controllers/attendanceController.js");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.sessionFindUnique.mockResolvedValue({ id: "session", employeeId: "employee", kioskId: "kiosk",
    state: "VERIFIED", expiresAt: new Date(Date.now() + 60_000) });
  mocks.userFindUnique.mockResolvedValue({ id: "employee", businessId: "business", isActive: true, shiftId: "stale-shift" });
  mocks.attendanceFindFirst.mockResolvedValue(null);
  mocks.policyFindFirst.mockResolvedValue(null);
  mocks.businessFindUnique.mockResolvedValue({ timezone: "UTC" });
  mocks.assignmentFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "completed-assignment" });
  mocks.attendanceCreate.mockResolvedValue({ id: "punch" });
  mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    attendance: { create: mocks.attendanceCreate }, verificationSession: { updateMany: mocks.sessionUpdateMany },
    attendanceAttempt: { create: mocks.attemptCreate },
  }));
});

describe("attendance in an assignment gap", () => {
  it("does not use a stale legacy pointer when historical assignment rows exist", async () => {
    const req = { kiosk: { kioskId: "kiosk", businessId: "business" },
      body: { verificationSessionId: "opaque" }, ip: "127.0.0.1", get: () => undefined } as unknown as Request;
    const result = { status: 200, body: undefined as unknown };
    const res = { status(code: number) { result.status = code; return this; },
      json(body: unknown) { result.body = body; return this; } } as Response;
    await clockIn(req, res);
    expect(result.status).toBe(201);
    expect(mocks.assignmentFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.assignmentFindFirst).toHaveBeenNthCalledWith(2, {
      where: { userId: "employee", businessId: "business" }, select: { id: true },
    });
    expect(mocks.shiftFindFirst).not.toHaveBeenCalled();
    expect(mocks.attendanceCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      shiftId: null, shiftNameSnapshot: null, shiftStartMinuteSnapshot: null,
    }) }));
  });
  it("does not revive a stale pointer when the only history is a cancelled [F,F) row", async () => {
    const start = new Date(Date.now() + 86_400_000);
    mocks.assignmentFindFirst.mockReset().mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "cancelled-future", effectiveFrom: start, effectiveTo: start });
    const req = { kiosk: { kioskId: "kiosk", businessId: "business" },
      body: { verificationSessionId: "opaque" }, ip: "127.0.0.1", get: () => undefined } as unknown as Request;
    const result = { status: 200, body: undefined as unknown };
    const res = { status(code: number) { result.status = code; return this; },
      json(body: unknown) { result.body = body; return this; } } as Response;
    await clockIn(req, res);
    expect(result.status).toBe(201);
    expect(mocks.assignmentFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.assignmentFindFirst).toHaveBeenNthCalledWith(2, {
      where: { userId: "employee", businessId: "business" }, select: { id: true },
    });
    expect(mocks.shiftFindFirst).not.toHaveBeenCalled();
    expect(mocks.attendanceCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      shiftId: null, shiftNameSnapshot: null, shiftStartMinuteSnapshot: null,
    }) }));
  });
});
