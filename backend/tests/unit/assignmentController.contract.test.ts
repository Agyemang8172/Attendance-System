import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * The assignment path is the only writer of the legacy `users.shift_id`
 * pointer. This suite pins that the write is tenant-scoped, so a pointer can
 * never be set on a row outside the caller's business, and that the pointer
 * is only written once the shift and the employee have both been checked.
 */

const mocks = vi.hoisted(() => ({
  shiftFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  businessFindFirst: vi.fn(),
  assignmentFindMany: vi.fn(),
  assignmentUpdateMany: vi.fn(),
  assignmentCreate: vi.fn(),
  userUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  businessId: vi.fn(),
  assignmentCreated: vi.fn(),
}));

const tx = {
  shiftAssignment: { findMany: mocks.assignmentFindMany, updateMany: mocks.assignmentUpdateMany, create: mocks.assignmentCreate },
  shift: { findFirst: mocks.shiftFindFirst },
  user: { findFirst: mocks.userFindFirst, updateMany: mocks.userUpdateMany },
  business: { findFirst: mocks.businessFindFirst },
  auditLog: { create: mocks.auditCreate },
  $executeRaw: mocks.executeRaw,
  $queryRaw: mocks.queryRaw,
};

vi.mock("../../config/prismaClient.js", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));
vi.mock("../../utils/tenant.js", () => ({ callerBusinessId: mocks.businessId }));
vi.mock("../../utils/logger.js", () => ({
  auditLog: { assignmentCreated: mocks.assignmentCreated, assignmentDeactivated: vi.fn() },
}));

const controller = await import("../../controllers/assignmentController.js");

const businessId = "business-one";
const shiftId = "11111111-1111-4111-8111-111111111111";
const employeeId = "22222222-2222-4222-8222-222222222222";

function request(body: Record<string, unknown> = {}) {
  return {
    user: { userId: "operator-one", role: "SUPERADMIN", businessId, tokenVersion: 1 },
    params: { id: shiftId }, query: {}, body, ip: "127.0.0.1",
  } as unknown as Request;
}

function response() {
  const result = { statusCode: 200, body: undefined as unknown };
  const res = {
    status: vi.fn((code: number) => { result.statusCode = code; return res; }),
    json: vi.fn((body: unknown) => { result.body = body; return res; }),
    setHeader: vi.fn(),
  };
  return { res: res as unknown as Response, result };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.businessId.mockResolvedValue(businessId);
  mocks.shiftFindFirst.mockResolvedValue({ id: shiftId });
  mocks.userFindFirst.mockResolvedValue({ id: employeeId });
  mocks.businessFindFirst.mockResolvedValue({ timezone: "UTC" });
  mocks.assignmentFindMany.mockResolvedValue([]);
  mocks.queryRaw.mockResolvedValue([{ now: new Date() }]);
  mocks.assignmentUpdateMany.mockResolvedValue({ count: 1 });
  mocks.assignmentCreate.mockResolvedValue({
    id: "assignment-one", businessId, userId: employeeId, shiftId,
    effectiveFrom: new Date("2026-11-10T00:00:00.000Z"), effectiveTo: null,
  });
  mocks.userUpdateMany.mockResolvedValue({ count: 1 });
  mocks.auditCreate.mockResolvedValue({ id: "audit-one" });
  mocks.transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));
});

describe("assignment pointer compatibility", () => {
  it("maps a nested PostgreSQL exclusion violation to a sanitized 409", async () => {
    mocks.transaction.mockRejectedValueOnce({
      driverAdapterError: { cause: { originalCode: "23P01", message: "secret constraint and row details" } },
    });
    const { res, result } = response();
    await controller.createAssignment(request({ employeeId, effectiveFrom: new Date().toISOString().slice(0, 10), reason: "Conflict" }), res);
    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual({ success: false, message: "Assignment conflicts with an existing period" });
    expect(JSON.stringify(result.body)).not.toContain("secret constraint");
  });

  it("writes the compatibility pointer inside the caller's business", async () => {
    const { res, result } = response();
    await controller.createAssignment(request({ employeeId, effectiveFrom: new Date().toISOString().slice(0, 10), reason: "Contract test" }), res);
    expect(result.statusCode).toBe(201);
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({ where: { id: employeeId, businessId }, data: { shiftId } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      businessId, actorUserId: "operator-one", reason: "Contract test", action: "assignment.created",
    }) }));
  });

  it("refuses a shift from another business and writes no pointer", async () => {
    mocks.shiftFindFirst.mockResolvedValue(null);
    const { res, result } = response();
    await controller.createAssignment(request({ employeeId, effectiveFrom: new Date().toISOString().slice(0, 10), reason: "Contract test" }), res);
    expect(result.statusCode).toBe(404);
    expect(mocks.shiftFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: shiftId, businessId, isActive: true } }));
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("refuses an employee from another business and writes no pointer", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    const { res, result } = response();
    await controller.createAssignment(request({ employeeId, effectiveFrom: new Date().toISOString().slice(0, 10), reason: "Contract test" }), res);
    expect(result.statusCode).toBe(404);
    expect(mocks.userFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: employeeId, businessId, isActive: true } }));
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("refuses an inactive employee and writes no pointer", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    const { res, result } = response();
    await controller.createAssignment(request({ employeeId, effectiveFrom: new Date().toISOString().slice(0, 10), reason: "Contract test" }), res);
    expect(result.statusCode).toBe(404);
    expect(mocks.userFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: employeeId, businessId, isActive: true } }));
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
