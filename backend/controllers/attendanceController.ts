import prisma from "../config/prismaClient.js";
import { Request, Response } from "express";

// ── Ensure user is authenticated ──────────────────────────────────────────────
const getUserId = (req: Request): string | null => {
  if (!req.user) return null;
  return req.user.userId;
};

// ── Clock In ──────────────────────────────────────────────────────────────────
export const clockIn = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    // Check for open session
    const openSession = await prisma.attendance.findFirst({
      where: { userId, sessionStatus: "OPEN" },
    });

    if (openSession) {
      res.status(400).json({
        success: false,
        message: "You already have an active session open. Clock out first",
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { checkInIp, checkInLat, checkInLng, remarks } = req.body;

    const record = await prisma.attendance.create({
      data: {
        userId,
        clockIn: new Date(),
        date: today,
        sessionStatus: "OPEN",
        status: "PRESENT",
        checkInIp: checkInIp || null,
        checkInLat: checkInLat || null,
        checkInLng: checkInLng || null,
        remarks: remarks || null,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Clock in successful",
      data: record,
    });
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

// ── Clock Out ─────────────────────────────────────────────────────────────────
export const clockOut = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const clockOutTime = new Date();

    const openSession = await prisma.attendance.findFirst({
      where: { userId, sessionStatus: "OPEN" },
    });

    if (!openSession) {
      res.status(404).json({
        success: false,
        message: "You need to have an active session open first",
      });
      return;
    }

    const hoursWorked =
      (clockOutTime.getTime() - openSession.clockIn.getTime()) /
      (1000 * 60 * 60);

    const updatedRecord = await prisma.attendance.update({
      where: { id: openSession.id },
      data: {
        clockOut: clockOutTime,
        sessionStatus: "CLOSED",
        hoursWorked,
        remarks: req.body.remarks || openSession.remarks,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Clock out successful",
      data: updatedRecord,
    });
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

// ── My Attendance (for staff) ─────────────────────────────────────────────────
export const getMyAttendance = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { startDate, endDate } = req.query;
    const page = parseInt((req.query.page as string) || "1") || 1;
    const limit = parseInt((req.query.limit as string) || "50") || 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (startDate && endDate) {
      where.clockIn = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    } else if (startDate) {
      where.clockIn = { gte: new Date(startDate as string) };
    } else if (endDate) {
      where.clockIn = { lte: new Date(endDate as string) };
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where: where as any,
        orderBy: { clockIn: "desc" },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      count: records.length,
      total,
      page,
      data: records,
    });
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

// ── All Attendance (for HR / superadmin) ──────────────────────────────────────
export const getAllAttendance = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, userId, department, sessionStatus, status } = req.query;
    const page = parseInt((req.query.page as string) || "1") || 1;
    const limit = parseInt((req.query.limit as string) || "50") || 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (startDate && endDate) {
      where.clockIn = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    } else if (startDate) {
      where.clockIn = { gte: new Date(startDate as string) };
    } else if (endDate) {
      where.clockIn = { lte: new Date(endDate as string) };
    }

    if (userId) where.userId = userId;
    if (sessionStatus) where.sessionStatus = sessionStatus;
    if (status) where.status = status;

    if (department) {
      where.user = { department } as any;
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where: where as any,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              department: true,
              role: true,
            },
          },
        },
        orderBy: { clockIn: "desc" },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      count: records.length,
      total,
      page,
      data: records,
    });
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

// ── Dismiss auto-clockout alert ───────────────────────────────────────────────
export const dismissAlert = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const record = await prisma.attendance.findFirst({
      where: { id, userId },
    });

    if (!record) {
      res.status(404).json({ success: false, message: "Record not found" });
      return;
    }

    // Mark the alert as dismissed by updating the record
    // Using remarks field to track dismissal
    await prisma.attendance.update({
      where: { id },
      data: {
        remarks: record.remarks
          ? `${record.remarks} | alert_dismissed:${new Date().toISOString()}`
          : `alert_dismissed:${new Date().toISOString()}`,
      },
    });

    res.status(200).json({ success: true, message: "Alert dismissed" });
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