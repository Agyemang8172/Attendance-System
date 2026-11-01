import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../config/prismaClient.js";
import { signAccessToken } from "../utils/tokens.js";
import { PASSWORD_HASH_ROUNDS } from "../utils/passwords.js";
import { authenticateLookup } from "../utils/tenantLookup.js";
import { runWithTenant } from "../utils/tenantContext.js";
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
 * Unknown-account verification uses the account password work factor.
 * This does not guarantee equal response timing.
 */
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-credential", PASSWORD_HASH_ROUNDS);

/**
 * A token is a bearer credential: whoever holds it, is the account, until it
 * expires. The lifetime bounds the damage; the token version ends it early.
 * A password change, an admin reset, a role change or a deactivation increments
 * the version, and `authMiddleware` compares the claim with the account row on
 * every request.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and Password required" });
      return;
    }

    // Login is the one request that starts before a tenant exists. The
    // SECURITY DEFINER lookup resolves the account and its business without
    // exposing any other tenant's rows; the full account is then read under
    // that business through the ordinary tenant-scoped client.
    const lookup = await authenticateLookup(email);

    if (!lookup) {
      await bcrypt.compare(password, DUMMY_HASH);
      auditLog.loginRejected(email, req.ip);
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, lookup.password);

    if (!isPasswordValid) {
      auditLog.login(lookup.id, email, false, req.ip);
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    // Reached only once the caller has proved knowledge of the password, so
    // this discloses nothing to anyone who does not already hold the credential.
    if (!lookup.is_active) {
      auditLog.login(lookup.id, email, false, req.ip);
      res.status(403).json({ success: false, message: "Account deactivated" });
      return;
    }

    const user = await runWithTenant(lookup.business_id, () =>
      prisma.user.findUnique({
        where: { id: lookup.id },
      })
    );

    if (!user) {
      auditLog.loginRejected(email, req.ip);
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    auditLog.login(user.id, email, true, req.ip);

    const token = signAccessToken(user);

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
 * Worth being precise about what it can and cannot do. Sign-out records the
 * event and tells the client to discard its copy. The token itself stays valid
 * until it expires, because logging out on one device must not sign the account
 * out everywhere. A password change, an admin reset, a role change or a
 * deactivation increments the account's token version, and that does end every
 * existing session on the next request.
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