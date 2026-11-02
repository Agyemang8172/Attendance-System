import { Request, Response } from "express";
import { createHmac, randomBytes } from "crypto";
import prisma from "../config/prismaClient.js";
import { constantTimeEqual } from "../utils/kioskKeys.js";
import { PIN_MAX_ATTEMPTS, pinLockUntil } from "../utils/pinPolicy.js";
import { userLogger } from "../utils/logger.js";

/**
 * The refusal bodies stay deliberately small. A wrong current PIN and a
 * request that has just tripped the lock share the same 400, so the response
 * never tells the caller how many attempts remain.
 */
const PIN_MISMATCH = {
  success: false,
  message: "Invalid current PIN",
} as const;

const PIN_LOCKED = {
  success: false,
  code: "PIN_LOCKED",
  message: "PIN is locked. Try again later.",
} as const;

const PIN_CONFLICT = {
  success: false,
  code: "PIN_CHANGED",
  message: "PIN changed. Try again.",
} as const;

/**
 * POST /api/staff/profile/change-pin (M8-R1)
 *
 * Allows a staff member to change their own kiosk PIN.
 * - Requires staff token (authMiddleware + authorizeRole("STAFF"))
 * - Body: { currentPin: string (required, 4 digits), newPin: string (required, 4 digits) }
 * - Validates: currentPin matches stored pinHash, newPin is 4 digits, newPin !== currentPin
 * - Honours the shared R5 budget: a locked PIN is refused, and a wrong current
 *   PIN increments the same cumulative counter the kiosk lane uses.
 * - On success: generates new salt, hashes newPin (HMAC-SHA256 with PIN_HMAC_KEY),
 *   clears the failure counters, expires every open kiosk verification session
 *   for this employee, and stores only the hash and salt.
 * - Audit: writes audit log with action="pin.changed.self"
 * - Response: { success: true, message: "PIN changed successfully" } — PIN never in response
 */
export const changePin = async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { currentPin, newPin } = req.body as { currentPin?: string; newPin?: string };

    // Validate input presence
    if (!currentPin || !newPin) {
      res.status(400).json({
        success: false,
        message: "Current PIN and new PIN are required",
      });
      return;
    }

    // Validate PIN format: exactly 4 digits
    if (!/^\d{4}$/.test(currentPin)) {
      res.status(400).json({
        success: false,
        message: "Current PIN must be exactly 4 digits",
      });
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      res.status(400).json({
        success: false,
        message: "New PIN must be exactly 4 digits",
      });
      return;
    }

    // Prevent PIN reuse
    if (currentPin === newPin) {
      res.status(400).json({
        success: false,
        message: "New PIN must be different from current PIN",
      });
      return;
    }

    const pinHmacKey = process.env.PIN_HMAC_KEY;
    if (!pinHmacKey) {
      // Fail closed: without the server key, a stored PIN would be weaker
      // than the contract, so the change is refused rather than downgraded.
      userLogger.error({ event: "pin_change_missing_key" }, "PIN_HMAC_KEY is not set");
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    const callerUserId = caller.userId;
    const businessId = caller.businessId;
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    // Load the caller's user record with the PIN state the lockout needs.
    const user = await prisma.user.findUnique({
      where: { id: callerUserId },
      select: {
        id: true,
        businessId: true,
        isActive: true,
        pinHash: true,
        pinSalt: true,
        pinUpdatedAt: true,
        pinFailedCount: true,
        pinLockedUntil: true,
      },
    });

    if (!user || user.businessId !== businessId || !user.isActive) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // User must have a PIN set to change it
    if (!user.pinHash || !user.pinSalt) {
      res.status(400).json({
        success: false,
        message: "No PIN is set. Contact HR to set one up.",
      });
      return;
    }

    const now = new Date();

    // The employee-level lock is cumulative and survives a new session. A
    // locked PIN cannot be changed until the R5 window has passed, so this
    // endpoint cannot be used as a cheaper guessing lane.
    if (user.pinLockedUntil && user.pinLockedUntil.getTime() > now.getTime()) {
      res.status(429).json(PIN_LOCKED);
      return;
    }

    // Verify current PIN using HMAC-SHA256 with PIN_HMAC_KEY. The comparison
    // is constant time: a reject path must not reveal how many digits matched.
    const currentPinHash = createHmac("sha256", pinHmacKey)
      .update(`${user.id}${currentPin}${user.pinSalt}`)
      .digest("hex");

    if (!constantTimeEqual(currentPinHash, user.pinHash)) {
      const failed = await prisma.$transaction(async (tx) => {
        // Reject stale credential or lockout state. A concurrent kiosk
        // attempt must not be charged against or bypassed by this request.
        const bumped = await tx.user.updateMany({
          where: {
            id: user.id,
            businessId,
            isActive: true,
            pinHash: user.pinHash,
            pinSalt: user.pinSalt,
            pinFailedCount: user.pinFailedCount,
            pinLockedUntil: user.pinLockedUntil,
          },
          data: {
            pinFailedCount: { increment: 1 },
            pinLastFailedAt: now,
          },
        });

        if (bumped.count !== 1) return { conflict: true, locked: false };

        // Read the counter back inside the transaction so concurrent failures
        // cannot each believe they are below the limit.
        const row = await tx.user.findUnique({
          where: { id: user.id },
          select: { pinFailedCount: true },
        });
        const count = row?.pinFailedCount ?? 0;
        const locked = count >= PIN_MAX_ATTEMPTS;

        if (locked) {
          await tx.user.update({
            where: { id: user.id },
            data: { pinLockedUntil: pinLockUntil(now) },
          });
        }

        await tx.auditLog.create({
          data: {
            businessId,
            actorType: "USER",
            actorUserId: user.id,
            action: "pin.change_failed",
            entityType: "user",
            entityId: user.id,
            reason: locked ? "pin attempt limit reached" : "current pin mismatch",
          },
        });

        return { conflict: false, locked };
      });

      if (failed.conflict) {
        res.status(409).json(PIN_CONFLICT);
        return;
      }

      // Same body whether this attempt tripped the lock or not. The next
      // request is refused 429 by the check above.
      res.status(400).json(PIN_MISMATCH);
      return;
    }

    // Generate new salt and hash for the new PIN
    const newPinSalt = randomBytes(16).toString("hex");
    const newPinHash = createHmac("sha256", pinHmacKey)
      .update(`${user.id}${newPin}${newPinSalt}`)
      .digest("hex");
    const newPinUpdatedAt = new Date();

    // Store old pinUpdatedAt for audit beforeValues
    const oldPinUpdatedAt = user.pinUpdatedAt;

    // Observe the credential and lockout state together. A concurrent reset
    // or PIN failure invalidates this write instead of clearing a newer lock.
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: user.id,
          businessId,
          isActive: true,
          pinHash: user.pinHash,
          pinSalt: user.pinSalt,
          pinFailedCount: user.pinFailedCount,
          pinLockedUntil: user.pinLockedUntil,
        },
        data: {
          pinHash: newPinHash,
          pinSalt: newPinSalt,
          pinUpdatedAt: newPinUpdatedAt,
          pinFailedCount: 0,
          pinLockedUntil: null,
          pinLastFailedAt: null,
          mustChangePin: false,
        },
      });

      if (updated.count !== 1) return false;

      // An open verification session proved the old PIN. Replacing the
      // credential must end those sessions, or the old holder could still
      // consume one after the change.
      await tx.verificationSession.updateMany({
        where: { businessId, employeeId: user.id, consumedAt: null },
        data: { state: "EXPIRED" },
      });

      // Required audit failure rejects the transaction with the PIN change.
      await tx.auditLog.create({
        data: {
          businessId,
          actorType: "USER",
          actorUserId: user.id,
          action: "pin.changed.self",
          entityType: "user",
          entityId: user.id,
          reason: JSON.stringify({ changedBy: "self" }),
          beforeValues: { pinUpdatedAt: oldPinUpdatedAt?.toISOString() ?? null },
          afterValues: { pinUpdatedAt: newPinUpdatedAt.toISOString() },
        },
      });

      return true;
    });

    if (!changed) {
      res.status(409).json(PIN_CONFLICT);
      return;
    }

    // Log to stdout audit stream as well (established convention)
    userLogger.info(
      { userId: user.id, event: "pin_changed_self" },
      "PIN changed by staff member"
    );

    res.status(200).json({
      success: true,
      message: "PIN changed successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      userLogger.error({ event: "pin_change_failed" }, "PIN change failed");
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default {
  changePin,
};
