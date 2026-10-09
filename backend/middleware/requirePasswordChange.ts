import { Request, Response, NextFunction } from "express";

/**
 * D1 — a first-login password change is mandatory, so an account that still
 * carries the temporary credential must not be able to reach the application.
 *
 * Mounted per-route after `authMiddleware` rather than globally, so a new
 * endpoint starts out reachable only if someone deliberately decides it should
 * be. `PUT /users/change-password` and `/auth/logout` are deliberately left
 * without it — they are the two things an account in this state must be able
 * to do, and logout has to work or the only escape is closing the tab.
 *
 * Returns the same 403 shape for every blocked route so the response does not
 * reveal which account is in this state or why.
 */
const requirePasswordChange = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated. Please log in." });
      return;
    }

    if (req.user.mustChangePassword) {
      res.status(403).json({
        success: false,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "You must change your password before continuing",
      });
      return;
    }

    next();
  };
};

export default requirePasswordChange;
