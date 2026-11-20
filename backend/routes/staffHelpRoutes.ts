import express from "express";
import {
  createHelpRequest,
  listMyHelpRequests,
  getMyHelpRequest,
} from "../controllers/helpRequestController.js";
import {
  listMyCorrections,
  getMyCorrection,
} from "../controllers/correctionController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import { validate } from "../middleware/validate.js";
import { createRateLimiter } from "../utils/rateLimit.js";
import {
  createHelpRequestSchema,
  listHelpRequestsQuerySchema,
  helpRequestIdSchema,
  listCorrectionsQuerySchema,
  correctionIdSchema,
} from "../validators/index.js";

const router = express.Router();

/**
 * Staff self-service lane, mounted at `/api/staff` (contracts §3). Route
 * table for this file:
 *   POST /api/staff/help-requests       STAFF  file a help request
 *   GET  /api/staff/help-requests       STAFF  own requests, paginated
 *   GET  /api/staff/help-requests/:id   STAFF  own request, ownership-checked
 *   GET  /api/staff/corrections         STAFF  own corrections, paginated
 *   GET  /api/staff/corrections/:id     STAFF  own correction, ownership-checked
 *
 * The auth posture matches the repo's other self-service lanes
 * (/api/attendance/corrections, /api/hr/*): still on a temporary password →
 * answer nothing, and STAFF only, because the §3 rows say STAFF (self).
 */

/**
 * A modest throttle on the WRITE only. The admit path (`help:<userId>:<ip>`
 * — the caller is authenticated by middleware before this runs, so the user
 * id exists; ip is the belt) bounds one account, and one address riding along
 * with it, to five filed tickets per quarter-hour. Reading the queue is
 * factory traffic and takes the server-wide limiter only.
 */
const createHelpRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyer: (req) => `help:${req.user?.userId ?? "anon"}:${req.ip}`,
});

// POST /api/staff/help-requests
router.post(
  "/help-requests",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF"),
  createHelpRequestLimiter,
  validate(createHelpRequestSchema),
  createHelpRequest
);

// GET /api/staff/help-requests
router.get(
  "/help-requests",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF"),
  validate(listHelpRequestsQuerySchema),
  listMyHelpRequests
);

// GET /api/staff/help-requests/:id
router.get(
  "/help-requests/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF"),
  validate(helpRequestIdSchema),
  getMyHelpRequest
);

// ── M7 — correction reads (contracts §3 rows 112-113) ────────────────────────
// Self reads only: the submission lane (POST /api/attendance/corrections)
// already gates STAFF on their own records, and these views follow it.

// GET /api/staff/corrections
router.get(
  "/corrections",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF"),
  validate(listCorrectionsQuerySchema),
  listMyCorrections
);

// GET /api/staff/corrections/:id
router.get(
  "/corrections/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("STAFF"),
  validate(correctionIdSchema),
  getMyCorrection
);

export default router;
