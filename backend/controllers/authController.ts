import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import prisma from "../config/prismaClient.js";
import { logError, auditLog } from "../utils/logger.js";

/**
 * PRD section 7: a failed sign-in must not reveal whether the account exists.
 * Unknown email and wrong password therefore return this identical status and
 * body, so the two are indistinguishable to a caller enumerating addresses.
 */
const INVALID_CREDENTIALS = {
  success: false,
  message: "Invalid email or password",
} as const;

/**
 * A real bcrypt hash of an unguessable value. When no user matches, a
 * comparison is still run against this so that an unknown email costs the same
 * time as a wrong password — without it, the missing ~100ms compare separates
 * the two cases by timing alone.
 */
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-credential", 10);

/**
 * A token is a bearer credential: whoever holds it, is the account, until it
 * expires. Twenty-four hours is a long time for one to survive being copied out
 * of a browser, a log line or a shoulder-surfed screenshot. Eight hours bounds
 * the damage to a working day, and an employee signing in each morning is not
 * inconvenienced by it.
 *
 * Logging out does not shorten this — see the note on `logout`.
 */
const TOKEN_TTL = "8h";

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and Password required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      auditLog.loginRejected(email, req.ip);
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      auditLog.login(user.id, email, false, req.ip);
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    // Reached only once the caller has proved knowledge of the password, so
    // this discloses nothing to anyone who does not already hold the credential.
    if (!user.isActive) {
      auditLog.login(user.id, email, false, req.ip);
      res.status(403).json({ success: false, message: "Account deactivated" });
      return;
    }

    auditLog.login(user.id, email, true, req.ip);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: TOKEN_TTL }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    const err = error as Error;
    logError(err, {
      correlationId: (req as any).correlationId || "unknown",
      method: req.method,
      url: req.url,
      ip: req.ip,
    });
    // PRD section 7: the client gets a generic 500; the detail stays in the log.
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

/**
 * D9 — a sign-out endpoint, which this API did not have.
 *
 * Worth being precise about what it can and cannot do. The token is a bearer
 * credential signed by the server with no server-side state behind it, so
 * refusing to accept it again is not possible without a revocation list or a
 * token-version column on the account — both of which are migrations and are
 * deliberately deferred. What this endpoint does is record that the holder
 * signed out, and what it tells the client is that the token must be discarded.
 *
 * Until one of those migrations lands, the practical bound on a copied token is
 * the eight-hour lifetime set above, and deactivating the account — which every
 * request now checks against the database — ends it immediately.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    auditLog.logout(req.user.userId, req.ip);

    res.status(200).json({
      success: true,
      message: "Signed out. Discard the token.",
    });
  } catch (error) {
    logError(error as Error, {
      correlationId: (req as any).correlationId || "unknown",
      method: req.method,
      url: req.url,
    });
    res.status(500).json({ success: false, message: "Sign-out failed" });
  }
};