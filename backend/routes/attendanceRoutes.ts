import express from "express";
import { getAttendanceById } from "../controllers/attendanceDetailController.js";
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
import kioskAuthMiddleware from "../middleware/kioskAuthMiddleware.js";
import { validate } from "../middleware/validate.js";
import { createRateLimiter } from "../utils/rateLimit.js";
import {
  kioskClockInSchema,
  kioskClockOutSchema,
  getMyAttendanceSchema,
  getAllAttendanceSchema,
  attendanceIdSchema,
} from "../validators/index.js";

const router = express.Router();

// This namespace is mounted separately by server.ts. Leave the router so
// correction requests cannot be mistaken for attendance IDs, including GETs.
router.use("/corrections", (_req, _res, next) => next("router"));

/**
 * Limits per the kiosk limiter table (kiosk §7): the punch lane is keyed on
 * the device, because a kiosk token carries no employee identity until the
 * verification session is resolved inside the handler. Provisional ceiling —
 * the limbs are generous against a broken kiosk retrying, not a guessing
 * lane (each punch needs a single-use verified session).
 */
const punchLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyer: (req) => `punch:${req.kiosk?.kioskId}`,
});

// Route table (contracts §12):
//   POST /api/attendance/clock-in     kiosk   consume a VERIFIED session, open a row
//   POST /api/attendance/clock-out    kiosk   consume a VERIFIED session, close the row
//   GET  /api/attendance/my-attendance        STAFF self — read alias kept (§8 row)
//   GET  /api/attendance/all-attendance       HR/SUPERADMIN — read alias kept (§8 row)
//   GET  /api/attendance/:id                  own STAFF / business HR/SUPERADMIN
//   PATCH /api/attendance/:id/dismiss-alert   STAFF self/HR

// ── Kiosk punch routes ───────────────────────────────────────────────────────
// The device token replaces the user session as the punch credential (contracts
// §8, §12): an employee session token can no longer reach these routes, so the
// old authMiddleware + requirePasswordChange gates are deliberately absent —
// the kiosk-authenticated device proves nothing about any employee; the
// verified QR+PIN session does both.

// POST /api/attendance/clock-in
router.post(
  "/clock-in",
  kioskAuthMiddleware,
  punchLimiter,
  validate(kioskClockInSchema),
  clockIn
);

// POST /api/attendance/clock-out
router.post(
  "/clock-out",
  kioskAuthMiddleware,
  punchLimiter,
  validate(kioskClockOutSchema),
  clockOut
);

// ── Staff Routes ─────────────────────────────────────────────────────────────

// An account still holding the temporary credential has not finished signing
// in, so it records no attendance. Every read route here carries the gate.

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

// Static list paths and the correction namespace take precedence over IDs.
router.get(
  "/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF", "HR", "SUPERADMIN"),
  validate(attendanceIdSchema),
  getAttendanceById
);

export default router;
