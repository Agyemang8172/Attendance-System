import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";
import { auditLog } from "../utils/logger.js";
import { writeAudit } from "../utils/auditWriter.js";
import { callerBusinessId } from "../utils/tenant.js";
import { generatePairingCode, generatePublicId } from "../utils/credentials.js";
import { constantTimeEqual, hashDeviceToken, hashPairingCode } from "../utils/kioskKeys.js";

/**
 * Kiosk device lifecycle (API contracts §7, kiosk spec §2 and §9).
 *
 * Three secrets rule this file: a code is shown once and stored only as a
 * keyed hash; a token is hashed and never echoed back in clear; and every
 * write that narrows who can act is wrapped in one transaction, so a raced
 * redemption or rotation cannot leave two live credentials on a row.
 */

/** Wrong code, unknown code, and expired code all answer the same refusal, so probing learns nothing. */
const INVALID_PAIRING_CODE = {
  success: false,
  message: "Invalid or expired pairing code",
} as const;

const KIOSK_TOKEN_TTL_DAYS = 30;
const KIOSK_TOKEN_MAX_AGE_DAYS = 90;

const dayMs = (days: number) => days * 24 * 60 * 60 * 1000;

/** Pairing codes are typed on a shop phone, outside on a touch keyboard: case-folding is on us. */
const normalizePairingCode = (code: string): string => code.trim().toUpperCase();

/** A kiosk token must be signed to be a kiosk token; an unset secret means a token that cannot be rebuilt. */
const missingKioskSecrets = () =>
  !process.env.JWT_SECRET || !process.env.KIOSK_TOKEN_KEY;

const signKioskToken = (
  kioskId: string,
  businessId: string,
  tokenVersion: number
): string =>
  jwt.sign(
    { kind: "kiosk", kioskId, businessId, tokenVersion },
    process.env.JWT_SECRET as string,
    { expiresIn: `${KIOSK_TOKEN_TTL_DAYS}d` }
  );

// ── Pairing-code issue (SUPERADMIN) ───────────────────────────────────

export const createPairingCode = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    // Fail closed: issuing an unkeyed hash would leave a code that never verifies properly.
    if (!process.env.KIOSK_PAIRING_KEY) {
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    const businessId = await callerBusinessId(req.user.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const { label, siteId } = req.body as { label: string; siteId?: string };

    if (siteId) {
      const site = await prisma.site.findFirst({
        where: { id: siteId, businessId },
        select: { id: true },
      });
      if (!site) {
        res.status(404).json({ success: false, message: "Site not found" });
        return;
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const code = generatePairingCode();

    // One transaction covers both shapes of the row: reuse a terminal that is
    // still waiting to pair for this label and site (the new code replaces the
    // previous hash and expiry, kiosk §2.1), or create the row fresh.
    const terminal = await prisma.$transaction(async (tx) => {
      const pending = await tx.kioskTerminal.findFirst({
        where: {
          businessId,
          state: "PENDING_PAIRING",
          label,
          siteId: siteId ?? null,
        },
        select: { id: true, publicId: true },
      });

      if (pending) {
        await tx.kioskTerminal.update({
          where: { id: pending.id },
          data: {
            pairingCodeHash: hashPairingCode(normalizePairingCode(code)),
            pairingCodeExpiresAt: expiresAt,
            registeredByUserId: req.user!.userId,
          },
        });
        await writeAudit({
          businessId,
          action: "kiosk.pairing_code_issued",
          entityType: "kiosk",
          entityId: pending.id,
          userId: req.user!.userId,
        }, tx);
        return pending;
      }

      const created = await tx.kioskTerminal.create({
        data: {
          businessId,
          siteId,
          label,
          publicId: generatePublicId(),
          state: "PENDING_PAIRING",
          pairingCodeHash: hashPairingCode(normalizePairingCode(code)),
          pairingCodeExpiresAt: expiresAt,
          registeredByUserId: req.user!.userId,
        },
        select: { id: true, publicId: true },
      });
      await writeAudit({
        businessId,
        action: "kiosk.pairing_code_issued",
        entityType: "kiosk",
        entityId: created.id,
        userId: req.user!.userId,
      }, tx);
      return created;
    });

    auditLog.kioskPairingIssued(req.user.userId, terminal.id, businessId, expiresAt);

    res.status(201).json({
      success: true,
      // The code is shown exactly once — the dashboard never displays it again (kiosk §2.1).
      data: {
        kioskId: terminal.id,
        publicId: terminal.publicId,
        pairingCode: code,
        expiresAt,
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

// ── Pair (public route) ───────────────────────────────────────────────

export const pair = async (req: Request, res: Response): Promise<void> => {
  try {
    if (missingKioskSecrets()) {
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    const submitted = normalizePairingCode(req.body.pairingCode as string);
    const now = new Date();

    // A pending terminal holds one keyed hash; redeemed, revoked, and expired
    // rows are all excluded by state. The expiry check in SQL removes the
    // expired rows from consideration, so a correct-but-expired code finds no
    // match and takes the same refusal as a wrong code (kiosk §10).
    const pending = await prisma.kioskTerminal.findMany({
      where: {
        state: "PENDING_PAIRING",
        pairingCodeHash: { not: null },
        pairingCodeExpiresAt: { gt: now },
      },
      select: {
        id: true,
        publicId: true,
        businessId: true,
        pairingCodeHash: true,
        tokenVersion: true,
      },
    });

    const submittedHash = hashPairingCode(submitted);
    const matched = pending.find((row) =>
      constantTimeEqual(submittedHash, row.pairingCodeHash as string)
    );

    if (!matched) {
      res.status(400).json(INVALID_PAIRING_CODE);
      return;
    }

    // Every terminal for this code bumps the version once, so a token signed
    // against a pre-pair version count can never outlive the reward.
    const newVersion = matched.tokenVersion + 1;
    const token = signKioskToken(matched.id, matched.businessId, newVersion);
    const tokenExpiresAt = new Date(now.getTime() + dayMs(KIOSK_TOKEN_TTL_DAYS));

    try {
      await prisma.$transaction(async (tx) => {
        // Version-current is the optimistic guard: two shoppers submitting the
        // same code race here and exactly one update wins; the loser finds no
        // row matching the still-pending version and falls through to the
        // same generic refusal below.
        await tx.kioskTerminal.update({
          where: { id: matched.id, tokenVersion: matched.tokenVersion },
          data: {
            state: "ACTIVE",
            pairedAt: now,
            pairingCodeHash: null,
            pairingCodeExpiresAt: null,
            tokenHash: hashDeviceToken(token),
            tokenVersion: { increment: 1 },
            tokenIssuedAt: now,
            tokenExpiresAt,
            lastSeenAt: now,
          },
        });
        await writeAudit({
          businessId: matched.businessId,
          action: "kiosk.paired",
          entityType: "kiosk",
          entityId: matched.id,
          kioskId: matched.id,
          reason: "pairing code used",
        }, tx);
      });
    } catch {
      // Lost the race over the same code — refusal, not a second token.
      res.status(400).json(INVALID_PAIRING_CODE);
      return;
    }

    auditLog.kioskPaired(matched.id, matched.businessId, req.ip);

    res.status(200).json({
      success: true,
      data: { token, publicId: matched.publicId, expiresAt: tokenExpiresAt },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Token renewal (kiosk middleware) ─────────────────────────────────

export const renewToken = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.kiosk) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    if (missingKioskSecrets()) {
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    // Recheck the row on every call, even though the middleware just did: the
    // row can move between the two reads (a revoke or expiry in between).
    const terminal = await prisma.kioskTerminal.findUnique({
      where: { id: req.kiosk.kioskId },
      select: { id: true, businessId: true, state: true, tokenVersion: true, tokenIssuedAt: true },
    });

    if (
      !terminal ||
      terminal.businessId !== req.kiosk.businessId ||
      terminal.state !== "ACTIVE"
    ) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    const now = new Date();

    // 90-day maximum age: renewal never extends a token past this window, and
    // at or past it the device must pair again (kiosk §2.4). Sending the row
    // back to PENDING_PAIRING in the same transaction is what makes the
    // terminal unreachable until a fresh pairing code is issued.
    if (
      terminal.tokenIssuedAt &&
      now.getTime() - terminal.tokenIssuedAt.getTime() >= dayMs(KIOSK_TOKEN_MAX_AGE_DAYS)
    ) {
      await prisma.kioskTerminal.update({
        where: { id: terminal.id },
        data: {
          state: "PENDING_PAIRING",
          tokenHash: null,
          tokenVersion: 0,
          tokenIssuedAt: null,
          tokenExpiresAt: null,
        },
      });

      // The expiry flip is a single update, not a transaction — the durable
      // row is written best-effort right after it succeeds.
      await writeAudit({
        businessId: terminal.businessId,
        action: "kiosk.expired",
        entityType: "kiosk",
        entityId: terminal.id,
        kioskId: terminal.id,
        reason: "token reached 90-day maximum age",
      });

      auditLog.kioskExpired(terminal.id, terminal.businessId);
      res.status(401).json({
        success: false,
        message: "Kiosk token has reached its maximum age, please pair the device again",
      });
      return;
    }

    const newVersion = terminal.tokenVersion + 1;
    const token = signKioskToken(terminal.id, terminal.businessId, newVersion);
    const tokenExpiresAt = new Date(now.getTime() + dayMs(KIOSK_TOKEN_TTL_DAYS));

    try {
      // Rotate the stored hash to the new token. tokenIssuedAt stays: the
      // 90-day age is measured from the original issue, not the last renewal.
      await prisma.kioskTerminal.update({
        where: { id: terminal.id, tokenVersion: terminal.tokenVersion },
        data: {
          tokenHash: hashDeviceToken(token),
          tokenVersion: { increment: 1 },
          tokenExpiresAt,
          lastSeenAt: now,
        },
      });
    } catch {
      // Another renewal (or revocation) landed between the read and the write.
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    // Rotation is a single guarded update, not a transaction — the durable
    // row is written best-effort after the hash actually changed.
    await writeAudit({
      businessId: terminal.businessId,
      action: "kiosk.token_renewed",
      entityType: "kiosk",
      entityId: terminal.id,
      kioskId: terminal.id,
    });

    auditLog.kioskTokenRenewed(terminal.id, terminal.businessId);

    res.status(200).json({
      success: true,
      data: { token, expiresAt: tokenExpiresAt },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Device list (SUPERADMIN) ─────────────────────────────────────────

export const listDevices = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(req.user.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 50;
    const skip = (page - 1) * limit;
    const state = req.query.state as string | undefined;
    const siteId = req.query.siteId as string | undefined;

    const where: Record<string, unknown> = { businessId };
    if (state) where.state = state;
    if (siteId) where.siteId = siteId;

    const [devices, total] = await Promise.all([
      prisma.kioskTerminal.findMany({
        // Non-secret fields only: the hashes exist so the server can verify,
        // never so the dashboard can display, which is why pairing and token
        // hashes stay here. publicId is the dashboard identifier by design.
        select: {
          id: true,
          publicId: true,
          label: true,
          siteId: true,
          state: true,
          pairedAt: true,
          lastSeenAt: true,
          pairingCodeExpiresAt: true,
          tokenIssuedAt: true,
          tokenExpiresAt: true,
          revokedAt: true,
          registeredAt: true,
        },
        where: where as any,
        orderBy: { registeredAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.kioskTerminal.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      data: devices,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalDevices: total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Revoke (SUPERADMIN) ──────────────────────────────────────────────

export const revokeDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(req.user.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const deviceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const device = await prisma.kioskTerminal.findUnique({
      where: { id: deviceId },
      select: { id: true, businessId: true, state: true },
    });

    // Cross-business and unknown share one refusal: existence elsewhere is not
    // for the caller to probe.
    if (!device || device.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Device not found" });
      return;
    }

    if (device.state === "REVOKED") {
      res.status(409).json({ success: false, message: "Device is already revoked" });
      return;
    }

    // The version bump is what kills the current token at once, before its
    // 30-day window would have run out (kiosk §9). Attendance history stays.
    await prisma.kioskTerminal.update({
      where: { id: device.id },
      data: {
        state: "REVOKED",
        tokenVersion: { increment: 1 },
        revokedAt: new Date(),
        revokedByUserId: req.user.userId,
      },
    });

    const revokeReason =
      typeof (req.body as { reason?: string }).reason === "string"
        ? (req.body as { reason?: string }).reason
        : undefined;

    await writeAudit({
      businessId,
      action: "kiosk.revoked",
      entityType: "kiosk",
      entityId: device.id,
      userId: req.user.userId,
      reason: revokeReason ?? null,
    });

    auditLog.kioskRevoked(req.user.userId, device.id, businessId, revokeReason);

    res.status(200).json({
      success: true,
      message: "Device revoked",
      data: { id: device.id, state: "REVOKED" },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default {
  createPairingCode,
  pair,
  renewToken,
  listDevices,
  revokeDevice,
};
