import express from "express";
import policyController from "../controllers/policyController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createPolicySchema,
  createPolicyVersionSchema,
  policyIdSchema,
} from "../validators/index.js";

const router = express.Router();

// Only SUPERADMIN may create policies or versions.
router.get(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  policyController.listPolicies
);

router.post(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(createPolicySchema),
  policyController.createPolicy
);

router.post(
  "/:id/versions",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(createPolicyVersionSchema),
  policyController.createPolicyVersion
);

export default router;
