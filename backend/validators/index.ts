import { z } from "zod";

// ── D7 — one password policy, used everywhere a password is accepted ─────────
//
// Previously the client enforced a six-character floor, the server enforced
// eight, and `POST /api/users` accepted no password at all because the server
// generated one. Three rules that disagree are worth having none: an attacker
// only has to find the weakest. These are now defined once, here.

/** Length floor. Ten characters is where a short wordlist stops being enough. */
export const PASSWORD_MIN_LENGTH = 10;
/**
 * Length ceiling. bcrypt reads at most 72 bytes, so anything longer is silently
 * truncated — a caller believes they set a 100-character password while the
 * hash covers 72. Rejecting rather than truncating removes the mismatch.
 */
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Passwords that show up in every credential-stuffing list. Compared
 * case-insensitively, so `Password1` is caught as readily as `password1`.
 */
const PASSWORD_BLOCKLIST = new Set(
  [
    "password",
    "password1",
    "password123",
    "passw0rd",
    "123456",
    "123456789",
    "1234567890",
    "qwerty",
    "qwertyuiop",
    "letmein",
    "welcome",
    "welcome1",
    "admin",
    "administrator",
    "iloveyou",
    "monkey",
    "dragon",
    "sunshine",
    "princess",
    "football",
    "baseball",
    "abc123",
    "abcd1234",
    "changeme",
    "summer2024",
    "winter2024",
    "attendance",
    "attendpro",
  ].map((entry) => entry.toLowerCase())
);

export const passwordString = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
  )
  .refine((value) => !PASSWORD_BLOCKLIST.has(value.toLowerCase()), {
    message: "That password is on the list of most commonly used passwords",
  });

export const loginSchema = {
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
};

export const createUserSchema = {
  body: z.object({
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    email: z.string().email("Invalid email format"),
    department: z.string().min(1, "Department is required").max(100),
    role: z.enum(["STAFF", "HR", "SUPERADMIN"]).optional(),
    phoneNumber: z.string().max(20).optional(),
    jobTitle: z.string().max(100).optional(),
    shiftId: z.string().uuid().optional(),
  }),
};

export const updateUserSchema = {
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    email: z.string().email().optional(),
    department: z.string().max(100).optional(),
    role: z.enum(["STAFF", "HR", "SUPERADMIN"]).optional(),
    phoneNumber: z.string().max(20).optional(),
    jobTitle: z.string().max(100).optional(),
    shiftId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordString,
  }),
};

/**
 * The administrator never chooses the replacement — the server issues one —
 * so the request carries no password field at all. Deliberately absent from
 * `body` means there is nothing here a caller can use to set a weak password
 * by hand.
 */
export const resetPasswordSchema = {
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
};

export const getUserByIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
};

export const deleteUserSchema = {
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
};

export const getUsersQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    department: z.string().optional(),
    role: z.enum(["STAFF", "HR", "SUPERADMIN"]).optional(),
    // `isActive` arrives as the string "false", and `z.coerce.boolean()` turns
    // that into `Boolean("false")` = true — silently inverting the filter and
    // showing active users in place of deactivated ones. The controller reads
    // the raw string (`!== "false"`), so validation keeps it a string: only
    // the two literals pass, and "false" stays "false" end to end.
    isActive: z.enum(["true", "false"]).optional(),
  }),
};

/**
 * Kiosk punch bodies (contracts §8): the single-use verification session
 * handle plus the location fields. The location rules mirror
 * `kioskIdentifySchema` (optional but validated when present, R1 provisional
 * bounds living in backend/utils/location.ts). The default-policy direction —
 * clock-in vs clock-out — is the route itself; the server recomputes the
 * permitted action from the open-session state and never trusts the client.
 */
const kioskPunchLocationFields = {
  latitude: z.number().min(-90, "Latitude out of range").max(90, "Latitude out of range").optional(),
  longitude: z
    .number()
    .min(-180, "Longitude out of range")
    .max(180, "Longitude out of range")
    .optional(),
  accuracyMeters: z
    .number()
    .min(1, "Accuracy must be at least 1 meter")
    .max(500, "Accuracy must be at most 500 meters")
    .optional(),
  capturedAt: z.string().datetime("capturedAt must be an ISO datetime").optional(),
};

export const kioskClockInSchema = {
  body: z.object({
    // The opaque session handle issued by identify; the ceiling mirrors the
    // other session-handle fields.
    verificationSessionId:
      z.string().min(1, "Verification session ID is required").max(64, "Verification session ID is too long"),
    ...kioskPunchLocationFields,
  }),
};

export const kioskClockOutSchema = {
  body: z.object({
    verificationSessionId:
      z.string().min(1, "Verification session ID is required").max(64, "Verification session ID is too long"),
    ...kioskPunchLocationFields,
  }),
};

export const getMyAttendanceSchema = {
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const getAllAttendanceSchema = {
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    userId: z.string().uuid().optional(),
    department: z.string().optional(),
    sessionStatus: z.enum(["OPEN", "CLOSED"]).optional(),
    status: z
      .enum([
        "EARLY",
        "ON_TIME",
        "LATE",
        "OPEN_SESSION",
        "CLOCK_OUT_MISSING",
        "AUTO_CLOSED",
        "ABSENT",
        "REQUIRES_REVIEW",
      ])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const shiftIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid shift ID format"),
  }),
};

export const shiftListQuerySchema = {
  query: z.object({
    isActive: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const createShiftSchema = {
  body: z
    .object({
      name: z.string().min(1, "Name is required").max(80, "Name must be at most 80 characters"),
      startMinute: z.coerce.number().int("Must be a whole number").min(0).max(1439),
      endMinute: z.coerce.number().int("Must be a whole number").min(0).max(1439),
      crossesMidnight: z.boolean().optional(),
    })
    .refine(
      (data) => {
        // The flag must describe the geometry, not contradict it: an end
        // before the start is a cross-midnight shift and nothing else, an end
        // after the start is an ordinary day shift. start == end is the
        // full-day edge (the shift spans the whole clock), so only the
        // cross-midnight flag makes it representable.
        const flag = data.crossesMidnight ?? false;
        if (data.endMinute < data.startMinute) return flag === true;
        if (data.endMinute > data.startMinute) return flag === false;
        return flag === true;
      },
      {
        message:
          "crossesMidnight must be true when the shift ends at or before it starts, and false when it ends after it starts",
        path: ["crossesMidnight"],
      }
    ),
};

export const updateShiftSchema = {
  params: z.object({
    id: z.string().uuid("Invalid shift ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(80).optional(),
    startMinute: z.coerce.number().int("Must be a whole number").min(0).max(1439).optional(),
    endMinute: z.coerce.number().int("Must be a whole number").min(0).max(1439).optional(),
    crossesMidnight: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const createAssignmentSchema = {
  params: z.object({
    id: z.string().uuid("Invalid shift ID format"),
  }),
  body: z.object({
    employeeId: z.string().uuid("Invalid employee ID format"),
    effectiveFrom: z.string().datetime("Invalid effective from date"),
  }),
};

export const assignmentIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid assignment ID format"),
  }),
};

export const assignmentListQuerySchema = {
  query: z.object({
    employeeId: z.string().uuid("Invalid employee ID format").optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const attendanceIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
};

export const dismissAlertSchema = {
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
};

export const policyIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid policy ID format"),
  }),
};

export const createPolicySchema = {
  body: z.object({
    name: z.string().min(1, "Name is required").max(80, "Name must be at most 80 characters"),
    shiftId: z.string().uuid("Invalid shift ID format").optional(),
    graceEarlyMinutes: z.coerce.number().int().min(0).max(120).optional(),
    graceLateMinutes: z.coerce.number().int().min(0).max(120).optional(),
    earlyThresholdMinutes: z.coerce.number().int().min(0).max(120).optional(),
    autoClockOutEnabled: z.boolean().optional(),
    autoClockOutBufferMinutes: z.coerce.number().int().min(0).max(720).optional(),
    autoClockOutMaxOpenMinutes: z.coerce.number().int().min(60).max(1440).optional(),
    correctionWindowDays: z.coerce.number().int().min(1).max(7).optional(),
    geoFenceRadiusMeters: z.coerce.number().int().min(25).max(1000).optional(),
    locationAccuracyThresholdMeters: z.coerce.number().int().min(10).max(500).optional(),
    gpsFreshnessSeconds: z.coerce.number().int().min(10).max(600).optional(),
    observePublicHolidays: z.boolean().optional(),
    effectiveFrom: z.string().datetime("Invalid effective from date"),
  }),
};

export const createPolicyVersionSchema = {
  params: z.object({
    id: z.string().uuid("Invalid policy ID format"),
  }),
  body: z.object({
    graceEarlyMinutes: z.coerce.number().int().min(0).max(120).optional(),
    graceLateMinutes: z.coerce.number().int().min(0).max(120).optional(),
    earlyThresholdMinutes: z.coerce.number().int().min(0).max(120).optional(),
    autoClockOutEnabled: z.boolean().optional(),
    autoClockOutBufferMinutes: z.coerce.number().int().min(0).max(720).optional(),
    autoClockOutMaxOpenMinutes: z.coerce.number().int().min(60).max(1440).optional(),
    correctionWindowDays: z.coerce.number().int().min(1).max(7).optional(),
    geoFenceRadiusMeters: z.coerce.number().int().min(25).max(1000).optional(),
    locationAccuracyThresholdMeters: z.coerce.number().int().min(10).max(500).optional(),
    gpsFreshnessSeconds: z.coerce.number().int().min(10).max(600).optional(),
    observePublicHolidays: z.boolean().optional(),
    effectiveFrom: z.string().datetime("Invalid effective from date"),
  }),
};
// ── M4 — HR, sites, calendars, QR credentials ────────────────────────────────

export const resetPinSchema = {
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    reason: z.string().min(1, "A reason is required").max(500, "Reason must be at most 500 characters"),
  }),
};

export const siteIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid site ID format"),
  }),
};

export const siteListQuerySchema = {
  query: z.object({
    isActive: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const createSiteSchema = {
  body: z.object({
    name: z.string().min(1, "Name is required").max(80, "Name must be at most 80 characters"),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    radiusMeters: z.coerce.number().int().min(25).max(1000).optional(),
    isActive: z.boolean().optional(),
  }),
};

export const updateSiteSchema = {
  params: z.object({
    id: z.string().uuid("Invalid site ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(80).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusMeters: z.coerce.number().int().min(25).max(1000).optional(),
    isActive: z.boolean().optional(),
  }),
};

export const calendarIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid calendar ID format"),
  }),
};

export const updateCalendarSchema = {
  params: z.object({
    id: z.string().uuid("Invalid calendar ID format"),
  }),
  body: z
    .object({
      name: z.string().min(1).max(80).optional(),
      monday: z.boolean().optional(),
      tuesday: z.boolean().optional(),
      wednesday: z.boolean().optional(),
      thursday: z.boolean().optional(),
      friday: z.boolean().optional(),
      saturday: z.boolean().optional(),
      sunday: z.boolean().optional(),
      timezone: z.string().min(1).max(64).optional(),
      isDefault: z.boolean().optional(),
    })
    // The column is documented as an IANA name and the evaluation paths parse
    // it later; "Not/AZone" must fail here rather than downstream.
    .refine(
      (data) => {
        if (data.timezone === undefined) return true;
        try {
          new Intl.DateTimeFormat(undefined, { timeZone: data.timezone });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Timezone must be a valid IANA name", path: ["timezone"] }
    ),
};

export const createCalendarExceptionSchema = {
  params: z.object({
    id: z.string().uuid("Invalid calendar ID format"),
  }),
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    kind: z.enum(["HOLIDAY", "WORKING_OVERRIDE"]),
    name: z.string().min(1, "Name is required").max(80, "Name must be at most 80 characters"),
  }),
};

export const qrCredentialIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid credential ID format"),
  }),
};

export const employeeIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid employee ID format"),
  }),
};

// ── M5 — kiosk device lifecycle ──────────────────────────────────────────────

export const createKioskPairingSchema = {
  body: z.object({
    label: z
      .string()
      .min(1, "Label is required")
      .max(80, "Label must be at most 80 characters"),
    siteId: z.string().uuid("Invalid site ID format").optional(),
  }),
};

// A shop operator types this by hand: the ceiling is generous against a
// typo-expanded paste, and the controller case-folds before hashing.
export const kioskPairSchema = {
  body: z.object({
    pairingCode: z
      .string()
      .min(4, "Pairing code is required")
      .max(16, "Pairing code must be at most 16 characters"),
  }),
};

export const kioskDeviceListQuerySchema = {
  query: z.object({
    state: z.enum(["PENDING_PAIRING", "ACTIVE", "REVOKED", "EXPIRED"]).optional(),
    siteId: z.string().uuid("Invalid site ID format").optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const kioskDeviceIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid device ID format"),
  }),
};

export const kioskRevokeDeviceSchema = {
  params: z.object({
    id: z.string().uuid("Invalid device ID format"),
  }),
  body: z.object({
    reason: z
      .string()
      .min(1, "A reason is required")
      .max(200, "Reason must be at most 200 characters")
      .optional(),
  }),
};

// ── M5 — kiosk verification (identify / verify-pin / cancel) ─────────────────

/**
 * Location fields are optional but validated when present (contracts §7).
 * The 500 m accuracy ceiling and the 60 s staleness threshold mirror the
 * provisional R1 defaults applied in backend/utils/location.ts, so R1's
 * final numbers land there, not here.
 */
export const kioskIdentifySchema = {
  body: z.object({
    // The badge payload is an opaque base64url token plus a version byte in
    // the QR itself; the kiosk sends the token only. Bounds are transport
    // hygiene, not a format test — the real test is the database match.
    qrToken: z
      .string()
      .min(8, "Badge token is required")
      .max(200, "Badge token is too long"),
    latitude: z.number().min(-90, "Latitude out of range").max(90, "Latitude out of range").optional(),
    longitude: z
      .number()
      .min(-180, "Longitude out of range")
      .max(180, "Longitude out of range")
      .optional(),
    accuracyMeters: z
      .number()
      .min(1, "Accuracy must be at least 1 meter")
      .max(500, "Accuracy must be at most 500 meters")
      .optional(),
    capturedAt: z.string().datetime("capturedAt must be an ISO datetime").optional(),
  }),
};

export const kioskVerifyPinSchema = {
  body: z.object({
    // The session handle is a 32-character base64url string; the ceiling just
    // keeps this table out of pages of junk, and any wrong-length entry
    // already hashes to nothing the database holds.
    sessionId: z.string().min(1, "Session ID is required").max(64, "Session ID is too long"),
    // R5 stays open, but six digits is the code's current reality (resetPin
    // generates six), so the validator enforces six — the owner's final PIN
    // policy updates this regex and the generator together.
    pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
  }),
};

export const kioskCancelSchema = {
  body: z.object({
    sessionId: z.string().min(1, "Session ID is required").max(64, "Session ID is too long"),
  }),
};

// ── M5 — correction submission (contracts §8, O17) ───────────────────────────

export const createCorrectionSchema = {
  body: z.object({
    attendanceId: z.string().uuid("Invalid attendance ID format"),
    // A reason is the contract's one required field; the ceiling keeps a
    // single request from ballooning a row.
    reason: z
      .string()
      .min(1, "A reason is required")
      .max(2000, "Reason must be at most 2000 characters"),
    proposedClockIn: z.string().datetime("proposedClockIn must be an ISO datetime").optional(),
    proposedClockOut: z.string().datetime("proposedClockOut must be an ISO datetime").optional(),
    // R6-optional: a failed punch attempt id may be attached to the
    // correction; the controller checks it against the caller's records.
    attemptId: z.string().uuid("Invalid attempt ID format").optional(),
  }),
};
