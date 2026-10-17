import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { callerBusinessId } from "../utils/tenant.js";
import {
  AUTO_CLOCK_OUT_JOB_ACTIONS,
  JOB_LOCKED,
  runAutoClockOut,
} from "../jobs/autoClockOut.js";

/**
 * Background job handlers (API contracts §9). The run handler wraps the
 * advisory-lock sweep in backend/jobs/autoClockOut.ts; the status handler
 * reads the latest run's counts back out of audit_logs.
 */

/**
 * POST /auto-clock-out/run — the service token scopes this caller; the job
 * token carries no employee identity, so the sweep derives its scope from the
 * body's optional businessId, never from a session. `businessId` was already
 * parsed out of the body by jobRunSchema/validate (optional uuid).
 */
export const runAutoClockOutJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await runAutoClockOut(prisma, req.body.businessId);

    // The sweep's own sentinel answers for it: another worker holds the
    // advisory lock, so this caller is rejected rather than queued behind a
    // duplicate pass (contracts §9's 409 row).
    if (result === JOB_LOCKED) {
      res.status(409).json({
        success: false,
        message: "Another run is already in progress",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Auto clock-out job completed",
      data: { closed: result.closed, flagged: result.flagged, businesses: result.businesses },
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

/**
 * GET /status (contracts §9: SUPERADMIN sees own, job token sees all) reads
 * the latest sweep's outcome out of audit_logs — the same durable rows the
 * sweep wrote with actorType = SYSTEM.
 */
export const jobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const isJobCaller = req.actorType === "job";
    // The session branch filters to the SUPERADMIN's own business — resolved
    // from their account with the shared helper, because the session payload
    // carries userId, not businessId. The job token is a server secret with
    // no business identity, so it reads every business (the middleware
    // guarantees one of the two identities). An account with no business
    // matches nothing, which is the same outcome as any other no-match.
    const businessFilter = isJobCaller
      ? undefined
      : req.user
        ? { businessId: (await callerBusinessId(req.user.userId)) ?? "" }
        : undefined;

    const latest = await prisma.auditLog.findFirst({
      where: {
        actorType: "SYSTEM",
        action: { in: [...AUTO_CLOCK_OUT_JOB_ACTIONS] },
        ...businessFilter,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // None of this job's actions ever ran → zeros and no lastRun.
    let data: { lastRun: string | null; closed: number; flagged: number } = {
      lastRun: null,
      closed: 0,
      flagged: 0,
    };

    if (latest) {
      // The sweep writes every row for one pass inside one transaction, so
      // the batch shares one createdAt to millisecond precision; reading
      // everything from that timestamp onward groups the latest run. This is
      // an approximation on purpose: a concurrent run's rows could share the
      // same millisecond, and at the 15-minute cadence the latest batch is
      // the just-finished run in practice.
      const batch = await prisma.auditLog.groupBy({
        by: ["action"],
        where: {
          actorType: "SYSTEM",
          action: { in: [...AUTO_CLOCK_OUT_JOB_ACTIONS] },
          createdAt: { gte: latest.createdAt },
          ...businessFilter,
        },
        _count: { _all: true },
      });

      data = { lastRun: latest.createdAt.toISOString(), closed: 0, flagged: 0 };
      for (const group of batch) {
        if (group.action === "job.auto_clock_out_closed") data.closed = group._count._all;
        if (group.action === "job.auto_clock_out_flagged") data.flagged = group._count._all;
      }
    }

    res.status(200).json({
      success: true,
      message: "Job status",
      data,
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

export default {
  runAutoClockOutJob,
  jobStatus,
};
