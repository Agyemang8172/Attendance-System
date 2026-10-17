import express from "express";
import auditController from "../controllers/auditController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import { attendanceAuditQuerySchema } from "../validators/index.js";

const router = express.Router();

// ── M7 Phase 3 — audit (contracts §11) ───────────────────────────────────────
// Mounted at /api/audit (contracts §11; nothing else owns that prefix). One
// gate order copied from hrRoutes/reportRoutes: an account still on its
// temporary password cannot read history first, and both the §11 correction-
// trail rows' roles (HR, SUPERADMIN) are stated here at the gate. The tenant
// scoping lives inside the handler (callerBusinessId), as everywhere else.

// The correction trail: the corrections on one attendance row, each with its
// append-only revisions and the decision audit rows, in one assembled view.
// SUPERADMIN and HR per the contract row.
router.get(
  "/corrections/:attendanceId",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(attendanceAuditQuerySchema),
  auditController.getCorrectionTrail
);

export default router;
