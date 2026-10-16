import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog } from "../utils/logger.js";

/**
 * Load the caller's business_id so every assignment query is scoped to one tenant.
 */
const callerBusinessId = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });
  return user?.businessId ?? null;
};

const assignmentSelect = {
  id: true,
  businessId: true,
  userId: true,
  shiftId: true,
  effectiveFrom: true,
  effectiveTo: true,
  assignedByUserId: true,
  createdAt: true,
};

// ── Create assignment ────────────────────────────────────────────────

export const createAssignment = async (
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

    const shiftId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { employeeId, effectiveFrom } = req.body as {
      employeeId: string;
      effectiveFrom: string;
    };

    // The shift must exist in this tenant.
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true, businessId: true },
    });
    if (!shift || shift.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Shift not found" });
      return;
    }

    // The employee must exist in this tenant and be active.
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, businessId: true, isActive: true },
    });
    if (!employee || employee.businessId !== businessId || !employee.isActive) {
      res.status(404).json({ success: false, message: "Employee not found" });
      return;
    }

    const effectiveFromDate = new Date(effectiveFrom);
    if (isNaN(effectiveFromDate.getTime())) {
      res.status(400).json({ success: false, message: "Invalid effective from date" });
      return;
    }

    // One transaction: close the employee's open assignment, insert the new
    // one, and keep the users.shift_id pointer in sync.
    const assignment = await prisma.$transaction(async (tx) => {
      await tx.shiftAssignment.updateMany({
        where: {
          userId: employeeId,
          businessId,
          effectiveTo: null,
        },
        data: { effectiveTo: effectiveFromDate },
      });

      const created = await tx.shiftAssignment.create({
        data: {
          businessId,
          userId: employeeId,
          shiftId,
          effectiveFrom: effectiveFromDate,
          assignedByUserId: caller.userId,
        },
        select: assignmentSelect,
      });

      await tx.user.update({
        where: { id: employeeId },
        data: { shiftId },
      });

      return created;
    });

    auditLog.assignmentCreated?.(caller.userId, assignment.id, businessId);
    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "An assignment already exists for this employee and shift.",
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

// ── List assignments ─────────────────────────────────────────────────

export const listAssignments = async (
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

    const { employeeId } = req.query as { employeeId?: string };
    const where: Record<string, unknown> = { businessId };
    if (employeeId) where.userId = employeeId;

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      orderBy: { effectiveFrom: "desc" },
      select: {
        ...assignmentSelect,
        user: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        },
        shift: {
          select: { id: true, name: true, startMinute: true, endMinute: true },
        },
      },
    });

    res.status(200).json({ success: true, data: assignments });
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

// ── Deactivate (soft-close) assignment ───────────────────────────────

export const deactivateAssignment = async (
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

    const assignmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, businessId: true, effectiveTo: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Assignment not found" });
      return;
    }

    if (existing.businessId !== businessId) {
      res.status(403).json({ success: false, message: "Access Denied" });
      return;
    }

    if (existing.effectiveTo !== null) {
      res.status(400).json({ success: false, message: "Assignment already closed" });
      return;
    }

    const assignment = await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: { effectiveTo: new Date() },
      select: assignmentSelect,
    });

    auditLog.assignmentDeactivated?.(caller.userId, assignment.id, businessId);
    res.status(200).json({ success: true, message: "Assignment closed", data: assignment });
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
  createAssignment,
  listAssignments,
  deactivateAssignment,
};
