import bcrypt from "bcrypt";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { Request, Response } from "express";
import { Prisma, Role } from "../generated/prisma/index.js";
import prisma from "../config/prismaClient.js";
import { generateEmployeeCode, generateTempPassword } from "../utils/credentials.js";
import { PASSWORD_HASH_ROUNDS } from "../utils/passwords.js";
import { signAccessToken } from "../utils/tokens.js";
import { auditLog, userLogger } from "../utils/logger.js";
import { createUserSchema, updateUserSchema, passwordString } from "../validators/index.js";
import type { ZodError } from "zod";

const PUBLIC_USER = {
  id: true, employeeCode: true, firstName: true, lastName: true, email: true,
  phoneNumber: true, role: true, department: true, jobTitle: true, isActive: true,
  mustChangePassword: true, profileImageUrl: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;
const ACTOR = { id: true, businessId: true, role: true, isActive: true, mustChangePassword: true } satisfies Prisma.UserSelect;
const ACCOUNT = { ...ACTOR, tokenVersion: true } satisfies Prisma.UserSelect;
type Actor = Prisma.UserGetPayload<{ select: typeof ACTOR }>;
type Account = Prisma.UserGetPayload<{ select: typeof ACCOUNT }>;
type Tx = Prisma.TransactionClient;

class AccountError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new AccountError(status, message); }
const idOf = (req: Request): string => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) fail(400, "User ID is required");
  return id;
};
const replyError = (res: Response, error: unknown): void => {
  if (error instanceof AccountError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "P2002") { res.status(409).json({ success: false, message: "That email or employee code is already taken." }); return; }
  if (code === "P2025") { res.status(404).json({ success: false, message: "User not found" }); return; }
  userLogger.error({ event: "account_operation_failed" }, "Account operation failed");
  res.status(500).json({ success: false, message: "Server error" });
};
const handled = (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response): Promise<void> => {
    try { await fn(req, res); } catch (error) { replyError(res, error); }
  };

const caller = async (req: Request, tx: Tx = prisma, permitForced = false): Promise<Actor> => {
  if (!req.user) fail(401, "Authentication required");
  const actor = await tx.user.findFirst({
    where: { id: req.user.userId, businessId: req.user.businessId }, select: ACTOR,
  });
  if (!actor || !actor.isActive) fail(401, "Authentication required");
  if (!permitForced && actor.mustChangePassword) fail(403, "Password change required");
  return actor;
};
const administrator = (actor: Actor): void => {
  if (actor.role !== "HR" && actor.role !== "SUPERADMIN") fail(403, "Access Denied");
};
const allowedTarget = (actor: Actor, target: Account): void => {
  administrator(actor);
  if (actor.role === "HR" && target.role !== "STAFF") fail(403, "HR accounts may only act on STAFF accounts");
};

// All account-management writes share this lock, including actor and target
// rechecks. `prepare` runs once the caller and their role are settled and
// before the transaction opens, so a handler can validate the request body in
// the same order the route middleware answers in: authentication, then
// authorization, then the body.
const managed = async <T>(
  req: Request,
  operation: (tx: Tx, actor: Actor) => Promise<T>,
  prepare?: (actor: Actor) => void,
  lockAssignment = false,
): Promise<T> => {
  const initial = await caller(req);
  administrator(initial);
  prepare?.(initial);
  return prisma.$transaction(async (tx) => {
    if (lockAssignment) {
      const employeeId = idOf(req);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('attendpro:assignment:' || ${initial.businessId} || ':' || ${employeeId}, 0))`;
    }
    // NO KEY UPDATE still serializes account operations but permits the KEY
    // SHARE taken by assignment inserts against their business foreign key.
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM businesses WHERE id = ${initial.businessId} FOR NO KEY UPDATE`;
    if (rows.length !== 1) fail(404, "Business not found");
    const actor = await caller(req, tx);
    administrator(actor);
    return operation(tx, actor);
  });
};
const targetAccount = async (tx: Tx, actor: Actor, id: string): Promise<Account> => {
  const target = await tx.user.findFirst({ where: { id, businessId: actor.businessId }, select: ACCOUNT });
  if (!target) fail(404, "User not found");
  allowedTarget(actor, target);
  return target;
};
/**
 * The message for a rejected account field. The legacy pointer has its own
 * wording because it is a field a caller used to be able to set, and the
 * route to a schedule is the assignment path. Every other field keeps the
 * original generic wording.
 */
const accountFieldError = (error: ZodError): string => {
  const pointer = error.issues.find((issue) => issue.path[0] === "shiftId");
  return pointer?.message ?? "Invalid account fields";
};
const persistAudit = async (tx: Tx, actor: Actor, id: string, action: string, reason?: string): Promise<void> => {
  await tx.auditLog.create({ data: {
    businessId: actor.businessId, actorType: "USER", actorUserId: actor.id,
    action, entityType: "user", entityId: id, ...(reason ? { reason } : {}),
  } });
};
const closeAccountAssignments = async (tx: Tx, actor: Actor, employeeId: string): Promise<void> => {
  // Called only after managed has acquired this employee's advisory lock.
  const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  const now = clock.now;
  const chain = await tx.shiftAssignment.findMany({
    where: { businessId: actor.businessId, userId: employeeId },
    select: { id: true, shiftId: true, effectiveFrom: true, effectiveTo: true },
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
  });
  const affected = chain.filter((row) =>
    (row.effectiveTo === null || row.effectiveTo > row.effectiveFrom) &&
    (row.effectiveTo === null || row.effectiveTo > now));
  const snapshot = (row: typeof affected[number], end = row.effectiveTo) => ({
    id: row.id, employeeId, shiftId: row.shiftId,
    effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: end?.toISOString() ?? null,
  });
  for (const row of affected) {
    const end = row.effectiveFrom > now ? row.effectiveFrom : now;
    const updated = await tx.shiftAssignment.updateMany({
      where: { id: row.id, businessId: actor.businessId, userId: employeeId },
      data: { effectiveTo: end },
    });
    if (updated.count !== 1) fail(409, "Assignment changed; please retry");
  }
  await tx.user.updateMany({ where: { id: employeeId, businessId: actor.businessId }, data: { shiftId: null } });
  if (affected.length) await tx.auditLog.create({ data: {
    businessId: actor.businessId, actorType: "USER", actorUserId: actor.id,
    action: "assignment.deactivated", entityType: "assignment", entityId: affected[0].id,
    reason: "Employee account deactivated",
    beforeValues: { assignments: affected.map((row) => snapshot(row)) } as Prisma.InputJsonValue,
    afterValues: { now: now.toISOString(), assignments: affected.map((row) =>
      snapshot(row, row.effectiveFrom > now ? row.effectiveFrom : now)) } as Prisma.InputJsonValue,
  } });
};
const expireVerification = async (tx: Tx, businessId: string, id: string): Promise<void> => {
  await tx.verificationSession.updateMany({
    where: { businessId, employeeId: id, consumedAt: null }, data: { state: "EXPIRED" },
  });
};
const guardState = async (tx: Tx, actor: Actor, target: Account, role: Role, active: boolean): Promise<void> => {
  if (actor.id === target.id && (role !== target.role || !active)) fail(403, "You cannot change your own role or deactivate your own account");
  if (target.role !== "SUPERADMIN" || !target.isActive || (role === "SUPERADMIN" && active)) return;
  const remaining = await tx.user.count({ where: { businessId: actor.businessId, role: "SUPERADMIN", isActive: true, id: { not: target.id } } });
  if (remaining === 0) fail(409, "At least one active SUPERADMIN account must remain");
};

const directoryQuery = (req: Request, actor: Actor): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = { businessId: actor.businessId, isActive: String(req.query.isActive) !== "false" };
  if (actor.role === "HR") where.role = "STAFF";
  else if (Object.values(Role).includes(req.query.role as Role)) where.role = req.query.role as Role;
  if (typeof req.query.department === "string") where.department = req.query.department;
  if (typeof req.query.search === "string" && req.query.search) {
    const text = { contains: req.query.search, mode: "insensitive" as const };
    where.OR = [{ firstName: text }, { lastName: text }, { email: text }, { employeeCode: text }];
  }
  return where;
};
const pageValue = (value: unknown, fallback: number, maximum: number): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) fail(400, "Invalid pagination parameters");
  return parsed;
};
export const getAllUsers = handled(async (req, res) => {
  const actor = await caller(req); administrator(actor);
  const page = pageValue(req.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = pageValue(req.query.limit, 10, 100);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) fail(400, "Invalid pagination parameters");
  const where = directoryQuery(req, actor);
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, select: PUBLIC_USER, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take: limit }),
    prisma.user.count({ where }),
  ]);
  res.status(200).json({ success: true, data, pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalUsers: total } });
});
export const getUserById = handled(async (req, res) => {
  const actor = await caller(req);
  const data = await prisma.user.findFirst({ where: { id: idOf(req), businessId: actor.businessId }, select: PUBLIC_USER });
  if (!data) fail(404, "User not found");
  if (actor.id !== data.id && actor.role !== "SUPERADMIN" && !(actor.role === "HR" && data.role === "STAFF")) fail(403, "Access Denied");
  res.status(200).json({ success: true, data });
});
export const createUser = handled(async (req, res) => {
  // The caller and their role are settled before the body is read, so an
  // anonymous or unauthorised request is refused as such and never reaches
  // the validator.
  const initial = await caller(req); administrator(initial);
  const parsed = createUserSchema.body.safeParse(req.body);
  if (!parsed.success) fail(400, accountFieldError(parsed.error));
  const input = parsed.data;
  const role = input.role ?? "STAFF";
  if (initial.role === "HR" && role !== "STAFF") fail(403, "HR accounts may only create STAFF accounts");
  const tempPassword = generateTempPassword();
  const password = await bcrypt.hash(tempPassword, PASSWORD_HASH_ROUNDS);
  const data = await managed(req, async (tx, actor) => {
    if (actor.role === "HR" && role !== "STAFF") fail(403, "HR accounts may only create STAFF accounts");
    const employeeCode = await generateEmployeeCode(() => tx.user.findFirst({
      where: { businessId: actor.businessId, employeeCode: { startsWith: "EMP-" } },
      orderBy: { employeeCode: "desc" }, select: { employeeCode: true },
    }));
    const created = await tx.user.create({ data: { ...input, role, businessId: actor.businessId,
      employeeCode, password, mustChangePassword: true, firstName: input.firstName.trim(),
      lastName: input.lastName.trim(), email: input.email.trim(), department: input.department.trim(),
    }, select: PUBLIC_USER });
    await persistAudit(tx, actor, created.id, "user.created");
    return created;
  });
  auditLog.userCreated(initial.id, data.id, data.role);
  res.setHeader("Cache-Control", "no-store");
  res.status(201).json({ success: true, data, tempPassword });
});

export const updateUser = handled(async (req, res) => {
  const parsed = updateUserSchema.body.safeParse(req.body);
  // The body is judged once the caller and their role are known, so a request
  // that is both unauthorised and malformed is refused as unauthorised. The
  // values are carried forward because the operation below only runs after
  // that judgement has passed.
  const fields = parsed.success ? Object.keys(parsed.data) : [];
  const profile = parsed.success ? parsed.data : {};
  const data = await managed(req, async (tx, actor) => {
    // The judgement is repeated here so the write can never run on an
    // unvalidated body, even if the pre-transaction check were ever removed.
    if (!parsed.success) fail(400, accountFieldError(parsed.error));
    const target = await targetAccount(tx, actor, idOf(req));
    const { role, isActive, ...rest } = profile;
    const nextRole = actor.role === "SUPERADMIN" ? role ?? target.role : target.role;
    const nextActive = actor.role === "SUPERADMIN" ? isActive ?? target.isActive : target.isActive;
    await guardState(tx, actor, target, nextRole, nextActive);
    if (target.isActive && !nextActive && actor.role === "SUPERADMIN")
      await closeAccountAssignments(tx, actor, target.id);
    const revokes = nextRole !== target.role || nextActive !== target.isActive;
    const updated = await tx.user.update({ where: { id: target.id, businessId: actor.businessId }, data: {
      ...rest, ...(actor.role === "SUPERADMIN" ? { role: nextRole, isActive: nextActive } : {}),
      ...(revokes ? { tokenVersion: { increment: 1 } } : {}),
    }, select: PUBLIC_USER });
    if (revokes) await expireVerification(tx, actor.businessId, target.id);
    await persistAudit(tx, actor, target.id, "user.updated", JSON.stringify({ fields }));
    return updated;
  }, () => {
    if (!parsed.success) fail(400, accountFieldError(parsed.error));
  }, profile.isActive === false);
  auditLog.userUpdated(req.user!.userId, data.id, fields);
  res.status(200).json({ success: true, data });
});
export const deleteUser = handled(async (req, res) => {
  await managed(req, async (tx, actor) => {
    const target = await targetAccount(tx, actor, idOf(req));
    await guardState(tx, actor, target, target.role, false);
    if (!target.isActive) fail(400, "User already deactivated");
    await closeAccountAssignments(tx, actor, target.id);
    await tx.user.update({ where: { id: target.id, businessId: actor.businessId }, data: { isActive: false, tokenVersion: { increment: 1 } } });
    await expireVerification(tx, actor.businessId, target.id);
    await persistAudit(tx, actor, target.id, "user.deactivated");
  }, undefined, true);
  auditLog.userDeactivated(req.user!.userId, idOf(req));
  res.status(200).json({ success: true, message: "User deactivated successfully" });
});
export const resetPassword = handled(async (req, res) => {
  const initial = await caller(req); administrator(initial);
  const tempPassword = generateTempPassword();
  const password = await bcrypt.hash(tempPassword, PASSWORD_HASH_ROUNDS);
  await managed(req, async (tx, actor) => {
    const target = await targetAccount(tx, actor, idOf(req));
    if (target.id === actor.id) fail(403, "Use change-password to set your own password");
    await tx.user.update({ where: { id: target.id, businessId: actor.businessId }, data: { password, mustChangePassword: true, tokenVersion: { increment: 1 } } });
    await expireVerification(tx, actor.businessId, target.id);
    await persistAudit(tx, actor, target.id, "user.password_reset");
  });
  auditLog.passwordReset(initial.id, idOf(req));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ success: true, message: "Password reset. The account must change it on next sign-in.", tempPassword });
});

export const changePassword = handled(async (req, res) => {
  const actor = await caller(req, prisma, true);
  const currentPassword: unknown = req.body?.currentPassword;
  const result = passwordString.safeParse(req.body?.newPassword);
  if (typeof currentPassword !== "string" || !currentPassword || !result.success) fail(400, "Current password and a valid new password are required");
  const user = await prisma.user.findFirst({ where: { id: actor.id, businessId: actor.businessId }, select: { ...ACCOUNT, password: true } });
  if (!user) fail(404, "User not found");
  if (!await bcrypt.compare(currentPassword, user.password)) fail(401, "Invalid current password");
  if (currentPassword === result.data) fail(400, "The new password must differ from the current one");
  const password = await bcrypt.hash(result.data, PASSWORD_HASH_ROUNDS);
  const response = await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({ where: { id: user.id, businessId: actor.businessId, password: user.password,
      tokenVersion: user.tokenVersion, isActive: true }, data: { password, mustChangePassword: false, tokenVersion: { increment: 1 } } });
    if (changed.count !== 1) fail(409, "Account changed. Sign in again before retrying.");
    const updated = await tx.user.findFirst({ where: { id: user.id, businessId: actor.businessId }, select: { ...PUBLIC_USER, businessId: true, tokenVersion: true } });
    if (!updated) fail(404, "User not found");
    await persistAudit(tx, actor, user.id, "user.password_changed");
    const { businessId, tokenVersion, ...publicUser } = updated;
    return { token: signAccessToken(updated), user: publicUser };
  });
  auditLog.passwordChanged(user.id);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ success: true, message: "Password changed successfully", ...response });
});
export const resetPin = handled(async (req, res) => {
  const reason: unknown = req.body?.reason;
  // The reason is narrowed once it has passed the check below, so the audit row
  // carries text rather than an unknown value.
  const reasonText = typeof reason === "string" ? reason : undefined;
  const pin = String(randomInt(0, 10_000)).padStart(4, "0");
  const pinSalt = randomBytes(16).toString("hex");
  const pinUpdatedAt = new Date();
  const data = await managed(req, async (tx, actor) => {
    // The server key is checked inside the operation, after the caller is
    // known, so a request that is not permitted is refused as such even when
    // the server is misconfigured.
    const key = process.env.PIN_HMAC_KEY;
    if (!key) fail(500, "Server error");
    const target = await targetAccount(tx, actor, idOf(req));
    if (target.role !== "STAFF") fail(403, "PINs belong to staff accounts only");
    const pinHash = createHmac("sha256", key).update(`${target.id}${pin}${pinSalt}`).digest("hex");
    await tx.user.update({ where: { id: target.id, businessId: actor.businessId }, data: {
      pinHash, pinSalt, pinUpdatedAt, pinFailedCount: 0, pinLockedUntil: null, pinLastFailedAt: null, mustChangePin: true,
    }, select: { id: true } });
    await expireVerification(tx, actor.businessId, target.id);
    await persistAudit(tx, actor, target.id, "hr.reset_pin", reasonText);
    return { userId: target.id, pinUpdatedAt, pin };
  }, () => {
    if (typeof reason !== "string" || !reason.trim() || reason.length > 500) fail(400, "A reason of at most 500 characters is required");
  });
  auditLog.pinReset(req.user!.userId, data.userId);
  res.setHeader("Cache-Control", "no-store");
  res.status(201).json({ success: true, data });
});

export default { getAllUsers, getUserById, createUser, updateUser, deleteUser, resetPassword, changePassword, resetPin };
