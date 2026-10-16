import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog } from "../utils/logger.js";

/**
 * Load the caller's business_id so every calendar query is scoped to one tenant.
 */
const callerBusinessId = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });
  return user?.businessId ?? null;
};

// ── List calendars with exceptions ───────────────────────────────────

export const listCalendars = async (req: Request, res: Response): Promise<void> => {
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

    const calendars = await prisma.workCalendar.findMany({
      where: { businessId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        businessId: true,
        name: true,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
        timezone: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
        exceptions: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            calendarId: true,
            date: true,
            kind: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, data: calendars });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

// ── Update calendar ──────────────────────────────────────────────────

export const updateCalendar = async (req: Request, res: Response): Promise<void> => {
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

    const calendarId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.workCalendar.findUnique({
      where: { id: calendarId },
      select: { id: true, businessId: true, isDefault: true },
    });
    if (!existing || existing.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Calendar not found" });
      return;
    }

    const { name, monday, tuesday, wednesday, thursday, friday, saturday, sunday, timezone, isDefault } =
      req.body as {
        name?: string;
        monday?: boolean;
        tuesday?: boolean;
        wednesday?: boolean;
        thursday?: boolean;
        friday?: boolean;
        saturday?: boolean;
        sunday?: boolean;
        timezone?: string;
        isDefault?: boolean;
      };

    // At most one default calendar per business (O22). Marking a calendar
    // default clears the flag on whichever calendar holds it now.
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (monday !== undefined) data.monday = monday;
    if (tuesday !== undefined) data.tuesday = tuesday;
    if (wednesday !== undefined) data.wednesday = wednesday;
    if (thursday !== undefined) data.thursday = thursday;
    if (friday !== undefined) data.friday = friday;
    if (saturday !== undefined) data.saturday = saturday;
    if (sunday !== undefined) data.sunday = sunday;
    if (timezone !== undefined) data.timezone = timezone;
    if (isDefault !== undefined) data.isDefault = isDefault;

    const calendar = await prisma.$transaction(async (tx) => {
      if (isDefault === true && !existing.isDefault) {
        await tx.workCalendar.updateMany({
          where: { businessId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.workCalendar.update({
        where: { id: calendarId },
        data,
        select: { id: true, name: true, isDefault: true, updatedAt: true },
      });
    });

    auditLog.calendarUpdated(caller.userId, calendar.id, businessId);
    res.status(200).json({ success: true, data: calendar });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string; meta?: { target?: string[] } };
      if (err.code === "P2002") {
        // The name unique and the partial default index both surface as P2002;
        // name the constraint the caller actually collided with.
        const target = err.meta?.target?.join(",") ?? "";
        res.status(409).json({
          success: false,
          message: target.includes("is_default")
            ? "Another calendar is already the default for this business."
            : "A calendar with that name already exists in this business.",
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

// ── Create calendar exception ────────────────────────────────────────

export const createCalendarException = async (
  req: Request,
  res: Response
): Promise<void> => {
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

    const calendarId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { date, kind, name } = req.body as {
      date: string;
      kind: "HOLIDAY" | "WORKING_OVERRIDE";
      name: string;
    };

    const existing = await prisma.workCalendar.findUnique({
      where: { id: calendarId },
      select: { id: true, businessId: true },
    });
    if (!existing || existing.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Calendar not found" });
      return;
    }

    // Midnight UTC on the given calendar date. `@db.Date` stores the day, so
    // the exact instant only has to land on the right day. The round-trip
    // (build it, then read the parts back) catches impossible dates such as
    // 2026-02-30, which JavaScript would silently roll into March. The plain
    // isNaN check only catches broken formats, not rolled-over days.
    const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!parts) {
      res.status(400).json({ success: false, message: "Invalid date" });
      return;
    }
    const [, y, m, d] = parts.map(Number) as unknown as [string, number, number, number];
    const exceptionDate = new Date(Date.UTC(y, m - 1, d));
    if (exceptionDate.getUTCMonth() !== m - 1 || exceptionDate.getUTCDate() !== d) {
      res.status(400).json({ success: false, message: "Invalid date" });
      return;
    }

    const exception = await prisma.calendarException.create({
      data: {
        businessId,
        calendarId,
        date: exceptionDate,
        kind,
        name,
      },
      select: {
        id: true,
        calendarId: true,
        date: true,
        kind: true,
        name: true,
        createdAt: true,
      },
    });

    auditLog.calendarExceptionCreated(caller.userId, exception.id, businessId);
    res.status(201).json({ success: true, data: exception });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "An exception already exists for that calendar and date.",
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

export default {
  listCalendars,
  updateCalendar,
  createCalendarException,
};
