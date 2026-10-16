import prisma from "../config/prismaClient.js";
import { Request, Response } from "express";
import { callerBusinessId } from "../utils/tenant.js";
import { auditLog, logError } from "../utils/logger.js";

/**
 * Correction submission (API contracts §8, O17): an employee may correct
 * their own attendance record inside the active policy's window, with a
 * reason. Submission only — the decision endpoint
 * (`PATCH /api/hr/corrections/:id/decision` with the backstop rules) is out
 * of M5 scope (plan Phase 4.3 notes it lands with the M6/HR area).
 */

/**
 * The review tier (contracts §8: `201 { data: { id, status: SUBMITTED, reviewTier } }`).
 *
 * Per `M1-API-CONTRACTS.md` §4, note under the HR table: "reviewTier is set
 * at submission: `SAME_DAY` when the record's date is the current business
 * day, `ESCALATED` when it is older and still inside the seven-day window".
 * That is the real tier rule the lifecycle carries too (O17, confirmed:
 * "HR approves same-day fixes and applies the stricter review beyond same
 * day") — it is decided by the record's DATE versus the current business
 * day, not by when a reviewer approves. The working date basis here is UTC
 * for the same reason the punch path uses it: the status engine reads UTC,
 * and business-local dates are the deferred O15 follow-up.
 */
const reviewTierFor = (attendanceDateUtc: Date, todayUtc: Date): "SAME_DAY" | "ESCALATED" =>
  attendanceDateUtc.getTime() === todayUtc.getTime() ? "SAME_DAY" : "ESCALATED";

export const createCorrection = async (req: Request, res: Response): Promise<void> => {
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

    const { attendanceId, reason, proposedClockIn, proposedClockOut, attemptId } = req.body as {
      attendanceId: string;
      reason: string;
      proposedClockIn?: string;
      proposedClockOut?: string;
      attemptId?: string;
    };

    const now = new Date();
    // Slot date at midnight UTC — the same basis the punch reads its date
    // from (Phase 0 decision; business-local dates are the O15 follow-up).
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    // Tenant AND self scope: the record must exist in the caller's business
    // and belong to the caller (STAFF acts on self; an HR officer submitting
    // on their own record may — but per R7 they are never that record's
    // approver; that gate is enforced at the decision route, not here).
    // Unknown, cross-business and foreign-user records share one 404, so a
    // caller cannot probe for an id in another business.
    const attendance = await prisma.attendance.findFirst({
      where: { id: attendanceId, businessId, userId: caller.userId },
      select: {
        id: true,
        date: true,
        clockIn: true,
        clockOut: true,
        sessionStatus: true,
        status: true,
        closureReason: true,
        hoursWorked: true,
      },
    });

    if (!attendance) {
      res.status(404).json({ success: false, message: "Record not found" });
      return;
    }

    // The correction window (contracts §8: default seven days, O17) comes
    // from the DEFAULT policy's live version. Corrections run on the
    // business-wide window — a shift-scoped override is read at the
    // decision, not at submission, because the employee's shift may have
    // changed since the record was written.
    let windowDays = 7;
    const defaultPolicy = await prisma.workplacePolicy.findFirst({
      where: { businessId, isDefault: true },
      include: {
        versions: {
          where: {
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });
    if (defaultPolicy?.versions[0]) {
      windowDays = defaultPolicy.versions[0].correctionWindowDays;
    }

    // A record whose date is past the window refuses with 409 (contracts §8
    // error cases: "409 when an open correction already exists or the window
    // has passed").
    if (now.getTime() - attendance.date.getTime() > windowDays * 24 * 60 * 60 * 1000) {
      res.status(409).json({
        success: false,
        message: "The correction window for this record has passed. See HR.",
      });
      return;
    }

    // Only one OPEN correction per attendance row (O17, lifecycle §8.2).
    // SUBMITTED is the schema's only open `CorrectionStatus` — APPROVED and
    // REJECTED are decisions, WITHDRAWN is the requester's exit — so the
    // lookup filters on it alone.
    const openCorrection = await prisma.attendanceCorrection.findFirst({
      where: { attendanceId, businessId, status: "SUBMITTED" },
      select: { id: true },
    });
    if (openCorrection) {
      res.status(409).json({
        success: false,
        message: "A correction for this record is already awaiting review",
      });
      return;
    }

    // The attachment (R6-optional) points at a failed punch attempt. The
    // schema's AttendanceCorrection carries no attempt column and M5 makes
    // no schema changes, so a supplied attemptId is referenced in the
    // submission record through its validation only — the persistent link
    // is deferred until the R6 decision adds a home for it.
    void attemptId;

    // The values the correction was written against, captured at submission
    // (lifecycle §8.2): an approval can copy proposals onto the row without
    // ever erasing what the record originally said.
    const originalValues = {
      date: attendance.date,
      clockIn: attendance.clockIn,
      clockOut: attendance.clockOut,
      sessionStatus: attendance.sessionStatus,
      status: attendance.status,
      closureReason: attendance.closureReason,
      hoursWorked: attendance.hoursWorked,
    };

    const reviewTier = reviewTierFor(attendance.date, today);

    const correction = await prisma.$transaction(async (tx) => {
      // status: SUBMITTED is the schema default but is written explicitly,
      // so the contract's `status: SUBMITTED` response statement stays true
      // even if someone later retunes the default.
      return tx.attendanceCorrection.create({
        data: {
          businessId,
          attendanceId,
          requestedById: caller.userId,
          reason,
          proposedClockIn: proposedClockIn ? new Date(proposedClockIn) : null,
          proposedClockOut: proposedClockOut ? new Date(proposedClockOut) : null,
          reviewTier,
          originalValues,
          status: "SUBMITTED" as const,
        },
        select: { id: true, status: true, reviewTier: true },
      });
    });

    auditLog.correctionSubmitted(caller.userId, correction.id, businessId);

    // 201 { data: { id, status, reviewTier } } per contracts §8.
    res.status(201).json({
      success: true,
      message: "Correction submitted",
      data: correction,
    });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "That correction already exists. Refresh and try again.",
        });
        return;
      }
      logError(error, { route: "corrections-create" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default { createCorrection };
