import express from "express";
import { createCorrection } from "../controllers/correctionController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import { createCorrectionSchema } from "../validators/index.js";

const router = express.Router();

/**
 * Correction submission (contracts §8): STAFF and HR acting on their own
 * records only. SUPERADMIN is not on the §8 row, so it is not granted here.
 * Route table for this file:
 *   POST /api/attendance/corrections   STAFF, HR (self)   submit a correction
 */

// POST /api/attendance/corrections
router.post(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF", "HR"),
  validate(createCorrectionSchema),
  createCorrection
);

export default router;
