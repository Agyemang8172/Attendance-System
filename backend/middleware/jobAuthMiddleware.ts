import { Request, Response, NextFunction } from "express";
import authMiddleware from "./authMiddleware.js";
import { constantTimeEqual } from "../utils/kioskKeys.js";

/**
 * Service-token middleware for background jobs (API contracts §9).
 *
 * A job token is a bare server secret, not a JWT — there is no signature to
 * verify and no row to look up, so the whole check is one constant-time
 * string comparison. And like a kiosk token (kioskAuthMiddleware), a job
 * token carries no employee identity: it proves nothing about a user, so the
 * handlers behind it scope reads by what the token means, never by who the
 * caller "is".
 *
 * Extends the same `Express.Request` augmentation that lives in
 * authMiddleware.ts; the interface declarations merge across files.
 */
declare global {
  namespace Express {
    interface Request {
      /** Set to "job" when the caller proved possession of JOB_TOKEN. */
      actorType?: "job";
    }
  }
}

/** "Bearer <token>" only — a missing or malformed header is no token at all. */
const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!token || scheme !== "Bearer") return null;

  return token;
};

const jobAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Fail closed: an unset JOB_TOKEN means there is nothing to compare
  // against, and refusing every caller is the safe answer — the route must
  // never become an open endpoint just because a deploy forgot the key.
  if (!process.env.JOB_TOKEN) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const token = extractBearerToken(req);
  if (!token || !constantTimeEqual(token, process.env.JOB_TOKEN)) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  req.actorType = "job";
  next();
};

/**
 * Combined auth for GET /api/jobs/status (contracts §9): the job token
 * *or* a SUPERADMIN session. A matching job token wins immediately;
 * anything else falls through to the session path, where authMiddleware
 * answers its own 401s (missing or invalid token) and the call continues
 * only for a live account.
 *
 * The role check is inlined rather than composed with `authorizeRole`
 * because this lane admits exactly one role — SUPERADMIN — and never HR.
 *
 * The session branch is filtered to the caller's own business inside the
 * status handler (M6 Phase 2), per the contract's "SUPERADMIN (own)"; the
 * job branch sees every business.
 */
const requireJobOrSuperadmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractBearerToken(req);

  if (
    token &&
    process.env.JOB_TOKEN &&
    constantTimeEqual(token, process.env.JOB_TOKEN)
  ) {
    req.actorType = "job";
    next();
    return;
  }

  await authMiddleware(req, res, () => {
    if (!req.user || !req.user.role) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (req.user.role !== "SUPERADMIN") {
      res.status(403).json({ success: false, message: "Access Denied" });
      return;
    }

    next();
  });
};

export { jobAuthMiddleware, requireJobOrSuperadmin };
