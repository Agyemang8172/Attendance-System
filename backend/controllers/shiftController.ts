import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog } from "../utils/logger.js";

const MINUTE_MIN = 0;
const MINUTE_MAX = 1439;

/**
 * Load the caller's business_id so every shift query is scoped to one tenant.
 * The schema makes business_id NOT NULL on every user after migration 1, so a
 * caller without a business is a configuration problem, not a normal case.
 */
const callerBusinessId = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });
  return user?.businessId ?? null;
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

    const { isActive } = req.query as { isActive?: string };
    const where: Record<string, unknown> = { businessId };
    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { name: "asc" },
      select: shiftSelect,
    });

    res.status(200).json({ success: true, data: shifts });
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
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
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
      select: { id: true, businessId: true },
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
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
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
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

export default {
  listShifts,
  createShift,
  updateShift,
  deactivateShift,
};
