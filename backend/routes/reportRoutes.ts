import express from "express";
import reportController from "../controllers/reportController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import {
  registerQuerySchema,
  punctualityQuerySchema,
  exceptionsQuerySchema,
  csvExportQuerySchema,
} from "../validators/index.js";

const router = express.Router();

// ── M7 — reports (contracts §10) ─────────────────────────────────────────────
// Every row mirrors the established gate order from hrRoutes.ts: an account
// still on its temporary password cannot pull a register first, and HR and
// SUPERADMIN are the only roles the reports surface answers to. The tenant
// scoping itself lives inside the handlers (callerBusinessId), as everywhere
// else.

// The export route is declared before the plain register route so the two
// sibling paths can never shadow each other whatever router version does the
// matching.
router.get(
  "/attendance-register/export",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(csvExportQuerySchema),
  reportController.attendanceRegisterCsv
);

// The paginated register, newest first.
router.get(
  "/attendance-register",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(registerQuerySchema),
  reportController.attendanceRegister
);

// Counts of the status buckets, grouped by employee, shift or day.
router.get(
  "/punctuality-summary",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(punctualityQuerySchema),
  reportController.punctualitySummary
);

// Review-flagged rows plus OUTSIDE/UNKNOWN location attempts.
router.get(
  "/exceptions",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(exceptionsQuerySchema),
  reportController.exceptionsReport
);

export default router;
