import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";
import { runWithTenant } from "../utils/tenantContext.js";

/**
 * The claims the session actually carries, plus the account flags the request
 * handlers need. `role` comes from the database rather than the token — see
 * below for why that matters.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        isActive: boolean;
        mustChangePassword: boolean;
        businessId: string;
      };
      correlationId?: string;
      log?: any;
    }
  }
}

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Access Denied. No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
      role: string;
      tokenVersion?: number;
      businessId?: string;
    };

    // A session minted before the tenant claim existed has no business, so it
    // cannot establish the RLS scope. It is refused like any other stale
    // token; the deploy signs everyone in once.
    if (!decoded.businessId) {
      res.status(401).json({
        success: false,
        code: "TOKEN_REVOKED",
        message: "Session expired. Sign in again.",
      });
      return;
    }

    await runWithTenant(decoded.businessId, async () => {
      // The token is checked for signature only, so by itself it says nothing
      // about the account's current state. Loading the record here is what
      // makes a token die the moment the account is deactivated, and what
      // stops a role held in a still-valid token from outliving the role in
      // the database.
      const account = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          tokenVersion: true,
          businessId: true,
        },
      });

      if (!account || account.businessId !== decoded.businessId) {
        res.status(401).json({ message: "Invalid token" });
        return;
      }

      if (!account.isActive) {
        res.status(401).json({
          success: false,
          code: "ACCOUNT_DEACTIVATED",
          message: "This account has been deactivated",
        });
        return;
      }

      // SEC-08: a password change, an admin reset, a role change or a
      // deactivation increments the version. A token minted before that
      // carries an older number, so it dies here even though its signature is
      // still valid. Tokens minted before this check existed have no claim at
      // all and are rejected the same way; that is one deliberate sign-out at
      // deploy.
      if (
        typeof decoded.tokenVersion !== "number" ||
        decoded.tokenVersion !== account.tokenVersion
      ) {
        res.status(401).json({
          success: false,
          code: "TOKEN_REVOKED",
          message: "Session expired. Sign in again.",
        });
        return;
      }

      req.user = {
        userId: account.id,
        role: account.role,
        isActive: account.isActive,
        mustChangePassword: account.mustChangePassword,
        businessId: account.businessId,
      };

      next();
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;
