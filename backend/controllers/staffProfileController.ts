import { Request, Response } from "express";
import { createHmac, randomBytes } from "crypto";
import prisma from "../config/prismaClient.js";
import { callerBusinessId } from "../utils/tenant.js";
import { writeAudit } from "../utils/auditWriter.js";
import { userLogger } from "../utils/logger.js";

/**
 * POST /api/staff/profile/change-pin (M8-R1)
 *
 * Allows a staff member to change their own kiosk PIN.
 * - Requires staff token (authMiddleware + authorizeRole("STAFF"))
 * - Body: { currentPin: string (required, 4 digits), newPin: string (required, 4 digits) }
 * - Validates: currentPin matches stored pinHash, newPin is 4 digits, newPin !== currentPin
 * - On success: generates new salt, hashes newPin (HMAC-SHA256 with PIN_HMAC_KEY),
 *   clears pinFailedCount=0, pinLockUntil=null, pinLastFailedAt=null, pinUpdatedAt=now, mustChangePin=false
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

    // Load caller's business for tenant scoping and audit
    const businessId = await callerBusinessId(callerUserId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    // Load the caller's user record with PIN fields
    const user = await prisma.user.findUnique({
      where: { id: callerUserId },
      select: {
        id: true,
        pinHash: true,
        pinSalt: true,
        pinUpdatedAt: true,
      },
    });

    if (!user) {
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

    // Verify current PIN using HMAC-SHA256 with PIN_HMAC_KEY
    const currentPinHash = createHmac("sha256", pinHmacKey)
      .update(`${user.id}${currentPin}${user.pinSalt}`)
      .digest("hex");

    if (currentPinHash !== user.pinHash) {
      res.status(400).json({
        success: false,
        message: "Invalid current PIN",
      });
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

    // Update user with new PIN and reset lock/failure counters
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: callerUserId },
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

      // Write audit log inside the transaction so it commits with the PIN change
      await writeAudit(
        {
          businessId,
          action: "pin.changed.self",
          entityType: "user",
          entityId: callerUserId,
          userId: callerUserId,
          reason: JSON.stringify({ changedBy: "self" }),
          beforeValues: { pinUpdatedAt: oldPinUpdatedAt },
          afterValues: { pinUpdatedAt: newPinUpdatedAt },
        },
        tx
      );
    });

    // Log to stdout audit stream as well (established convention)
    userLogger.info(
      { userId: callerUserId, event: "pin_changed_self" },
      "PIN changed by staff member"
    );

    res.status(200).json({
      success: true,
      message: "PIN changed successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      userLogger.error({ err: error.message, event: "pin_change_failed" }, "PIN change failed");
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