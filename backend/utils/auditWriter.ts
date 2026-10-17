import prisma from "../config/prismaClient.js";
import { Prisma } from "../generated/prisma/index.js";
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
 * uses `prisma` itself. Failures are swallowed onto stdout — auditing must
 * never break the request it is describing.
 */
export const writeAudit = async (
  entry: AuditEntry,
  client: Prisma.TransactionClient = prisma
): Promise<void> => {
  try {
    await client.auditLog.create({
      data: {
        businessId: entry.businessId,
        actorType: actorTypeFor(entry),
        actorUserId: entry.userId ?? null,
        actorKioskId: entry.kioskId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        reason: entry.reason ?? null,
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
