import prisma from "../config/prismaClient.js";
import { Request, Response } from "express";
import { Prisma } from "../generated/prisma/index.js";
import { callerBusinessId } from "../utils/tenant.js";
import { writeAudit } from "../utils/auditWriter.js";
import { auditLog, logError } from "../utils/logger.js";
import { evaluateClockInStatus, type AttendanceStatus } from "../utils/statusEngine.js";
import { hoursBetween } from "../utils/shiftWindow.js";

/**
 * Correction submission (API contracts §8, O17): an employee may correct
 * their own attendance record inside the active policy's window, with a
 * reason. Submission only — the decision endpoint
 * (`PATCH /api/hr/corrections/:id/decision` with the backstop rules) arrived
 * with M7, in this same file: submission and decision read the same shapes,
 * so keeping them apart would only be a second chance for the two copies to
 * drift.
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

    const { attendanceId, reason, proposedClockIn, proposedClockOut } = req.body as {
      attendanceId: string;
      reason: string;
      proposedClockIn?: string;
      proposedClockOut?: string;
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

    // Proposals are text-only per owner ruling R6 (2026-10-17) — no attempt
    // attachments.

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
      const created = await tx.attendanceCorrection.create({
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

      // Lifecycle §8.3 step 3: the submission is the trail's first revision.
      // The decision path below numbers revisions dynamically; a fresh
      // creation is always revision 1, `PROPOSED`, because nothing has been
      // acted on yet — valuesAfter stays unset (NULL), since a proposal
      // changes nothing until a reviewer approves it.
      await tx.attendanceCorrectionRevision.create({
        data: {
          businessId,
          correctionId: created.id,
          revisionNo: 1,
          action: "PROPOSED" as const,
          valuesBefore: originalValues as unknown as Prisma.InputJsonValue,
          actorId: caller.userId,
          // The employee's own words ride the revision's reason verbatim, so
          // the append-only history explains each step in the same column the
          // decision steps use.
          reason,
        },
      });

      // Durable `correction.submitted` row, committed with the correction (the
      // same "audit inside the transaction" rule the decision path follows).
      // The audit trail endpoint (auditController) lists this action among the
      // four correction events it promises to return, so a submission without
      // the row would leave a hole the trail contract already advertises.
      await writeAudit(
        {
          businessId,
          action: "correction.submitted",
          entityType: "correction",
          entityId: created.id,
          userId: caller.userId,
          reason: JSON.stringify({
            attendanceId,
            reason,
            proposedClockIn: proposedClockIn ?? null,
            proposedClockOut: proposedClockOut ?? null,
            reviewTier,
          }),
          // The values the employee raised the correction against, now also in
          // the row's own column; reason above still carries the summary set.
          beforeValues: originalValues as unknown as Prisma.InputJsonValue,
        },
        tx
      );

      return created;
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

// ── M7 — correction reads and decisions (contracts §3 staff lane, §4 HR lane) ─

/** The fields a staff caller sees on their own correction rows. */
const correctionSelfSelect = {
  id: true,
  attendanceId: true,
  reason: true,
  requestedAt: true,
  reviewTier: true,
  proposedClockIn: true,
  proposedClockOut: true,
  status: true,
  decisionNote: true,
  decidedAt: true,
  createdAt: true,
} as const;

/** The fields HR sees on the business-wide list, plus who raised what. */
const correctionBusinessSelect = {
  ...correctionSelfSelect,
  originalValues: true,
  requestedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  attendance: {
    select: {
      id: true,
      date: true,
      // The employee whose record is under correction — normally the same
      // person as the requester (an HR officer can only correct their own
      // row), but the join is the honest answer to "employee names", not a
      // guess that they always match.
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

/** Both list handlers are newest first so the live queue sits on top. */
const correctionsNewestFirst = { requestedAt: "desc" as const };

/**
 * GET /api/staff/corrections — the employee's own correction queue
 * (contracts §3 row 112), `requestedById` AND business both filtered,
 * newest first. `status?` narrows it; `reviewTier` (accepted by the shared
 * query validator) is deliberately unread here — a self lane would only
 * ever return the caller's own rows, all of which answer to the same user.
 */
export const listMyCorrections = async (req: Request, res: Response): Promise<void> => {
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

    // After the validate() middleware the query carries the parser's numbers
    // (page/limit defaulted, status narrowed to the enum) — typed, not parsed.
    const { status: filter, page, limit } = req.query as unknown as {
      status?: "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
      page: number;
      limit: number;
    };
    const skip = (page - 1) * limit;

    const where = {
      businessId,
      requestedById: caller.userId,
      ...(filter ? { status: filter } : {}),
    };

    const [corrections, total] = await Promise.all([
      prisma.attendanceCorrection.findMany({
        where,
        select: correctionSelfSelect,
        orderBy: correctionsNewestFirst,
        skip,
        take: limit,
      }),
      prisma.attendanceCorrection.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: corrections,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "corrections-list-staff" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/**
 * GET /api/staff/corrections/:id — one of the caller's own corrections
 * (contracts §3 row 113). Refusals split the same way the help-request read
 * does:
 *   - unknown id or a row in ANOTHER business → 404, same-generic message
 *     (a caller cannot tell for which id value the database holds a row);
 *   - a row in the caller's own business but raised by someone else → 403
 *     (a colleague's correction exists inside the tenant; only viewing it
 *     is forbidden).
 */
export const getMyCorrection = async (req: Request, res: Response): Promise<void> => {
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

    const { id } = req.params as { id: string };

    const row = await prisma.attendanceCorrection.findUnique({ where: { id } });

    if (!row || row.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Correction not found" });
      return;
    }

    if (row.requestedById !== caller.userId) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    res.status(200).json({ success: true, data: row });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "corrections-get-staff" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/**
 * GET /api/hr/corrections — the whole business queue (contracts §4: SELECT
 * WHERE business_id), newest first, with the requester's name and the
 * employee the corrected record belongs to, so HR can act on it. Role
 * gating lives on the route.
 */
export const listBusinessCorrections = async (req: Request, res: Response): Promise<void> => {
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

    // Same post-validate read as the staff list above, plus the tier filter.
    const { status: filter, reviewTier, page, limit } = req.query as unknown as {
      status?: "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
      reviewTier?: "SAME_DAY" | "ESCALATED";
      page: number;
      limit: number;
    };
    const skip = (page - 1) * limit;

    const where = {
      businessId,
      ...(filter ? { status: filter } : {}),
      ...(reviewTier ? { reviewTier } : {}),
    };

    const [corrections, total] = await Promise.all([
      prisma.attendanceCorrection.findMany({
        where,
        select: correctionBusinessSelect,
        orderBy: correctionsNewestFirst,
        skip,
        take: limit,
      }),
      prisma.attendanceCorrection.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: corrections,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "corrections-list-hr" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/** Direct detail uses the reviewer queue's tenant scope and stored evidence. */
export const getBusinessCorrection = async (req: Request, res: Response): Promise<void> => {
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
    const { id } = req.params as { id: string };
    const correction = await prisma.attendanceCorrection.findFirst({
      where: { id, businessId },
      select: { ...correctionBusinessSelect, approvedValues: true },
    });
    if (!correction) {
      res.status(404).json({ success: false, message: "Correction not found" });
      return;
    }
    res.status(200).json({ success: true, data: correction });
  } catch (error) {
    if (error instanceof Error) logError(error, { route: "corrections-detail-hr" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * A Prisma `Json` column round-trips a `Date` as an ISO string, so every
 * time comparison pulls each side to a millisecond count first.
 */
const instantOf = (value: unknown): number | null => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  return null;
};

/**
 * The approval reality recheck (lifecycle §8.3: the approval may only move
 * the row forward from the values the correction was raised against). Every
 * recorded field is compared only when the submission's JSON copy actually
 * carries it — a field the submission never recorded cannot "change", so
 * ignoring it keeps the check honest instead of inventing a mismatch.
 */
const rowStillMatchesOriginal = (
  row: {
    clockIn: Date | null;
    clockOut: Date | null;
    sessionStatus: string;
    status: string;
    closureReason: string | null;
    hoursWorked: number;
  },
  original: Record<string, unknown>
): boolean => {
  const originalIn = instantOf(original.clockIn);
  if (originalIn !== null) {
    if (!row.clockIn || row.clockIn.getTime() !== originalIn) return false;
  } else if (original.clockIn === null && row.clockIn !== null) {
    return false;
  }

  const originalOut = original.clockOut === null ? null : instantOf(original.clockOut);
  const rowOut = row.clockOut ? row.clockOut.getTime() : null;
  if (original.clockOut !== undefined && originalOut !== rowOut) return false;

  if (typeof original.sessionStatus === "string" && original.sessionStatus !== row.sessionStatus) {
    return false;
  }
  if (typeof original.status === "string" && original.status !== row.status) {
    return false;
  }
  if (original.closureReason !== undefined) {
    const originalReason = typeof original.closureReason === "string" ? original.closureReason : null;
    if ((row.closureReason ?? null) !== originalReason) return false;
  }
  if (typeof original.hoursWorked === "number" && Math.abs(original.hoursWorked - row.hoursWorked) > 1e-6) {
    return false;
  }
  return true;
};

type Backstop = { condition: string; reason: string };
class CorrectionDecisionLost extends Error {}

type DecisionResult =
  | { kind: "NOT_FOUND" }
  | { kind: "ALREADY_CLOSED"; message: string }
  | { kind: "FORBIDDEN"; message: string }
  | { kind: "RECORD_CHANGED" }
  | {
      kind: "DECIDED";
      correction: {
        id: string;
        attendanceId: string;
        status: string;
        reviewTier: string;
        decidedAt: Date | null;
        decisionNote: string | null;
        reviewedById: string | null;
        approvedValues: unknown;
      };
      attendance: Record<string, unknown>;
      escalation: { type: "SECOND_HR"; condition: null } | { type: "SUPERADMIN_BACKSTOP"; condition: string } | null;
    };

/**
 * PATCH /api/hr/corrections/:id/decision (contracts §4, lifecycle §8.3).
 *
 * The 403 matrix — the reviewer's map of who may decide what (O17 + O21 + R7,
 * and contracts §4: "no self-approval … a second HR user (never the
 * requester); ESCALATED only by the SUPERADMIN backstop or a second HR user"):
 *
 * | Caller role | Tier      | Caller is requester? | Backstop fields sent?        | Outcome                          |
 * |-------------|-----------|----------------------|------------------------------|----------------------------------|
 * | any         | any       | yes                  | —                            | 403 (no self-approval, absolute) |
 * | HR          | SAME_DAY  | no                   | —                            | decide                           |
 * | SUPERADMIN  | SAME_DAY  | no                   | —                            | decide                           |
 * | HR          | ESCALATED | no                   | no                           | decide, as a second HR user when another active HR exists |
 * | HR (sole)   | ESCALATED | no                   | no                           | 403 (no second pair of HR hands) |
 * | HR          | ESCALATED | no                   | yes                          | 403 (the backstop is SUPERADMIN-only) |
 * | SUPERADMIN  | ESCALATED | no                   | condition + non-empty reason | decide, as the documented backstop |
 * | SUPERADMIN  | ESCALATED | no                   | missing / half-sent          | 403 (backstop not eligible)      |
 */
export const decideCorrection = async (req: Request, res: Response): Promise<void> => {
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

    const { id } = req.params as { id: string };
    // The zod validator narrowed the enum values and the 500-char caps; what
    // it cannot see — whether the backstop fields are REQUIRED — is the
    // caller's role and the correction's tier, so the presence rules are
    // re-checked here (contracts §4: "backstopReason (non-empty, ≤500)").
    const { decision, note, backstopCondition, backstopReason } = req.body as {
      decision: "APPROVED" | "REJECTED";
      note?: string;
      backstopCondition?: "UNCLAIMED_24H" | "CONFLICT_OF_INTEREST" | "EXPLICIT_HANDOFF";
      backstopReason?: string;
    };

    // A half-sent backstop is not a backstop. Either both fields arrive and
    // the reason carries words, or none of the fields count at all.
    const backstopFieldsSent = backstopCondition !== undefined || backstopReason !== undefined;
    const backstopRequested =
      backstopFieldsSent &&
      backstopCondition !== undefined &&
      backstopReason !== undefined &&
      backstopReason.trim().length > 0;

    // One transaction loads the correction AND its attendance row scoped to
    // the reviewer's business (lifecycle §8.3 step 1), runs every gate, and
    // writes the decision, the applied change, the revision and the audit
    // rows together — an approval that committed without its audit row is
    // exactly the failure the append-only trail exists to prevent.
    const result: DecisionResult = await prisma.$transaction(async (tx) => {
      const correction = await tx.attendanceCorrection.findFirst({
        where: { id, businessId },
      });

      if (!correction) {
        return { kind: "NOT_FOUND" as const };
      }

      // The state machine (§8.1): a decided or withdrawn correction has no
      // path back into SUBMITTED, so a second decision is a 409, not an
      // update.
      if (correction.status !== "SUBMITTED") {
        return {
          kind: "ALREADY_CLOSED" as const,
          message:
            correction.status === "WITHDRAWN"
              ? "This correction was withdrawn by its requester"
              : "This correction has already been decided",
        };
      }

      // No self-approval (O17, R7): the requester never decides their own
      // correction — any role, SUPERADMIN included, with no backstop escape.
      if (correction.requestedById === caller.userId) {
        return {
          kind: "FORBIDDEN" as const,
          message: "You cannot approve your own correction",
        };
      }

      let backstop: Backstop | null = null;

      if (backstopRequested) {
        // The backstop conditions are O21's SUPERADMIN escape hatch; an HR
        // reviewer who sent them is "backstop not eligible" (contracts §4
        // error column), because their lane is the second-HR-reviewer lane.
        if (caller.role !== "SUPERADMIN") {
          return {
            kind: "FORBIDDEN" as const,
            message: "Only a SUPERADMIN may use the backstop conditions",
          };
        }
        backstop = { condition: backstopCondition!, reason: backstopReason! };
      } else if (backstopFieldsSent) {
        // Half-sent (a condition with no reason, or vice versa, or a blank
        // reason): the row names the eligibility gap rather than silently
        // deciding as the plain lane.
        return {
          kind: "FORBIDDEN" as const,
          message:
            "The backstop needs both a condition and a non-empty reason; without them a second HR reviewer decides instead",
        };
      } else if (correction.reviewTier === "ESCALATED") {
        // The stricter tier beyond same day (O17). A SUPERADMIN arriving
        // without backstop fields is in no named lane — O21 lets SUPERADMIN
        // decide only as the documented backstop. An HR reviewer is a
        // second pair of eyes only when the business actually has more than
        // one active HR officer; the sole ("first-line") HR deciding an
        // escalated row alone would defeat that tier, which is why the
        // launch default routes those to the SUPERADMIN backstop instead.
        if (caller.role === "SUPERADMIN") {
          return {
            kind: "FORBIDDEN" as const,
            message:
              "An escalated correction needs the SUPERADMIN backstop conditions, or a second HR reviewer",
          };
        }
        const otherActiveHr = await tx.user.count({
          where: {
            businessId,
            role: "HR",
            isActive: true,
            id: { not: caller.userId },
          },
        });
        if (otherActiveHr === 0) {
          return {
            kind: "FORBIDDEN" as const,
            message: "Escalated corrections need a second reviewer — a SUPERADMIN may act as backstop",
          };
        }
      }
      // SAME_DAY passes this chain however it arrives: any HR role may
      // decide it, so backstop fields sent there are simply recorded as sent
      // (they explain the decision) without ever being required.

      const attendance = await tx.attendance.findUnique({
        where: { id: correction.attendanceId },
        select: {
          id: true,
          clockIn: true,
          clockOut: true,
          status: true,
          sessionStatus: true,
          closureReason: true,
          hoursWorked: true,
          // The record's owner, so the decision audit row can name the person
          // the decision acts on (distinct from the acting reviewer).
          userId: true,
          shiftStartMinuteSnapshot: true,
          shiftEndMinuteSnapshot: true,
          shiftCrossesMidnightSnapshot: true,
          graceEarlyMinutesSnapshot: true,
          graceLateMinutesSnapshot: true,
        },
      });

      // The FK is Restrict, so this is unreachable while the correction row
      // exists — but the response contract needs the row, so fall through to
      // the same generic 404 rather than fabricating one.
      if (!attendance) {
        return { kind: "NOT_FOUND" as const };
      }

      const proposedAny = correction.proposedClockIn !== null || correction.proposedClockOut !== null;

      if (decision === "APPROVED" && proposedAny) {
        // First recheck reality (lifecycle §8.3 + §8.4): the row may have
        // been closed or changed after submission, and the approval must
        // never write over values it has not seen. A mismatch is refused —
        // never fabricated into an approval.
        const original = correction.originalValues as unknown as Record<string, unknown>;
        if (!rowStillMatchesOriginal(attendance, original)) {
          return { kind: "RECORD_CHANGED" as const };
        }
      }

      // ── What approval writes, per lifecycle §5.2/§8.3/§10 ────────────────
      // Only proposed fields move; a proposal for one time leaves the other
      // standing. A proposed clock-out on an open session closes it (the
      // "keep as appropriate" clause), setting `closure_reason = CORRECTION`
      // — the CORRECTION closure also lands on any closed row the correction
      // rewrote, including a previously auto-closed one (§8.4; the row's
      // automatic origin survives in originalValues and in the audit entry).
      // A no-op approval (neither time proposed) touches the attendance row
      // not at all: there is nothing to apply, and rewriting its closure or
      // status would be a change nobody proposed.

      // The engine runs off the row's frozen snapshots, the same shift data
      // the punch classified against — never the shift's live definition
      // (lifecycle §5, "reproducible classification").
      const shiftLike =
        attendance.shiftStartMinuteSnapshot !== null &&
        attendance.shiftEndMinuteSnapshot !== null &&
        attendance.shiftCrossesMidnightSnapshot !== null
          ? {
              startMinute: attendance.shiftStartMinuteSnapshot,
              endMinute: attendance.shiftEndMinuteSnapshot,
              crossesMidnight: attendance.shiftCrossesMidnightSnapshot,
            }
          : null;
      const policyLike =
        attendance.graceEarlyMinutesSnapshot !== null && attendance.graceLateMinutesSnapshot !== null
          ? {
              graceEarlyMinutes: attendance.graceEarlyMinutesSnapshot,
              graceLateMinutes: attendance.graceLateMinutesSnapshot,
            }
          : null;

      const wasClosed = attendance.sessionStatus === "CLOSED";
      const applyingClockOut = correction.proposedClockOut !== null && !wasClosed;
      const stillClosed = wasClosed || applyingClockOut;

      const finalClockIn = correction.proposedClockIn ?? attendance.clockIn;
      const finalClockOut = correction.proposedClockOut ?? attendance.clockOut;

      // The punch path's exact divisor (lifecycle §3.3 step 3), so a
      // corrected row's hours cannot drift from a verified one's.
      const finalHours =
        finalClockIn && finalClockOut ? hoursBetween(finalClockIn, finalClockOut) : 0;

      let finalStatus: AttendanceStatus = attendance.status;
      if (proposedAny) {
        if (stillClosed) {
          // Closed rows classify by the CORRECTION branch of §5.2: an
          // effective clock-in evaluates EARLY/ON_TIME/LATE; without one, or
          // without the frozen snapshots to judge by, the row lands in
          // REQUIRES_REVIEW instead of being guessed.
          if (!finalClockIn || !shiftLike || !policyLike) {
            finalStatus = "REQUIRES_REVIEW";
          } else {
            const evaluated = evaluateClockInStatus(finalClockIn, shiftLike, policyLike);
            // The engine answers OPEN_SESSION when the snapshots it needs do
            // not resolve — valid only for an open row, not for a closed one.
            finalStatus = evaluated === "OPEN_SESSION" ? "REQUIRES_REVIEW" : evaluated;
          }
        } else {
          // Still-open rows keep the punch path's classification of the
          // corrected clock-in (missing snapshots evaluate to OPEN_SESSION,
          // exactly as an ordinary punch does).
          finalStatus = evaluateClockInStatus(finalClockIn, shiftLike, policyLike);
        }
      }

      // approvedValues hold the accepted values — the applied end state on
      // an approval, or the row standing on a no-op approval; a rejection
      // leaves them unset.
      const approvedValues = decision === "APPROVED"
        ? {
            clockIn: finalClockIn,
            clockOut: finalClockOut,
            sessionStatus: wasClosed || applyingClockOut ? "CLOSED" : attendance.sessionStatus,
            status: finalStatus,
            closureReason: stillClosed && proposedAny ? ("CORRECTION" as const) : attendance.closureReason,
            hoursWorked: stillClosed && proposedAny ? finalHours : attendance.hoursWorked,
          }
        : null;

      if (decision === "APPROVED" && proposedAny) {
        // The update carries the row's observed state in its WHERE so a
        // write that lands between this transaction's read and update (an
        // auto-close racing the approval, for instance) refuses here — the
        // approval then reads as "the record changed", never overwrites.
        const applied = await tx.attendance.updateMany({
          where: {
            id: attendance.id,
            clockIn: attendance.clockIn,
            clockOut: attendance.clockOut,
            hoursWorked: attendance.hoursWorked,
            sessionStatus: attendance.sessionStatus,
            status: attendance.status,
            // Cheap future-proofing: if some path ever rewrites the closure
            // reason between the read above and this write, refusing to apply
            // (and answering "record changed") stays honest instead of
            // overwriting a closure this approval never saw.
            closureReason: attendance.closureReason,
          },
          data: {
            clockIn: finalClockIn,
            clockOut: finalClockOut,
            ...(wasClosed || applyingClockOut
              ? {
                  sessionStatus: "CLOSED" as const,
                  closureReason: "CORRECTION" as const,
                  hoursWorked: finalHours,
                }
              : {}),
            status: finalStatus,
          },
        });
        if (applied.count === 0) {
          return { kind: "RECORD_CHANGED" as const };
        }
      }

      // The decision guard mirrors the lifecycle: only a SUBMITTED row can
      // move. If a concurrent decision committed between the read above and
      // this write, this is the loser of the race and it answers 409.
      const decisionStamp = new Date();
      const decided = await tx.attendanceCorrection.updateMany({
        where: { id: correction.id, businessId, status: "SUBMITTED" },
        data: {
          status: decision,
          reviewedById: caller.userId,
          decidedAt: decisionStamp,
          // Absent means "leave the note alone" is wrong here — a decision
          // note belongs to the decision, so absent writes null.
          decisionNote: note ?? null,
          // Json inputs reject a bare null, so the column is only named when
          // an approval has values to store; a rejection leaves it unset.
          ...(approvedValues ? { approvedValues } : {}),
        },
      });
      if (decided.count === 0) {
        // A normal return would commit any attendance change made above.
        throw new CorrectionDecisionLost();
      }

      // Revision history (lifecycle §8.3 steps 3-5): one append-only row per
      // decision — APPLIED when the approval wrote attendance values, DECIDED
      // when it did not touch the row (a rejection or a no-op approval).
      const lastRevision = await tx.attendanceCorrectionRevision.aggregate({
        where: { correctionId: correction.id },
        _max: { revisionNo: true },
      });
      const revisionNo = (lastRevision._max.revisionNo ?? 0) + 1;
      const revisionAction = decision === "APPROVED" && proposedAny ? "APPLIED" : "DECIDED";

      await tx.attendanceCorrectionRevision.create({
        data: {
          businessId,
          correctionId: correction.id,
          revisionNo,
          action: revisionAction,
          // The schema makes `original_values` NOT NULL, so the read-back
          // cast to the Json input type is safe: the submission stored a
          // concrete object and Prisma returns an object at runtime.
          valuesBefore: correction.originalValues as unknown as Prisma.InputJsonValue,
          ...(approvedValues ? { valuesAfter: approvedValues } : {}),
          actorId: caller.userId,
          reason: [
            revisionAction === "APPLIED"
              ? `Approved and applied to attendance ${attendance.id}`
              : `Decision: ${decision}`,
            note,
            backstop ? `${backstop.condition} backstop: ${backstop.reason}` : null,
          ]
            .filter((part): part is string => Boolean(part))
            .join(" — "),
        },
      });

      // Audit inside the transaction (§8.3 step 6). These events keep riding
      // the human-readable `reason` field as serialized JSON (the established
      // convention; `writeAudit` now exposes beforeValues/afterValues, but the
      // before-state already holds the full original set above) — AuditLog has
      // no attendanceId column of its own.
      const auditPayload = {
        decision,
        role: caller.role,
        attendanceId: attendance.id,
        targetUserId: attendance.userId,
        original: correction.originalValues,
        proposed: {
          clockIn: correction.proposedClockIn,
          clockOut: correction.proposedClockOut,
        },
        approved: approvedValues,
        note: note ?? null,
        ...(backstop
          ? { condition: backstop.condition, backstopReason: backstop.reason }
          : {}),
      };
      await writeAudit(
        {
          businessId,
          action: backstop ? "correction.decided.backstop" : "correction.decided",
          entityType: "correction",
          entityId: correction.id,
          userId: caller.userId,
          reason: JSON.stringify(auditPayload),
        },
        tx
      );

      // Explicit handoff is auditable in its own right (contracts §4).
      if (backstop?.condition === "EXPLICIT_HANDOFF") {
        await writeAudit(
          {
            businessId,
            action: "correction.escalated",
            entityType: "correction",
            entityId: correction.id,
            userId: caller.userId,
            reason: JSON.stringify({
              attendanceId: attendance.id,
              targetUserId: attendance.userId,
              condition: backstop.condition,
              backstopReason: backstop.reason,
            }),
          },
          tx
        );
      }

      const escalation = backstop
        ? ({ type: "SUPERADMIN_BACKSTOP", condition: backstop.condition } as const)
        : correction.reviewTier === "ESCALATED"
          ? ({ type: "SECOND_HR", condition: null } as const)
          : null;

      // Fresh reads for the response body — same labels the contract row
      // names in `{ data: { correction, attendance, escalation } }`.
      const [freshCorrection, freshAttendance] = await Promise.all([
        tx.attendanceCorrection.findUnique({
          where: { id: correction.id },
          select: {
            id: true,
            attendanceId: true,
            status: true,
            reviewTier: true,
            decidedAt: true,
            decisionNote: true,
            reviewedById: true,
            approvedValues: true,
          },
        }),
        tx.attendance.findUnique({
          where: { id: attendance.id },
          select: {
            id: true,
            clockIn: true,
            clockOut: true,
            status: true,
            sessionStatus: true,
            closureReason: true,
            hoursWorked: true,
          },
        }),
      ]);
      if (!freshCorrection || !freshAttendance) {
        // Unreachable in a committed transaction; the row is right there.
        return { kind: "NOT_FOUND" as const };
      }

      return {
        kind: "DECIDED" as const,
        correction: freshCorrection,
        attendance: freshAttendance,
        escalation,
      };
    });

    if (result.kind === "NOT_FOUND") {
      res.status(404).json({ success: false, message: "Correction not found" });
      return;
    }
    if (result.kind === "ALREADY_CLOSED") {
      res.status(409).json({ success: false, message: result.message });
      return;
    }
    if (result.kind === "FORBIDDEN") {
      res.status(403).json({ success: false, message: result.message });
      return;
    }
    if (result.kind === "RECORD_CHANGED") {
      res.status(409).json({
        success: false,
        message: "The record changed since this correction was raised",
      });
      return;
    }

    auditLog.correctionDecided(caller.userId, result.correction.id, decision, businessId, {
      attendanceId: result.correction.attendanceId,
      backstopCondition:
        result.escalation?.type === "SUPERADMIN_BACKSTOP" ? result.escalation.condition : null,
    });

    res.status(200).json({
      success: true,
      message: decision === "APPROVED" ? "Correction approved" : "Correction rejected",
      data: {
        correction: result.correction,
        attendance: result.attendance,
        escalation: result.escalation,
      },
    });
  } catch (error) {
    if (error instanceof CorrectionDecisionLost) {
      res.status(409).json({ success: false, message: "This correction has already been decided" });
    } else if (error instanceof Error) {
      logError(error, { route: "corrections-decide" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default {
  createCorrection,
  listMyCorrections,
  getMyCorrection,
  listBusinessCorrections,
  getBusinessCorrection,
  decideCorrection,
};
