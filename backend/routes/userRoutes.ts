import express from "express";
import userController from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  getUsersQuerySchema,
  getUserByIdSchema,
  changePasswordSchema,
} from "../validators/index.js";

const router = express.Router();

// ⚠️ Route ordering matters: static routes BEFORE parameterized routes

// GET /api/users — list all (HR / SUPERADMIN)
router.get(
  "/",
  authMiddleware,
  authorizeRole("SUPERADMIN", "HR"),
  validate(getUsersQuerySchema),
  userController.getAllUsers
);

// POST /api/users — create (SUPERADMIN only)
router.post(
  "/",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(createUserSchema),
  userController.createUser
);

// PUT /api/users/change-password — own password (authenticated)
// MUST be before /:id to avoid matching "change-password" as an ID
router.put(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  userController.changePassword
);

// GET /api/users/:id — single user (authenticated)
router.get(
  "/:id",
  authMiddleware,
  authorizeRole("SUPERADMIN", "HR", "STAFF"),
  validate(getUserByIdSchema),
  userController.getUserById
);

// PUT /api/users/:id — update user (SUPERADMIN / HR)
router.put(
  "/:id",
  authMiddleware,
  authorizeRole("SUPERADMIN", "HR"),
  validate(updateUserSchema),
  userController.updateUser
);

// DELETE /api/users/:id — deactivate user (SUPERADMIN only)
router.delete(
  "/:id",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(deleteUserSchema),
  userController.deleteUser
);

export default router;