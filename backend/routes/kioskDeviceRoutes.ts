import express from "express";
import kioskDeviceController from "../controllers/kioskDeviceController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import kioskAuthMiddleware from "../middleware/kioskAuthMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import { createRateLimiter } from "../utils/rateLimit.js";
import {
  createKioskPairingSchema,
  kioskDeviceListQuerySchema,
  kioskPairSchema,
  kioskRevokeDeviceSchema,
} from "../validators/index.js";

const router = express.Router();

// Mounted at /api/kiosk (device management today; identify/verify land in the
// later phases at the same prefix).
//
// Route table (contracts §7):
//   POST /api/kiosk/pairing-codes        SUPERADMIN  issue a one-time code
//   POST /api/kiosk/pair                 public      redeem a code
//   POST /api/kiosk/token/renew          kiosk       rotate the device token
//   GET  /api/kiosk/devices              SUPERADMIN  list devices
//   POST /api/kiosk/devices/:id/revoke   SUPERADMIN  revoke a device

/**
 * Limits from the kiosk limiter table (kiosk §7), all per a kiosk-class lane
 * rather than raw IP where the kiosk middleware hands us a better key:
 *
 * - renewal is keyed on the kiosk id itself — the "token auth" row bounds
 *   brute force against one device without failing legitimate kiosks;
 * - pairing-code issue is keyed on the signed-in administrator — one admin
 *   page cannot spray codes;
 * - redemption stays IP-keyed: there is no kiosk id yet on a device that is
 *   not paired, and that is exactly the window brute force has to run in.
 */
const pairLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyer: (req) => `pair:${req.ip}`,
});

const pairingCodeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyer: (req) => `pairing-code:${req.user?.userId}:${req.ip}`,
});

const renewLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyer: (req) => `renew:${req.kiosk?.kioskId}:${req.ip}`,
});

// Public: an unpaired device has no session and no token, only the code.
router.post("/pair", pairLimiter, validate(kioskPairSchema), kioskDeviceController.pair);

// Device management is a SUPERADMIN action on the devices page; HR does not
// pair or revoke (O3).
router.post(
  "/pairing-codes",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  pairingCodeLimiter,
  validate(createKioskPairingSchema),
  kioskDeviceController.createPairingCode
);

router.post(
  "/token/renew",
  kioskAuthMiddleware,
  renewLimiter,
  kioskDeviceController.renewToken
);

router.get(
  "/devices",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(kioskDeviceListQuerySchema),
  kioskDeviceController.listDevices
);

router.post(
  "/devices/:id/revoke",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(kioskRevokeDeviceSchema),
  kioskDeviceController.revokeDevice
);

// The revoke route uses kioskRevokeDeviceSchema, which validates the device
// UUID param and the optional reason together. kioskDeviceIdSchema stays in
// validators for device-detail reads on the same param.

export default router;
