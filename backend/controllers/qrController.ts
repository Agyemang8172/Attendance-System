import { createHmac, randomBytes } from "crypto";
import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog, userLogger } from "../utils/logger.js";
import { callerBusinessId } from "../utils/tenant.js";

/**
 * The badge token is opaque and only its keyed hash is stored. The hash uses
 * HMAC-SHA-256 with the server-side `QR_SECRET_KEY` (kiosk §3.2); a database
 * leak therefore exposes nothing that can be presented as a badge.
 */
const tokenHash = (token: string): string =>
  createHmac("sha256", process.env.QR_SECRET_KEY as string).update(token).digest("hex");

// ── Issue (or re-issue) a QR credential ──────────────────────────────

export const issueQrCredential = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (!process.env.QR_SECRET_KEY) {
      // Fail closed: a token whose hash was never keyed would persist forever.
      userLogger.error({ event: "qr_issue_missing_key" }, "QR_SECRET_KEY is not set");
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, businessId: true, isActive: true },
    });
    if (!employee || employee.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Employee not found" });
      return;
    }
    if (!employee.isActive) {
      res.status(400).json({ success: false, message: "Employee is not active" });
      return;
    }

    // One transaction: revoke the active credential and insert the new one, so
    // the partial unique index (one active credential per employee) never trips.
    const token = randomBytes(24).toString("base64url");
    const credential = await prisma.$transaction(async (tx) => {
      await tx.qrCredential.updateMany({
        where: { employeeId, revokedAt: null },
        data: { revokedAt: new Date(), revokedByUserId: caller.userId },
      });

      return tx.qrCredential.create({
        data: {
          businessId,
          employeeId,
          tokenHash: tokenHash(token),
          issuedByUserId: caller.userId,
        },
        select: {
          id: true,
          employeeId: true,
          schemaVersion: true,
          issuedAt: true,
        },
      });
    });

    auditLog.qrIssued(caller.userId, employeeId, businessId);
    // The raw token is shown exactly once — SUPERADMIN prints the badge (O5).
    res.status(201).json({
      success: true,
      data: {
        id: credential.id,
        qrPayload: token,
        schemaVersion: credential.schemaVersion,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Revoke a QR credential ───────────────────────────────────────────

export const revokeQrCredential = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const credentialId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.qrCredential.findUnique({
      where: { id: credentialId },
      select: { id: true, businessId: true, revokedAt: true },
    });
    if (!existing || existing.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Credential not found" });
      return;
    }

    if (existing.revokedAt) {
      res.status(400).json({ success: false, message: "Credential is already revoked" });
      return;
    }

    await prisma.qrCredential.update({
      where: { id: credentialId },
      data: { revokedAt: new Date(), revokedByUserId: caller.userId },
    });

    auditLog.qrRevoked(caller.userId, credentialId, businessId);
    res.status(200).json({ success: true, message: "Credential revoked" });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default {
  issueQrCredential,
  revokeQrCredential,
};
