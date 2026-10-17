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
// Device (kiosk) lane; the pairing, token, and revocation events below.
export const kioskLogger = logger.child({ domain: "kiosk" });
// Business-settings lane (M7 Phase 3); the SUPERADMIN's own-business edits.
export const businessLogger = logger.child({ domain: "business" });
// Employee verification lane (identify → PIN → session); events §11 event table.
export const verifyLogger = logger.child({ domain: "verify" });
// Help-request lane (M7): staff submissions and HR status changes.
export const helpLogger = logger.child({ domain: "help" });

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

  shiftCreated: (adminId: string, shiftId: string, businessId: string) => {
    userLogger.info(
      { adminId, shiftId, businessId, event: "shift_created" },
      "Shift created"
    );
  },

  shiftUpdated: (adminId: string, shiftId: string, businessId: string) => {
    userLogger.info(
      { adminId, shiftId, businessId, event: "shift_updated" },
      "Shift updated"
    );
  },

  shiftDeactivated: (adminId: string, shiftId: string, businessId: string) => {
    userLogger.warn(
      { adminId, shiftId, businessId, event: "shift_deactivated" },
      "Shift deactivated"
    );
  },

  assignmentCreated: (adminId: string, assignmentId: string, businessId: string) => {
    userLogger.info(
      { adminId, assignmentId, businessId, event: "assignment_created" },
      "Shift assignment created"
    );
  },

  assignmentDeactivated: (
    adminId: string,
    assignmentId: string,
    businessId: string
  ) => {
    userLogger.warn(
      { adminId, assignmentId, businessId, event: "assignment_deactivated" },
      "Shift assignment deactivated"
    );
  },

  policyCreated: (adminId: string, policyId: string, businessId: string) => {
    userLogger.info(
      { adminId, policyId, businessId, event: "policy_created" },
      "Workplace policy created"
    );
  },

  policyVersionCreated: (
    adminId: string,
    versionId: string,
    businessId: string
  ) => {
    userLogger.info(
      { adminId, versionId, businessId, event: "policy_version_created" },
      "Policy version created"
    );
  },

  pinReset: (adminId: string, targetUserId: string) => {
    userLogger.info(
      { adminId, targetUserId, event: "pin_reset" },
      "Kiosk PIN reset by administrator"
    );
  },

  siteCreated: (adminId: string, siteId: string, businessId: string) => {
    userLogger.info(
      { adminId, siteId, businessId, event: "site_created" },
      "Site created"
    );
  },

  siteUpdated: (adminId: string, siteId: string, businessId: string) => {
    userLogger.info(
      { adminId, siteId, businessId, event: "site_updated" },
      "Site updated"
    );
  },

  siteDeactivated: (adminId: string, siteId: string, businessId: string) => {
    userLogger.warn(
      { adminId, siteId, businessId, event: "site_deactivated" },
      "Site deactivated"
    );
  },

  calendarUpdated: (adminId: string, calendarId: string, businessId: string) => {
    userLogger.info(
      { adminId, calendarId, businessId, event: "calendar_updated" },
      "Work calendar updated"
    );
  },

  calendarExceptionCreated: (
    adminId: string,
    exceptionId: string,
    businessId: string
  ) => {
    userLogger.info(
      { adminId, exceptionId, businessId, event: "calendar_exception_created" },
      "Calendar exception created"
    );
  },

  qrIssued: (adminId: string, employeeId: string, businessId: string) => {
    userLogger.info(
      { adminId, employeeId, businessId, event: "qr_reissued" },
      "QR credential issued"
    );
  },

  qrRevoked: (adminId: string, credentialId: string, businessId: string) => {
    userLogger.warn(
      { adminId, credentialId, businessId, event: "qr_revoked" },
      "QR credential revoked"
    );
  },

  // ── Kiosk device lifecycle (kiosk spec §11; no code or token on any row) ────

  /** A one-time pairing code was issued. Records the expiry, never the code. */
  kioskPairingIssued: (
    adminId: string,
    kioskId: string,
    businessId: string,
    expiresAt: Date
  ) => {
    kioskLogger.info(
      {
        adminId,
        kioskId,
        businessId,
        expiresAt,
        event: "kiosk_pairing_issued",
      },
      "Kiosk pairing code issued"
    );
  },

  /** A shop phone redeemed a pairing code and became a paired kiosk. */
  kioskPaired: (kioskId: string, businessId: string, ip?: string) => {
    kioskLogger.info(
      { kioskId, businessId, ip, event: "kiosk_paired" },
      "Kiosk device paired"
    );
  },

  /** A kiosk token was rotated inside its 90-day maximum age. */
  kioskTokenRenewed: (kioskId: string, businessId: string) => {
    kioskLogger.info(
      { kioskId, businessId, event: "kiosk_token_renewed" },
      "Kiosk token renewed"
    );
  },

  /** A token passed the 90-day maximum age and the terminal went back to pairing. */
  kioskExpired: (kioskId: string, businessId: string) => {
    kioskLogger.warn(
      { kioskId, businessId, event: "kiosk_expired" },
      "Kiosk token passed maximum age"
    );
  },

  /** An administrator revoked a device. The reason is free text, never a token. */
  kioskRevoked: (
    adminId: string,
    kioskId: string,
    businessId: string,
    reason?: string
  ) => {
    kioskLogger.warn(
      { adminId, kioskId, businessId, reason, event: "kiosk_revoked" },
      "Kiosk device revoked"
    );
  },

  /** A badge presentation resolved to nothing usable (kiosk §11, no badge value). */
  identifyFailed: (kioskId: string, reason: string, ip?: string) => {
    kioskLogger.warn(
      { kioskId, reason, ip, event: "qr_identify_failed" },
      "Badge identification failed"
    );
  },

  // ── Kiosk verification events (kiosk spec §11; no PIN or badge value on any
  // row — the session id recorded is the opaque handle the kiosk already
  // holds, which expires in minutes) ────────────────────────────────────────

  /** A QR scan opened a short-lived verification session. */
  verifySessionStarted: (
    kioskId: string,
    businessId: string,
    employeeId: string,
    sessionId: string
  ) => {
    verifyLogger.info(
      { kioskId, businessId, employeeId, sessionId, event: "verify_session_started" },
      "Verification session started"
    );
  },

  /** A PIN matched and the session reached VERIFIED (§4.2). */
  verifySucceeded: (sessionId: string, employeeId: string, kioskId: string) => {
    verifyLogger.info(
      { sessionId, employeeId, kioskId, event: "verify_succeeded" },
      "PIN verification succeeded"
    );
  },

  /** A wrong PIN on a live session; the count is the session's own counter. */
  pinVerifyFailed: (
    sessionId: string,
    employeeId: string,
    attemptCount: number
  ) => {
    verifyLogger.warn(
      { sessionId, employeeId, attemptCount, event: "pin_verify_failed" },
      "PIN verification failed"
    );
  },

  /** Attempts exhausted: the session went LOCKED and the employee's PIN locked. */
  pinLocked: (
    sessionId: string,
    employeeId: string,
    lockedUntil: Date
  ) => {
    verifyLogger.warn(
      { sessionId, employeeId, lockedUntil, event: "pin_locked" },
      "PIN attempts exhausted, temporary lock applied"
    );
  },

  /** The kiosk (or the kiosk's expiry logic) abandoned a session. */
  verifyCancelled: (
    sessionId: string,
    employeeId: string,
    kioskId: string
  ) => {
    verifyLogger.info(
      { sessionId, employeeId, kioskId, event: "verify_cancelled" },
      "Verification session cancelled"
    );
  },

  // ── Attendance punch and correction events (kiosk spec §11; the punch row
  // carries action and locationResult, never a badge value or a token) ───────

  /** A kiosk punch committed (kiosk §11 `attendance.recorded`). */
  attendanceRecorded: (
    kioskId: string,
    employeeId: string,
    businessId: string,
    action: string,
    attendanceId: string,
    locationResult: string
  ) => {
    attendanceLogger.info(
      {
        kioskId,
        employeeId,
        businessId,
        action,
        attendanceId,
        locationResult,
        event: "attendance_recorded",
      },
      "Kiosk punch recorded"
    );
  },

  // ── Background-job events (M6; counts only — never an employee or record
  // id, so the stdout lane cannot become an employee log) ───────────────────

  /**
   * One summary line per auto-clock-out sweep, after the run commits. The
   * durable per-row detail lives in audit_logs; this is the at-a-glance
   * "did the job run" signal.
   */
  jobRun: (counts: {
    closed: number;
    flagged: number;
    businesses: number;
  }) => {
    attendanceLogger.info(
      { ...counts, event: "auto_clock_out_run" },
      "Auto clock-out sweep finished"
    );
  },

  /** A correction request entered review (contracts §8, O17). */
  correctionSubmitted: (userId: string, correctionId: string, businessId: string) => {
    attendanceLogger.info(
      { userId, correctionId, businessId, event: "correction_submitted" },
      "Correction submitted for review"
    );
  },

  /**
   * A reviewer decided a correction (contracts §4 `correction.decided` /
   * `correction.decided.backstop`; O17 + the O21 backstop). The durable copy
   * rides the `audit_logs` row the transaction writes through `writeAudit`;
   * this stdout row is the live-troubleshooting mirror. `backstopCondition`
   * is null on a plain second-reviewer decision and carries the O21 enum
   * value (or the explicit-handoff condition) otherwise.
   */
  correctionDecided: (
    actorId: string,
    correctionId: string,
    decision: string,
    businessId: string,
    detail: { attendanceId: string; backstopCondition: string | null }
  ) => {
    attendanceLogger.info(
      {
        actorId,
        correctionId,
        decision,
        businessId,
        attendanceId: detail.attendanceId,
        backstopCondition: detail.backstopCondition,
        event: "correction_decided",
      },
      "Correction decided"
    );
  },

  // ── Help requests (M7; contracts §3/§4 name no event, so the names are
  // crafted in the dotted style of the named ones like `correction.decided`:
  // `help.request_submitted`, `help.request_resolved`) ───────────────────────

  /** An employee filed a help request. Subject text is not logged — the row holds it. */
  helpRequestSubmitted: (userId: string, requestId: string, businessId: string) => {
    helpLogger.info(
      { userId, requestId, businessId, event: "help_request_submitted" },
      "Help request submitted"
    );
  },

  /**
   * HR (or the SUPERADMIN backstop) moved a help request. Always emitted per
   * accepted PATCH, whatever the resulting status — `help.request_resolved`
   * names the audit row for the RESOLVED case; the stdout lane just records
   * the change with the resulting status.
   */
  helpRequestResolved: (
    actorId: string,
    requestId: string,
    status: string,
    noteRecorded: boolean,
    businessId: string
  ) => {
    helpLogger.info(
      {
        actorId,
        requestId,
        status,
        noteRecorded,
        businessId,
        event: "help_request_resolved",
      },
      "Help request status changed"
    );
  },

  // ── Business settings (M7 Phase 3; contracts §5). The durable copy rides
  // the `settings.updated` audit_logs row the transaction writes through
  // `writeAudit`; this stdout row is the live mirror, in the same split as
  // every other audited event (auditWriter.ts header). ─────────────────────

  /**
   * The SUPERADMIN changed their own business's settings (GET reads write
   * nothing). `fields` names exactly the values that actually changed, so a
   * no-op PATCH is visible as an empty list instead of a phantom edit.
   */
  settingsUpdated: (adminId: string, businessId: string, fields: string[]) => {
    businessLogger.info(
      { adminId, businessId, fields, event: "settings_updated" },
      "Business settings updated"
    );
  },
};
