import prisma from "../config/prismaClient.js";
import { Request, Response } from "express";
import { evaluateClockInStatus, evaluateClockOutStatus, type AttendanceStatus } from "../utils/statusEngine.js";
import { auditLog, logError } from "../utils/logger.js";
import { writeAudit } from "../utils/auditWriter.js";
import { assessLocation, LocationAssessment } from "../utils/location.js";
import {
  hashSessionHandle,
  resolveKioskSite,
  SESSION_EXPIRED,
  SESSION_LOCKED,
  SESSION_UNKNOWN,
  SESSION_USED,
} from "./kioskVerifyController.js";

// ── Ensure user is authenticated ──────────────────────────────────────────────
const getUserId = (req: Request): string | null => {
  if (!req.user) return null;
  return req.user.userId;
};

// ── Kiosk-scoped punch (API contracts §8) ────────────────────────────────────
/**
 * Clock-in and clock-out moved from a user session to a kiosk device token
 * (contracts §12: PRD §7 — a staff web session no longer reaches these; the
 * kiosk token replaces the user session as the punch credential). A punch
 * needs a single-use `VERIFIED` verification session and one transaction that
 * consumes the session, writes the attendance row, the attempt row, and
 * answers audited (lifecycle §3.1, §3.3).
 *
 * The action is never taken from the client: each endpoint recomputes the
 * employee's open/closed state at punch time and refuses when the state does
 * not match the requested direction (lifecycle §0's provisional rule — the
 * state can change in the two minutes between identify and punch, §9).
 */

/**
 * A refusal that happens after validation work, thrown to abandon the punch
 * transaction cleanly (nothing is half-written) and answer the client with a
 * plain message and status. Used for the session/row race cases the guard
 * clauses cannot answer before the transaction has begun.
 */
class PunchConflictError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Shift resolution: dated history first — the assignment effective at the
 * punch instant (lifecycle §3.1 step 3), latest effectiveFrom wins — and the
 * user record's `shiftId` pointer as the fallback when no assignment rows
 * exist (legacy data migrates before ShiftAssignment existed). No shift at
 * all is not an error: the punch records with a null shift and the status
 * engine classifies it OPEN_SESSION (lifecycle §9).
 */
const resolveEffectiveShift = async (
  employeeId: string,
  legacyShiftId: string | null,
  businessId: string,
  now: Date
): Promise<{ id: string; name: string; startMinute: number; endMinute: number; crossesMidnight: boolean } | null> => {
  const assignment = await prisma.shiftAssignment.findFirst({
    where: {
      userId: employeeId,
      businessId,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
    take: 1,
    select: {
      shift: {
        select: {
          id: true,
          name: true,
          startMinute: true,
          endMinute: true,
          crossesMidnight: true,
        },
      },
    },
  });

  if (assignment) return assignment.shift;

  if (legacyShiftId) {
    // The pointer is only a compatibility source for employees who have never
    // had an assignment; a gap after deactivation must stay unscheduled.
    const existingAssignment = await prisma.shiftAssignment.findFirst({
      where: { userId: employeeId, businessId },
      select: { id: true },
    });
    if (existingAssignment) return null;
    // A stale pointer could name another business's shift, so the lookup
    // stays business-scoped; a miss simply falls through to null.
    const legacyShift = await prisma.shift.findFirst({
      where: { id: legacyShiftId, businessId },
      select: {
        id: true,
        name: true,
        startMinute: true,
        endMinute: true,
        crossesMidnight: true,
      },
    });
    if (legacyShift) return legacyShift;
  }

  return null;
};

/**
 * Policy resolution, the same shape clockIn used before the rework: a
 * policy bound to the employee's shift first (night shifts carry their own
 * grace windows), then the business default, then null — the live version at
 * the punch instant, because a past version does not classify a punch today.
 */
const resolveEffectivePolicy = async (
  businessId: string,
  shiftId: string | null,
  now: Date
) => {
  const versionSelect = {
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { versionNumber: "desc" as const },
    take: 1,
  };

  if (shiftId) {
    const shiftPolicy = await prisma.workplacePolicy.findFirst({
      where: { businessId, shiftId },
      include: { versions: versionSelect },
    });
    if (shiftPolicy?.versions[0]) return shiftPolicy.versions[0];
  }

  const defaultPolicy = await prisma.workplacePolicy.findFirst({
    where: { businessId, isDefault: true },
    include: { versions: versionSelect },
  });
  return defaultPolicy?.versions[0] ?? null;
};

/**
 * The employee behind the session. The punch NEVER resolves the employee from
 * a caller claim — the kiosk token proves the device, the session proves the
 * employee (contracts §8 preamble). Deactivation between identify and punch
 * refuses the punch but keeps history (lifecycle §9).
 */
const punchEmployeeFromSession = async (session: { employeeId: string }, businessId: string) => {
  const employee = await prisma.user.findUnique({
    where: { id: session.employeeId },
    select: {
      id: true,
      businessId: true,
      isActive: true,
      shiftId: true,
    },
  });
  if (!employee || employee.businessId !== businessId || !employee.isActive) return null;
  return employee;
};

/**
 * The location assessment the attempt will record (kiosk §6.1): the kiosk's
 * paired site is loaded and `assessLocation` runs request-side data through
 * it. A punch without a paired site, with a stale capture, or outside the
 * fence is still recorded — OUTSIDE and UNKNOWN flag the attempt for review,
 * they never block it (§6.1, contracts §8 "attendance.location_flagged").
 */
const punchLocationFor = async (req: Request, body: {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  capturedAt?: string;
}) => {
  const receivedAt = new Date();
  const { siteId, site } = await resolveKioskSite(req.kiosk!.kioskId);
  const location = assessLocation(site, {
    latitude: body.latitude,
    longitude: body.longitude,
    accuracyMeters: body.accuracyMeters,
    capturedAt: body.capturedAt,
  });
  return {
    receivedAt,
    siteId,
    location,
    // capturedAt falls back to server receipt when the body omitted it —
    // the attempt column records when the position was taken, recorded or
    // received (kiosk §6.1 table).
    capturedAt: body.capturedAt !== undefined ? new Date(body.capturedAt) : receivedAt,
  };
};

/**
 * The attempt row fields shared by both punch directions. `siteId` rides here
 * rather than on the attendance row: the schema puts the site on
 * `AttendanceAttempt`, and the attendance row's kiosk column is
 * `createdByKioskId` — there is no siteId column on `attendances` (no column
 * is invented for it).
 */
const punchAttemptBase = (
  businessId: string,
  kioskId: string,
  employeeId: string,
  verificationSessionId: string,
  siteId: string | null,
  location: LocationAssessment,
  position: { latitude?: number; longitude?: number; accuracyMeters?: number },
  capturedAt: Date,
  receivedAt: Date,
  req: Request
) => ({
  businessId,
  kioskId,
  employeeId,
  verificationSessionId,
  siteId,
  latitude: position.latitude ?? null,
  longitude: position.longitude ?? null,
  accuracyMeters: position.accuracyMeters ?? null,
  distanceMeters: location.distanceMeters,
  locationResult: location.result,
  capturedAt,
  receivedAt,
  ip: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});

/** A rejection the guard clauses answer before any write (evidence row only). */
const rejectAttempt = async (
  businessId: string,
  kioskId: string,
  employeeId: string,
  verificationSessionId: string,
  siteId: string | null,
  location: LocationAssessment,
  position: { latitude?: number; longitude?: number; accuracyMeters?: number },
  capturedAt: Date,
  receivedAt: Date,
  req: Request,
  reason: string
) => {
  await prisma.attendanceAttempt.create({
    data: {
      ...punchAttemptBase(
        businessId,
        kioskId,
        employeeId,
        verificationSessionId,
        siteId,
        location,
        position,
        capturedAt,
        receivedAt,
        req
      ),
      step: "PUNCH",
      outcome: "REJECTED" as const,
      reason,
    },
  });
};

/**
 * Everything both punches share before the transaction: the kiosk claim, the
 * session resolution (IDENTICAL to verifyPin — same hash, same binding, same
 * refusal bodies), the state tests, and the employee behind the session.
 * Returns null ONLY when a response has already been sent.
 */
const resolvePunchContext = async (
  req: Request,
  res: Response
): Promise<{
  kiosk: NonNullable<Request["kiosk"]>;
  body: { latitude?: number; longitude?: number; accuracyMeters?: number; capturedAt?: string };
  session: { id: string; employeeId: string };
  employee: { id: string; businessId: string; isActive: boolean; shiftId: string | null };
  businessId: string;
  now: Date;
  locationCtx: Awaited<ReturnType<typeof punchLocationFor>>;
} | null> => {
  const kiosk = req.kiosk;
  if (!kiosk) {
    res.status(401).json({ success: false, message: "Invalid token" });
    return null;
  }

  const body = (req.body ?? {}) as {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    capturedAt?: string;
  };

  // Same handle handling as verifyPin: the client sends the opaque handle,
  // the server hashes it and reads the row by hash. Unknown and cross-kiosk
  // share one 404 so a stolen handle cannot be probed (kiosk §4.3).
  const session = await prisma.verificationSession.findUnique({
    where: { sessionIdHash: hashSessionHandle((req.body?.verificationSessionId as string) ?? "") },
  });

  if (!session || session.kioskId !== kiosk.kioskId) {
    res.status(404).json(SESSION_UNKNOWN);
    return null;
  }

  // Single-use (lifecycle §3.2): already consumed answers the plain 409 the
  // verifyPin path uses for a used session.
  if (session.state === "CONSUMED") {
    res.status(409).json(SESSION_USED);
    return null;
  }

  if (session.state === "LOCKED") {
    res.status(429).json(SESSION_LOCKED);
    return null;
  }

  // A session that is not VERIFIED (never verified, or expired) cannot
  // authorize a punch; both answer the same "start again" body the kiosk
  // spec's table gives expired sessions (§10).
  if (
    session.state !== "VERIFIED" ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    res.status(400).json(SESSION_EXPIRED);
    return null;
  }

  const employee = await punchEmployeeFromSession(session, kiosk.businessId);
  if (!employee) {
    res.status(404).json(SESSION_UNKNOWN);
    return null;
  }

  const locationCtx = await punchLocationFor(req, body);

  return {
    kiosk,
    body,
    session: { id: session.id, employeeId: session.employeeId },
    employee,
    businessId: kiosk.businessId,
    now: new Date(),
    locationCtx,
  };
};

/**
 * The recomputed permitted action (lifecycle §2): nothing is taken from what
 * identify displayed — the OPEN/CLOSED state is read from `attendances` NOW.
 * A direction that does not fit the state is refused, its attempt row records
 * the refusal as evidence (§9, "clock-out after auto close"), and `refused`
 * lets the handler bail before any write. The open row itself comes back for
 * the clock-out that will close it.
 */
const recomputeAndEnforceAction = async (
  action: "CLOCK_IN" | "CLOCK_OUT",
  employeeId: string,
  businessId: string,
  kioskId: string,
  verificationSessionId: string,
  locationCtx: Awaited<ReturnType<typeof punchLocationFor>>,
  body: { latitude?: number; longitude?: number; accuracyMeters?: number },
  req: Request,
  res: Response
): Promise<{
  refused: boolean;
  openAttendance: { id: string; clockIn: Date; status: AttendanceStatus } | null;
}> => {
  const openAttendance = await prisma.attendance.findFirst({
    where: { userId: employeeId, businessId, sessionStatus: "OPEN" },
    select: { id: true, clockIn: true, status: true },
  });

  if (action === "CLOCK_IN" && openAttendance) {
    await rejectAttempt(
      businessId,
      kioskId,
      employeeId,
      verificationSessionId,
      locationCtx.siteId,
      locationCtx.location,
      body,
      locationCtx.capturedAt,
      locationCtx.receivedAt,
      req,
      "open_session_exists"
    );
    res.status(409).json({
      success: false,
      // The same plain message the legacy punch answered on this condition —
      // it names the fix, not the database (contracts §8 error catalog).
      message: "You already have an active session open. Clock out first",
    });
    return { refused: true, openAttendance };
  }

  if (action === "CLOCK_OUT" && !openAttendance) {
    await rejectAttempt(
      businessId,
      kioskId,
      employeeId,
      verificationSessionId,
      locationCtx.siteId,
      locationCtx.location,
      body,
      locationCtx.capturedAt,
      locationCtx.receivedAt,
      req,
      "no_open_session"
    );
    res.status(400).json({
      success: false,
      message: "You need to have an active session open first",
    });
    return { refused: true, openAttendance: null };
  }

  return { refused: false, openAttendance };
};

// ── Clock In (kiosk token + VERIFIED session) ─────────────────────────────────
export const clockIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePunchContext(req, res);
    if (!ctx) return;

    // The server-derived action check: the session's identify-time suggestion
    // is never trusted; the open-session state recompute NOW decides (lifecycle §2).
    const action = await recomputeAndEnforceAction(
      "CLOCK_IN",
      ctx.employee.id,
      ctx.businessId,
      ctx.kiosk.kioskId,
      ctx.session.id,
      ctx.locationCtx,
      ctx.body,
      req,
      res
    );
    if (!ctx || action.refused) return;

    const clockInTime = ctx.now;
    // One timestamp drives the whole classification: the punch, the slot
    // date, and the policy's live-version check read the same instant.
    const today = new Date(
      Date.UTC(
        clockInTime.getUTCFullYear(),
        clockInTime.getUTCMonth(),
        clockInTime.getUTCDate()
      )
    );

    // Shift (dated history, legacy pointer fallback) and policy (shift-scoped
    // live version, then business default) resolved AT the punch instant.
    const shift = await resolveEffectiveShift(
      ctx.employee.id,
      ctx.employee.shiftId,
      ctx.businessId,
      clockInTime
    );

    const [policy, business] = await Promise.all([
      // resolveEffectivePolicy already tries the shift-scoped policy first
      // and falls back to the business default inside itself.
      resolveEffectivePolicy(ctx.businessId, shift?.id ?? null, clockInTime),
      prisma.business.findUnique({
        where: { id: ctx.businessId },
        select: { timezone: true },
      }),
    ]);

    const status = evaluateClockInStatus(
      clockInTime,
      shift,
      policy
        ? {
            graceEarlyMinutes: policy.graceEarlyMinutes,
            graceLateMinutes: policy.graceLateMinutes,
          }
        : null
    );

    // FOR the classification used — kept inline in the create spread below
    // so a policy-less punch simply omits the JSON column instead of writing
    // a JSON null over it.

    // OUTSIDE / UNKNOWN raise the review flag on the row; the punch itself
    // lands either way (kiosk §6.1 "flag, never block").
    const locationFlagged = ctx.locationCtx.location.result !== "INSIDE";

    const record = await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: {
          businessId: ctx.businessId,
          userId: ctx.employee.id,
          date: today,
          clockIn: clockInTime,
          sessionStatus: "OPEN" as const,
          status,
          // Location metadata columns kept filled; the verdict lives on the
          // attempt — the row just mirrors the coordinates for the old reads.
          checkInIp: req.ip ?? null,
          checkInLat: ctx.body.latitude ?? null,
          checkInLng: ctx.body.longitude ?? null,
          // Kiosk source reference (the schema's one kiosk column).
          createdByKioskId: ctx.kiosk.kioskId,
          // Single-use guarantee: a session may create exactly one punch
          // (unique column; the per-user partial index covers the rest, §3.2).
          sourceVerificationSessionId: ctx.session.id,
          // Snapshots (PRD §12): shift, timezone, grace and the policy JSON,
          // frozen at the punch instant.
          shiftId: shift?.id ?? null,
          shiftNameSnapshot: shift?.name ?? null,
          shiftStartMinuteSnapshot: shift?.startMinute ?? null,
          shiftEndMinuteSnapshot: shift?.endMinute ?? null,
          shiftCrossesMidnightSnapshot: shift?.crossesMidnight ?? null,
          // The business's timezone, snapshotted for the O15 follow-up. The
          // status engine still reads UTC (Phase 0 basis) — wiring this
          // snapshot into the engine is the deferred business-timezone work.
          timezoneSnapshot: business?.timezone ?? "UTC",
          graceEarlyMinutesSnapshot: policy?.graceEarlyMinutes ?? null,
          graceLateMinutesSnapshot: policy?.graceLateMinutes ?? null,
          policyVersionId: policy?.id ?? null,
          // The JSON copy of what the classification used, so later edits
          // cannot rewrite the punch's grading basis (PRD §9, §12). Only a
          // resolved policy writes the column — a no-policy punch omits it
          // rather than inventing a null snapshot of "nothing".
          ...(policy
            ? {
                policySnapshot: {
                  versionNumber: policy.versionNumber,
                  effectiveFrom: policy.effectiveFrom,
                  graceEarlyMinutes: policy.graceEarlyMinutes,
                  graceLateMinutes: policy.graceLateMinutes,
                  autoClockOutEnabled: policy.autoClockOutEnabled,
                  autoClockOutBufferMinutes: policy.autoClockOutBufferMinutes,
                  autoClockOutMaxOpenMinutes: policy.autoClockOutMaxOpenMinutes,
                  correctionWindowDays: policy.correctionWindowDays,
                  geoFenceRadiusMeters: policy.geoFenceRadiusMeters,
                  locationAccuracyThresholdMeters: policy.locationAccuracyThresholdMeters,
                  gpsFreshnessSeconds: policy.gpsFreshnessSeconds,
                },
              }
            : {}),
          // A flagged assessment rides the row too, so HR's exception list can
          // reach it without joining the attempt; the attempt still carries
          // the full assessment per kiosk §6.1.
          requiresReviewReason: locationFlagged
            ? `location ${ctx.locationCtx.location.result.toLowerCase()}: ${ctx.locationCtx.location.reason}`
            : null,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true },
          },
        },
      });

      // Consume the session with a version-guard on `consumedAt: null` so a
      // second request holding the same session loses this update cleanly
      // and answers the same 409 — the loser aborts the whole transaction
      // and the attendance row it just wrote rolls back with it (§3.2).
      const consumed = await tx.verificationSession.updateMany({
        where: { id: ctx.session.id, consumedAt: null },
        data: { state: "CONSUMED" as const, consumedAt: clockInTime },
      });
      if (consumed.count === 0) {
        throw new PunchConflictError(409, "Verification session was already used");
      }

      // Attempt row (kiosk §6.1): every punch step writes one; this is the
      // SUCCESS row for the completed punch.
      await tx.attendanceAttempt.create({
        data: {
          ...punchAttemptBase(
            ctx.businessId,
            ctx.kiosk.kioskId,
            ctx.employee.id,
            ctx.session.id,
            ctx.locationCtx.siteId,
            ctx.locationCtx.location,
            ctx.body,
            ctx.locationCtx.capturedAt,
            ctx.locationCtx.receivedAt,
            req
          ),
          action: "CLOCK_IN" as const,
          step: "PUNCH",
          outcome: "SUCCESS" as const,
          reason: "clock_in_recorded",
        },
      });

      // Durable audit trail (§11): one row for the punch, plus a flagged
      // second row when the fence assessment was not INSIDE.
      await writeAudit({
        businessId: ctx.businessId,
        action: "attendance.recorded",
        entityType: "attendance",
        entityId: attendance.id,
        kioskId: ctx.kiosk.kioskId,
      }, tx);
      if (locationFlagged) {
        await writeAudit({
          businessId: ctx.businessId,
          action: "attendance.location_flagged",
          entityType: "attendance",
          entityId: attendance.id,
          kioskId: ctx.kiosk.kioskId,
          reason: `location ${ctx.locationCtx.location.result.toLowerCase()}: ${ctx.locationCtx.location.reason}`,
        }, tx);
      }

      return attendance;
    });

    auditLog.attendanceRecorded(
      ctx.kiosk.kioskId,
      ctx.employee.id,
      ctx.businessId,
      "CLOCK_IN",
      record.id,
      ctx.locationCtx.location.result
    );

    res.status(201).json({
      success: true,
      message: "Clock in successful",
      data: record,
    });
  } catch (error) {
    if (error instanceof PunchConflictError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        // The two punch uniqueness guarantees (lifecycle §3.2): one open
        // session per employee, one punch per verification session. The
        // loser of the race answers the same 409 either way.
        res.status(409).json({
          success: false,
          message: "You already have an active session open. Clock out first",
        });
        return;
      }
      logError(error, { route: "clock-in" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Clock Out (kiosk token + VERIFIED session) ────────────────────────────────
export const clockOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePunchContext(req, res);
    if (!ctx) return;

    const action = await recomputeAndEnforceAction(
      "CLOCK_OUT",
      ctx.employee.id,
      ctx.businessId,
      ctx.kiosk.kioskId,
      ctx.session.id,
      ctx.locationCtx,
      ctx.body,
      req,
      res
    );
    if (!ctx || action.refused) return;
    // The refusal is impossible to reach for a valid CLOCK_OUT (the guard
    // above sent the response already), so the open row is the one to close.
    const openAttendance = action.openAttendance!;

    const clockOutTime = ctx.now;

    // Same shift resolution the clock-in does: the classification of the
    // close-out is engine-based, so CLOCK_OUT_MISSING for a session left
    // open past shift end stays reachable (Phase 0 wiring).
    const shift = await resolveEffectiveShift(
      ctx.employee.id,
      ctx.employee.shiftId,
      ctx.businessId,
      clockOutTime
    );

    const status = evaluateClockOutStatus(clockOutTime, openAttendance.status, shift);

    // Same flag rule the clock-in uses: a punch outside the fence, or one the
    // fence could not assess, never blocks the close-out — it only flags it
    // for review (kiosk §6.1).
    const locationFlagged =
      ctx.locationCtx.location.result === "OUTSIDE" ||
      ctx.locationCtx.location.result === "UNKNOWN";

    // The same arithmetic the legacy code used, recomputed from the stored
    // clock-in (lifecycle §3.3 step 3).
    const hoursWorked =
      (clockOutTime.getTime() - openAttendance.clockIn.getTime()) / (1000 * 60 * 60);

    await prisma.$transaction(async (tx) => {
      // Guard on sessionStatus: the row must still be OPEN when this
      // transaction runs. A racing verified clock-out already closed it —
      // that loser answers the same "no open session" message and changes
      // nothing (§3.4).
      const closed = await tx.attendance.updateMany({
        where: { id: openAttendance.id, sessionStatus: "OPEN" },
        data: {
          clockOut: clockOutTime,
          sessionStatus: "CLOSED" as const,
          // The verified-punch closure reason (lifecycle §3.3 step 3; the enum
          // keeps auto and verified closures apart, PRD §13).
          closureReason: "VERIFIED_CLOCK_OUT" as const,
          status,
          hoursWorked,
        },
      });
      if (closed.count === 0) {
        throw new PunchConflictError(
          400,
          "You need to have an active session open first"
        );
      }

      // Consume the session only after the attendance row accepted the
      // close-out, so a losing race never burns a session on a refusal.
      const consumed = await tx.verificationSession.updateMany({
        where: { id: ctx.session.id, consumedAt: null },
        data: { state: "CONSUMED" as const, consumedAt: clockOutTime },
      });
      if (consumed.count === 0) {
        throw new PunchConflictError(409, "Verification session was already used");
      }

      await tx.attendanceAttempt.create({
        data: {
          ...punchAttemptBase(
            ctx.businessId,
            ctx.kiosk.kioskId,
            ctx.employee.id,
            ctx.session.id,
            ctx.locationCtx.siteId,
            ctx.locationCtx.location,
            ctx.body,
            ctx.locationCtx.capturedAt,
            ctx.locationCtx.receivedAt,
            req
          ),
          action: "CLOCK_OUT" as const,
          step: "PUNCH",
          outcome: "SUCCESS" as const,
          reason: "clock_out_recorded",
        },
      });

      // Durable audit trail (§11): one row for the punch (the attendance row
      // already existed — this row attaches the close-out to it), plus a
      // flagged second row when the fence assessment was not INSIDE.
      await writeAudit({
        businessId: ctx.businessId,
        action: "attendance.recorded",
        entityType: "attendance",
        entityId: openAttendance.id,
        kioskId: ctx.kiosk.kioskId,
      }, tx);
      if (locationFlagged) {
        await writeAudit({
          businessId: ctx.businessId,
          action: "attendance.location_flagged",
          entityType: "attendance",
          entityId: openAttendance.id,
          kioskId: ctx.kiosk.kioskId,
          reason: `location ${ctx.locationCtx.location.result.toLowerCase()}: ${ctx.locationCtx.location.reason}`,
        }, tx);
      }
    });

    const updatedRecord = await prisma.attendance.findUnique({
      where: { id: openAttendance.id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });

    auditLog.attendanceRecorded(
      ctx.kiosk.kioskId,
      ctx.employee.id,
      ctx.businessId,
      "CLOCK_OUT",
      openAttendance.id,
      ctx.locationCtx.location.result
    );

    res.status(200).json({
      success: true,
      message: "Clock out successful",
      data: updatedRecord,
    });
  } catch (error) {
    if (error instanceof PunchConflictError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        // The attendance close-out carries no new uniqueness of its own; a
        // P2002 here still means a same-instant duplicate won the race, so
        // the plain 409 speaks for it too.
        res.status(409).json({
          success: false,
          message: "This punch was already recorded",
        });
        return;
      }
      logError(error, { route: "clock-out" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── My Attendance (for staff) ─────────────────────────────────────────────────
export const getMyAttendance = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { startDate, endDate, status, sessionStatus, search } = req.query;
    const page = parseInt((req.query.page as string) || "1") || 1;
    const limit = parseInt((req.query.limit as string) || "50") || 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    // SEC-19: the staff screen has always offered these filters; the query
    // schema used to strip them silently, so the list never changed. They are
    // scalar columns on the caller's own rows, so no extra tenant surface.
    if (status) where.status = status;
    if (sessionStatus) where.sessionStatus = sessionStatus;
    if (search) {
      where.OR = [
        { remarks: { contains: search as string, mode: "insensitive" } },
        { requiresReviewReason: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (startDate && endDate) {
      where.clockIn = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    } else if (startDate) {
      where.clockIn = { gte: new Date(startDate as string) };
    } else if (endDate) {
      where.clockIn = { lte: new Date(endDate as string) };
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where: where as any,
        orderBy: { clockIn: "desc" },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      count: records.length,
      total,
      page,
      data: records,
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

// ── All Attendance (for HR / superadmin) ──────────────────────────────────────
export const getAllAttendance = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, userId, department, sessionStatus, status } = req.query;
    const page = parseInt((req.query.page as string) || "1") || 1;
    const limit = parseInt((req.query.limit as string) || "50") || 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (startDate && endDate) {
      where.clockIn = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    } else if (startDate) {
      where.clockIn = { gte: new Date(startDate as string) };
    } else if (endDate) {
      where.clockIn = { lte: new Date(endDate as string) };
    }

    if (userId) where.userId = userId;
    if (sessionStatus) where.sessionStatus = sessionStatus;
    if (status) where.status = status;

    if (department) {
      where.user = { department } as any;
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where: where as any,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              department: true,
              role: true,
            },
          },
        },
        orderBy: { clockIn: "desc" },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      count: records.length,
      total,
      page,
      data: records,
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

// ── Dismiss auto-clockout alert ───────────────────────────────────────────────
export const dismissAlert = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const record = await prisma.attendance.findFirst({
      where: { id, userId },
    });

    if (!record) {
      res.status(404).json({ success: false, message: "Record not found" });
      return;
    }

    // Mark the alert as dismissed by updating the record
    // Using remarks field to track dismissal
    await prisma.attendance.update({
      where: { id },
      data: {
        remarks: record.remarks
          ? `${record.remarks} | alert_dismissed:${new Date().toISOString()}`
          : `alert_dismissed:${new Date().toISOString()}`,
      },
    });

    res.status(200).json({ success: true, message: "Alert dismissed" });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};
