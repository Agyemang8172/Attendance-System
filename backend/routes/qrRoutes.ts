import express from "express";
import qrController from "../controllers/qrController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import { employeeIdSchema, qrCredentialIdSchema } from "../validators/index.js";

const router = express.Router();

// Mounted at /api/business:
//   POST /api/business/employees/:id/qr-credential    issue (payload shown once)
//   POST /api/business/qr-credentials/:id/revoke      revoke
//
// SUPERADMIN only; O5 puts badge printing on SUPERADMIN, HR does not issue.

router.post(
  "/employees/:id/qr-credential",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(employeeIdSchema),
  qrController.issueQrCredential
);

router.post(
  "/qr-credentials/:id/revoke",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(qrCredentialIdSchema),
  qrController.revokeQrCredential
);

export default router;
