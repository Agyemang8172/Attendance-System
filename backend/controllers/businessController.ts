import prisma from "../config/prismaClient.js";
import { Prisma } from "../generated/prisma/index.js";
import { Request, Response } from "express";
import { callerBusinessId } from "../utils/tenant.js";
import { writeAudit } from "../utils/auditWriter.js";
import { auditLog, logError } from "../utils/logger.js";

/**
 * Business settings (API contracts §5 rows 1-2). Retention lives here as
 * config only — O10 keeps automatic deletion OFF until Ghana-specific legal
 * advice lands, so this surface stores and audits the knobs and nothing in
 * this milestone ever deletes a row.
 *
 * The caller is always the tenant: an HR officer or a SUPERADMIN of one
 * business reaches their own row and nothing else, the same
 * callerBusinessId scoping every controller uses. The route gates both
 * endpoints to SUPERADMIN.
 */

/**
 * The settings record as both GET and PATCH respond it. The contract GET row
 * names `branding` as one field while the schema carries it as four columns
 * (logoUrl, brandColor, supportEmail, supportPhone); grouping keeps the
 * contract's keyword without inventing a `branding` column. The two
 * per-category day fields are shown beside the legacy `retentionYears`
 * because R8 split the categories (attendance vs audit) and a reader of this
 * surface needs to see both windows, not guess them (O10).
 */
const settingsShape = {
  name: true,
  timezone: true,
  logoUrl: true,
  brandColor: true,
  supportEmail: true,
  supportPhone: true,
  retentionYears: true,
  retentionEnabled: true,
  attendanceRetentionDays: true,
  auditRetentionDays: true,
} as const;

type SettingsShape = {
  name: string;
  timezone: string;
  logoUrl: string | null;
  brandColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  retentionYears: number;
  retentionEnabled: boolean;
  attendanceRetentionDays: number | null;
  auditRetentionDays: number | null;
};

const presentSettings = (business: SettingsShape) => ({
  name: business.name,
  timezone: business.timezone,
  branding: {
    logoUrl: business.logoUrl,
    brandColor: business.brandColor,
    supportEmail: business.supportEmail,
    supportPhone: business.supportPhone,
  },
  retentionYears: business.retentionYears,
  retentionEnabled: business.retentionEnabled,
  attendanceRetentionDays: business.attendanceRetentionDays,
  auditRetentionDays: business.auditRetentionDays,
});

/**
 * GET /api/business/settings (contracts §5 row 1) — SUPERADMIN reads their
 * own business row. No audit row: every read endpoint here stays unaudited;
 * only accepted writes earn a durable row.
 */
export const getBusinessSettings = async (req: Request, res: Response): Promise<void> => {
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

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: settingsShape,
    });
    if (!business) {
      // callerBusinessId resolved a user row a moment ago, so a missing
      // business here is a data-integrity problem, not a caller problem.
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    res.status(200).json({ success: true, data: presentSettings(business) });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "business-settings-get" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/**
 * PATCH /api/business/settings (contracts §5 row 2) — SUPERADMIN updates
 * their own business. Contract fields (name/timezone/logoUrl/brandColor/
 * supportEmail/supportPhone) and the O10 retention knobs share the body;
 * bounds and the IANA timezone check are the zod validator's job.
 *
 * One durable audit row per accepted PATCH (`settings.updated`), written
 * inside the transaction with the business write so an unaudited settings
 * change cannot exist. AuditLog carries before/after value columns but
 * `writeAudit` (fixed groundwork) exposes no parameter for them, so — like
 * the correction decisions — the payload rides the `reason` field as
 * serialized JSON, and the contract's "audit before and after" is honoured
 * in the same serialized form every other audited write here uses.
 */
export const updateBusinessSettings = async (req: Request, res: Response): Promise<void> => {
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

    // After the zod validator: unknown keys refused (strict), bounds checked,
    // timezone a valid IANA name. `retentionEnabled` can only be false (the
    // schema-level refine blocks `true`); the guard below is defence in depth
    // in case the validator is ever loosened without rethinking O10.
    const body = req.body as {
      name?: string;
      timezone?: string;
      logoUrl?: string;
      brandColor?: string;
      supportEmail?: string;
      supportPhone?: string;
      retentionYears?: number;
      // Deliberately typed as a plain boolean, not `false`: the type must not
      // encode the rule away, or the O10 guard below would be a compile-time
      // no-op instead of the runtime defence in depth it exists to be.
      retentionEnabled?: boolean;
      attendanceRetentionDays?: number;
      auditRetentionDays?: number;
    };

    if (body.retentionEnabled === true) {
      res.status(400).json({
        success: false,
        message: "Retention cannot be enabled yet — O10 keeps deletion off until the Ghana-specific legal advice lands",
      });
      return;
    }

    const current = await prisma.business.findUnique({
      where: { id: businessId },
      select: settingsShape,
    });
    if (!current) {
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    // Only values that actually differ are written and counted, so a stale
    // screen re-submitting today's numbers cannot masquerade as a change in
    // the audit trail.
    const data: Partial<Record<keyof SettingsShape, unknown>> = {};
    const before: Partial<Record<keyof SettingsShape, unknown>> = {};
    const after: Partial<Record<keyof SettingsShape, unknown>> = {};
    for (const key of Object.keys(body) as Array<keyof typeof body>) {
      const value = body[key];
      if (value === undefined) continue;
      if (current[key] !== value) {
        data[key] = value;
        before[key] = current[key];
        after[key] = value;
      }
    }

    const changedFields = Object.keys(data);

    const updated = await prisma.$transaction(async (tx) => {
      // One row per accepted PATCH, committed with the write it describes.
      // A PATCH whose values already matched still gets the row, with an
      // empty diff the reason makes honest: the request was accepted, no
      // value moved.
      await writeAudit(
        {
          businessId,
          action: "settings.updated",
          entityType: "business",
          entityId: businessId,
          userId: caller.userId,
          reason: JSON.stringify({
            fields: changedFields,
            ...(changedFields.length ? { before, after } : {}),
            ...(changedFields.length ? {} : { note: "no effective change — the values already matched" }),
          }),
        },
        tx
      );

      return tx.business.update({
        where: { id: businessId },
        // the loop above only ever puts body-typed scalars in `data`; the
        // cast hands Prisma the exact update-input shape it wants.
        data: data as Prisma.BusinessUpdateInput,
        select: settingsShape,
      });
    });

    auditLog.settingsUpdated(caller.userId, businessId, changedFields);

    // The response echoes the updated record in the same shape GET returns —
    // nothing on this row is secret (no PIN, token or hash lives on Business).
    res.status(200).json({
      success: true,
      message: "Business settings updated",
      data: presentSettings(updated),
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "business-settings-update" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default { getBusinessSettings, updateBusinessSettings };
