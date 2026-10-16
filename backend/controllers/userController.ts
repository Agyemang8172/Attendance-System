import bcrypt from "bcrypt";
import { createHmac, randomBytes, randomInt } from "crypto";
import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog, userLogger } from "../utils/logger.js";
import { generateTempPassword, generateEmployeeCode } from "../utils/credentials.js";

// ── Bcrypt cost ──────────────────────────────────────────────────────────────

/**
 * Raising the cost from 10 to 12 roughly quadruples the work per guess. The
 * ~300ms a single verification now costs is imperceptible in a login and
 * meaningful across ten thousand guesses.
 */
const SALT_ROUNDS = 12;

// ── Permission matrix ────────────────────────────────────────────────────────

/**
 * The fields an administrator may write. Anything absent here cannot be
 * changed through this API, regardless of what the caller sends — the previous
 * `const updates = req.body` accepted every column the schema happened to
 * surface, and the only defence was three trailing `delete` statements.
 */
const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "department",
  "jobTitle",
  "phoneNumber",
  "shiftId",
  "profileImageUrl",
] as const;

/** Account-state fields. SUPERADMIN only: these decide who can act at all. */
const PRIVILEGED_FIELDS = ["role", "isActive", "mustChangePassword"] as const;

const isSuperadmin = (role: string) => role === "SUPERADMIN";
const isHr = (role: string) => role === "HR";

/** HR exists to look after staff accounts, so every HR action is scoped to them. */
const assertHrMayActOn = (res: Response, targetRole: string): boolean => {
  if (targetRole !== "STAFF") {
    res.status(403).json({
      success: false,
      message: "HR accounts may only act on STAFF accounts",
    });
    return false;
  }
  return true;
};

const countActiveSuperadmins = async (businessId: string, excludeId?: string) =>
  prisma.user.count({
    where: {
      role: "SUPERADMIN",
      isActive: true,
      businessId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

// ── CRUD Controllers ──────────────────────────────────────────────────────────

export const getAllUsers = async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || "1") || 1;
  const limit = parseInt((req.query.limit as string) || "10") || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const department = req.query.department as string | undefined;
  const role = req.query.role as string | undefined;
  const isActive = (req.query.isActive as string) !== "false";

  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    // Tenant scope: everything reads inside the caller's business only.
    const caller = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { businessId: true },
    });
    if (!caller?.businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const where: Record<string, unknown> = { isActive, businessId: caller.businessId };

    // HR looks after staff. A request that asks HR for HR or SUPERADMIN
    // accounts is answered with staff rather than refused, so the response
    // never confirms whether such an account exists.
    if (isHr(req.user.role)) {
      where.role = "STAFF";
    } else if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (department) where.department = department;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: where as any,
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          role: true,
          department: true,
          jobTitle: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: "Error fetching users",
        error: error.message,
      });
    }
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        role: true,
        department: true,
        jobTitle: true,
        isActive: true,
        mustChangePassword: true,
        shiftId: true,
        profileImageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Every authenticated account could read every other account's record,
    // including home address, phone number and role. A STAFF token was enough
    // to enumerate the directory.
    const caller = req.user;
    const ownsRecord = user.id === caller.userId;
    const permitted =
      isSuperadmin(caller.role) ||
      ownsRecord ||
      (isHr(caller.role) && user.role === "STAFF");

    if (!permitted) {
      res.status(403).json({ success: false, message: "Access Denied" });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: "Server Error",
        error: error.message,
      });
    }
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const callerBusiness = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { businessId: true },
    });
    const businessId = callerBusiness?.businessId;
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const { firstName, lastName, email, department, role, phoneNumber, jobTitle } = req.body;

    if (!firstName || !lastName || !email || !department) {
      res.status(400).json({
        success: false,
        message: "firstName, lastName, email and department are required.",
      });
      return;
    }

    // HR creates staff accounts. Handing HR the ability to mint an HR or
    // SUPERADMIN account would make the rest of the permission matrix
    // decorative, so the request is refused rather than silently downgraded —
    // a caller who thinks they created an administrator needs to be told.
    const requestedRole = role || "STAFF";
    if (isHr(req.user.role) && requestedRole !== "STAFF") {
      res.status(403).json({
        success: false,
        message: "HR accounts may only create STAFF accounts",
      });
      return;
    }

    const employeeCode = await generateEmployeeCode(() =>
      prisma.user.findFirst({
        where: { employeeCode: { startsWith: "EMP-" } },
        orderBy: { employeeCode: "desc" },
        select: { employeeCode: true },
      })
    );
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const newUser = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        department: department.trim(),
        role: requestedRole,
        employeeCode,
        password: hashedPassword,
        mustChangePassword: true,
        phoneNumber: phoneNumber?.trim(),
        jobTitle: jobTitle?.trim(),
        business: { connect: { id: businessId } },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        role: true,
        department: true,
        jobTitle: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    auditLog.userCreated(req.user.userId, newUser.id, newUser.role);

    res.status(201).json({
      success: true,
      data: newUser,
      tempPassword,
    });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "That email is already taken.",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const caller = req.user;
    const body = (req.body || {}) as Record<string, unknown>;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, businessId: true },
    });

    if (!target) {
      res.status(404).json({ message: "User not found!" });
      return;
    }

    // Tenant scope: a target in another business is answered as absent, so the
    // response never confirms whether such an account exists.
    const callerBusiness = await prisma.user.findUnique({
      where: { id: caller.userId },
      select: { businessId: true },
    });
    if (!callerBusiness?.businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }
    if (target.businessId !== callerBusiness.businessId) {
      res.status(404).json({ message: "User not found!" });
      return;
    }

    if (isHr(caller.role) && !assertHrMayActOn(res, target.role)) return;

    // Build the write set from the allowlists. Keys absent from both are
    // dropped, so a column can only become writable by being named here.
    const data: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        data[field] = body[field];
      }
    }
    if (isSuperadmin(caller.role)) {
      for (const field of PRIVILEGED_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          data[field] = body[field];
        }
      }
    }

    const changesRole = "role" in data && data.role !== target.role;
    const deactivates = "isActive" in data && data.isActive === false;

    if (changesRole && target.id === caller.userId) {
      res.status(403).json({
        success: false,
        message: "You cannot change your own role",
      });
      return;
    }

    if (deactivates && target.id === caller.userId) {
      res.status(403).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
      return;
    }

    // Demoting or deactivating the last SUPERADMIN locks everyone out of the
    // one role that can undo it.
    if (target.role === "SUPERADMIN" && (changesRole || deactivates)) {
      const remaining = await countActiveSuperadmins(
        callerBusiness.businessId,
        target.id
      );
      if (remaining === 0) {
        res.status(409).json({
          success: false,
          message: "At least one active SUPERADMIN account must remain",
        });
        return;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: data as any,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        role: true,
        department: true,
        jobTitle: true,
        isActive: true,
        mustChangePassword: true,
        shiftId: true,
        updatedAt: true,
      },
    });

    auditLog.userUpdated(caller.userId, target.id, Object.keys(data));

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error) {
      const prismaError = error as Error & { code?: string };
      if (prismaError.code === "P2025") {
        res.status(404).json({ message: "User not found!" });
        return;
      }
      res.status(500).json({
        message: "Update failed",
        error: error.message,
      });
    }
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const caller = req.user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, businessId: true },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Tenant scope: a target in another business is answered as absent.
    const callerBusiness = await prisma.user.findUnique({
      where: { id: caller.userId },
      select: { businessId: true },
    });
    if (!callerBusiness?.businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }
    if (user.businessId !== callerBusiness.businessId) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (isHr(caller.role) && !assertHrMayActOn(res, user.role)) return;

    if (user.id === caller.userId) {
      res.status(403).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
      return;
    }

    if (!user.isActive) {
      res.status(400).json({
        success: false,
        message: "User already deactivated",
      });
      return;
    }

    if (user.role === "SUPERADMIN") {
      const remaining = await countActiveSuperadmins(
        callerBusiness.businessId,
        user.id
      );
      if (remaining === 0) {
        res.status(409).json({
          success: false,
          message: "At least one active SUPERADMIN account must remain",
        });
        return;
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    auditLog.userDeactivated(caller.userId, user.id);

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: "Delete failed",
        error: error.message,
      });
    }
  }
};

/**
 * S4 — there was no way to give a locked-out account a new credential short of
 * editing the row by hand. SUPERADMIN may reset any account; HR may reset the
 * staff accounts it already manages. The replacement is server-generated for
 * the same reason as on creation: an administrator choosing the password means
 * an administrator knows it.
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const caller = req.user;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!target) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (isHr(caller.role) && !assertHrMayActOn(res, target.role)) return;

    if (target.id === caller.userId) {
      res.status(403).json({
        success: false,
        message: "Use change-password to set your own password",
      });
      return;
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
      },
    });

    auditLog.passwordReset(caller.userId, target.id);

    res.status(200).json({
      success: true,
      message: "Password reset. The account must change it on next sign-in.",
      tempPassword,
    });
  } catch (error) {
    if (error instanceof Error) {
      userLogger.error({ err: error.message }, "Password reset failed");
      res.status(500).json({
        success: false,
        message: "Password reset failed",
      });
    }
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid current password",
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        success: false,
        message: "The new password must differ from the current one",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    auditLog.passwordChanged(userId);

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: "Change password failed",
        error: error.message,
      });
    }
  }
};

// ── Reset kiosk PIN (M4) ─────────────────────────────────────────────────────

/**
 * An audited HR reset of a staff member's kiosk PIN (O2, O7).
 *
 * The PIN is six random digits from `crypto.randomInt`. It is stored as
 * `HMAC-SHA-256(key = PIN_HMAC_KEY, message = employeeId || pin || salt)`
 * with a per-record salt (kiosk §5.1), never a bare hash. The response never
 * carries the old or the new PIN; the employee learns it out of band.
 */
export const resetPin = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    const caller = req.user;

    const pinHmacKey = process.env.PIN_HMAC_KEY;
    if (!pinHmacKey) {
      // Fail closed: without the server key, a stored PIN would be weaker
      // than the contract, so the reset is refused rather than downgraded.
      userLogger.error({ event: "pin_reset_missing_key" }, "PIN_HMAC_KEY is not set");
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { reason } = (req.body || {}) as { reason?: string };
    if (!reason || reason.length > 500) {
      res.status(400).json({
        success: false,
        message: "A reason of at most 500 characters is required",
      });
      return;
    }

    const callerBusiness = await prisma.user.findUnique({
      where: { id: caller.userId },
      select: { businessId: true },
    });
    if (!callerBusiness?.businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, businessId: true },
    });
    if (!target || target.businessId !== callerBusiness.businessId) {
      res.status(404).json({ success: false, message: "User not found!" });
      return;
    }

    // The target must be staff regardless of who calls: the kiosk PIN has no
    // meaning for HR or SUPERADMIN accounts, and the contract scopes the
    // target to STAFF for both HR and SUPERADMIN.
    if (target.role !== "STAFF") {
      res.status(403).json({
        success: false,
        message: "PINs belong to staff accounts only",
      });
      return;
    }

    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const pinSalt = randomBytes(16).toString("hex");
    const pinHash = createHmac("sha256", pinHmacKey)
      .update(`${target.id}${pin}${pinSalt}`)
      .digest("hex");
    const pinUpdatedAt = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: target.id },
        data: {
          pinHash,
          pinSalt,
          pinUpdatedAt,
          pinFailedCount: 0,
          pinLockedUntil: null,
          pinLastFailedAt: null,
          mustChangePin: true,
        },
        select: { id: true, pinUpdatedAt: true },
      });

      await tx.auditLog.create({
        data: {
          businessId: callerBusiness.businessId,
          actorType: "USER",
          actorUserId: caller.userId,
          action: "hr.reset_pin",
          entityType: "user",
          entityId: target.id,
          reason,
        },
      });

      return user;
    });

    auditLog.pinReset(caller.userId, target.id);
    res.status(201).json({
      success: true,
      data: { userId: updated.id, pinUpdatedAt: updated.pinUpdatedAt },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  changePassword,
  resetPin,
};
