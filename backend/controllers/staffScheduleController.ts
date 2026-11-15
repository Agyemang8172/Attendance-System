import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { callerBusinessId } from "../utils/tenant.js";
import { logError } from "../utils/logger.js";
import { businessDateStart, nextBusinessDate } from "../utils/assignmentDates.js";

/**
 * GET /api/staff/schedule (M8-R2)
 *
 * Returns the caller's shift assignments within a date range, joined with
 * shift details (name, startMinute, endMinute, crossesMidnight).
 *
 * Query: startDate (required, YYYY-MM-DD), endDate (required, YYYY-MM-DD), max 190 days
 * Auth: staff token required, scopes to callerBusinessId + callerUserId
 */
export const getMySchedule = async (req: Request, res: Response): Promise<void> => {
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

    const { startDate, endDate } = req.query as { startDate: string; endDate: string };

    const business = await prisma.business.findFirst({ where: { id: businessId }, select: { timezone: true } });
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }
    const start = businessDateStart(startDate, business.timezone);
    const end = businessDateStart(nextBusinessDate(endDate), business.timezone);

    // Find shift assignments for this user that overlap with the date range
    // Half-open overlap excludes empty cancelled intervals.
    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        businessId,
        userId: caller.userId,
        effectiveFrom: { lt: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: start } }],
      },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            startMinute: true,
            endMinute: true,
            crossesMidnight: true,
            isActive: true,
          },
        },
      },
      orderBy: { effectiveFrom: "asc" },
    });

    res.status(200).json({
      success: true,
      data: assignments.filter((row) => row.effectiveTo === null || row.effectiveTo > row.effectiveFrom),
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "staff-schedule-get" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/**
 * GET /api/staff/off-days (M8-R2)
 *
 * Returns calendar exceptions (holidays/overrides) for the caller's business
 * within a date range, where kind = HOLIDAY or WORKING_OVERRIDE.
 *
 * Query: startDate (required, YYYY-MM-DD), endDate (required, YYYY-MM-DD), max 190 days
 * Auth: staff token required, scopes to callerBusinessId
 */
export const getMyOffDays = async (req: Request, res: Response): Promise<void> => {
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

    const { startDate, endDate } = req.query as { startDate: string; endDate: string };

    // Parse dates at UTC midnight for consistent day-boundary queries
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    // Find calendar exceptions for this business within the date range
    // Only return HOLIDAY and WORKING_OVERRIDE kinds (off-days from WorkCalendar + CalendarException)
    const exceptions = await prisma.calendarException.findMany({
      where: {
        businessId,
        date: { gte: start, lte: end },
        kind: { in: ["HOLIDAY", "WORKING_OVERRIDE"] },
      },
      include: {
        calendar: {
          select: {
            id: true,
            name: true,
            isDefault: true,
          },
        },
      },
      orderBy: { date: "asc" },
    });

    res.status(200).json({
      success: true,
      data: exceptions,
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "staff-off-days-get" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default {
  getMySchedule,
  getMyOffDays,
};
