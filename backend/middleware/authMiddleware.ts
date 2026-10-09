import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";

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
    };

    // The token is checked for signature only, so by itself it says nothing
    // about the account's current state. Loading the record here is what makes
    // a token die the moment the account is deactivated, and what stops a role
    // held in a still-valid token from outliving the role in the database.
    const account = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (!account) {
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

    req.user = {
      userId: account.id,
      role: account.role,
      isActive: account.isActive,
      mustChangePassword: account.mustChangePassword,
    };

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;
