import prisma, { prismaUnscoped } from "../config/prismaClient.js";
import { Prisma } from "../generated/prisma/index.js";
import { currentTenant } from "./tenantContext.js";
import { logger } from "./logger.js";

/**
 * Durable audit-trail writer (kiosk spec §11, API contracts M1 §11).
 *
 * Every audited event is written twice by design: the pino `auditLog.*`
 * helpers keep the correlation-rich stdout stream for live troubleshooting,
 * and this helper persists the same event into the `audit_logs` TABLE, which
 * survives log rotation and is queryable by HR. Neither replaces the other —
 * call sites must keep emitting the pino rows.
 *
 * No entry here ever carries secret material: PIN, device token, pairing
 * code, or QR value exist only as one-way hashes in their own lanes.
 *
 * The `beforeValues`/`afterValues` entry fields map onto the AuditLog
 * columns of the same names (both nullable, so unset and null behave the
 * same: the column stores SQL NULL). They are an escape hatch for callers
 * who want the snapshot JSON in its own column; every established event
 * keeps carrying its detail in `reason`, which REMAINS the row's
 * human-readable summary — the columns never replace it.
 */

export type AuditEntry = {
  businessId: string;
  action: string; // dotted event name, e.g. "kiosk.paired"
  entityType: string; // "kiosk" | "verification_session" | "attendance" | ...
  entityId?: string | null;
  userId?: string | null; // actor when a user
  kioskId?: string | null; // actor when the kiosk
  /**
   * M6: optional explicit actor override for background-job rows. The job
   * writes no user or kiosk identity, so the derived actor below (kiosk →
   * USER otherwise) would label every row USER; passing "SYSTEM" here is how
   * the job lane marks itself (§7.2). Unset keeps the kiosk/user derivation.
   */
  actorType?: AuditActorTypeValue;
  reason?: string | null;
  /**
   * Optional state snapshots for the AuditLog `before_values` / `after_values`
   * columns (both nullable, default SQL NULL). `Prisma.InputJsonValue`, not
   * `unknown`, because the create payload has to satisfy the column's input
   * type; callers cast their snapshot object the same way the correction
   * revisions already do. Unset in every call site that predates M7 —
   * adding the capability never changed an existing row's shape.
   */
  beforeValues?: Prisma.InputJsonValue | null;
  afterValues?: Prisma.InputJsonValue | null;
};

/** Mirrors the schema's AuditActorType enum without importing the whole client. */
type AuditActorTypeValue = "USER" | "KIOSK" | "SYSTEM";

// The actor is the kiosk whenever a kiosk id rides the entry; otherwise it is
// a user action (or SYSTEM when the caller overrides — the M6 job lane).
const actorTypeFor = (entry: AuditEntry): AuditActorTypeValue =>
  entry.actorType ?? (entry.kioskId ? "KIOSK" : "USER");

/**
 * Persist one audit row. Transaction callers pass their `tx` so the audit row
 * commits or rolls back with the business write it describes; everything else
 * uses the tenant-scoped client. A rejection raised before a tenant exists
 * (a bad kiosk token, for example) still has a business id in the entry, so
 * that narrow case uses the owner connection rather than losing the row.
 * Failures are swallowed onto stdout — auditing must never break the request
 * it is describing.
 */
export const writeAudit = async (
  entry: AuditEntry,
  client?: Prisma.TransactionClient
): Promise<void> => {
  const target =
    client ?? (currentTenant() ? prisma : prismaUnscoped);

  try {
    await target.auditLog.create({
      data: {
        businessId: entry.businessId,
        actorType: actorTypeFor(entry),
        actorUserId: entry.userId ?? null,
        actorKioskId: entry.kioskId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        reason: entry.reason ?? null,
        // Default NULL: the fields are only named when the caller passed a
        // snapshot, so every pre-existing entry keeps its old shape.
        // (`Prisma.DbNull` is how a JSON column stores an explicit SQL NULL;
        // a bare `null` is not part of the column's input type.)
        ...(entry.beforeValues !== undefined
          ? { beforeValues: entry.beforeValues ?? Prisma.DbNull }
          : {}),
        ...(entry.afterValues !== undefined
          ? { afterValues: entry.afterValues ?? Prisma.DbNull }
          : {}),
      },
    });
  } catch (error) {
    // The described write already succeeded; losing the durable row only
    // costs history, so a warn (not a throw) is the whole recovery.
    logger.warn(
      {
        action: entry.action,
        eventType: "audit_write_failed",
        err: error instanceof Error ? error.message : undefined,
      },
      "Audit trail row not written"
    );
  }
};
