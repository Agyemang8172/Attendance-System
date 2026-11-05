import prisma from "../config/prismaClient.js";
import { Request, Response } from "express";
import { callerBusinessId } from "../utils/tenant.js";
import { writeAudit } from "../utils/auditWriter.js";
import { auditLog, logError } from "../utils/logger.js";

/**
 * Help requests (API contracts §3 staff lane + §4 HR lane). An employee who
 * cannot fix their own access (a lost PIN, a kiosk that will not read them,
 * a broken profile) raises a request here; HR answers it from the other
 * endpoint. The requester and the business are always taken from the CALLER —
 * never from the body — so no payload can ever file a ticket on someone
 * else's behalf or into another tenant.
 */

/** The only fields an employee sees on a list; a staff caller reads their own. */
const selfSelect = {
  id: true,
  category: true,
  subject: true,
  body: true,
  status: true,
  resolutionNote: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The fields HR sees on a business-wide list, plus who raised it. */
const businessSelect = {
  ...selfSelect,
  requester: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

/** Both list handlers are the newest first, so HR and staff see the live queue on top. */
const newestFirst = { createdAt: "desc" as const };

/**
 * `help.request_submitted` (dotted, in the style of the audit events the
 * contracts DO name — `correction.decided`, `kiosk.paired`). The M1 contracts
 * name no event for help requests: §3/§4 rows say only "audit" for the PATCH
 * and nothing for the POST, so these names are crafted to fit the same
 * `entity.event` shape. Also mirrored onto the pino stdout lane by the
 * `auditLog.helpRequest*` helpers (auditWriter.ts header asks for both).
 */
export const createHelpRequest = async (req: Request, res: Response): Promise<void> => {
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

    // Category, subject and body bounds were checked by the zod validator,
    // and `category` is the allowlist enum — an unknown category is a 400
    // "Validation failed" before this handler runs.
    const { category, subject, body } = req.body as {
      category: string;
      subject: string;
      body: string;
    };

    // Tenant AND requester are forced from the caller (contracts §3:
    // "requester forced to self"); the body carries neither field.
    const created = await prisma.attendanceHelpRequest.create({
      data: {
        businessId,
        requesterId: caller.userId,
        category,
        subject,
        body,
      },
      select: { id: true, status: true },
    });

    await writeAudit({
      businessId,
      action: "help.request_submitted",
      entityType: "help_request",
      entityId: created.id,
      userId: caller.userId,
      reason: `category: ${category}`,
    });

    auditLog.helpRequestSubmitted(caller.userId, created.id, businessId);

    // 201 { data: { id, status } } per contracts §3.
    res.status(201).json({
      success: true,
      message: "Help request submitted",
      data: created,
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "help-requests-create" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/**
 * GET /api/staff/help-requests — the employee's own queue, `requesterId` AND
 * business both filtered, newest first. `status?` narrows it.
 */
export const listMyHelpRequests = async (req: Request, res: Response): Promise<void> => {
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
      status?: "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
      page: number;
      limit: number;
    };
    const skip = (page - 1) * limit;

    const where = {
      businessId,
      requesterId: caller.userId,
      ...(filter ? { status: filter } : {}),
    };

    const [requests, total] = await Promise.all([
      prisma.attendanceHelpRequest.findMany({
        where,
        select: selfSelect,
        orderBy: newestFirst,
        skip,
        take: limit,
      }),
      prisma.attendanceHelpRequest.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "help-requests-list-mine" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/**
 * GET /api/staff/help-requests/:id — one of the caller's own requests.
 * Refusals split so the contract's two error codes are both used without
 * becoming a probe:
 *   - unknown id or a row in ANOTHER business → 404, same-generic message
 *     (a caller cannot tell for which id value the database holds a row);
 *   - a row in the caller's own business but raised by someone else → 403
 *     (the contract's ownership check — the existence of a colleague's
 *     ticket is not a secret inside the tenant, only viewing it is).
 */
export const getMyHelpRequest = async (req: Request, res: Response): Promise<void> => {
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

    const row = await prisma.attendanceHelpRequest.findUnique({ where: { id } });

    if (!row || row.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Request not found" });
      return;
    }

    if (row.requesterId !== caller.userId) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    res.status(200).json({ success: true, data: row });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "help-requests-get-mine" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/**
 * GET /api/hr/help-requests — the whole business queue (contracts §4: SELECT
 * WHERE business_id), newest first, with who raised each one so HR can
 * actually reach the person. Role gating lives on the route.
 */
export const listBusinessHelpRequests = async (req: Request, res: Response): Promise<void> => {
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

    // Same post-validate read as the staff list above.
    const { status: filter, page, limit } = req.query as unknown as {
      status?: "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
      page: number;
      limit: number;
    };
    const skip = (page - 1) * limit;

    const where = {
      businessId,
      ...(filter ? { status: filter } : {}),
    };

    const [requests, total] = await Promise.all([
      prisma.attendanceHelpRequest.findMany({
        where,
        select: businessSelect,
        orderBy: newestFirst,
        skip,
        take: limit,
      }),
      prisma.attendanceHelpRequest.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "help-requests-list-business" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/** Direct detail uses the same tenant and field scope as the business queue. */
export const getBusinessHelpRequest = async (req: Request, res: Response): Promise<void> => {
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
    const row = await prisma.attendanceHelpRequest.findFirst({
      where: { id, businessId },
      select: businessSelect,
    });
    if (!row) {
      res.status(404).json({ success: false, message: "Request not found" });
      return;
    }
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    if (error instanceof Error) logError(error, { route: "help-requests-get-business" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * The transition map behind `updateHelpRequest`'s ladder, read as "current
 * status → statuses it may move to". An entry with no legal destination
 * means a decided request is final; a status absent as a KEY cannot occur
 * (the zod validator only admits these four).
 */
const HELP_REQUEST_TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ["IN_REVIEW", "RESOLVED", "CLOSED"],
  IN_REVIEW: ["RESOLVED", "CLOSED"],
  // Decided requests are final — there is no re-opening.
  RESOLVED: [],
  CLOSED: [],
} as const;

/**
 * PATCH /api/hr/help-requests/:id — HR (or the SUPERADMIN backstop) moves a
 * request through OPEN → IN_REVIEW → RESOLVED/CLOSED, with an optional note
 * explaining what was done. The status set and the note cap are the zod
 * validator's job; this handler is about who, when, and what gets stamped
 * on the row.
 *
 * Status ladder — the transitions this endpoint actually allows, with a 409
 * (`"Cannot move a request from X to Y"`) for every jump off the map:
 *   OPEN → IN_REVIEW | RESOLVED | CLOSED
 *   IN_REVIEW → RESOLVED | CLOSED
 *   RESOLVED → (nothing) and CLOSED → (nothing)
 * That is the docstring's OPEN → IN_REVIEW → RESOLVED/CLOSED ladder read
 * literally: OPEN may reach any other status directly (a reviewer can
 * resolve or close without a review stopover), IN_REVIEW may only move
 * forward to an end state, and a decided request (RESOLVED or CLOSED) is
 * final — there is no re-opening. Every transition is still audited below.
 *
 * Audit events (§10 style, dotted): every accepted change writes
 * `help.request_status_changed`; a change whose new status is RESOLVED
 * instead writes `help.request_resolved`, because that is the row the audit
 * reader will want to filter on. No PATCH is left unaudited.
 */
export const updateHelpRequest = async (req: Request, res: Response): Promise<void> => {
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
    // The zod validator has already narrowed `status` to the schema's
    // HelpRequestStatus values and the note to its cap; the union type here
    // is what Prisma expects on the write.
    const { status, resolutionNote } = req.body as {
      status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
      resolutionNote?: string;
    };

    // Tenant scope first: a row in another business shares the unknown-id
    // refusal, so a cross-tenant caller learns nothing from a 404.
    const row = await prisma.attendanceHelpRequest.findUnique({
      where: { id },
      select: { id: true, businessId: true, status: true },
    });
    if (!row || row.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Request not found" });
      return;
    }

    // The schema has no unique guard against a no-op PATCH, so the answer is
    // here: statuses are a small finite ladder, and a change to the value the
    // row already carries is either a stale screen or a race, not work. The
    // contracts do not name a 409 for this endpoint (their row lists only
    // 400/401/403/404); this 409 was added so a client that retries blindly
    // hears "already in this status" instead of believing its stale write won.
    if (row.status === status) {
      res.status(409).json({
        success: false,
        message: `The request is already in this status, ${status}`,
      });
      return;
    }

    // The status ladder (documented in the docstring, encoded in
    // HELP_REQUEST_TRANSITIONS above): a jump off the map — e.g. RESOLVED
    // back to OPEN, or CLOSED to anything — is refused with the same plain
    // 409 as the no-op check, so a stale client hears exactly what did not
    // happen instead of believing its write won.
    if (!HELP_REQUEST_TRANSITIONS[row.status]?.includes(status)) {
      res.status(409).json({
        success: false,
        message: `Cannot move a request from ${row.status} to ${status}`,
      });
      return;
    }

    // `resolutionNote` is optional: absent means "leave the note alone", a
    // present string replaces it.
    const noteProvided = resolutionNote !== undefined;

    const updated = await prisma.$transaction(async (tx) => {
      // `resolved_at` is the row's only resolution timestamp (there is no
      // `resolved_by` column — the deciding actor lives in the audit row
      // instead, which is what audit rows are for). Setting RESOLVED stamps
      // it; moving off RESOLVED clears it, so the column never claims a
      // resolution the status column contradicts.
      const resolvedAt = status === "RESOLVED" ? new Date() : null;

      // Match the observed state so overlapping decisions cannot overwrite it.
      const result = await tx.attendanceHelpRequest.update({
        where: { id: row.id, businessId, status: row.status },
        data: {
          status: status as never,
          ...(noteProvided ? { resolutionNote } : {}),
          resolvedAt,
        },
        select: {
          id: true,
          category: true,
          subject: true,
          status: true,
          resolutionNote: true,
          resolvedAt: true,
          requesterId: true,
          updatedAt: true,
        },
      }).catch((error: unknown) => {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") return null;
        throw error;
      });
      if (!result) return null;

      // Commit the audit together with the status change.
      await writeAudit({
        businessId,
        action: status === "RESOLVED" ? "help.request_resolved" : "help.request_status_changed",
        entityType: "help_request",
        entityId: row.id,
        userId: caller.userId,
        reason: `Status set to ${status}${noteProvided ? " with a resolution note" : ""}`,
      }, tx);
      return result;
    });

    if (!updated) {
      res.status(409).json({ success: false, message: "Request changed while it was being reviewed" });
      return;
    }

    auditLog.helpRequestResolved(caller.userId, updated.id, status, noteProvided, businessId);

    // `data: updated` per contracts §4.
    res.status(200).json({
      success: true,
      message: "Help request updated",
      data: updated,
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "help-requests-update" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default {
  createHelpRequest,
  listMyHelpRequests,
  getMyHelpRequest,
  listBusinessHelpRequests,
  getBusinessHelpRequest,
  updateHelpRequest,
};
