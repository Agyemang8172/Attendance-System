import type { Request, Response } from "express";
import type { Prisma } from "../generated/prisma/index.js";
import prisma from "../config/prismaClient.js";
import { attendanceLogger } from "../utils/logger.js";

const DETAIL_SELECT = {
  id: true, userId: true, date: true, clockIn: true, clockOut: true,
  hoursWorked: true, status: true, sessionStatus: true, closureReason: true,
  requiresReviewReason: true, remarks: true, createdAt: true, updatedAt: true,
  shiftId: true, shiftNameSnapshot: true, shiftStartMinuteSnapshot: true,
  shiftEndMinuteSnapshot: true, shiftCrossesMidnightSnapshot: true,
  timezoneSnapshot: true, graceEarlyMinutesSnapshot: true,
  graceLateMinutesSnapshot: true, policyVersionId: true, policySnapshot: true,
  checkInLat: true, checkInLng: true,
  user: { select: { id: true, businessId: true, employeeCode: true, firstName: true, lastName: true } },
  createdByKiosk: { select: { id: true, businessId: true, label: true, publicId: true } },
} satisfies Prisma.AttendanceSelect;

type DetailRecord = Prisma.AttendanceGetPayload<{ select: typeof DETAIL_SELECT }>;

const POLICY_NUMBERS = [
  "versionNumber", "graceEarlyMinutes", "graceLateMinutes",
  "autoClockOutBufferMinutes", "autoClockOutMaxOpenMinutes", "correctionWindowDays",
  "geoFenceRadiusMeters", "locationAccuracyThresholdMeters", "gpsFreshnessSeconds",
] as const;

// Only fields written by the existing punch snapshot writer can leave this read.
const safePolicySnapshot = (value: Prisma.JsonValue): Prisma.JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Prisma.JsonObject = {};
  for (const key of POLICY_NUMBERS) {
    const field = value[key];
    if (field === null || (typeof field === "number" && Number.isFinite(field))) result[key] = field;
  }
  if (typeof value.autoClockOutEnabled === "boolean") result.autoClockOutEnabled = value.autoClockOutEnabled;
  if (typeof value.effectiveFrom === "string" && Number.isFinite(Date.parse(value.effectiveFrom))) {
    result.effectiveFrom = value.effectiveFrom;
  }
  return Object.keys(result).length ? result : null;
};

const safeRelations = (row: DetailRecord, businessId: string) => ({
  user: row.user?.businessId === businessId ? {
    id: row.user.id, employeeCode: row.user.employeeCode,
    firstName: row.user.firstName, lastName: row.user.lastName,
  } : null,
  createdByKiosk: row.createdByKiosk?.businessId === businessId ? {
    id: row.createdByKiosk.id, label: row.createdByKiosk.label, publicId: row.createdByKiosk.publicId,
  } : null,
});

const detailData = (row: DetailRecord, businessId: string) => ({
  id: row.id, userId: row.userId, date: row.date, clockIn: row.clockIn, clockOut: row.clockOut,
  hoursWorked: row.hoursWorked, status: row.status, sessionStatus: row.sessionStatus,
  closureReason: row.closureReason, requiresReviewReason: row.requiresReviewReason,
  remarks: row.remarks, createdAt: row.createdAt, updatedAt: row.updatedAt,
  shiftId: row.shiftId, shiftNameSnapshot: row.shiftNameSnapshot,
  shiftStartMinuteSnapshot: row.shiftStartMinuteSnapshot, shiftEndMinuteSnapshot: row.shiftEndMinuteSnapshot,
  shiftCrossesMidnightSnapshot: row.shiftCrossesMidnightSnapshot, timezoneSnapshot: row.timezoneSnapshot,
  graceEarlyMinutesSnapshot: row.graceEarlyMinutesSnapshot, graceLateMinutesSnapshot: row.graceLateMinutesSnapshot,
  policyVersionId: row.policyVersionId, policySnapshot: safePolicySnapshot(row.policySnapshot),
  checkInLat: row.checkInLat, checkInLng: row.checkInLng,
  ...safeRelations(row, businessId),
});

const allowedCaller = (req: Request, res: Response): boolean => {
  if (!req.user?.userId || !req.user.businessId || !req.user.isActive) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return false;
  }
  if (!["STAFF", "HR", "SUPERADMIN"].includes(req.user.role)) {
    res.status(403).json({ success: false, message: "Access Denied" });
    return false;
  }
  if (req.user.mustChangePassword !== false) {
    res.status(403).json({ success: false, code: "PASSWORD_CHANGE_REQUIRED", message: "Password change required" });
    return false;
  }
  return true;
};

export const getAttendanceById = async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  if (!allowedCaller(req, res) || !req.user) return;
  const id = req.params.id;
  if (typeof id !== "string") {
    res.status(400).json({ success: false, message: "Invalid attendance ID format" });
    return;
  }
  try {
    const row = await prisma.attendance.findFirst({
      where: { id, businessId: req.user.businessId }, select: DETAIL_SELECT,
    });
    if (!row) {
      res.status(404).json({ success: false, message: "Attendance record not found" });
      return;
    }
    if (req.user.role === "STAFF" && row.userId !== req.user.userId) {
      res.status(403).json({ success: false, message: "Access Denied" });
      return;
    }
    res.status(200).json({ success: true, data: detailData(row, req.user.businessId) });
  } catch {
    attendanceLogger.error({ event: "attendance_detail_failed" }, "Attendance detail read failed");
    res.status(500).json({ success: false, message: "Server error" });
  }
};
