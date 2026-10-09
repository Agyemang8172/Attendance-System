import express from "express";
import userController from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  getUsersQuerySchema,
  getUserByIdSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "../validators/index.js";

const router = express.Router();

// Route ordering matters: static routes BEFORE parameterized routes, because
// "/change-password" would otherwise be captured by "/:id" as an ID.

// HR creates accounts too, but only staff ones — `createUser` scopes it.
// Refusing HR outright here was blocking the one thing HR exists to do, while
// the real protection lives in the controller where the target's role is known.
router.post(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR"),
  validate(createUserSchema),
  userController.createUser
);

// Own password. The one route an account mid-forced-change is allowed to reach.
router.put(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  userController.changePassword
);

// Administrative reset. SUPERADMIN may reset anyone; HR is scoped to staff.
router.put(
  "/:id/reset-password",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR"),
  validate(resetPasswordSchema),
  userController.resetPassword
);

// GET /api/users — list (HR sees staff only, enforced in the controller)
router.get(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR"),
  validate(getUsersQuerySchema),
  userController.getAllUsers
);

// GET /api/users/:id — single user (ownership checked in the controller)
router.get(
  "/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR", "STAFF"),
  validate(getUserByIdSchema),
  userController.getUserById
);

// PUT /api/users/:id — update user (HR scoped to staff in the controller)
router.put(
  "/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR"),
  validate(updateUserSchema),
  userController.updateUser
);

// DELETE /api/users/:id — deactivate (HR scoped to staff in the controller)
router.delete(
  "/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR"),
  validate(deleteUserSchema),
  userController.deleteUser
);

export default router;
