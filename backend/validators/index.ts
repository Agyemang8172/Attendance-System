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

export const clockInSchema = {
  body: z.object({
    checkInIp: z.string().ip().optional(),
    checkInLat: z.number().min(-90).max(90).optional(),
    checkInLng: z.number().min(-180).max(180).optional(),
    remarks: z.string().max(500).optional(),
  }),
};

export const clockOutSchema = {
  body: z.object({
    remarks: z.string().max(500).optional(),
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
      (data) => data.crossesMidnight || data.endMinute > data.startMinute,
      {
        message: "End minute must be after start minute unless the shift crosses midnight",
        path: ["endMinute"],
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