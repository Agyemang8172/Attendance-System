import express from "express";
import { changePin } from "../controllers/staffProfileController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import { createRateLimiter } from "../utils/rateLimit.js";
import { changePinSchema } from "../validators/index.js";

const router = express.Router();

/**
 * Staff self-service profile lane, mounted at `/api/staff/profile` (M8-R1).
 * Route table for this file:
 *   POST /api/staff/profile/change-pin   STAFF  change own kiosk PIN
 *
 * Auth: staff token required, still-on-temp-password gate, STAFF role only.
 */

/**
 * Rate limiter for PIN change — mirrors the kiosk pin limiter pattern
 * (15 min window, generous cap for self-service). Keyed on user ID + IP
 * so one account cannot be brute-forced from multiple addresses.
 */
const changePinLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyer: (req) => `pin-change:${req.user?.userId ?? "anon"}:${req.ip}`,
});

// POST /api/staff/profile/change-pin
router.post(
  "/change-pin",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF"),
  changePinLimiter,
  validate(changePinSchema),
  changePin
);

export default router;