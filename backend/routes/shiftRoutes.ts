import express from "express";
import shiftController from "../controllers/shiftController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createShiftSchema,
  updateShiftSchema,
  shiftIdSchema,
  shiftListQuerySchema,
} from "../validators/index.js";

const router = express.Router();

// Static routes come before parameterised routes so "/deactivate" is not
// captured by "/:id" as an ID.

// HR may read shifts; only SUPERADMIN may create or change them.
router.get(
  "/",
  authMiddleware,
  authorizeRole("SUPERADMIN", "HR"),
  validate(shiftListQuerySchema),
  shiftController.listShifts
);

router.post(
  "/",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(createShiftSchema),
  shiftController.createShift
);

router.patch(
  "/:id",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(updateShiftSchema),
  shiftController.updateShift
);

router.post(
  "/:id/deactivate",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(shiftIdSchema),
  shiftController.deactivateShift
);

export default router;
