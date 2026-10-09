import pino from "pino";
import { Request, Response, NextFunction } from "express";

// ── Logger Configuration ─────────────────────────────────────────────────────

const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  base: {
    service: "attendance-api",
    version: process.env.npm_package_version || "1.0.0",
  },
});

// ── Child Loggers for Specific Domains ───────────────────────────────────────

export const authLogger = logger.child({ domain: "auth" });
export const attendanceLogger = logger.child({ domain: "attendance" });
export const userLogger = logger.child({ domain: "user" });
export const dbLogger = logger.child({ domain: "database" });

// ── Request Correlation ID Middleware ────────────────────────────────────────

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Use existing correlation ID from header or generate new one
  const correlationId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string) ||
    crypto.randomUUID();

  // Attach to request for use in route handlers
  (req as any).correlationId = correlationId;

  // Set response header for client tracing
  res.setHeader("X-Correlation-ID", correlationId);

  // Add to logger context
  req.log = logger.child({ correlationId });

  next();
};

// ── Request Logging Middleware ───────────────────────────────────────────────

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  const correlationId = (req as any).correlationId || "unknown";

  // Log incoming request
  req.log?.info(
    {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    },
    "Incoming request"
  );

  // Capture response
  const originalSend = res.send;
  res.send = function (body?: any): Response {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    req.log?.info(
      {
        method: req.method,
        url: req.url,
        statusCode,
        duration: `${duration}ms`,
        contentLength: res.get("content-length") || 0,
      },
      "Request completed"
    );

    // Log slow requests
    if (duration > 1000) {
      req.log?.warn(
        {
          method: req.method,
          url: req.url,
          duration: `${duration}ms`,
        },
        "Slow request detected"
      );
    }

    // Log errors
    if (statusCode >= 400) {
      req.log?.warn(
        {
          method: req.method,
          url: req.url,
          statusCode,
          body: typeof body === "string" ? body.slice(0, 500) : body,
        },
        "Request error"
      );
    }

    return originalSend.call(this, body);
  };

  next();
};

// ── Error Logging Helper ─────────────────────────────────────────────────────

export const logError = (
  err: Error,
  context: Record<string, any> = {}
): void => {
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      ...context,
    },
    "Application error"
  );
};

// ── Audit Log Helpers ────────────────────────────────────────────────────────

export const auditLog = {
  login: (userId: string, email: string, success: boolean, ip?: string) => {
    authLogger.info(
      { userId, email, success, ip, event: "login" },
      success ? "User login successful" : "User login failed"
    );
  },

  /**
   * A sign-in attempt for an address that matches no account. Distinct from a
   * failed password because it is the shape an address-enumeration sweep makes,
   * and because there is no account to attribute it to.
   */
  loginRejected: (email: string, ip?: string, reason = "unknown_account") => {
    authLogger.warn(
      { email, ip, reason, event: "login_rejected" },
      "Sign-in attempt rejected"
    );
  },

  clockIn: (userId: string, attendanceId: string, ip?: string) => {
    attendanceLogger.info(
      { userId, attendanceId, ip, event: "clock_in" },
      "User clocked in"
    );
  },

  clockOut: (userId: string, attendanceId: string, hoursWorked: number) => {
    attendanceLogger.info(
      { userId, attendanceId, hoursWorked, event: "clock_out" },
      "User clocked out"
    );
  },

  userCreated: (adminId: string, newUserId: string, role: string) => {
    userLogger.info(
      { adminId, newUserId, role, event: "user_created" },
      "User account created"
    );
  },

  userDeactivated: (adminId: string, targetUserId: string) => {
    userLogger.warn(
      { adminId, targetUserId, event: "user_deactivated" },
      "User account deactivated"
    );
  },

  userUpdated: (adminId: string, targetUserId: string, fields: string[]) => {
    userLogger.info(
      { adminId, targetUserId, fields, event: "user_updated" },
      "User account updated"
    );
  },

  passwordReset: (adminId: string, targetUserId: string) => {
    authLogger.warn(
      { adminId, targetUserId, event: "password_reset" },
      "Password reset by administrator"
    );
  },

  logout: (userId: string, ip?: string) => {
    authLogger.info({ userId, ip, event: "logout" }, "User logged out");
  },

  passwordChanged: (userId: string) => {
    authLogger.info(
      { userId, event: "password_changed" },
      "Password changed successfully"
    );
  },
};