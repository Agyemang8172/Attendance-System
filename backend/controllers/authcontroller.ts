import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import prisma from "../config/prismaClient.js";
import { logError } from "../utils/logger.js";

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
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    // Reached only once the caller has proved knowledge of the password, so
    // this discloses nothing to anyone who does not already hold the credential.
    if (!user.isActive) {
      res.status(403).json({ success: false, message: "Account deactivated" });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" }
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