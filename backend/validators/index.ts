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
 * `kioskIdentifySchema` (optional but validated when present, R1 final bounds
 * living in backend/utils/location.ts). The default-policy direction —
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

// ── M8 Phase 2 — staff profile & schedule (contracts M8-R1, M8-R2) ────────────

/**
 * POST /api/staff/profile/change-pin (M8-R1).
 * Body: { currentPin: string (4 digits), newPin: string (4 digits) }
 * Both fields required; validator ensures format, handler enforces inequality.
 */
export const changePinSchema = {
  body: z.object({
    currentPin: z.string().regex(/^\d{4}$/, "Current PIN must be exactly 4 digits"),
    newPin: z.string().regex(/^\d{4}$/, "New PIN must be exactly 4 digits"),
  }),
};

/**
 * GET /api/staff/schedule and GET /api/staff/off-days (M8-R2).
 * Query: startDate (required, YYYY-MM-DD), endDate (required, YYYY-MM-DD), max 190 days.
 * The same range rules as reports apply here.
 */
const STAFF_SCHEDULE_MAX_SPAN_DAYS = 190;

const staffScheduleRangeFields = {
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
} as const;

const staffScheduleRangeRefine = {
  message: "endDate must be on or after startDate, and the range cannot span more than 190 days",
  path: ["endDate"] as (string | number)[],
};

const isStaffScheduleBoundedRange = (data: { startDate: string; endDate: string }): boolean => {
  const start = Date.parse(`${data.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${data.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return end >= start && (end - start) / 86_400_000 <= STAFF_SCHEDULE_MAX_SPAN_DAYS;
};

export const staffScheduleQuerySchema = {
  query: z
    .object({
      ...staffScheduleRangeFields,
    })
    .refine(isStaffScheduleBoundedRange, staffScheduleRangeRefine),
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
 * final R1 defaults applied in backend/utils/location.ts, so R1's exact
 * numbers land there, not here.
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
    // Four digits, final per owner ruling R5 (2026-10-17). resetPin's
    // generator produces four digits to match, so both sides stay in step.
    pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
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
    // Proposals are text-only per owner ruling R6 (2026-10-17) — no attempt
    // attachments.
  }),
};

// ── M6 — background jobs (contracts §9) ──────────────────────────────────────

/**
 * POST /auto-clock-out/run takes an optional businessId so the sweep can be
 * aimed at one business; absent means every active business. The request
 * carries nothing else — the caller's authority is the service token, not the
 * body.
 */
export const jobRunSchema = {
  body: z.object({
    businessId: z.string().uuid("Invalid business ID format").optional(),
  }),
};

/**
 * GET /status has no request fields to validate (contracts §9: "none"), so
 * the route wires no validate() middleware; this empty schema exists as the
 * marker that the omission is deliberate.
 */
export const jobStatusSchema = z.object({});

// ── M7 — help requests (contracts §3 staff lane + §4 HR lane) ────────────────

/** Category allowlist: the exact five the contracts §3 row spells out. */
const helpRequestCategory = z.enum(["pin", "kiosk", "profile", "access", "other"]);

/** The schema's `HelpRequestStatus` values — read, not guessed. */
const helpRequestStatus = z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]);

export const createHelpRequestSchema = {
  body: z.object({
    category: helpRequestCategory,
    subject: z
      .string()
      .min(3, "Subject must be at least 3 characters")
      .max(120, "Subject must be at most 120 characters"),
    body: z
      .string()
      .min(1, "A description is required")
      .max(4000, "Description must be at most 4000 characters"),
    // requesterId is set from the caller, never the body — nothing here for
    // a spoofed payload to fill.
  }),
};

/**
 * The staff and HR list rows read the same query string (`status, page,
 * limit`). No shared pagination object exists in this file — every list
 * schema above repeats its own page/limit coalescing — so this follows the
 * established inline form (coerce, positive int, ceiling 100) rather than
 * inventing a new abstraction this late.
 */
export const listHelpRequestsQuerySchema = {
  query: z.object({
    status: helpRequestStatus.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const helpRequestIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid help request ID format"),
  }),
};

/**
 * PATCH /api/hr/help-requests/:id takes the target status (required — the
 * contract body is `{ status, resolutionNote? }`) and an optional note.
 *
 * The note cap is 500. Located while building M7: the contracts row says
 * only "note length" without a number, and M1-VISUAL-DESIGN §7 states no
 * limit for help-request notes either, so 500 is set here to match the
 * repo's other free-text reason fields (`resetPinSchema` reason and the
 * contract's own `backstopReason ≤500`).
 */
export const updateHelpRequestSchema = {
  params: z.object({
    id: z.string().uuid("Invalid help request ID format"),
  }),
  body: z.object({
    status: helpRequestStatus,
    resolutionNote: z
      .string()
      .min(1, "An empty note is not an answer — leave it out instead")
      .max(500, "Note must be at most 500 characters")
      .optional(),
  }),
};

// ── M7 — correction reads + the decision endpoint (contracts §3/§4) ──────────

/** The schema's `CorrectionStatus` values — read, not guessed. */
const correctionStatus = z.enum(["SUBMITTED", "APPROVED", "REJECTED", "WITHDRAWN"]);

/**
 * Both correction list lanes read this one query string: the contracts' staff
 * row (§3) asks for `status, page, limit` and the HR row (§4) adds
 * `reviewTier`. A shared schema lets a staff caller pass `reviewTier` too —
 * harmless, because the staff handler never sees it: its `where` is forced to
 * the caller's own rows before the filter could matter.
 */
export const listCorrectionsQuerySchema = {
  query: z.object({
    status: correctionStatus.optional(),
    reviewTier: z.enum(["SAME_DAY", "ESCALATED"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const correctionIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid correction ID format"),
  }),
};

/**
 * PATCH /api/hr/corrections/:id/decision (contracts §4). `decision` is the
 * contract's required field; `note` mirrors the help-request note cap set in
 * `updateHelpRequestSchema` above (500, riding the repo's other free-text
 * reason fields). The backstop enums are the exact three the contract row and
 * decision O21 spell out.
 *
 * `backstopReason` checks length only here. Whether it is REQUIRED — the
 * contract's "backstop requires backstopReason (non-empty, ≤500)" — depends
 * on the caller's role and the correction's tier, facts the validator cannot
 * see, so the presence part is re-checked in the handler (`decideCorrection`).
 */
export const correctionDecisionSchema = {
  params: z.object({
    id: z.string().uuid("Invalid correction ID format"),
  }),
  body: z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z
      .string()
      .min(1, "An empty note is not an answer — leave it out instead")
      .max(500, "Note must be at most 500 characters")
      .optional(),
    backstopCondition: z
      .enum(["UNCLAIMED_24H", "CONFLICT_OF_INTEREST", "EXPLICIT_HANDOFF"])
      .optional(),
    backstopReason: z
      .string()
      .max(500, "Backstop reason must be at most 500 characters")
      .optional(),
  }),
};

// ── M7 — reports (contracts §10) ─────────────────────────────────────────────

/**
 * The maximum number of calendar days one report range may span. 190 is the
 * arithmetic ceiling a single bounded scan can answer quickly in the grouped
 * queries below (per-employee absence multiplies users × days); it still
 * covers a full half-year register plus any monthly or quarterly payroll
 * period a business would run, which is the longest period reports are asked
 * for in contracts §10.
 */
const REPORT_MAX_SPAN_DAYS = 190;

/** Dates arrive as plain YYYY-MM-DD — register rows are calendar dates, not instants. */
const reportRangeFields = {
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
} as const;

/**
 * The range rules all four report rows share: the pair is required (the
 * contract row asks for "range bounded"), the end cannot precede the start,
 * and the span stays inside `REPORT_MAX_SPAN_DAYS`. One refine per schema —
 * there is no shared pagination/range object anywhere in this file and none
 * is being introduced this late.
 */
const rangeRefine: {
  message: string;
  // Zod wants a mutable (string | number)[] for the issue path.
  path: Array<string>;
} = {
  message: "endDate must be on or after startDate, and the range cannot span more than 190 days",
  // A bad range is about the pair, so the error lands on endDate.
  path: ["endDate"],
};

const isBoundedRange = (data: { startDate: string; endDate: string }): boolean => {
  const start = Date.parse(`${data.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${data.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return end >= start && (end - start) / 86_400_000 <= REPORT_MAX_SPAN_DAYS;
};

/** Same inline page/limit coalescing every list schema above repeats. */
const reportPageFields = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
} as const;

export const registerQuerySchema = {
  query: z
    .object({
      ...reportRangeFields,
      employeeId: z.string().uuid("Invalid employee ID format").optional(),
      shiftId: z.string().uuid("Invalid shift ID format").optional(),
      ...reportPageFields,
    })
    .refine(isBoundedRange, rangeRefine),
};

export const punctualityQuerySchema = {
  query: z
    .object({
      ...reportRangeFields,
      groupBy: z.enum(["employee", "shift", "day"]),
      ...reportPageFields,
    })
    .refine(isBoundedRange, rangeRefine),
};

export const exceptionsQuerySchema = {
  query: z.object({ ...reportRangeFields, ...reportPageFields }).refine(isBoundedRange, rangeRefine),
};

/**
 * `format` is pinned to `csv` when present (the contract row's `format=csv`);
 * any other value is refused here with a plain message rather than silently
 * ignored, so the caller is told the surface only exports one format.
 */
export const csvExportQuerySchema = {
  query: z
    .object({
      ...reportRangeFields,
      // Same optional filters the JSON register accepts (mirror of
      // `registerQuerySchema`): a bogus id must die here as a 400, not
      // surface later as an unexpected Prisma cast 500.
      employeeId: z.string().uuid("Invalid employee ID format").optional(),
      shiftId: z.string().uuid("Invalid shift ID format").optional(),
      format: z
        .string()
        .refine((value) => value === "csv", {
          message: "format must be csv",
        })
        .optional(),
    })
    .refine(isBoundedRange, rangeRefine),
};

// ── M7 Phase 3 — audit trail + business settings (contracts §11/§5) ──────────

/**
 * GET /api/audit/corrections/:attendanceId carries exactly one request field
 * — the id of the attendance row whose correction story is being pulled —
 * and the contracts demand the uuid check up front (`400` on a bad format),
 * so a mangled id dies at the validation gate instead of an empty query.
 */
export const attendanceAuditQuerySchema = {
  params: z.object({
    attendanceId: z.string().uuid("Invalid attendance ID format"),
  }),
};

/**
 * GET /api/business/settings takes no request fields (contracts §5: "none").
 * Like `jobStatusSchema` above, this empty schema is the marker that the
 * omission is deliberate; the GET route wires no validate() middleware.
 */
export const businessSettingsQuerySchema = z.object({});

/**
 * PATCH /api/business/settings (contracts §5 PATCH row + the M7 Phase 3
 * retention work, O10). The contract row names the profile fields (name,
 * timezone, logoUrl, brandColor, supportEmail, supportPhone); the retention
 * knobs join them here because the M7 plan names this surface as where
 * retention is configured, and the GET row already exposes the same knobs.
 *
 * `.strict()` everywhere: a misspelled retention field (`retentionYear`) must
 * meet a 400 "unrecognized key" rather than being silently dropped, leaving
 * the owner to believe a change took effect that never happened.
 */
export const updateBusinessSettingsSchema = {
  body: z
    .object({
      // The repo's other editable name fields (shift, site, calendar, policy)
      // all cap at 80; the business name joins them so every name input on
      // the surface is bounded the same way.
      name: z.string().min(1, "Name is required").max(80, "Name must be at most 80 characters").optional(),
      // The column is documented as an IANA name; the same refine as the
      // calendar update above fails "Not/AZone" here rather than downstream.
      timezone: z.string().min(1).max(64).optional(),
      logoUrl: z.string().min(1, "logoUrl cannot be empty").max(500, "logoUrl is too long").optional(),
      brandColor: z.string().min(1, "brandColor cannot be empty").max(32, "brandColor is too long").optional(),
      supportEmail: z.string().email("Invalid support email format").optional(),
      supportPhone: z.string().max(20, "Phone must be at most 20 characters").optional(),
      /**
       * One to thirty years. No document names a spread — O10 defers the
       * policy itself to Ghana-specific legal advice — so the bounds are
       * arithmetic: the schema's own default is 7, `retentionYears` stays the
       * legacy whole-window knob (O10 comment on the column), and refusing
       * values below one stops the future deletion job from wiping yesterday
       * while the thirty-year ceiling keeps the promise a business can still
       * honour. These are config-only values in M7: nothing is ever deleted.
       */
      retentionYears: z.coerce.number().int().min(1, "Retention must be at least 1 year").max(30, "Retention must be at most 30 years").optional(),
      /**
       * Flipping retention on arms a deletion job that does not exist yet.
       * O10 blocks enabling until Ghana-specific legal advice lands, so the
       * validator refuses `true` outright (the schema default keeps every
       * business at `false`); the handler re-checks as defence in depth.
       */
      retentionEnabled: z
        .boolean()
        .refine((value) => value === false, {
          message: "retentionEnabled must stay false — enabling deletion waits for the Ghana-specific legal advice O10 requires",
        })
        .optional(),
      /**
       * The per-category windows R8 split out (attendance vs audit). Both
       * mirror the retentionYears ceiling: 30 years × 365 days. Clearing a
       * window back to null is deliberately not accepted in M7 — config-only
       * milestone, and a cleared window is a retention decision of its own.
       */
      attendanceRetentionDays: z.coerce.number().int().min(1, "Retention must be at least 1 day").max(10950, "Retention must be at most 10950 days (30 years)").optional(),
      auditRetentionDays: z.coerce.number().int().min(1, "Retention must be at least 1 day").max(10950, "Retention must be at most 10950 days (30 years)").optional(),
    })
    .strict()
    // The contract's validation column names the IANA check for this row;
    // same refine shape as `updateCalendarSchema` above.
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
