import express from "express";
import kioskVerifyController from "../controllers/kioskVerifyController.js";
import kioskAuthMiddleware from "../middleware/kioskAuthMiddleware.js";
import { validate } from "../middleware/validate.js";
import { createRateLimiter } from "../utils/rateLimit.js";
import {
  kioskCancelSchema,
  kioskIdentifySchema,
  kioskVerifyPinSchema,
} from "../validators/index.js";

const router = express.Router();

// Mounted at /api/kiosk alongside the device routes (contracts §7). Route
// table for this file:
//   POST /api/kiosk/identify     kiosk  read a badge, open a 2-minute session
//   POST /api/kiosk/verify-pin   kiosk  turn the session into a verified one
//   POST /api/kiosk/cancel       kiosk  abandon a session

/**
 * Limits from the kiosk limiter table (kiosk §7); the numeric entries are
 * provisional pending R5, which owes the final PIN policy:
 *
 * - identify takes the "kiosk identify" row, keyed `identify:<kioskId>` —
 *   stopping one device spraying QR lookups;
 * - verify-pin: the §7 "pin verify" row is keyed on the employee, but the
 *   employee only becomes known after the session is resolved inside the
 *   handler, so the in-memory limiter here is keyed `pin:<kioskId>` and the
 *   per-employee bound rides on the session's own pinAttemptCount plus the
 *   user's pinFailedCount/pinLockedUntil (kiosk §5.2);
 * - cancel sits out the table on purpose: it writes nothing until a live
 *   session is found, so there is no guessing lane to bound.
 */
const identifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyer: (req) => `identify:${req.kiosk?.kioskId}`,
});

const pinLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 150,
  keyer: (req) => `pin:${req.kiosk?.kioskId}`,
});

router.post(
  "/identify",
  kioskAuthMiddleware,
  identifyLimiter,
  validate(kioskIdentifySchema),
  kioskVerifyController.identify
);

router.post(
  "/verify-pin",
  kioskAuthMiddleware,
  pinLimiter,
  validate(kioskVerifyPinSchema),
  kioskVerifyController.verifyPin
);

router.post(
  "/cancel",
  kioskAuthMiddleware,
  validate(kioskCancelSchema),
  kioskVerifyController.cancel
);

export default router;
