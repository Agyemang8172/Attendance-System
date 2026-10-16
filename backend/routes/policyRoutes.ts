import express from "express";
import policyController from "../controllers/policyController.js";
import authMiddleware from "../middleware/authMiddleware.js";
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
  authorizeRole("SUPERADMIN"),
  policyController.listPolicies
);

router.post(
  "/",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(createPolicySchema),
  policyController.createPolicy
);

router.post(
  "/:id/versions",
  authMiddleware,
  authorizeRole("SUPERADMIN"),
  validate(createPolicyVersionSchema),
  policyController.createPolicyVersion
);

export default router;
