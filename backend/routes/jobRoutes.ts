import express from "express";
import jobController from "../controllers/jobController.js";
import { jobAuthMiddleware, requireJobOrSuperadmin } from "../middleware/jobAuthMiddleware.js";
import { validate } from "../middleware/validate.js";
import { createRateLimiter } from "../utils/rateLimit.js";
import { jobRunSchema } from "../validators/index.js";

const router = express.Router();

// Mounted at /api/jobs (contracts §9):
//   POST /api/jobs/auto-clock-out/run   job (service token)
//   GET  /api/jobs/status               job (service token) or SUPERADMIN

/**
 * The run route is job-token ONLY: the contract row says "service token
 * matches JOB_TOKEN", so a SUPERADMIN session is accepted on /status but not
 * on /run — no session middleware is wired here.
 *
 * The contract lists 401/409/500 for the run route and leaves rate limiting
 * unstated, but a machine-trigger URL on the public API is still worth a
 * modest throttle. 5 per minute per IP is ten times the legitimate cadence
 * (the job fires once every 15 minutes), so a scheduler or a manual pass is
 * never throttled while blind hammering is.
 */
const runLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyer: (req) => `job-run:${req.ip}`,
});

router.post(
  "/auto-clock-out/run",
  runLimiter,
  // Auth before validation: an unauthenticated caller gets a plain 401,
  // never a 400 spelling out the body's field problems.
  jobAuthMiddleware,
  validate(jobRunSchema),
  jobController.runAutoClockOutJob
);

// /status carries no request fields to validate (jobStatusSchema documents
// this), so no validate() middleware is wired.
router.get("/status", requireJobOrSuperadmin, jobController.jobStatus);

export default router;
