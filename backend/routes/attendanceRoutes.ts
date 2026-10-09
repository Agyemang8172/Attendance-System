import express from "express";
import {
  clockIn,
  clockOut,
  getMyAttendance,
  getAllAttendance,
  dismissAlert,
} from "../controllers/attendanceController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import {
  clockInSchema,
  clockOutSchema,
  getMyAttendanceSchema,
  getAllAttendanceSchema,
  attendanceIdSchema,
} from "../validators/index.js";

const router = express.Router();

// An account still holding the temporary credential has not finished signing
// in, so it records no attendance. Every route here carries the gate; clocking
// in is the first thing a person does after setting their password, not before.

// ── Staff Routes ─────────────────────────────────────────────────────────────

// POST /api/attendance/clock-in
router.post(
  "/clock-in",
  authMiddleware,
  requirePasswordChange(),
  validate(clockInSchema),
  clockIn
);

// POST /api/attendance/clock-out
router.post(
  "/clock-out",
  authMiddleware,
  requirePasswordChange(),
  validate(clockOutSchema),
  clockOut
);

// GET /api/attendance/my-attendance
router.get(
  "/my-attendance",
  authMiddleware,
  requirePasswordChange(),
  validate(getMyAttendanceSchema),
  getMyAttendance
);

// ── HR / Admin Routes ────────────────────────────────────────────────────────

// GET /api/attendance/all-attendance
router.get(
  "/all-attendance",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR"),
  validate(getAllAttendanceSchema),
  getAllAttendance
);

// PATCH /api/attendance/:id/dismiss-alert
router.patch(
  "/:id/dismiss-alert",
  authMiddleware,
  requirePasswordChange(),
  validate(attendanceIdSchema),
  dismissAlert
);

export default router;
