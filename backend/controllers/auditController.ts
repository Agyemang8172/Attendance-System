import prisma from "../config/prismaClient.js";
import { Request, Response } from "express";
import { callerBusinessId } from "../utils/tenant.js";
import { logError } from "../utils/logger.js";

/**
 * Audit-trail reads (API contracts §11). M7 Phase 3 adds the correction
 * trail: the corrections on one attendance row, each with its append-only
 * revisions and the audit rows the decisions wrote, assembled in one view so
 * a reviewer reads the whole story without re-joining three endpoints.
 */

/**
 * The four audit events the correction loop writes (contracts §4 + §11 prose).
 * `correction.submitted` is included for when a durable submission row lands;
 * AuditLog has no attendanceId column, so the trail is keyed through the
 * corrections themselves — every one of these rows is written with
 * entityType "correction" and entityId = the correction's id.
 */
const CORRECTION_AUDIT_ACTIONS = [
  "correction.submitted",
  "correction.decided",
  "correction.decided.backstop",
  "correction.escalated",
] as const;

/**
 * The correction fields the trail shows — the same set the business-wide HR
 * list exposes (`correctionBusinessSelect`), the trail adds nothing new a
 * caller could not already read.
 */
const trailCorrectionSelect = {
  id: true,
  attendanceId: true,
  reason: true,
  requestedAt: true,
  reviewTier: true,
  proposedClockIn: true,
  proposedClockOut: true,
  originalValues: true,
  approvedValues: true,
  status: true,
  decisionNote: true,
  decidedAt: true,
  createdAt: true,
  requestedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  reviewedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  attendance: {
    select: {
      id: true,
      date: true,
      // The employee whose record is under correction, same join the HR list
      // makes: requester and record-owner are usually the same person but the
      // join is the honest answer, not a guess that they always match.
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

/** The revision fields, plus who acted (§10: append-only, one row per step). */
const trailRevisionSelect = {
  id: true,
  correctionId: true,
  revisionNo: true,
  action: true,
  valuesBefore: true,
  valuesAfter: true,
  reason: true,
  createdAt: true,
  actor: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

/** The audit fields a trail reader needs; entities carry no secret material. */
const trailAuditSelect = {
  id: true,
  actorType: true,
  actorUserId: true,
  actorKioskId: true,
  action: true,
  entityType: true,
  entityId: true,
  reason: true,
  createdAt: true,
} as const;

/**
 * GET /api/audit/corrections/:attendanceId (contracts §11 row 3) —
 * SUPERADMIN and HR, both tenant-scoped like every other supervised read.
 *
 * Response shape: the contract row's response column literally reads
 * `{ data: [ corrections ] }`, so the corrections array is the top level and
 * the revisions plus the related audit rows nest INSIDE each correction as
 * `attendanceCorrectionRevisions` and `audits`. Nesting was chosen over the
 * assembled `{ corrections, audits }` alternative for exactly that reason —
 * it keeps the documented shape true — and because each correction's audits
 * are keyed by entityId = that correction's id, so the per-correction group
 * costs a filter, not a re-join. Corrections are newest first, matching every
 * other corrections lane; each trail reads forward (revisions by revisionNo
 * ascending, audit rows oldest first) so the story reads in the order it
 * happened.
 *
 * No audit row is written for this read: the endpoint reads the trail, and a
 * supervisor opening history is not an event the trail exists to preserve —
 * every audited action here is a state change (contracts §11's rows are all
 * reads except the CSV export, which O9 carves out explicitly).
 */
export const getCorrectionTrail = async (req: Request, res: Response): Promise<void> => {
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

    const { attendanceId } = req.params as { attendanceId: string };

    // Tenant scope first, and one 404 for both an unknown id and a row in
    // another business — the same-generic rule the help-request reads use, so
    // a cross-tenant caller learns nothing from the refusal.
    const attendance = await prisma.attendance.findFirst({
      where: { id: attendanceId, businessId },
      select: { id: true },
    });
    if (!attendance) {
      res.status(404).json({ success: false, message: "Attendance record not found" });
      return;
    }

    const corrections = await prisma.attendanceCorrection.findMany({
      where: { attendanceId, businessId },
      select: trailCorrectionSelect,
      orderBy: { requestedAt: "desc" },
    });

    const correctionIds = corrections.map((correction) => correction.id);

    // Two flat queries instead of nested includes, so the result keys can be
    // named exactly as the response promises (`attendanceCorrectionRevisions`,
    // `audits`) and nothing is fetched when the attendance has no corrections.
    const [revisions, audits] = await Promise.all([
      correctionIds.length
        ? prisma.attendanceCorrectionRevision.findMany({
            where: { businessId, correctionId: { in: correctionIds } },
            select: trailRevisionSelect,
            orderBy: { revisionNo: "asc" },
          })
        : Promise.resolve([]),
      correctionIds.length
        ? prisma.auditLog.findMany({
            where: {
              businessId,
              entityType: "correction",
              entityId: { in: correctionIds },
              action: { in: CORRECTION_AUDIT_ACTIONS as unknown as string[] },
            },
            select: trailAuditSelect,
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
    ]);

    // Each submission carries its own slice of both histories.
    const trail = corrections.map((correction) => ({
      ...correction,
      attendanceCorrectionRevisions: revisions.filter(
        (revision) => revision.correctionId === correction.id
      ),
      audits: audits.filter((audit) => audit.entityId === correction.id),
    }));

    res.status(200).json({ success: true, data: trail });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "audit-corrections-trail" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default { getCorrectionTrail };
