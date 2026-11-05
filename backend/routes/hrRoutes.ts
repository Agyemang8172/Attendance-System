import express from "express";
import userController from "../controllers/userController.js";
import {
  getBusinessHelpRequest,
  listBusinessHelpRequests,
  updateHelpRequest,
} from "../controllers/helpRequestController.js";
import {
  listBusinessCorrections,
  decideCorrection,
} from "../controllers/correctionController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import {
  createUserSchema,
  updateUserSchema,
  resetPinSchema,
  listHelpRequestsQuerySchema,
  helpRequestIdSchema,
  updateHelpRequestSchema,
  listCorrectionsQuerySchema,
  correctionDecisionSchema,
} from "../validators/index.js";

const router = express.Router();

// The employee endpoints reuse the `userController` handlers already mounted at
// /api/users: list, create and update carry the same HR-is-scoped-to-STAFF and
// last-superadmin rules, so a second implementation would only be a second
// chance for the two copies to drift apart. The tenant scoping lives inside the
// handlers. Only the PIN reset here is a new capability.

// List employees. Same gate as GET /api/users: an account still on its
// temporary password cannot read the directory first.
router.get(
  "/employees",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  userController.getAllUsers
);

// Create an employee; the server generates the first password.
router.post(
  "/employees",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(createUserSchema),
  userController.createUser
);

// Update an employee.
router.patch(
  "/employees/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(updateUserSchema),
  userController.updateUser
);

// Audited kiosk PIN reset; the new PIN is never in the response.
router.post(
  "/users/:id/reset-pin",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(resetPinSchema),
  userController.resetPin
);

// ── M7 — help requests (contracts §4) ────────────────────────────────────────
// Same login posture as every other HR row above: an account still carrying
// its temporary password clears it before reading the queue.

// Business-wide queue, newest first, with who raised each one.
router.get(
  "/help-requests",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(listHelpRequestsQuerySchema),
  listBusinessHelpRequests
);

router.get(
  "/help-requests/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(helpRequestIdSchema),
  getBusinessHelpRequest
);

// Decide a request: status move plus an optional resolution note, audited.
router.patch(
  "/help-requests/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(updateHelpRequestSchema),
  updateHelpRequest
);

// ── M7 — corrections (contracts §4) ──────────────────────────────────────────

// The business-wide correction queue, newest first, with the requester's
// name and the employee the corrected record belongs to.
router.get(
  "/corrections",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(listCorrectionsQuerySchema),
  listBusinessCorrections
);

// The decision endpoint (lifecycle §8.3, O17 + the O21 backstop). The
// no-self-approval, tier and backstop gates live inside the handler, next
// to the matrix that documents them.
router.patch(
  "/corrections/:id/decision",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("HR", "SUPERADMIN"),
  validate(correctionDecisionSchema),
  decideCorrection
);

export default router;
