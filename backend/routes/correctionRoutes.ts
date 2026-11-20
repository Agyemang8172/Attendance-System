import express from "express";
import { createCorrection, getOwnCorrectionDetail, listMyCorrections } from "../controllers/correctionController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import { correctionIdSchema, createCorrectionSchema, listCorrectionsQuerySchema } from "../validators/index.js";

const router = express.Router();

/**
 * Correction submission (contracts §8): STAFF and HR acting on their own
 * records only. SUPERADMIN is not on the §8 row, so it is not granted here.
 * Route table for this file:
 *   POST /api/attendance/corrections   STAFF, HR (self)   submit a correction
 *   GET  /api/attendance/corrections   STAFF, HR (self)   list own corrections
 *   GET  /api/attendance/corrections/:id   STAFF, HR (self)   read own correction
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

router.get(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF", "HR"),
  validate(listCorrectionsQuerySchema),
  listMyCorrections
);

router.get(
  "/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF", "HR"),
  validate(correctionIdSchema),
  getOwnCorrectionDetail
);

export default router;
