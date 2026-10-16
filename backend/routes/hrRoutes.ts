import express from "express";
import userController from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import { createUserSchema, updateUserSchema, resetPinSchema } from "../validators/index.js";

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

export default router;
