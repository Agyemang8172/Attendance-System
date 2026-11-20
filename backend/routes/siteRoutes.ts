import express from "express";
import siteController from "../controllers/siteController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createSiteSchema,
  updateSiteSchema,
  siteIdSchema,
  siteListQuerySchema,
} from "../validators/index.js";

const router = express.Router();

// HR may read sites; only SUPERADMIN may create or change them.
router.get(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR"),
  validate(siteListQuerySchema),
  siteController.listSites
);

router.post(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(createSiteSchema),
  siteController.createSite
);

router.patch(
  "/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(updateSiteSchema),
  siteController.updateSite
);

router.post(
  "/:id/deactivate",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(siteIdSchema),
  siteController.deactivateSite
);

export default router;
