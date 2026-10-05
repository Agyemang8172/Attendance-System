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
import { validate } from "../middleware/validate.js";
import {
  clockInSchema,
  clockOutSchema,
  getMyAttendanceSchema,
  getAllAttendanceSchema,
  attendanceIdSchema,
} from "../validators/index.js";

const router = express.Router();

// ── Staff Routes ─────────────────────────────────────────────────────────────

// POST /api/attendance/clock-in
router.post(
  "/clock-in",
  authMiddleware,
  validate(clockInSchema),
  clockIn
);

// POST /api/attendance/clock-out
router.post(
  "/clock-out",
  authMiddleware,
  validate(clockOutSchema),
  clockOut
);

// GET /api/attendance/my-attendance
router.get(
  "/my-attendance",
  authMiddleware,
  validate(getMyAttendanceSchema),
  getMyAttendance
);

// ── HR / Admin Routes ────────────────────────────────────────────────────────

// GET /api/attendance/all-attendance
router.get(
  "/all-attendance",
  authMiddleware,
  authorizeRole("SUPERADMIN", "HR"),
  validate(getAllAttendanceSchema),
  getAllAttendance
);

// PATCH /api/attendance/:id/dismiss-alert
router.patch(
  "/:id/dismiss-alert",
  authMiddleware,
  validate(attendanceIdSchema),
  dismissAlert
);

export default router;