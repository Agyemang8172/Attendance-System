import express from "express";
import businessController from "../controllers/businessController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import { updateBusinessSettingsSchema } from "../validators/index.js";

const router = express.Router();

// ── M7 Phase 3 — business settings (contracts §5 rows 1-2) ───────────────────
// Mounted at /api/business alongside the assignment and QR routers (see
// server.ts): this file defines only the `/settings` subpaths, so its routes
// can never shadow those routers' paths and vice versa. Retention rides this
// surface per O10 — config only, stored and audited; nothing is ever deleted
// in this milestone.

// Read the caller's own business settings (SUPERADMIN per the contract row).
// The contract asks for no request fields ("none"), so no validate() runs —
// `businessSettingsQuerySchema` marks that omission deliberate.
router.get(
  "/settings",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  businessController.getBusinessSettings
);

// Update them; the same gate order as every other router (login posture
// first, then the role the contract row grants: SUPERADMIN only).
router.patch(
  "/settings",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(updateBusinessSettingsSchema),
  businessController.updateBusinessSettings
);

export default router;
