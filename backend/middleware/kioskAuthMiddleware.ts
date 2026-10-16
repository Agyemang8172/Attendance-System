import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";
import { constantTimeEqual, hashDeviceToken } from "../utils/kioskKeys.js";
import { writeAudit } from "../utils/auditWriter.js";

/**
 * Device-token middleware (kiosk spec §2.5 — the server rechecks the row on
 * every request, because a signed token only proves who was authorized when
 * it was issued).
 *
 * Extends the same `Express.Request` augmentation that lives in
 * authMiddleware.ts; the interface declarations merge across files.
 */
declare global {
  namespace Express {
    interface Request {
      kiosk?: {
        kioskId: string;
        businessId: string;
      };
    }
  }
}

const kioskAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ success: false, message: "Access Denied. No token provided" });
    return;
  }

  // Fail closed: verifying against an unset secret would either throw or
  // accept nothing, but both are silently opaque, so make the misconfiguration
  // an explicit server error.
  if (!process.env.JWT_SECRET || !process.env.KIOSK_TOKEN_KEY) {
    res.status(500).json({ success: false, message: "Server error" });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      kind?: string;
      kioskId?: string;
      businessId?: string;
      tokenVersion?: number;
    };

    // The `kind` claim separates a device token from an employee session
    // token; an employee token must never be mistaken for a paired kiosk.
    if (decoded.kind !== "kiosk" || !decoded.kioskId || !decoded.businessId) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    const terminal = await prisma.kioskTerminal.findUnique({
      where: { id: decoded.kioskId },
      select: {
        id: true,
        businessId: true,
        state: true,
        tokenVersion: true,
        tokenHash: true,
        tokenExpiresAt: true,
        business: { select: { isActive: true } },
      },
    });

    // Unknown device, cross-reference device, or non-ACTIVE state all answer
    // the same refusal so the response confirms nothing to an attacker.
    if (
      !terminal ||
      terminal.businessId !== decoded.businessId ||
      terminal.state !== "ACTIVE"
    ) {
      // Best-effort durable row (§11 `kiosk.token_rejected`): only when the
      // terminal row resolved — an unknown token has no terminal or business
      // to attribute, so nothing is written for it.
      if (terminal) {
        await writeAudit({
          businessId: terminal.businessId,
          action: "kiosk.token_rejected",
          entityType: "kiosk",
          entityId: terminal.id,
          kioskId: terminal.id,
          reason:
            terminal.businessId !== decoded.businessId
              ? "token business mismatch"
              : `terminal not in active state (${terminal.state})`,
        });
      }
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    if (!terminal.business.isActive) {
      await writeAudit({
        businessId: terminal.businessId,
        action: "kiosk.token_rejected",
        entityType: "kiosk",
        entityId: terminal.id,
        kioskId: terminal.id,
        reason: "business account inactive",
      });
      res
        .status(403)
        .json({ success: false, message: "Business account is not active" });
      return;
    }

    // A stale token (from before a renewal or re-pair) carries an outdated
    // version claim, and a rotated tokenHash no longer matches — either way
    // the device is refused at once (kiosk §2.3).
    if (decoded.tokenVersion !== terminal.tokenVersion) {
      await writeAudit({
        businessId: terminal.businessId,
        action: "kiosk.token_rejected",
        entityType: "kiosk",
        entityId: terminal.id,
        kioskId: terminal.id,
        reason: "token version mismatch",
      });
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    if (
      !terminal.tokenHash ||
      !constantTimeEqual(hashDeviceToken(token), terminal.tokenHash)
    ) {
      await writeAudit({
        businessId: terminal.businessId,
        action: "kiosk.token_rejected",
        entityType: "kiosk",
        entityId: terminal.id,
        kioskId: terminal.id,
        reason: "token hash mismatch",
      });
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    if (terminal.tokenExpiresAt && terminal.tokenExpiresAt.getTime() < Date.now()) {
      await writeAudit({
        businessId: terminal.businessId,
        action: "kiosk.token_rejected",
        entityType: "kiosk",
        entityId: terminal.id,
        kioskId: terminal.id,
        reason: "token expired",
      });
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    req.kiosk = {
      kioskId: terminal.id,
      businessId: terminal.businessId,
    };

    // Best effort: the request is already authenticated, so a failed uptime
    // write must not fail the punch. The renewal window moves only on
    // POST /token/renew (§2.4), never as a side effect here.
    prisma.kioskTerminal
      .update({
        where: { id: terminal.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});

    next();
  } catch {
    // jwt.verify throws on a bad signature or expired token; that is a 401.
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export default kioskAuthMiddleware;
