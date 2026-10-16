import express from "express";
import assignmentController from "../controllers/assignmentController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createAssignmentSchema,
  assignmentIdSchema,
  assignmentListQuerySchema,
} from "../validators/index.js";

const router = express.Router();

// Only SUPERADMIN may create or close assignments; HR may read them.
// Paths are mounted at /api/business, so:
//
//   POST   /api/business/shifts/:id/assignments   (create)
//   GET    /api/business/assignments              (list)
//   DELETE /api/business/assignments/:id          (soft-close)

router.post(
  "/shifts/:id/assignments",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(createAssignmentSchema),
  assignmentController.createAssignment
);

router.get(
  "/assignments",
  authMiddleware,
  authorizeRole("SUPERADMIN", "HR"),
  validate(assignmentListQuerySchema),
  assignmentController.listAssignments
);

router.delete(
  "/assignments/:id",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(assignmentIdSchema),
  assignmentController.deactivateAssignment
);

export default router;
