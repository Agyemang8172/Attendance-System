import { createHash, createHmac, randomBytes } from "crypto";
import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog, verifyLogger } from "../utils/logger.js";
import { writeAudit } from "../utils/auditWriter.js";
import { constantTimeEqual } from "../utils/kioskKeys.js";
import { PIN_MAX_ATTEMPTS, PIN_LOCK_MINUTES } from "../utils/pinPolicy.js";
import { assessLocation, KioskGeoSite } from "../utils/location.js";

/**
 * Kiosk employee verification (API contracts §7, kiosk spec §3–§5).
 *
 * Two steps, two secrets: a badge token opens a candidate session, a PIN
 * turns it into a verified one, and neither step alone authorizes a punch
 * (O5, §4.2). Every failure path below writes one `attendance_attempts`
 * row — evidence that the step was attempted and refused — without ever
 * fabricating a punch for it (O7). Bodies carry no employee id on failure
 * and no PIN material anywhere.
 */

/**
 * Badge hashes, session-handle hashes, and the PIN hash are three separate
 * secret lanes. The session handle is random 24 bytes from a CSPRNG, so its
 * at-rest hash needs no key: a bare SHA-256 of a 192-bit random value has no
 * precomputable table, which is exactly what kiosk §4.3 asks of it ("hashed
 * at rest, so a leaked database does not yield a usable session handle").
 */
const hashQrToken = (token: string): string =>
  createHmac("sha256", process.env.QR_SECRET_KEY as string).update(token).digest("hex");

/**
 * Exported for Phase 4: the punch endpoints (`POST /api/attendance/clock-in`
 * `/clock-out`) must resolve the session handle EXACTLY the way `verifyPin`
 * does — same hash, same kiosk binding, same refusals.
 */
export const hashSessionHandle = (handle: string): string =>
  createHash("sha256").update(handle).digest("hex");

/** The PIN lane, in the exact shape userController.resetPin stores it (kiosk §5.1). */
const pinCandidateHash = (
  employeeId: string,
  pin: string,
  pinSalt: string
): string =>
  createHmac("sha256", process.env.PIN_HMAC_KEY as string)
    .update(`${employeeId}${pin}${pinSalt}`)
    .digest("hex");

// Final R5 values (owner ruling R5, 2026-10-17) live in utils/pinPolicy.ts so
// the kiosk lane and the self-service PIN change share one guessing budget.

/** Session lifetime: a candidate identity lives two minutes (kiosk §4.3). */
const SESSION_TTL_MS = 2 * 60 * 1000;

/**
 * The safe refusals (kiosk §10). Unknown and cross-business badges share one
 * body so probing cannot tell them apart; the wrong-PIN body is identical
 * whether or not it just tripped the lock, so no countdown is revealed.
 */
const BADGE_NOT_RECOGNISED = {
  success: false,
  message: "Badge not recognised. See HR.",
} as const;
const BADGE_REVOKED = {
  success: false,
  message: "This badge is no longer valid. See HR.",
} as const;
const EMPLOYEE_INACTIVE = {
  success: false,
  message: "This account is not active. See HR.",
} as const;
const PIN_INCORRECT = {
  success: false,
  message: "That PIN is not correct. Try again.",
} as const;
// The session refusals below are also the punch endpoints' bodies (contracts
// §8 reads the same session rows), so they are exported with them: unknown and
// cross-kiosk share one 404, CONSUMED answers a plain 409, and both expired
// and never-verified share one "start again" 400. No body reveals attendance
// state or an employee id.
export const SESSION_UNKNOWN = {
  success: false,
  message: "Verification session not found",
} as const;
export const SESSION_EXPIRED = {
  success: false,
  message: "Session expired. Scan your badge again.",
} as const;
export const SESSION_LOCKED = {
  success: false,
  message: "Too many tries. Try again later or see HR.",
} as const;
export const SESSION_USED = {
  success: false,
  message: "Verification session was already used",
} as const;

/**
 * One attempt row, built from the fields the schema provides
 * (`AttendanceAttempt`, kiosk §6.1): the location assessment rides on every
 * identify attempt, successful or not; `outcome` is the AttemptOutcome enum.
 * `step` is the free-text step marker the schema comment lists — IDENTIFY,
 * VERIFY, PIN, TOKEN.
 */
const recordAttempt = async (data: {
  businessId: string;
  kioskId?: string | null;
  employeeId?: string | null;
  siteId?: string | null;
  verificationSessionId?: string | null;
  step: string;
  outcome: "SUCCESS" | "REJECTED";
  reason: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  distanceMeters?: number | null;
  locationResult?: "INSIDE" | "OUTSIDE" | "UNKNOWN" | null;
  capturedAt?: Date | null;
  receivedAt: Date;
  ip?: string | null;
  userAgent?: string | null;
}) =>
  prisma.attendanceAttempt.create({
    data: {
      businessId: data.businessId,
      kioskId: data.kioskId ?? null,
      employeeId: data.employeeId ?? null,
      siteId: data.siteId ?? null,
      verificationSessionId: data.verificationSessionId ?? null,
      step: data.step,
      outcome: data.outcome,
      reason: data.reason,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      accuracyMeters: data.accuracyMeters ?? null,
      distanceMeters: data.distanceMeters ?? null,
      locationResult: data.locationResult ?? null,
      capturedAt: data.capturedAt ?? null,
      receivedAt: data.receivedAt,
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
    },
  });

/**
 * The kiosk's paired site, for the fence the attempt is assessed against —
 * exported because the punch assesses the location the same way. A site that
 * exists but is inactive binds no fence — it is treated the same as no site
 * paired, so the assessment says UNKNOWN instead of inventing a radius
 * someone just switched off.
 */
export const resolveKioskSite = async (
  kioskId: string
): Promise<{ siteId: string | null; site: KioskGeoSite | null }> => {
  const terminal = await prisma.kioskTerminal.findUnique({
    where: { id: kioskId },
    select: {
      siteId: true,
      site: {
        select: { id: true, latitude: true, longitude: true, radiusMeters: true, isActive: true },
      },
    },
  });

  if (!terminal?.site || !terminal.site.isActive) {
    return { siteId: null, site: null };
  }
  return {
    siteId: terminal.site.id,
    site: {
      latitude: terminal.site.latitude,
      longitude: terminal.site.longitude,
      radiusMeters: terminal.site.radiusMeters,
    },
  };
};

/** CLOCK_IN when nothing is open, CLOCK_OUT when the day already started. */
const permittedActionFor = async (employeeId: string): Promise<"CLOCK_IN" | "CLOCK_OUT"> => {
  // An open session is exactly what the legacy clockIn refuses on:
  // `sessionStatus: "OPEN"` on the Attendance row.
  const openAttendance = await prisma.attendance.findFirst({
    where: { userId: employeeId, sessionStatus: "OPEN" },
    select: { id: true },
  });
  return openAttendance ? "CLOCK_OUT" : "CLOCK_IN";
};

// ── Identify (kiosk middleware) ──────────────────────────────────────────────

export const identify = async (req: Request, res: Response): Promise<void> => {
  try {
    const kiosk = req.kiosk;
    if (!kiosk) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    // Fail closed: a token hashed without the key would be a bare digest
    // anyone can precompute (kiosk §10, same rule as the other key lanes).
    if (!process.env.QR_SECRET_KEY) {
      verifyLogger.error(
        { kioskId: kiosk.kioskId, event: "verify_missing_qr_key" },
        "QR_SECRET_KEY is not set"
      );
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    const body = req.body as {
      qrToken: string;
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
      capturedAt?: string;
    };

    const receivedAt = new Date();
    const { siteId, site } = await resolveKioskSite(kiosk.kioskId);
    const location = assessLocation(site, {
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyMeters: body.accuracyMeters,
      capturedAt: body.capturedAt,
    });

    // Every branch below ends in an attempt row with these fields on it.
    const attemptBase = {
      businessId: kiosk.businessId,
      kioskId: kiosk.kioskId,
      siteId,
      step: "IDENTIFY",
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      accuracyMeters: body.accuracyMeters ?? null,
      distanceMeters: location.distanceMeters,
      locationResult: location.result,
      capturedAt:
        body.capturedAt !== undefined ? new Date(body.capturedAt) : null,
      receivedAt,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    };

    const tokenHash = hashQrToken(body.qrToken);

    // Lookup by hash alone first: a revoked badge answers its own §10 row,
    // an unknown or foreign badge shares one refusal. The employee id is
    // joined but never put in a response body.
    const credential = await prisma.qrCredential.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        businessId: true,
        employeeId: true,
        revokedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            businessId: true,
            isActive: true,
          },
        },
      },
    });

    if (!credential || credential.businessId !== kiosk.businessId) {
      await recordAttempt({
        ...attemptBase,
        outcome: "REJECTED",
        reason: "badge_unknown_or_foreign",
      });
      auditLog.identifyFailed(kiosk.kioskId, "badge_unknown_or_foreign", req.ip);
      res.status(404).json(BADGE_NOT_RECOGNISED);
      return;
    }

    if (credential.revokedAt) {
      await recordAttempt({
        ...attemptBase,
        employeeId: credential.employeeId,
        outcome: "REJECTED",
        reason: "badge_revoked",
      });
      auditLog.identifyFailed(kiosk.kioskId, "badge_revoked", req.ip);
      res.status(403).json(BADGE_REVOKED);
      return;
    }

    const employee = credential.employee;
    if (!employee || employee.businessId !== kiosk.businessId || !employee.isActive) {
      await recordAttempt({
        ...attemptBase,
        employeeId: credential.employeeId,
        outcome: "REJECTED",
        reason: "employee_inactive",
      });
      auditLog.identifyFailed(kiosk.kioskId, "employee_inactive", req.ip);
      res.status(403).json(EMPLOYEE_INACTIVE);
      return;
    }

    const permittedAction = await permittedActionFor(employee.id);
    const expiresAt = new Date(receivedAt.getTime() + SESSION_TTL_MS);

    // The kiosk's handle is shown exactly once here; only its hash is persistated.
    const handle = randomBytes(24).toString("base64url");

    // The DB session id comes back so every audit row and every pino row for
    // this session correlates on the same id — the raw handle stays only in
    // the response body, which the kiosk already holds.
    const sessionId = await prisma.$transaction(async (tx) => {
      const session = await tx.verificationSession.create({
        data: {
          businessId: kiosk.businessId,
          employeeId: employee.id,
          kioskId: kiosk.kioskId,
          sessionIdHash: hashSessionHandle(handle),
          state: "QR_ACCEPTED",
          expiresAt,
        },
        select: { id: true },
      });

      await writeAudit({
        businessId: kiosk.businessId,
        action: "verify.session_started",
        entityType: "verification_session",
        entityId: session.id,
        kioskId: kiosk.kioskId,
      }, tx);

      await tx.attendanceAttempt.create({
        data: {
          ...attemptBase,
          employeeId: employee.id,
          verificationSessionId: session.id,
          outcome: "SUCCESS",
          reason: "badge_recognised",
        },
      });

      return session.id;
    });

    auditLog.verifySessionStarted(
      kiosk.kioskId,
      kiosk.businessId,
      employee.id,
      sessionId
    );

    res.status(201).json({
      success: true,
      // No employee id, no PIN fields, no attendance state — only what the
      // kiosk screen needs to say (contracts §7, kiosk §10).
      data: {
        sessionId: handle,
        employeeDisplayName: `${employee.firstName} ${employee.lastName}`,
        permittedAction,
        locationResult: location.result,
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

// ── Verify PIN (kiosk middleware) ────────────────────────────────────────────

export const verifyPin = async (req: Request, res: Response): Promise<void> => {
  try {
    const kiosk = req.kiosk;
    if (!kiosk) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    // Fail closed: an unkeyed PIN hash would be a bare digest anyone can
    // precompute over 10,000 four-digit codes (kiosk §10).
    if (!process.env.PIN_HMAC_KEY) {
      verifyLogger.error(
        { kioskId: kiosk.kioskId, event: "verify_missing_pin_key" },
        "PIN_HMAC_KEY is not set"
      );
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    /*
     * Limiting per §7 and §5.2: the kiosk-keyed limiter on the route bounds
     * the device lane. The employee lane is bound here by the session's own
     * pinAttemptCount (second layer) and, cumulatively, by the user's
     * pinFailedCount/pinLockedUntil — the employee key only exists after the
     * session lookup, so the user row is the durable counter that survives a
     * cancelled session (SEC-13).
     */

    const { sessionId, pin } = req.body as { sessionId: string; pin: string };
    const now = new Date();

    // Resolve by the stored hash; unknown and cross-kiosk sessions share one
    // 404, so a stolen handle cannot be probed from another device (§4.3).
    const session = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(sessionId) },
    });

    if (!session || session.kioskId !== kiosk.kioskId) {
      res.status(404).json(SESSION_UNKNOWN);
      return;
    }

    // State machine (§4.2): only QR_ACCEPTED and PIN_PENDING may proceed.
    if (session.state === "VERIFIED" || session.state === "CONSUMED") {
      res.status(409).json(SESSION_USED);
      return;
    }

    if (session.state === "LOCKED") {
      res.status(429).json(SESSION_LOCKED);
      return;
    }

    if (session.state === "EXPIRED" || session.expiresAt.getTime() <= now.getTime()) {
      // Best-effort durable row (§11 `verify.expired`): the refusal reason is
      // recorded only where the kiosk claim gives us a business to attribute.
      await writeAudit({
        businessId: kiosk.businessId,
        action: "verify.expired",
        entityType: "verification_session",
        entityId: session.id,
        kioskId: kiosk.kioskId,
        reason:
          session.state === "EXPIRED" ? "session already expired" : "session passed its expiry",
      });
      res.status(400).json(SESSION_EXPIRED);
      return;
    }

    const attemptBase = {
      businessId: kiosk.businessId,
      kioskId: kiosk.kioskId,
      employeeId: session.employeeId,
      verificationSessionId: session.id,
      step: "VERIFY",
      receivedAt: now,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    };

    const employee = await prisma.user.findUnique({
      where: { id: session.employeeId },
      select: {
        id: true,
        businessId: true,
        isActive: true,
        pinHash: true,
        pinSalt: true,
        pinFailedCount: true,
        pinLockedUntil: true,
        pinLastFailedAt: true,
      },
    });

    if (!employee || employee.businessId !== kiosk.businessId || !employee.isActive) {
      await recordAttempt({ ...attemptBase, outcome: "REJECTED", reason: "employee_unavailable" });
      res.status(404).json(SESSION_UNKNOWN);
      return;
    }

    // Employee-level lock from an earlier session: temporary and silent in
    // the body — "try again later", never attempts left (kiosk §10).
    if (employee.pinLockedUntil && employee.pinLockedUntil.getTime() > now.getTime()) {
      await recordAttempt({ ...attemptBase, outcome: "REJECTED", reason: "pin_employee_locked" });
      res.status(429).json({
        success: false,
        message: "Try again later or see HR.",
      });
      return;
    }

    const candidate = employee.pinSalt
      ? pinCandidateHash(employee.id, pin, employee.pinSalt)
      : null;

    const matched =
      employee.pinHash !== null &&
      candidate !== null &&
      // Constant time: the reject path must not reveal how many digits were
      // right (kiosk §5.2).
      constantTimeEqual(candidate, employee.pinHash);

    if (matched) {
      await prisma.$transaction(async (tx) => {
        await tx.verificationSession.update({
          where: { id: session.id },
          data: { state: "VERIFIED", pinAttemptCount: 0, verifiedAt: now },
        });
        await tx.user.update({
          where: { id: employee.id },
          data: {
            pinFailedCount: 0,
            pinLastFailedAt: null,
            pinLockedUntil: null,
          },
        });
        await tx.attendanceAttempt.create({
          data: { ...attemptBase, outcome: "SUCCESS", reason: "pin_matched" },
        });
        await writeAudit({
          businessId: kiosk.businessId,
          action: "verify.succeeded",
          entityType: "verification_session",
          entityId: session.id,
          kioskId: kiosk.kioskId,
        }, tx);
      });

      auditLog.verifySucceeded(session.id, employee.id, kiosk.kioskId);

      // Recomputed here, not trusted from identify: an open session could
      // have closed (or opened) between the two calls.
      const action = await permittedActionFor(employee.id);
      res.status(201).json({
        success: true,
        data: { result: "VERIFIED", action, status: "VERIFIED" },
      });
      return;
    }

    // Mismatch: one transaction bumps both counters, keeps the failure
    // evidence, and locks the session at its own limit. A PIN that was never
    // set (no hash/salt row yet) just fails here too.
    //
    // SEC-13: the employee-level count is the cumulative lock, so a new
    // verification session cannot reset the guessing budget. The session lock
    // stays as the second layer, but the user row is what bounds an attacker
    // who cancels and re-identifies after nine failures.
    const newAttemptCount = session.pinAttemptCount + 1;
    const sessionHitsLimit = newAttemptCount >= PIN_MAX_ATTEMPTS;
    const lockedUntil = new Date(
      now.getTime() + PIN_LOCK_MINUTES * 60 * 1000
    );

    // A cumulative lock can trip on a session whose own counter is still low.
    // The counter is read back from the database inside the transaction (not
    // the value loaded before it) so concurrent failures cannot each believe
    // they are below the limit.
    let lockTriggered = false;

    await prisma.$transaction(async (tx) => {
      await tx.verificationSession.update({
        where: { id: session.id },
        data: {
          pinAttemptCount: { increment: 1 },
          ...(sessionHitsLimit ? { state: "LOCKED" as const, lockedAt: now } : {}),
        },
      });
      const failedUser = await tx.user.update({
        where: { id: employee.id },
        data: {
          pinFailedCount: { increment: 1 },
          pinLastFailedAt: now,
        },
        select: { pinFailedCount: true },
      });
      const userHitsLimit = failedUser.pinFailedCount >= PIN_MAX_ATTEMPTS;
      if (userHitsLimit) {
        await tx.user.update({
          where: { id: employee.id },
          data: { pinLockedUntil: lockedUntil },
        });
      }

      lockTriggered = sessionHitsLimit || userHitsLimit;

      await tx.attendanceAttempt.create({
        data: {
          ...attemptBase,
          outcome: "REJECTED",
          reason: lockTriggered ? "pin_attempts_exhausted" : "pin_mismatch",
        },
      });
      await writeAudit({
        businessId: kiosk.businessId,
        action: "pin.verify_failed",
        entityType: "verification_session",
        entityId: session.id,
        kioskId: kiosk.kioskId,
        reason: `pin attempt ${newAttemptCount} did not match`,
      }, tx);
      if (lockTriggered) {
        await writeAudit({
          businessId: kiosk.businessId,
          action: "pin.locked",
          entityType: "verification_session",
          entityId: session.id,
          kioskId: kiosk.kioskId,
          reason: "pin attempt limit reached",
        }, tx);
      }
    });

    if (lockTriggered) {
      auditLog.pinLocked(session.id, employee.id, lockedUntil);
    } else {
      auditLog.pinVerifyFailed(session.id, employee.id, newAttemptCount);
    }

    // Same body whether this request tripped the lock or not (§10): the
    // response never says attempts left. The next attempt is refused 429 by
    // the LOCKED state above.
    res.status(400).json(PIN_INCORRECT);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Cancel (kiosk middleware) ────────────────────────────────────────────────

export const cancel = async (req: Request, res: Response): Promise<void> => {
  try {
    const kiosk = req.kiosk;
    if (!kiosk) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    const { sessionId } = req.body as { sessionId: string };

    const session = await prisma.verificationSession.findUnique({
      where: { sessionIdHash: hashSessionHandle(sessionId) },
    });

    if (!session || session.kioskId !== kiosk.kioskId) {
      res.status(404).json(SESSION_UNKNOWN);
      return;
    }

    // Idempotent-ish: only a candidate session (QR_ACCEPTED / PIN_PENDING)
    // moves to EXPIRED. VERIFIED, CONSUMED, LOCKED and EXPIRED are already
    // decided states — cancelling one answers success and changes nothing,
    // because a cancel is not a permission to rewrite history (§4.2).
    if (
      session.state === "QR_ACCEPTED" ||
      session.state === "PIN_PENDING"
    ) {
      await prisma.verificationSession.update({
        where: { id: session.id },
        data: { state: "EXPIRED" },
      });
    }

    auditLog.verifyCancelled(session.id, session.employeeId, session.kioskId);

    res.status(200).json({ success: true, message: "Verification session cancelled" });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default { identify, verifyPin, cancel };
