import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog } from "../utils/logger.js";
import { callerBusinessId } from "../utils/tenant.js";

const MINUTE_MIN = 0;
const MINUTE_MAX = 1439;

/**
 * The `start_time` / `end_time` TEXT columns predate the minute-of-day pair and
 * are still NOT NULL in the database, even though the Prisma model marks them
 * optional. A create that omits them fails with a not-null violation, so every
 * write mirrors the minute values into the legacy columns until an approved
 * destructive migration removes them (M9-B2).
 */
const minutesToClock = (minute: number): string => {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const shiftSelect = {
  id: true,
  businessId: true,
  name: true,
  startMinute: true,
  endMinute: true,
  crossesMidnight: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

// ── List shifts ──────────────────────────────────────────────────────

export const listShifts = async (req: Request, res: Response): Promise<void> => {
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

    const { isActive, search, page, limit } = req.query as unknown as {
      isActive?: "true" | "false";
      search?: string;
      page: number;
      limit: number;
    };
    const where = {
      businessId,
      ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: shiftSelect,
      }),
      prisma.shift.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: shifts,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalRecords: total },
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

// ── Create shift ─────────────────────────────────────────────────────

export const createShift = async (req: Request, res: Response): Promise<void> => {
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

    const { name, startMinute, endMinute, crossesMidnight } = req.body as {
      name: string;
      startMinute: number;
      endMinute: number;
      crossesMidnight?: boolean;
    };

    const shift = await prisma.shift.create({
      data: {
        businessId,
        name,
        startMinute,
        endMinute,
        // Legacy NOT NULL TEXT columns — see minutesToClock above.
        startTime: minutesToClock(startMinute),
        endTime: minutesToClock(endMinute),
        crossesMidnight: crossesMidnight ?? false,
        isActive: true,
      },
      select: shiftSelect,
    });

    auditLog.shiftCreated?.(caller.userId, shift.id, businessId);
    res.status(201).json({ success: true, data: shift });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "A shift with that name already exists in this business.",
        });
        return;
      }
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Update shift ─────────────────────────────────────────────────────

export const updateShift = async (req: Request, res: Response): Promise<void> => {
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

    const shiftId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true, businessId: true, startMinute: true, endMinute: true, crossesMidnight: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Shift not found" });
      return;
    }

    if (existing.businessId !== businessId) {
      res.status(403).json({ success: false, message: "Access Denied" });
      return;
    }

    const { name, startMinute, endMinute, crossesMidnight, isActive } = req.body as {
      name?: string;
      startMinute?: number;
      endMinute?: number;
      crossesMidnight?: boolean;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (startMinute !== undefined) data.startMinute = startMinute;
    if (endMinute !== undefined) data.endMinute = endMinute;
    if (crossesMidnight !== undefined) data.crossesMidnight = crossesMidnight;
    if (isActive !== undefined) data.isActive = isActive;

    // The geometry rule must hold on the merged shift, not on the patch
    // alone: a PATCH that moves only the end minute can silently flip an
    // ordinary shift into one that ends before it starts. Stored values are
    // overridden by the payload fields, same rules as createShiftSchema.
    const mergedStart =
      startMinute !== undefined ? startMinute : existing.startMinute;
    const mergedEnd =
      endMinute !== undefined ? endMinute : existing.endMinute;
    const mergedCrossesMidnight =
      crossesMidnight !== undefined ? crossesMidnight : existing.crossesMidnight;

    // Keep the legacy NOT NULL TEXT columns in step with the minute pair.
    if (startMinute !== undefined || endMinute !== undefined) {
      data.startTime = minutesToClock(mergedStart);
      data.endTime = minutesToClock(mergedEnd);
    }

    const geometryIsConsistent =
      mergedEnd < mergedStart
        ? mergedCrossesMidnight === true
        : mergedEnd > mergedStart
          ? mergedCrossesMidnight === false
          : mergedCrossesMidnight === true; // start == end is the full-day edge

    if (!geometryIsConsistent) {
      res.status(400).json({
        success: false,
        message:
          "crossesMidnight must be true when the shift ends at or before it starts, and false when it ends after it starts",
      });
      return;
    }

    const shift = await prisma.shift.update({
      where: { id: shiftId },
      data,
      select: shiftSelect,
    });

    auditLog.shiftUpdated?.(caller.userId, shift.id, businessId);
    res.status(200).json({ success: true, data: shift });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "A shift with that name already exists in this business.",
        });
        return;
      }
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Deactivate shift ─────────────────────────────────────────────────

export const deactivateShift = async (req: Request, res: Response): Promise<void> => {
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

    const shiftId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true, businessId: true, isActive: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Shift not found" });
      return;
    }

    if (existing.businessId !== businessId) {
      res.status(403).json({ success: false, message: "Access Denied" });
      return;
    }

    // Never delete a shift — deactivate only. History (attendance snapshots)
    // keeps pointing at this row, so a hard delete would orphan it.
    const shift = await prisma.shift.update({
      where: { id: shiftId },
      data: { isActive: false },
      select: shiftSelect,
    });

    auditLog.shiftDeactivated?.(caller.userId, shift.id, businessId);
    res.status(200).json({ success: true, message: "Shift deactivated", data: shift });
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
  listShifts,
  createShift,
  updateShift,
  deactivateShift,
};
