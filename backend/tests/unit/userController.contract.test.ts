import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";

const mocks = vi.hoisted(() => {
  const user = {
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
  };
  return {
    user, queryRaw: vi.fn(), auditCreate: vi.fn(), expireSessions: vi.fn(),
    transaction: vi.fn(), compare: vi.fn(), hash: vi.fn(), sign: vi.fn(),
    shiftFindFirst: vi.fn(),
  };
});

const tx = {
  user: mocks.user,
  shift: { findFirst: mocks.shiftFindFirst },
  $queryRaw: mocks.queryRaw,
  $executeRaw: mocks.queryRaw,
  auditLog: { create: mocks.auditCreate },
  verificationSession: { updateMany: mocks.expireSessions },
};

vi.mock("../../config/prismaClient.js", () => ({
  default: { ...tx, $transaction: mocks.transaction },
}));
vi.mock("bcrypt", () => ({ default: { compare: mocks.compare, hash: mocks.hash } }));
vi.mock("../../utils/tokens.js", () => ({ signAccessToken: mocks.sign }));
vi.mock("../../utils/logger.js", () => ({
  userLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  auditLog: {
    userCreated: vi.fn(), userUpdated: vi.fn(), userDeactivated: vi.fn(),
    passwordReset: vi.fn(), passwordChanged: vi.fn(), pinReset: vi.fn(),
  },
}));
vi.mock("../../utils/auditWriter.js", () => ({ writeAudit: vi.fn() }));
// Mount smoke only: production middleware behavior is an integration concern.
vi.mock("../../middleware/authMiddleware.js", () => ({ default: vi.fn() }));
vi.mock("../../middleware/roleMiddleware.js", () => ({ default: () => vi.fn() }));
vi.mock("../../middleware/requirePasswordChange.js", () => ({ default: () => vi.fn() }));
vi.mock("../../middleware/validate.js", () => ({ validate: () => vi.fn() }));
vi.mock("../../controllers/helpRequestController.js", () => ({
  listBusinessHelpRequests: vi.fn(), updateHelpRequest: vi.fn(),
}));
vi.mock("../../controllers/correctionController.js", () => ({
  listBusinessCorrections: vi.fn(), decideCorrection: vi.fn(),
}));

const controller = await import("../../controllers/userController.js");
const businessId = "business-one";
const staff = {
  id: "staff-one", businessId, role: "STAFF", isActive: true,
  firstName: "Mina", lastName: "Reed", email: "mina@example.test",
  employeeCode: "EMP-0007", department: "Operations", tokenVersion: 2,
  password: "stored-password-hash", mustChangePassword: false,
};
const operator = { ...staff, id: "operator-one", role: "SUPERADMIN", tokenVersion: 4 };
let currentActor = operator;

function request(role = "SUPERADMIN", body: Record<string, unknown> = {}, id = staff.id) {
  currentActor = role === "STAFF" ? { ...staff, tokenVersion: 4 } : { ...operator, role };
  return {
    user: { userId: role === "STAFF" ? staff.id : operator.id, role, businessId, tokenVersion: 4 },
    params: { id }, query: {}, body, ip: "127.0.0.1",
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
  currentActor = operator;
  mocks.transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));
  mocks.queryRaw.mockResolvedValue([{ id: businessId }]);
  const lookup = async (args: { where: { id?: string } }) =>
    args.where.id === currentActor.id ? currentActor : { ...staff, id: args.where.id ?? staff.id };
  mocks.user.findUnique.mockImplementation(lookup);
  mocks.user.findFirst.mockImplementation(lookup);
  mocks.user.findMany.mockResolvedValue([]);
  mocks.user.count.mockResolvedValue(2);
  mocks.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.user.update.mockResolvedValue({ ...staff, tokenVersion: 3 });
  mocks.auditCreate.mockResolvedValue({ id: "audit-one" });
  mocks.expireSessions.mockResolvedValue({ count: 1 });
  mocks.hash.mockResolvedValue("replacement-hash");
  mocks.compare.mockResolvedValue(true);
  mocks.sign.mockReturnValue("replacement-access-token");
});

describe("account controller contracts without a database", () => {
  it("exports every handler mounted by users and HR routes", () => {
    for (const name of ["getAllUsers", "getUserById", "createUser", "updateUser", "deleteUser", "changePassword", "resetPassword", "resetPin"] as const) {
      expect(controller[name], name).toBeTypeOf("function");
      expect(controller.default[name], `default.${name}`).toBe(controller[name]);
    }
  });

  it("registers actual users and HR route aliases with defined account handlers", async () => {
    const users = (await import("../../routes/userRoutes.js")).default;
    const hr = (await import("../../routes/hrRoutes.js")).default;
    type Layer = { route?: { path: string; stack: Array<{ handle: unknown }> } };
    const handlerFor = (router: { stack: Layer[] }, path: string, handler: unknown) =>
      router.stack.some((layer) => layer.route?.path === path &&
        layer.route.stack.some((entry) => entry.handle === handler));
    expect(handlerFor(users, "/", controller.getAllUsers)).toBe(true);
    expect(handlerFor(hr, "/employees", controller.getAllUsers)).toBe(true);
    expect(handlerFor(users, "/:id/reset-password", controller.resetPassword)).toBe(true);
    expect(handlerFor(hr, "/users/:id/reset-pin", controller.resetPin)).toBe(true);
    expect(handlerFor(users, "/:id", controller.updateUser)).toBe(true);
    expect(handlerFor(hr, "/employees/:id", controller.updateUser)).toBe(true);
  });

  it("rejects unauthenticated directory access before a database query", async () => {
    const { res, result } = response();
    await controller.getAllUsers({ query: {} } as Request, res);
    expect(result.statusCode).toBe(401);
    expect(mocks.user.findMany).not.toHaveBeenCalled();
  });

  it("scopes the HR directory to the caller business and STAFF roles", async () => {
    const { res, result } = response();
    await controller.getAllUsers(request("HR"), res);
    expect(result.statusCode).toBe(200);
    expect(mocks.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId, role: "STAFF" }),
      select: expect.objectContaining({ id: true, employeeCode: true }),
    }));
    const selection = mocks.user.findMany.mock.calls[0][0].select;
    for (const secret of ["password", "pinHash", "pinSalt", "tokenVersion"]) expect(selection[secret]).not.toBe(true);
    expect(result.body).toEqual(expect.objectContaining({ pagination: expect.objectContaining({ totalUsers: 2 }) }));
  });

  it("bounds pagination even when the HR alias has no query validator", async () => {
    const req = request("HR");
    req.query = { limit: "500" };
    const { res, result } = response();
    await controller.getAllUsers(req, res);
    expect(result.statusCode).toBe(400);
    expect(mocks.user.findMany).not.toHaveBeenCalled();
  });

  it("refuses STAFF inspection of another account", async () => {
    const { res, result } = response();
    await controller.getUserById(request("STAFF", {}, "another-staff"), res);
    expect(result.statusCode).toBe(403);
  });

  it("does not expose a foreign-business detail", async () => {
    mocks.user.findFirst.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === operator.id ? operator : null);
    mocks.user.findUnique.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === operator.id ? operator : null);
    const { res, result } = response();
    await controller.getUserById(request(), res);
    expect(result.statusCode).toBe(404);
  });

  it("administrator password reset forces setup and revokes old tokens", async () => {
    const { res, result } = response();
    await controller.resetPassword(request(), res);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual(expect.objectContaining({ tempPassword: expect.any(String) }));
    expect(mocks.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mustChangePassword: true, tokenVersion: { increment: 1 } }),
    }));
    // An open kiosk session must not survive a credential reset.
    expect(mocks.expireSessions).toHaveBeenCalledWith({
      where: { businessId, employeeId: staff.id, consumedAt: null },
      data: { state: "EXPIRED" },
    });
    const tempPassword = (result.body as { tempPassword: string }).tempPassword;
    expect(JSON.stringify(mocks.auditCreate.mock.calls)).not.toContain(tempPassword);
    expect(JSON.stringify(result.body)).not.toContain("replacement-hash");
  });

  it("refuses an incorrect current password without writing", async () => {
    mocks.compare.mockResolvedValue(false);
    const { res, result } = response();
    await controller.changePassword(request("STAFF", {
      currentPassword: "devos123", newPassword: "devos123-rotated",
    }), res);
    expect(result.statusCode).toBe(401);
    expect(mocks.user.update).not.toHaveBeenCalled();
    expect(mocks.user.updateMany).not.toHaveBeenCalled();
  });

  it("refuses password reuse without writing", async () => {
    const { res, result } = response();
    await controller.changePassword(request("STAFF", {
      currentPassword: "devos123-rotated", newPassword: "devos123-rotated",
    }), res);
    expect(result.statusCode).toBe(400);
    expect(mocks.user.updateMany).not.toHaveBeenCalled();
  });

  it("does not return a reset credential when its audit write fails", async () => {
    mocks.auditCreate.mockRejectedValue(new Error("unavailable audit store"));
    const { res, result } = response();
    await controller.resetPassword(request(), res);
    expect(result.statusCode).toBe(500);
    expect(result.body).not.toHaveProperty("tempPassword");
    expect(JSON.stringify(result.body)).not.toContain("unavailable audit store");
  });

  it("changes a password using an optimistic version check and returns a new token", async () => {
    mocks.user.updateMany.mockImplementation(async () => {
      currentActor = { ...currentActor, tokenVersion: currentActor.tokenVersion + 1, mustChangePassword: false };
      return { count: 1 };
    });
    const { res, result } = response();
    await controller.changePassword(request("STAFF", {
      currentPassword: "devos123", newPassword: "devos123-rotated",
    }), res);
    expect(result.statusCode).toBe(200);
    expect(mocks.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: staff.id, businessId, tokenVersion: 4, isActive: true }),
      data: expect.objectContaining({ mustChangePassword: false, tokenVersion: { increment: 1 } }),
    }));
    expect(mocks.sign).toHaveBeenCalledWith(expect.objectContaining({ tokenVersion: 5, businessId }));
    expect(result.body).toHaveProperty("token", "replacement-access-token");
    expect(result.body).not.toHaveProperty("user.tokenVersion");
  });

  it("refuses a concurrent password change without returning a token", async () => {
    mocks.user.updateMany.mockResolvedValue({ count: 0 });
    const { res, result } = response();
    await controller.changePassword(request("STAFF", {
      currentPassword: "devos123", newPassword: "devos123-rotated",
    }), res);
    expect(result.statusCode).toBe(409);
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("refuses self-deactivation", async () => {
    const { res, result } = response();
    await controller.deleteUser(request("SUPERADMIN", {}, operator.id), res);
    expect(result.statusCode).toBe(403);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("refuses HR resetting another privileged account", async () => {
    mocks.user.findFirst.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === currentActor.id ? currentActor : { ...staff, role: "SUPERADMIN" });
    const { res, result } = response();
    await controller.resetPassword(request("HR"), res);
    expect(result.statusCode).toBe(403);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("refuses removal of the last active Superadmin under the business lock", async () => {
    mocks.user.findFirst.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === currentActor.id ? currentActor : { ...staff, role: "SUPERADMIN" });
    mocks.user.count.mockResolvedValue(0);
    const { res, result } = response();
    await controller.updateUser(request("SUPERADMIN", { role: "HR" }), res);
    expect(result.statusCode).toBe(409);
    expect(mocks.queryRaw).toHaveBeenCalled();
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("strips credential fields from profile updates", async () => {
    const { res, result } = response();
    await controller.updateUser(request("SUPERADMIN", {
      firstName: "Mina", password: "devos123", pinHash: "untrusted", tokenVersion: 0,
    }), res);
    expect(result.statusCode).toBe(200);
    const update = mocks.user.update.mock.calls[0][0].data;
    expect(update).toHaveProperty("firstName", "Mina");
    for (const secret of ["password", "pinHash", "tokenVersion"]) expect(update).not.toHaveProperty(secret);
  });

  it("fails closed when the business lock target is missing", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const { res, result } = response();
    await controller.resetPassword(request(), res);
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("PIN reset fails closed when its HMAC key is absent", async () => {
    vi.stubEnv("PIN_HMAC_KEY", "");
    try {
      const { res, result } = response();
      await controller.resetPin(request("SUPERADMIN", { reason: "Employee requested replacement" }), res);
      expect(result.statusCode).toBe(500);
      expect(mocks.user.update).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });

  it("lets STAFF read their own record through the public projection", async () => {
    const { res, result } = response();
    await controller.getUserById(request("STAFF", {}, staff.id), res);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual(expect.objectContaining({ data: expect.objectContaining({ email: staff.email }) }));
    const selection = mocks.user.findFirst.mock.calls[1][0].select;
    for (const secret of ["password", "pinHash", "pinSalt", "tokenVersion"]) expect(selection[secret]).not.toBe(true);
  });

  it("answers 404 without writing for an unknown update or deactivation target", async () => {
    mocks.user.findFirst.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === currentActor.id ? currentActor : null);
    const unknown = "00000000-0000-4000-8000-0000000000ff";

    const update = response();
    await controller.updateUser(request("SUPERADMIN", { jobTitle: "Nobody" }, unknown), update.res);
    expect(update.result.statusCode).toBe(404);

    const deactivate = response();
    await controller.deleteUser(request("SUPERADMIN", {}, unknown), deactivate.res);
    expect(deactivate.result.statusCode).toBe(404);
    expect(mocks.user.update).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("creates a tenant-scoped STAFF account on a forced password change", async () => {
    mocks.user.create.mockResolvedValue({ ...staff, id: "created-one", employeeCode: "EMP-0008", role: "STAFF" });
    const { res, result } = response();
    await controller.createUser(request("HR", {
      firstName: "Nova", lastName: "Park", email: "nova@example.test", department: "Operations",
    }), res);
    expect(result.statusCode).toBe(201);
    expect(result.body).toEqual(expect.objectContaining({ tempPassword: expect.any(String) }));
    expect(mocks.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        businessId, role: "STAFF", mustChangePassword: true,
        password: "replacement-hash", employeeCode: "EMP-0008",
      }),
    }));
    expect(JSON.stringify(result.body)).not.toContain("replacement-hash");
  });

  it("refuses HR creating a privileged account", async () => {
    const { res, result } = response();
    await controller.createUser(request("HR", {
      firstName: "Nova", lastName: "Park", email: "nova@example.test",
      department: "Operations", role: "SUPERADMIN",
    }), res);
    expect(result.statusCode).toBe(403);
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it("refuses a shift that is not an active shift in the caller business", async () => {
    mocks.shiftFindFirst.mockResolvedValue(null);
    const { res, result } = response();
    await controller.createUser(request("SUPERADMIN", {
      firstName: "Nova", lastName: "Park", email: "nova@example.test",
      department: "Operations", shiftId: "00000000-0000-4000-8000-0000000000aa",
    }), res);
    expect(result.statusCode).toBe(400);
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it("deactivates softly and revokes sessions instead of deleting history", async () => {
    const { res, result } = response();
    await controller.deleteUser(request("SUPERADMIN", {}, staff.id), res);
    expect(result.statusCode).toBe(200);
    expect(mocks.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: staff.id, businessId }),
      data: { isActive: false, tokenVersion: { increment: 1 } },
    }));
    expect(mocks.expireSessions).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ employeeId: staff.id, consumedAt: null }),
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "user.deactivated" }),
    }));
  });

  it("revokes sessions when a role change is accepted", async () => {
    const { res, result } = response();
    await controller.updateUser(request("SUPERADMIN", { role: "HR" }, staff.id), res);
    expect(result.statusCode).toBe(200);
    expect(mocks.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "HR", tokenVersion: { increment: 1 } }),
    }));
    expect(mocks.expireSessions).toHaveBeenCalled();
  });

  it("refuses deactivating the last active Superadmin", async () => {
    mocks.user.findFirst.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === currentActor.id ? currentActor : { ...staff, role: "SUPERADMIN" });
    mocks.user.count.mockResolvedValue(0);
    const { res, result } = response();
    await controller.deleteUser(request("SUPERADMIN", {}, staff.id), res);
    expect(result.statusCode).toBe(409);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("refuses a PIN reset without a reason or for a non-STAFF target", async () => {
    const noReason = response();
    await controller.resetPin(request("SUPERADMIN", {}), noReason.res);
    expect(noReason.result.statusCode).toBe(400);

    vi.stubEnv("PIN_HMAC_KEY", randomBytes(32).toString("hex"));
    try {
      mocks.user.findFirst.mockImplementation(async (args: { where: { id?: string } }) =>
        args.where.id === currentActor.id ? currentActor : { ...staff, role: "HR" });
      const privileged = response();
      await controller.resetPin(request("SUPERADMIN", { reason: "Wrong target" }), privileged.res);
      expect(privileged.result.statusCode).toBe(403);
      expect(mocks.user.update).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });

  it("returns a four-digit replacement PIN once and invalidates verification sessions", async () => {
    vi.stubEnv("PIN_HMAC_KEY", randomBytes(32).toString("hex"));
    try {
      const { res, result } = response();
      await controller.resetPin(request("SUPERADMIN", { reason: "Employee requested replacement" }), res);
      expect(result.statusCode).toBe(201);
      const body = result.body as { data: { pin: string } };
      expect(body.data.pin).toMatch(/^\d{4}$/);
      expect(mocks.expireSessions).toHaveBeenCalled();
      expect(mocks.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ mustChangePin: true, pinFailedCount: 0 }),
      }));
      expect(JSON.stringify(mocks.auditCreate.mock.calls)).not.toContain(body.data.pin);
      expect(JSON.stringify(result.body)).not.toContain("pinHash");
    } finally { vi.unstubAllEnvs(); }
  });
});
