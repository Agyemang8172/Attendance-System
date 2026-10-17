import type { PrismaClient } from "../generated/prisma/index.js";
import { writeAudit } from "../utils/auditWriter.js";
import { auditLog } from "../utils/logger.js";
import { hoursBetween, resolveShiftEndInstant } from "../utils/shiftWindow.js";

/**
 * The automatic clock-out sweep (M6, lifecycle §7, architecture §4, O8).
 *
 * One HTTP-triggered pass closes OPEN attendance sessions whose scheduled
 * shift end (frozen on the row's own snapshots) plus the policy's offset has
 * passed, and flags the ambiguous ones to HR instead of guessing a time. It
 * never overwrites a genuine clock-out: every UPDATE is filtered on
 * `sessionStatus = "OPEN"`, so a verified clock-out that landed mid-pass
 * makes that row's update match nothing.
 *
 * The exported entrypoint takes the prisma client as an argument, so later
 * tests can hand a transaction or a test client without stubbing the global.
 */

/** Sentinel returned when another concurrent run holds the sweep lock (→ 409). */
export const JOB_LOCKED = Symbol("auto-clock-out-lock-held");

export type AutoClockOutCounts = {
  /** Sessions closed automatically this pass. */
  closed: number;
  /** Sessions flagged to REQUIRES_REVIEW because the window or policy could not be resolved. */
  flagged: number;
  /** How many businesses the pass swept. */
  businesses: number;
};

/**
 * The two audit actions this job writes; the status endpoint (contracts §9)
 * reads back the latest run from exactly this action pair.
 */
export const AUTO_CLOCK_OUT_JOB_ACTIONS = [
  "job.auto_clock_out_closed",
  "job.auto_clock_out_flagged",
] as const;

/**
 * Plain-English review reasons, shared by the attendance row and the audit
 * row so HR sees the same wording in both places.
 */
const REVIEW_NO_SHIFT_WINDOW =
  "Auto clock-out needs HR review: the shift end snapshot is missing or cannot be resolved";
const REVIEW_NO_POLICY =
  "Auto clock-out needs HR review: the effective policy version could not be determined";

/**
 * A flagged row is already with HR; re-writing it and re-auditing it every 15
 * minutes would spam audit_logs, so the flag branches never touch it again.
 */
const ALREADY_FLAGGED = "REQUIRES_REVIEW" as const;

type PolicyVersionLite = {
  id: string;
  autoClockOutEnabled: boolean;
  autoClockOutOffsetMinutes: number | null;
  autoClockOutBufferMinutes: number;
};

/**
 * Run one sweep. Returns the counts, or JOB_LOCKED when a concurrent run is
 * already holding the advisory lock (the controller turns that into 409).
 *
 * **Lock approach.** One interactive transaction whose FIRST statement is
 * `pg_try_advisory_xact_lock`; the whole sweep runs inside the transaction
 * that holds the lock, so there is no second lock to release: a commit or a
 * rollback frees it automatically. The plain `pg_advisory_lock` variant was
 * deliberately NOT chosen — advisory locks are session-scoped, and Prisma
 * hands pooled connections to standalone statements, so a try and an unlock
 * can land on different connections; the xact-scoped variant binds lock
 * lifetime to the transaction, which is the lifetime the sweep needs anyway.
 */
export const runAutoClockOut = async (
  prismaClient: PrismaClient,
  businessId?: string
): Promise<AutoClockOutCounts | typeof JOB_LOCKED> => {
  // One wall-clock reading for the whole pass: eligibility (`now >= end +
  // offset`) is judged against a single instant, not one per business.
  const now = new Date();
  const counts: AutoClockOutCounts = { closed: 0, flagged: 0, businesses: 0 };

  const result = await prismaClient.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(
          'attendpro:auto-clock-out'
        )) AS acquired`;

      if (!lockRows[0]?.acquired) return JOB_LOCKED;

      // A targeted pass takes the body's businessId verbatim; otherwise the
      // sweep walks all active businesses. Tenant scoping stays in the
      // per-query `businessId` filters below — the established pattern in
      // this codebase (no app.business_id session variable is set).
      const businesses = businessId
        ? [{ id: businessId }]
        : await tx.business.findMany({
            where: { isActive: true },
            select: { id: true },
          });

      for (const business of businesses) {
        counts.businesses += 1;

        const rows = await tx.attendance.findMany({
          where: { businessId: business.id, sessionStatus: "OPEN" },
          select: {
            id: true,
            status: true,
            clockIn: true,
            date: true,
            shiftStartMinuteSnapshot: true,
            shiftEndMinuteSnapshot: true,
            shiftCrossesMidnightSnapshot: true,
            timezoneSnapshot: true,
            policyVersionId: true,
          },
        });
        if (rows.length === 0) continue;

        // The business default policy's live version — the same lookup shape
        // the punch path uses (live = effective at `now`, highest version
        // number) — is the fallback for rows that carry no policyVersionId.
        const defaultPolicy = await tx.workplacePolicy.findFirst({
          where: { businessId: business.id, isDefault: true },
          select: {
            versions: {
              where: {
                effectiveFrom: { lte: now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
              },
              orderBy: { versionNumber: "desc" as const },
              take: 1,
              select: {
                id: true,
                autoClockOutEnabled: true,
                autoClockOutOffsetMinutes: true,
                autoClockOutBufferMinutes: true,
              },
            },
          },
        });
        const defaultVersion: PolicyVersionLite | null =
          defaultPolicy?.versions[0] ?? null;

        // Rows repeat the same version ids, so each id is queried at most
        // once per business pass: both hits and misses (a deleted version)
        // are cached, distinguished with has() below — otherwise a
        // genuinely absent version is re-queried for every remaining row.
        const versionsById = new Map<string, PolicyVersionLite | null>();

        for (const row of rows) {
          // ── Effective policy (lifecycle §7.1 condition 2) ──
          let version: PolicyVersionLite | null = null;
          if (row.policyVersionId) {
            if (versionsById.has(row.policyVersionId)) {
              version = versionsById.get(row.policyVersionId) ?? null;
            } else {
              version = ((await tx.policyVersion.findUnique({
                // defense in depth: the id is system-written, but scope it to
                // this business's rows anyway.
                where: {
                  id: row.policyVersionId,
                  businessId: business.id,
                },
                select: {
                  id: true,
                  autoClockOutEnabled: true,
                  autoClockOutOffsetMinutes: true,
                  autoClockOutBufferMinutes: true,
                },
              })) as PolicyVersionLite | null);
              versionsById.set(row.policyVersionId, version);
            }
          }
          if (!version) version = defaultVersion;

          // Guard every write on the row still being OPEN: a racing verified
          // clock-out (or a parallel punch) closes the row between the read
          // above and the write here, and that write must then match nothing.
          // A zero count therefore means "someone else closed it" — excluded
          // from closed and flagged alike, since neither the job nor anyone
          // else wrote a duplication, and the counts must not double-report.
          const guard = { id: row.id, sessionStatus: "OPEN" as const };

          if (!version) {
            // Already with HR (ALREADY_FLAGGED): skipping costs nothing — no
            // update, no audit row.
            if (row.status === ALREADY_FLAGGED) continue;
            // The row's policy version is gone and no business default is
            // live right now: unresolvable, so HR decides (owner decision 2).
            const written = await tx.attendance.updateMany({
              where: guard,
              data: { status: "REQUIRES_REVIEW", requiresReviewReason: REVIEW_NO_POLICY },
            });
            if (written.count > 0) {
              counts.flagged += 1;
              await writeAudit(
                {
                  businessId: business.id,
                  actorType: "SYSTEM",
                  action: "job.auto_clock_out_flagged",
                  entityType: "attendance",
                  entityId: row.id,
                  reason: REVIEW_NO_POLICY,
                },
                tx
              );
            }
            continue;
          }

          if (!version.autoClockOutEnabled) {
            // The business (or this version) turned the job off: the row is
            // left exactly as it stands — no write, no flag. Recording it
            // would flood the audit trail with identical "did nothing" rows
            // every 15 minutes for every still-open shift (lifecycle §7.1: it
            // stays CLOCK_OUT_MISSING for HR).
            continue;
          }

          const endInstant = resolveShiftEndInstant(row);
          if (!endInstant) {
            // Already with HR (ALREADY_FLAGGED): skipping costs nothing — no
            // update, no audit row.
            if (row.status === ALREADY_FLAGGED) continue;
            // No resolvable shift window (§7.1 condition 4): flag, never
            // guess. Session stays OPEN so HR's own close-out still applies.
            const written = await tx.attendance.updateMany({
              where: guard,
              data: {
                status: "REQUIRES_REVIEW",
                requiresReviewReason: REVIEW_NO_SHIFT_WINDOW,
              },
            });
            if (written.count > 0) {
              counts.flagged += 1;
              await writeAudit(
                {
                  businessId: business.id,
                  actorType: "SYSTEM",
                  action: "job.auto_clock_out_flagged",
                  entityType: "attendance",
                  entityId: row.id,
                  reason: REVIEW_NO_SHIFT_WINDOW,
                },
                tx
              );
            }
            continue;
          }

          // Offset = policy-driven minutes past the scheduled end before the
          // job may close. Decision 3: offset unset → fall back to the older
          // buffer field. The schema boots autoClockOutBufferMinutes at 120
          // and makes it non-nullable, so after the fallback the offset is
          // always a number; a "both unset" case cannot exist in this schema.
          const offsetMinutes =
            version.autoClockOutOffsetMinutes ??
            version.autoClockOutBufferMinutes;
          const closeAt = new Date(
            endInstant.getTime() + offsetMinutes * 60_000
          );

          if (now.getTime() < closeAt.getTime()) {
            // Enabled, resolvable, but the shift's end+offset has not passed
            // yet: the ordinary open-session branch (§5.2) still applies and
            // the job leaves the row alone (§7.1 condition 3).
            continue;
          }

          // The stored clock-out is end + offset, never the run time: PRD §12
          // keeps the closure times tied to the schedule, not to when the
          // sweep happened to execute (idempotence relies on this too — a
          // rerun derives the same instant and the WHERE guard matches
          // nothing, because the row is CLOSED by then).
          const hoursWorked = hoursBetween(row.clockIn, closeAt);

          const closed = await tx.attendance.updateMany({
            where: guard,
            data: {
              clockOut: closeAt,
              hoursWorked,
              sessionStatus: "CLOSED" as const,
              status: "AUTO_CLOSED" as const,
              closureReason: "AUTO_CLOCK_OUT" as const,
            },
          });
          if (closed.count === 0) continue;

          counts.closed += 1;
          await writeAudit(
            {
              businessId: business.id,
              actorType: "SYSTEM",
              action: "job.auto_clock_out_closed",
              entityType: "attendance",
              entityId: row.id,
              reason: closeAt.toISOString(),
            },
            tx
          );
        }
      }

      return counts;
    },
    // A sweep over many businesses is one long transaction; the library
    // defaults cut interactive transactions at 5 s, which no real deployment
    // sweep fits inside.
    { maxWait: 10_000, timeout: 300_000 }
  );

  if (result === JOB_LOCKED) return result;

  // One stdout line per run (never an employee identifier) — the durable
  // per-row detail is the audit_logs table this already wrote.
  auditLog.jobRun({ ...result });
  return result;
};
