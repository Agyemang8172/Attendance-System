import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createHmac, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

/**
 * P04 — password and PIN security contracts without a database.
 *
 * The integration suites exercise the real rows; this file pins the parts that
 * must hold even when the database is unavailable to the test run:
 *   - a token dies when the account's tokenVersion moves, and the role comes
 *     from the account row rather than the signed claim;
 *   - a self-service PIN change shares the kiosk lockout budget, refuses a
 *     locked PIN, expires open verification sessions, and cannot overwrite a
 *     concurrent administrator reset;
 *   - no PIN, hash, salt or replacement credential appears in a response or
 *     audit row.
 */

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdateMany: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
  expireSessions: vi.fn(),
  auditCreate: vi.fn(),
  writeAudit: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const tx = {
  user: {
    findUnique: mocks.userFindUnique,
    updateMany: mocks.userUpdateMany,
    update: mocks.userUpdate,
  },
  verificationSession: { updateMany: mocks.expireSessions },
  auditLog: { create: mocks.auditCreate },
};

vi.mock("../../config/prismaClient.js", () => ({
  default: {
    user: {
      findUnique: mocks.userFindUnique,
      updateMany: mocks.userUpdateMany,
      update: mocks.userUpdate,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../../utils/auditWriter.js", () => ({ writeAudit: mocks.writeAudit }));
vi.mock("../../utils/logger.js", () => ({
  userLogger: mocks.logger,
  auditLog: { pinReset: vi.fn(), pinChanged: vi.fn(), passwordReset: vi.fn() },
}));

const controller = await import("../../controllers/staffProfileController.js");
const authMiddleware = (await import("../../middleware/authMiddleware.js")).default;
const { signAccessToken, ACCESS_TOKEN_TTL } = await import("../../utils/tokens.js");
const { PIN_MAX_ATTEMPTS, PIN_LOCK_MINUTES, pinLockUntil } = await import("../../utils/pinPolicy.js");
const { constantTimeEqual } = await import("../../utils/kioskKeys.js");

const businessId = "business-one";
const staffId = "staff-one";
const pinKey = "p04-test-pin-key";
const jwtKey = "p04-test-jwt-secret";

const hmacPin = (id: string, pin: string, salt: string): string =>
  createHmac("sha256", pinKey).update(`${id}${pin}${salt}`).digest("hex");

let user: {
  id: string;
  businessId: string;
  isActive: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  pinUpdatedAt: Date | null;
  pinFailedCount: number;
  pinLockedUntil: Date | null;
};

function request(body: Record<string, unknown> = {}): Request {
  return {
    user: {
      userId: staffId,
      businessId,
      role: "STAFF",
      isActive: true,
      mustChangePassword: false,
    },
    body,
  } as unknown as Request;
}

function response() {
  const result = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = {
    status: vi.fn((code: number) => { result.statusCode = code; return res; }),
    json: vi.fn((body: unknown) => { result.body = body; return res; }),
    setHeader: vi.fn((name: string, value: string) => { result.headers[name] = value; return res; }),
  };
  return { res: res as unknown as Response, result };
}

const originalPinKey = process.env.PIN_HMAC_KEY;
const originalJwtKey = process.env.JWT_SECRET;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.PIN_HMAC_KEY = pinKey;
  process.env.JWT_SECRET = jwtKey;

  user = {
    id: staffId,
    businessId,
    isActive: true,
    pinHash: hmacPin(staffId, "1234", "stored-salt"),
    pinSalt: "stored-salt",
    pinUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
    pinFailedCount: 0,
    pinLockedUntil: null,
  };

  mocks.userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
    // The controller reads the whole PIN state first, then reads only the
    // incremented counter inside the failure transaction.
    if (args.select && Object.keys(args.select).length === 1 && args.select.pinFailedCount) {
      return { pinFailedCount: 1 };
    }
    return user;
  });
  mocks.userUpdateMany.mockResolvedValue({ count: 1 });
  mocks.userUpdate.mockResolvedValue({ ...user });
  mocks.expireSessions.mockResolvedValue({ count: 1 });
  mocks.writeAudit.mockResolvedValue(undefined);
  mocks.auditCreate.mockResolvedValue({ id: "audit-one" });
  mocks.transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));
});

afterAll(() => {
  if (originalPinKey === undefined) delete process.env.PIN_HMAC_KEY;
  else process.env.PIN_HMAC_KEY = originalPinKey;
  if (originalJwtKey === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtKey;
});

describe("access-token and middleware contract", () => {
  it("signs the account version and tenant, and expires in eight hours", () => {
    const token = signAccessToken({ id: staffId, role: "STAFF", tokenVersion: 7, businessId });
    const decoded = jwt.verify(token, jwtKey) as {
      userId: string; role: string; tokenVersion: number; businessId: string; iat: number; exp: number;
    };
    expect(decoded).toEqual(expect.objectContaining({
      userId: staffId, role: "STAFF", tokenVersion: 7, businessId,
    }));
    expect(decoded.exp - decoded.iat).toBe(8 * 60 * 60);
    expect(ACCESS_TOKEN_TTL).toBe("8h");
  });

  it("fails closed when the signing secret is absent", () => {
    delete process.env.JWT_SECRET;
    expect(() => signAccessToken({ id: staffId, role: "STAFF", tokenVersion: 0, businessId }))
      .toThrow(/JWT_SECRET/);
  });

  it("refuses a token whose version no longer matches the account row", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: staffId, businessId, role: "STAFF", isActive: true,
      mustChangePassword: false, tokenVersion: 2,
    });
    const token = signAccessToken({ id: staffId, role: "STAFF", tokenVersion: 1, businessId });
    const { res, result } = response();
    const next = vi.fn() as unknown as NextFunction;

    await authMiddleware({ headers: { authorization: `Bearer ${token}` } } as Request, res, next);

    expect(result.statusCode).toBe(401);
    expect(result.body).toEqual(expect.objectContaining({ code: "TOKEN_REVOKED" }));
    expect(next).not.toHaveBeenCalled();
  });

  it("takes the role from the account row, not from the signed claim", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: staffId, businessId, role: "HR", isActive: true,
      mustChangePassword: false, tokenVersion: 1,
    });
    const token = signAccessToken({ id: staffId, role: "STAFF", tokenVersion: 1, businessId });
    const { res } = response();
    const next = vi.fn() as unknown as NextFunction;
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(expect.objectContaining({ userId: staffId, role: "HR", businessId }));
  });

  it("refuses an inactive account even when the signature and version are valid", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: staffId, businessId, role: "STAFF", isActive: false,
      mustChangePassword: false, tokenVersion: 1,
    });
    const token = signAccessToken({ id: staffId, role: "STAFF", tokenVersion: 1, businessId });
    const { res, result } = response();
    const next = vi.fn() as unknown as NextFunction;

    await authMiddleware({ headers: { authorization: `Bearer ${token}` } } as Request, res, next);

    expect(result.statusCode).toBe(401);
    expect(result.body).toEqual(expect.objectContaining({ code: "ACCOUNT_DEACTIVATED" }));
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses a token that names a different tenant than the account row", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: staffId, businessId: "business-two", role: "STAFF", isActive: true,
      mustChangePassword: false, tokenVersion: 1,
    });
    const token = signAccessToken({ id: staffId, role: "STAFF", tokenVersion: 1, businessId });
    const { res, result } = response();
    const next = vi.fn() as unknown as NextFunction;

    await authMiddleware({ headers: { authorization: `Bearer ${token}` } } as Request, res, next);

    expect(result.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses a signed token that carries no tenant claim", async () => {
    const token = jwt.sign({ userId: staffId, role: "STAFF", tokenVersion: 1 }, jwtKey);
    const { res, result } = response();
    const next = vi.fn() as unknown as NextFunction;

    await authMiddleware({ headers: { authorization: `Bearer ${token}` } } as Request, res, next);

    expect(result.statusCode).toBe(401);
    expect(result.body).toEqual(expect.objectContaining({ code: "TOKEN_REVOKED" }));
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses a request with no token", async () => {
    const { res, result } = response();
    const next = vi.fn() as unknown as NextFunction;

    await authMiddleware({ headers: {} } as Request, res, next);

    expect(result.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("shared PIN policy", () => {
  it("keeps the owner's R5 values in one place", () => {
    expect(PIN_MAX_ATTEMPTS).toBe(10);
    expect(PIN_LOCK_MINUTES).toBe(5);
    expect(pinLockUntil(new Date(0)).getTime()).toBe(5 * 60 * 1000);
  });

  it("compares stored PIN hashes in constant time and treats length mismatch as a miss", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});

describe("POST /api/staff/profile/change-pin", () => {
  const call = async (body: Record<string, unknown>) => {
    const { res, result } = response();
    await controller.changePin(request(body), res);
    return result;
  };

  it("is mounted as the staff-only self-service handler", async () => {
    const router = (await import("../../routes/staffProfileRoutes.js")).default;
    type Layer = { route?: { path: string; stack: Array<{ handle: unknown }> } };
    const layer = (router as { stack: Layer[] }).stack.find(
      (entry) => entry.route?.path === "/change-pin"
    );
    expect(layer).toBeTruthy();
    expect(layer!.route!.stack.at(-1)!.handle).toBe(controller.changePin);
  });

  it("rejects missing, malformed and reused PINs before reading the account", async () => {
    for (const body of [
      {},
      { currentPin: "12", newPin: "5678" },
      { currentPin: "1234", newPin: "12" },
      { currentPin: "1234", newPin: "1234" },
    ]) {
      const result = await call(body);
      expect(result.statusCode).toBe(400);
    }
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("fails closed when PIN_HMAC_KEY is absent", async () => {
    delete process.env.PIN_HMAC_KEY;
    const result = await call({ currentPin: "1234", newPin: "5678" });
    expect(result.statusCode).toBe(500);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("refuses a PIN that was never set", async () => {
    user.pinHash = null;
    user.pinSalt = null;
    const result = await call({ currentPin: "1234", newPin: "5678" });
    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual(expect.objectContaining({ message: expect.stringMatching(/no pin is set/i) }));
  });

  it("refuses an inactive or foreign account without writing", async () => {
    user.isActive = false;
    expect((await call({ currentPin: "1234", newPin: "5678" })).statusCode).toBe(404);
    user.isActive = true;
    user.businessId = "business-two";
    expect((await call({ currentPin: "1234", newPin: "5678" })).statusCode).toBe(404);
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses a locked PIN before comparing it", async () => {
    user.pinLockedUntil = new Date(Date.now() + 60_000);
    const result = await call({ currentPin: "1234", newPin: "5678" });
    expect(result.statusCode).toBe(429);
    expect(result.body).toEqual(expect.objectContaining({ code: "PIN_LOCKED" }));
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("charges a wrong current PIN to the shared cumulative counter", async () => {
    const result = await call({ currentPin: "0000", newPin: "5678" });

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual(expect.objectContaining({ message: "Invalid current PIN" }));
    expect(mocks.userUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: staffId, businessId, isActive: true,
        pinHash: user.pinHash, pinSalt: user.pinSalt,
      }),
      data: expect.objectContaining({
        pinFailedCount: { increment: 1 },
        pinLastFailedAt: expect.any(Date),
      }),
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "pin.change_failed", businessId, actorType: "USER", actorUserId: staffId,
      }),
    });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("trips the lock when the incremented counter reaches R5", async () => {
    mocks.userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      if (args.select && args.select.pinFailedCount && Object.keys(args.select).length === 1) {
        return { pinFailedCount: PIN_MAX_ATTEMPTS };
      }
      return user;
    });

    const result = await call({ currentPin: "0000", newPin: "5678" });

    // The tripping attempt still gets the neutral 400; the next request sees
    // the lock and is refused 429.
    expect(result.statusCode).toBe(400);
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: staffId },
      data: { pinLockedUntil: expect.any(Date) },
    }));
  });

  it("does not charge a failure to a PIN that changed concurrently", async () => {
    mocks.userUpdateMany.mockResolvedValue({ count: 0 });
    const result = await call({ currentPin: "0000", newPin: "5678" });

    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual(expect.objectContaining({ code: "PIN_CHANGED" }));
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("stores only a keyed salted hash, clears the counters and expires open sessions", async () => {
    const result = await call({ currentPin: "1234", newPin: "5678" });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ success: true, message: "PIN changed successfully" });
    expect(JSON.stringify(result.body)).not.toContain("5678");
    expect(JSON.stringify(result.body)).not.toContain("pinHash");
    expect(JSON.stringify(result.body)).not.toContain("pinSalt");

    const update = mocks.userUpdateMany.mock.calls[0][0];
    expect(update.where).toEqual(expect.objectContaining({
      id: staffId, businessId, isActive: true,
      pinHash: user.pinHash, pinSalt: user.pinSalt,
    }));
    expect(update.data).toEqual(expect.objectContaining({
      pinFailedCount: 0,
      pinLockedUntil: null,
      pinLastFailedAt: null,
      mustChangePin: false,
      pinUpdatedAt: expect.any(Date),
    }));
    expect(update.data.pinSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(update.data.pinHash).toBe(hmacPin(staffId, "5678", update.data.pinSalt));
    expect(update.data).not.toHaveProperty("tokenVersion");

    expect(mocks.expireSessions).toHaveBeenCalledWith({
      where: { businessId, employeeId: staffId, consumedAt: null },
      data: { state: "EXPIRED" },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "pin.changed.self", entityId: staffId, businessId,
        actorType: "USER", actorUserId: staffId,
      }),
    });
    expect(JSON.stringify(mocks.auditCreate.mock.calls)).not.toContain("5678");
    expect(mocks.writeAudit).not.toHaveBeenCalled();
  });

  it("does not overwrite a concurrent administrator reset", async () => {
    mocks.userUpdateMany.mockResolvedValue({ count: 0 });
    const result = await call({ currentPin: "1234", newPin: "5678" });

    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual(expect.objectContaining({ code: "PIN_CHANGED" }));
    expect(mocks.expireSessions).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.logger.info).not.toHaveBeenCalled();
  });

  it("does not clear a lock established after the initial account read", async () => {
    const lockedCount = PIN_MAX_ATTEMPTS;
    const lockedUntil = new Date(Date.now() + 60_000);
    mocks.userUpdateMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      // Model the database's predicate decision after another request has
      // changed lock state. Missing predicates must not accidentally pass.
      const matches = args.where.pinFailedCount === lockedCount
        && args.where.pinLockedUntil === lockedUntil;
      const observesLock = Object.hasOwn(args.where, "pinFailedCount")
        && Object.hasOwn(args.where, "pinLockedUntil");
      return { count: !observesLock || matches ? 1 : 0 };
    });

    const result = await call({ currentPin: "1234", newPin: "5678" });

    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual(expect.objectContaining({ code: "PIN_CHANGED" }));
    expect(mocks.expireSessions).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.logger.info).not.toHaveBeenCalled();
  });

  it("does not charge a stale failure after another attempt changes the counter", async () => {
    mocks.userUpdateMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      const observesCounter = Object.hasOwn(args.where, "pinFailedCount");
      return { count: !observesCounter || args.where.pinFailedCount === 1 ? 1 : 0 };
    });

    const result = await call({ currentPin: "0000", newPin: "5678" });

    expect(result.statusCode).toBe(409);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("refuses a PIN change when its required audit write fails", async () => {
    mocks.auditCreate.mockRejectedValue(new Error("synthetic database failure"));

    const result = await call({ currentPin: "1234", newPin: "5678" });

    // A mocked transaction cannot prove rollback. This verifies only that an
    // audit rejection propagates and is never reported as accepted success.
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ success: false, message: "Server error" });
    expect(mocks.logger.info).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.logger.error.mock.calls)).not.toContain("synthetic database failure");
  });

  it("propagates an audit failure instead of accepting a failed-PIN counter write", async () => {
    mocks.auditCreate.mockRejectedValue(new Error("synthetic audit failure"));

    const result = await call({ currentPin: "0000", newPin: "5678" });

    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ success: false, message: "Server error" });
    expect(JSON.stringify(mocks.logger.error.mock.calls)).not.toContain("synthetic audit failure");
  });
});
