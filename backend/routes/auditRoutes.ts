import express from "express";
import auditController from "../controllers/auditController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import {
  attendanceAuditQuerySchema,
  auditListQuerySchema,
  auditIdSchema,
} from "../validators/index.js";

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

// M8-R4 — the generic listing. Tenant-scoped and paginated; HR sees the
// supervised subset, SUPERADMIN the whole trail (scope applied in the handler).
router.get(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(auditListQuerySchema),
  auditController.listAudit
);

// M1 matrix §11 — one audit row. Same roles; HR gets the same 404 for a row
// outside its subset as for a row that does not exist.
router.get(
  "/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(auditIdSchema),
  auditController.getAuditById
);

export default router;
