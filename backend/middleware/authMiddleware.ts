import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request to include your user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
      };
      correlationId?: string;
      log?: any;
    }
  }
}

const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;