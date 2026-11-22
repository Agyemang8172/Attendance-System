import express from "express";
import { getMySchedule, getMyOffDays } from "../controllers/staffScheduleController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import { staffScheduleQuerySchema } from "../validators/index.js";

const router = express.Router();

/**
 * Staff self-service schedule lane, mounted at `/api/staff` (M8-R2).
 * Route table for this file:
 *   GET /api/staff/schedule   STAFF  own shift assignments within date range
 *   GET /api/staff/off-days   STAFF  business off-days (holidays/overrides) within date range
 *
 * Auth: staff token required, still-on-temp-password gate, STAFF role only.
 * Both endpoints share the same query validator (startDate, endDate, max 190 days).
 */

// GET /api/staff/schedule
router.get(
  "/schedule",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF"),
  validate(staffScheduleQuerySchema),
  getMySchedule
);

// GET /api/staff/off-days
router.get(
  "/off-days",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF"),
  validate(staffScheduleQuerySchema),
  getMyOffDays
);

export default router;