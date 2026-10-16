# AttendPro M1 — Data Model

- **Date:** 2026-10-16
- **Baseline commit:** `f87ce1d`
- **Milestone:** M1
- **Owners:** DBA Agent and Architect Agent
- **Companions:** `docs/attendpro/M1-ARCHITECTURE.md`, `docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/M1-KIOSK-SECURITY.md`
- **Status:** design only. The schema below is a proposal. No migration is written or applied here.

**Revision 2026-10-16.** The owner's M1 design review on this date changed the model from
the 2026-10-15 draft. SMS one-time codes are out and the QR badge plus PIN is in, leave
moves to version two, and the schema gains a site, a recovery-code table, PIN fields,
pairing fields and location fields. Section 0 records what moved.

This document reconciles the PRD §17 entity inventory with the three models the
repository holds today (`User`, `Shift`, `Attendance`) and the entities named in
`M1-KIOSK-SECURITY.md`. Model and enum names match `M1-KIOSK-SECURITY.md`; where the kiosk
design named a concept without a model (the QR credential row, the site), the name chosen
here is marked.

---

## 0. Reconciliation and decisions carried in

### 0.1 What the 2026-10-16 review changed

- **Leave removed.** `LeaveType` and `LeaveRequest` leave version one and are deferred to
  version two (O16). The absence rule in §8 no longer consults a leave source, because no
  leave source exists in v1.
- **SMS OTP removed.** The `OtpChallenge` table and every OTP field are gone. The kiosk
  verifies a QR badge plus a PIN (O2, `M1-KIOSK-SECURITY.md` §4 and §5). The verification
  states are `QR_ACCEPTED`, `PIN_PENDING`, `VERIFIED`, `LOCKED`, `EXPIRED`, `CONSUMED`.
- **Added.** `Site` for geo-fences (O4); `EmailRecoveryCode` for account recovery (O6);
  PIN fields and `tokenVersion` on `User` (O2, O12); kiosk pairing and token fields that
  replace the device secret (O3); location fields on `AttendanceAttempt` (O4).
- **Final count.** The schema holds **nineteen models**.

### 0.2 Decisions carried in

The earlier "Provisional assumptions carried in" table is replaced by this one. Every row
below is owner-confirmed on 2026-10-16 and is designed to as settled, not as a default.

| Ref | Confirmed direction | Register state |
|-----|---------------------|----------------|
| O2 | Kiosk verification is the employee QR badge plus a PIN. SMS codes are not used for clock-in. The PIN is stored hashed, with attempt limits, rate limits, temporary lockouts, and an audited HR reset. | Confirmed (owner, 2026-10-16) |
| O3 | An administrator generates a one-time pairing code that expires in ten minutes; entering it pairs the device and issues a kiosk token. Token lifetime is 30 days, renewed on use, capped at 90 days, and revocable from the devices page. | Confirmed (owner, 2026-10-16) |
| O4 | QR identifies the badge; every attempt records its timestamp and a location assessment. Each site carries a geo-fence (centre plus radius; 150 m is an example). Outside is flagged, not blocked. Poor accuracy is `UNKNOWN`, never `OUTSIDE`. | Confirmed (owner, 2026-10-16) |
| O5 | The server generates a long random QR credential and stores only a hash, shown once. Reissue revokes the previous credential. A QR alone never authorizes a punch. | Confirmed (owner, 2026-10-16) |
| O6 | Email recovery code: six digits, ten-minute expiry, single use, lock after five incorrect attempts, resends no more often than once every 60 seconds, stored hashed and rate limited. Account recovery only. | Confirmed (owner, 2026-10-16) |
| O7 | Recovery order: an audited HR PIN reset; badge reissue with the old credential revoked; then a correction request. A failed attempt is never a successful punch. | Confirmed (owner, 2026-10-16) |
| O8 | Auto clock-out runs every 15 minutes. An open session past shift end plus a buffer (default two hours) is closed at shift end and flagged; with no shift it closes after a maximum duration (default 14 hours). | Confirmed (owner, 2026-10-16) |
| O10 | Retention is configurable per business and off by default. Attendance, correction history, audit logs and security events may keep different periods. Legal advice precedes enabling deletion. | Confirmed (owner, 2026-10-16) |
| O12 | A `tokenVersion` guards sessions. Every request verifies the user is active, the version is current, the action is authorized, and the request is scoped to the business. Deactivation bumps the version and revokes the QR credential. | Confirmed (owner, 2026-10-16) |
| O14 | A separate test database with fake data only. Tests refuse to run unless the database name ends in `_test`, and the configured host is verified before a destructive reset. | Confirmed (owner, 2026-10-16) |
| O15 | `SUPERADMIN` controls business-wide timing rules. One late grace applies across shifts unless the owner changes it. Timing changes take effect from the next business midnight and never recalculate history. | Confirmed (owner, 2026-10-16) |
| O16 | Version one includes shift assignment, working-day and off-day configuration, absence calculation, and a per-business rule for observing public holidays. Leave requests, allocation and timetable upload are deferred to version two. | Confirmed (owner, 2026-10-16) |
| O17 | An employee may correct their own record within seven days with a reason. HR approves same-day fixes; older fixes follow a stricter review. Nobody approves their own record. History is append-only. | Confirmed (owner, 2026-10-16) |
| O21 | Append-only protection (grants, RLS and a trigger) is confirmed for the correction history and the audit log. | Confirmed (owner, 2026-10-16) |
| O22 | One default working calendar per business in v1, with the schema already allowing more later. | Confirmed (owner, 2026-10-16) |

---

## 1. Entity map

| PRD §17 entity | Model here | Notes |
|----------------|-----------|-------|
| Business / Tenant | `Business` | new |
| User | `User` | extended with `businessId` and PIN fields |
| Shift | `Shift` | extended; minute-of-day window |
| Attendance | `Attendance` | extended with tenancy, evaluation snapshots, status vocabulary |
| KioskTerminal | `KioskTerminal` | new; pairing and token model |
| VerificationSession | `VerificationSession` | new; QR and PIN states |
| AttendanceAttempt | `AttendanceAttempt` | new; carries the location assessment |
| AttendanceHelpRequest | `AttendanceHelpRequest` | new |
| AttendanceCorrection | `AttendanceCorrection` | new; review tier |
| WorkplacePolicy / PolicyVersion | `WorkplacePolicy` + `PolicyVersion` | split into two models |
| AuditLog | `AuditLog` | new |
| (assignment approach, chosen) | `ShiftAssignment` | dated assignment history |
| (QR credential, from kiosk §3) | `QrCredential` | new |
| (site and geo-fence, O4) | `Site` | new |
| (email recovery code, O6) | `EmailRecoveryCode` | new |
| (work calendar, O16) | `WorkCalendar` | new; per business, more than one calendar allowed |
| (calendar exception, O16) | `CalendarException` | new; holidays and working overrides |
| (correction revision, O17) | `AttendanceCorrectionRevision` | new; append-only history |

The schema holds nineteen models. The earlier revision held fifteen; the 2026-10-15
direction added five (`WorkCalendar`, `CalendarException`, `LeaveType`, `LeaveRequest` and
`AttendanceCorrectionRevision`), and the 2026-10-16 review took three back out (both leave
models and the OTP table) and added two (`Site` and `EmailRecoveryCode`). Absence is not one
of the models and has no table of its own. It is an `Attendance` row with `status = ABSENT`
that the day-close job writes. The count moves from twenty to nineteen.

Two PRD gaps were handled by inference. The PRD does not state whether shift assignment is
a column on `User` or its own entity, so §2 keeps `User.shiftId` as a maintained pointer
and adds `ShiftAssignment` for dated history. The off-day calendar entity the PRD omits is
settled by O16: §2 adds `WorkCalendar` and `CalendarException`, and §8 states how they feed
the absence rule.

---

## 2. Proposed Prisma schema

The block below is the proposed `backend/prisma/schema.prisma`. It keeps the existing
generator and datasource, keeps existing model and field names where they exist, and adds
the tenancy, security and evaluation columns. Partial unique indexes cannot be expressed in
the Prisma schema; two of them (one open attendance per user, one active QR credential per
employee) are created in raw SQL by the migration and are marked in comments here.

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../generated/prisma"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── Enums ────────────────────────────────────────────────────────────────────

enum Role {
  SUPERADMIN
  HR
  STAFF
}

/// PRD §12 vocabulary, standardised. Replaces PRESENT/HALF_DAY/ON_LEAVE.
enum AttendanceStatus {
  EARLY
  ON_TIME
  LATE
  OPEN_SESSION
  CLOCK_OUT_MISSING
  AUTO_CLOSED
  ABSENT
  REQUIRES_REVIEW
}

enum SessionStatus {
  OPEN
  CLOSED
}

/// How a session reached CLOSED. Keeps auto and verified closures apart (PRD §13).
/// ABSENT_NO_SHOW marks the absence row the day-close job writes (§8).
enum ClosureReason {
  VERIFIED_CLOCK_OUT
  AUTO_CLOCK_OUT
  HR_ASSISTED
  CORRECTION
  ABSENT_NO_SHOW
}

/// Device lifecycle (O3, kiosk §2 and §9). EXPIRED is a token that passed its 90-day
/// maximum age and must re-pair; REVOKED is an administrator action.
enum KioskState {
  PENDING_PAIRING
  ACTIVE
  REVOKED
  EXPIRED
}

/// State machine from M1-KIOSK-SECURITY.md §4.2.
enum VerificationState {
  QR_ACCEPTED
  PIN_PENDING
  VERIFIED
  LOCKED
  EXPIRED
  CONSUMED
}

enum AttendanceAction {
  CLOCK_IN
  CLOCK_OUT
}

enum AttemptOutcome {
  SUCCESS
  REJECTED
}

/// Location assessment per attempt (O4, kiosk §6.2). Poor accuracy is UNKNOWN, never
/// OUTSIDE.
enum LocationResult {
  INSIDE
  OUTSIDE
  UNKNOWN
}

enum HelpRequestStatus {
  OPEN
  IN_REVIEW
  RESOLVED
  CLOSED
}

enum CorrectionStatus {
  SUBMITTED
  APPROVED
  REJECTED
  WITHDRAWN
}

/// Same-day fixes are approved by HR; older fixes follow a stricter review (O17).
enum CorrectionReviewTier {
  SAME_DAY
  ESCALATED
}

enum AuditActorType {
  USER
  KIOSK
  SYSTEM
}

/// A dated exception on a calendar: a public or company holiday, or a special working
/// day that falls on a non-working weekday (O16).
enum CalendarExceptionKind {
  HOLIDAY
  WORKING_OVERRIDE
}

// ── Core tenancy ─────────────────────────────────────────────────────────────

model Business {
  id                      String   @id @default(uuid())
  name                    String
  slug                    String   @unique
  timezone                String   @default("UTC") // IANA name, for example Africa/Accra
  isActive                Boolean  @default(true) @map("is_active")
  logoUrl                 String?  @map("logo_url")
  brandColor              String?  @map("brand_color")
  supportEmail            String?  @map("support_email")
  supportPhone            String?  @map("support_phone")
  /// Legacy fixed window kept until the per-category fields below replace it (O10).
  retentionYears          Int      @default(7) @map("retention_years")
  /// Retention is off until the owner enables it per business (O10).
  retentionEnabled        Boolean  @default(false) @map("retention_enabled")
  attendanceRetentionDays Int?     @map("attendance_retention_days")
  auditRetentionDays      Int?     @map("audit_retention_days")
  createdAt               DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt               DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  users               User[]
  shifts              Shift[]
  assignments         ShiftAssignment[]
  attendances         Attendance[]
  sites               Site[]
  policies            WorkplacePolicy[]
  policyVersions      PolicyVersion[]
  kiosks              KioskTerminal[]
  qrCredentials       QrCredential[]
  sessions            VerificationSession[]
  attempts            AttendanceAttempt[]
  helpRequests        AttendanceHelpRequest[]
  corrections         AttendanceCorrection[]
  correctionRevisions AttendanceCorrectionRevision[]
  workCalendars       WorkCalendar[]
  calendarExceptions  CalendarException[]
  emailRecoveryCodes  EmailRecoveryCode[]
  auditLogs           AuditLog[]

  @@index([isActive])
  @@map("businesses")
}

model User {
  id                 String   @id @default(uuid())
  businessId         String   @map("business_id")
  employeeCode       String   @map("employee_code")
  firstName          String   @map("first_name")
  lastName           String   @map("last_name")
  email              String   @unique // login is by email alone
  password           String
  phoneNumber        String?  @map("phone_number") // contact only; no OTP (O2)
  role               Role     @default(STAFF)
  department         String?
  jobTitle           String?  @map("job_title")
  isActive           Boolean  @default(true) @map("is_active")
  profileImageUrl    String?  @map("profile_image_url")
  mustChangePassword Boolean  @default(true) @map("must_change_password")

  /// Kiosk PIN (O2, kiosk §5.1). A keyed hash of the PIN joined to a per-record salt;
  /// never a bare hash. HR resets it through an audited action (O7).
  pinHash            String?  @map("pin_hash")
  pinSalt            String?  @map("pin_salt")
  pinUpdatedAt       DateTime? @map("pin_updated_at") @db.Timestamptz(3)
  pinFailedCount     Int      @default(0) @map("pin_failed_count")
  pinLockedUntil     DateTime? @map("pin_locked_until") @db.Timestamptz(3)
  pinLastFailedAt    DateTime? @map("pin_last_failed_at") @db.Timestamptz(3)
  mustChangePin      Boolean  @default(false) @map("must_change_pin")

  /// Session revocation (O12). Deactivation and forced logout increment it, so every
  /// outstanding token fails the next request check.
  tokenVersion       Int      @default(0) @map("token_version")

  /// Current assignment pointer, maintained alongside ShiftAssignment. Deprecated as
  /// the evaluation source; kept because the existing API and validators read it.
  shiftId            String?  @map("shift_id")
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  business             Business             @relation(fields: [businessId], references: [id], onDelete: Restrict)
  shift                Shift?               @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  attendances          Attendance[]
  assignments          ShiftAssignment[]
  qrCredentials        QrCredential[]
  verificationSessions VerificationSession[]
  attempts             AttendanceAttempt[]
  emailRecoveryCodes   EmailRecoveryCode[]
  helpRequests         AttendanceHelpRequest[] @relation("HelpRequester")
  assistedRequests     AttendanceHelpRequest[] @relation("HelpAssignee")
  corrections          AttendanceCorrection[]  @relation("CorrectionRequester")
  reviewedCorrections  AttendanceCorrection[]  @relation("CorrectionReviewer")
  correctionRevisions  AttendanceCorrectionRevision[] @relation("CorrectionRevisionActor")
  auditLogs            AuditLog[]
  kiosksRegistered     KioskTerminal[]      @relation("KioskRegistrar")
  kiosksRevoked        KioskTerminal[]      @relation("KioskRevoker")

  @@unique([businessId, employeeCode])
  @@index([businessId])
  @@index([businessId, isActive])
  @@index([businessId, department])
  @@index([businessId, shiftId])
  @@map("users")
}

// ── Shifts and scheduling ────────────────────────────────────────────────────

model Shift {
  id             String   @id @default(uuid())
  businessId     String   @map("business_id")
  name           String
  /// Minute-of-day, 0..1439, in the business timezone.
  startMinute    Int      @map("start_minute")
  endMinute      Int      @map("end_minute")
  crossesMidnight Boolean @default(false) @map("crosses_midnight")
  isActive       Boolean  @default(true) @map("is_active")
  /// Deprecated text columns kept until an approved destructive migration removes them.
  startTime      String?  @map("start_time")
  endTime        String?  @map("end_time")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  business      Business          @relation(fields: [businessId], references: [id], onDelete: Restrict)
  users         User[]
  assignments   ShiftAssignment[]
  attendances   Attendance[]
  policies      WorkplacePolicy[]

  @@unique([businessId, name])
  @@index([businessId, isActive])
  @@map("shifts")
}

/// Dated assignment history. Evaluating a punch resolves the assignment effective at the
/// clock instant, which preserves historical context (PRD §11, §12).
model ShiftAssignment {
  id             String   @id @default(uuid())
  businessId     String   @map("business_id")
  userId         String   @map("user_id")
  shiftId        String   @map("shift_id")
  effectiveFrom  DateTime @map("effective_from") @db.Timestamptz(3)
  effectiveTo    DateTime? @map("effective_to") @db.Timestamptz(3) // null = current
  assignedByUserId String? @map("assigned_by_user_id")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  user     User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  shift    Shift    @relation(fields: [shiftId], references: [id], onDelete: Restrict)

  @@index([businessId, userId, effectiveFrom])
  @@index([businessId, shiftId])
  // Partial unique: at most one open-ended assignment per user.
  // CREATE UNIQUE INDEX shift_assignments_current_uq ON shift_assignments(user_id)
  //   WHERE effective_to IS NULL;
  @@map("shift_assignments")
}

// ── Attendance ───────────────────────────────────────────────────────────────

model Attendance {
  id            String           @id @default(uuid())
  businessId    String           @map("business_id")
  userId        String           @map("user_id")
  /// Business-local calendar date the record belongs to (PRD §12, range queries).
  date          DateTime         @map("date") @db.Date
  clockIn       DateTime         @default(now()) @map("clock_in") @db.Timestamptz(3)
  clockOut      DateTime?        @map("clock_out") @db.Timestamptz(3)
  status        AttendanceStatus @default(OPEN_SESSION)
  sessionStatus SessionStatus    @default(OPEN) @map("session_status")
  closureReason ClosureReason?   @map("closure_reason")
  hoursWorked   Float            @default(0) @map("hours_worked")
  requiresReviewReason String?   @map("requires_review_reason")
  alertDismissedAt DateTime?      @map("alert_dismissed_at") @db.Timestamptz(3)
  remarks       String?

  // Location and network metadata
  checkInIp     String? @map("check_in_ip")
  checkInLat    Float?  @map("check_in_lat")
  checkInLng    Float?  @map("check_in_lng")

  // Source references
  createdByKioskId          String? @map("created_by_kiosk_id")
  sourceVerificationSessionId String? @unique @map("source_verification_session_id")

  // Historical snapshots: the shift and policy used at evaluation time (PRD §12).
  shiftId                  String? @map("shift_id")
  shiftNameSnapshot        String? @map("shift_name_snapshot")
  shiftStartMinuteSnapshot Int?    @map("shift_start_minute_snapshot")
  shiftEndMinuteSnapshot   Int?    @map("shift_end_minute_snapshot")
  shiftCrossesMidnightSnapshot Boolean? @map("shift_crosses_midnight_snapshot")
  timezoneSnapshot         String? @map("timezone_snapshot")
  graceEarlyMinutesSnapshot Int?   @map("grace_early_minutes_snapshot")
  graceLateMinutesSnapshot  Int?   @map("grace_late_minutes_snapshot")
  policyVersionId          String? @map("policy_version_id")
  policySnapshot           Json?   @map("policy_snapshot")

  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  // No cascade on attendance. Deleting a user, shift, kiosk or session must not erase
  // history (PRD §15, §17).
  business       Business           @relation(fields: [businessId], references: [id], onDelete: Restrict)
  user           User               @relation(fields: [userId], references: [id], onDelete: Restrict)
  shift          Shift?             @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  policyVersion  PolicyVersion?     @relation(fields: [policyVersionId], references: [id], onDelete: SetNull)
  createdByKiosk KioskTerminal?     @relation(fields: [createdByKioskId], references: [id], onDelete: SetNull)
  corrections    AttendanceCorrection[]

  @@index([businessId, date])
  @@index([businessId, userId, date])
  @@index([businessId, shiftId, date])
  @@index([businessId, status])
  @@index([businessId, sessionStatus])
  @@index([userId, sessionStatus])
  // Partial unique: one open session per employee (PRD §17, M0 finding F3).
  // CREATE UNIQUE INDEX attendances_open_per_user_uq ON attendances(user_id)
  //   WHERE session_status = 'OPEN';
  @@map("attendances")
}

// ── Sites and location ───────────────────────────────────────────────────────

/// A place of work with a geo-fence centre and radius (O4). The radius is an example
/// value, not a fixed rule: outside the fence is flagged, never blocked.
model Site {
  id           String   @id @default(uuid())
  businessId   String   @map("business_id")
  name         String
  latitude     Float
  longitude    Float
  radiusMeters Int      @default(150) @map("radius_meters")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  business Business            @relation(fields: [businessId], references: [id], onDelete: Restrict)
  kiosks   KioskTerminal[]
  attempts AttendanceAttempt[]

  @@unique([businessId, name])
  @@index([businessId, isActive])
  @@map("sites")
}

// ── Kiosk, QR and verification ───────────────────────────────────────────────

model KioskTerminal {
  id                   String     @id @default(uuid())
  businessId           String     @map("business_id")
  siteId               String?    @map("site_id")
  label                String
  /// Non-secret identifier shown in the dashboard (kiosk §2).
  publicId             String     @unique @map("public_id")
  /// One-time pairing code, stored as a keyed hash only (kiosk §2.1).
  pairingCodeHash      String?    @map("pairing_code_hash")
  pairingCodeExpiresAt DateTime?  @map("pairing_code_expires_at") @db.Timestamptz(3)
  pairedAt             DateTime?  @map("paired_at") @db.Timestamptz(3)
  /// Keyed hash of the current device token; the plaintext is never stored (kiosk §2.3).
  tokenHash            String?    @map("token_hash")
  tokenVersion         Int        @default(0) @map("token_version")
  tokenIssuedAt        DateTime?  @map("token_issued_at") @db.Timestamptz(3)
  tokenExpiresAt       DateTime?  @map("token_expires_at") @db.Timestamptz(3)
  lastSeenAt           DateTime?  @map("last_seen_at") @db.Timestamptz(3)
  state                KioskState @default(PENDING_PAIRING)
  registeredByUserId   String?    @map("registered_by_user_id")
  revokedByUserId      String?    @map("revoked_by_user_id")
  registeredAt         DateTime   @default(now()) @map("registered_at") @db.Timestamptz(3)
  revokedAt            DateTime?  @map("revoked_at") @db.Timestamptz(3)
  createdAt            DateTime   @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt            DateTime   @updatedAt @map("updated_at") @db.Timestamptz(3)

  business     Business       @relation(fields: [businessId], references: [id], onDelete: Restrict)
  site         Site?          @relation(fields: [siteId], references: [id], onDelete: SetNull)
  registeredBy User?          @relation("KioskRegistrar", fields: [registeredByUserId], references: [id], onDelete: SetNull)
  revokedBy    User?          @relation("KioskRevoker", fields: [revokedByUserId], references: [id], onDelete: SetNull)
  attendances  Attendance[]
  sessions     VerificationSession[]
  attempts     AttendanceAttempt[]

  @@index([businessId, state])
  @@index([businessId, siteId])
  @@index([tokenHash])
  @@map("kiosk_terminals")
}

model QrCredential {
  id               String    @id @default(uuid())
  businessId       String    @map("business_id")
  employeeId       String    @map("employee_id")
  /// Keyed hash of the opaque token, keyed with QR_SECRET_KEY (kiosk §3.2).
  tokenHash        String    @unique @map("token_hash")
  schemaVersion    Int       @default(1) @map("schema_version")
  issuedByUserId   String?   @map("issued_by_user_id")
  issuedAt         DateTime  @default(now()) @map("issued_at") @db.Timestamptz(3)
  revokedAt        DateTime? @map("revoked_at") @db.Timestamptz(3)
  revokedByUserId  String?   @map("revoked_by_user_id")
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  employee User     @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  @@index([businessId, employeeId])
  // Partial unique: one active credential per employee (kiosk §3.3).
  // CREATE UNIQUE INDEX qr_credentials_active_uq ON qr_credentials(employee_id)
  //   WHERE revoked_at IS NULL;
  @@map("qr_credentials")
}

model VerificationSession {
  id               String            @id @default(uuid())
  businessId       String            @map("business_id")
  employeeId       String            @map("employee_id")
  kioskId          String            @map("kiosk_id")
  /// Hashed session handle returned to the kiosk (kiosk §4.3).
  sessionIdHash    String            @unique @map("session_id_hash")
  state            VerificationState @default(QR_ACCEPTED)
  /// Per-session PIN attempts; the session moves to LOCKED at the limit (kiosk §5.2).
  pinAttemptCount  Int               @default(0) @map("pin_attempt_count")
  lockedAt         DateTime?         @map("locked_at") @db.Timestamptz(3)
  expiresAt        DateTime          @map("expires_at") @db.Timestamptz(3)
  verifiedAt       DateTime?         @map("verified_at") @db.Timestamptz(3)
  consumedAt       DateTime?         @map("consumed_at") @db.Timestamptz(3)
  createdAt        DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime          @updatedAt @map("updated_at") @db.Timestamptz(3)

  business  Business      @relation(fields: [businessId], references: [id], onDelete: Restrict)
  employee  User          @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  kiosk     KioskTerminal @relation(fields: [kioskId], references: [id], onDelete: Restrict)

  @@index([businessId, employeeId])
  @@index([kioskId])
  @@index([state, expiresAt])
  @@map("verification_sessions")
}

/// A log of every kiosk step, successful or rejected (kiosk §6.1, O7, O21). Append-only:
/// see §10. The row carries the location assessment for the attempt.
model AttendanceAttempt {
  id                    String            @id @default(uuid())
  businessId            String            @map("business_id")
  employeeId            String?           @map("employee_id")
  kioskId               String?           @map("kiosk_id")
  siteId                String?           @map("site_id")
  verificationSessionId String?           @map("verification_session_id")
  /// CLOCK_IN or CLOCK_OUT when the attempt reached a punch; null before that.
  action                AttendanceAction? @map("action")
  /// IDENTIFY, VERIFY, PIN, TOKEN: the step the attempt was logged at.
  step                  String?
  outcome               AttemptOutcome
  reason                String?

  // Location assessment (kiosk §6.1). Recorded for every attempt, flagged not blocked.
  locationResult        LocationResult?   @map("location_result")
  latitude              Float?
  longitude             Float?
  accuracyMeters        Float?            @map("accuracy_meters")
  distanceMeters        Float?            @map("distance_meters")
  capturedAt            DateTime?         @map("captured_at") @db.Timestamptz(3)
  receivedAt            DateTime?         @map("received_at") @db.Timestamptz(3)

  ip                    String?
  userAgent             String?           @map("user_agent")
  createdAt             DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)

  business Business       @relation(fields: [businessId], references: [id], onDelete: Restrict)
  employee User?          @relation(fields: [employeeId], references: [id], onDelete: SetNull)
  kiosk    KioskTerminal? @relation(fields: [kioskId], references: [id], onDelete: SetNull)
  site     Site?          @relation(fields: [siteId], references: [id], onDelete: SetNull)

  @@index([businessId, createdAt])
  @@index([businessId, employeeId, createdAt])
  @@index([kioskId, createdAt])
  @@index([businessId, siteId, createdAt])
  @@map("attendance_attempts")
}

// ── Help requests and corrections ────────────────────────────────────────────

model AttendanceHelpRequest {
  id               String            @id @default(uuid())
  businessId       String            @map("business_id")
  requesterId      String            @map("requester_id")
  category         String            // pin, kiosk, profile, access, other
  subject          String
  body             String
  status           HelpRequestStatus @default(OPEN)
  assignedToId     String?           @map("assigned_to_id")
  resolutionNote   String?           @map("resolution_note")
  resolvedAt       DateTime?         @map("resolved_at") @db.Timestamptz(3)
  createdAt        DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime          @updatedAt @map("updated_at") @db.Timestamptz(3)

  business  Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  requester User     @relation("HelpRequester", fields: [requesterId], references: [id], onDelete: Restrict)
  assignee  User?    @relation("HelpAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)

  @@index([businessId, status])
  @@index([requesterId])
  @@map("attendance_help_requests")
}

model AttendanceCorrection {
  id               String           @id @default(uuid())
  businessId       String           @map("business_id")
  attendanceId     String           @map("attendance_id")
  requestedById    String           @map("requested_by_id")
  reason           String
  /// When the employee raised the request (O17). Distinct from the decision time.
  requestedAt      DateTime         @default(now()) @map("requested_at") @db.Timestamptz(3)
  /// Same-day fixes are approved by HR; older fixes follow a stricter review (O17).
  reviewTier       CorrectionReviewTier @map("review_tier")
  proposedClockIn  DateTime?        @map("proposed_clock_in") @db.Timestamptz(3)
  proposedClockOut DateTime?        @map("proposed_clock_out") @db.Timestamptz(3)
  /// Original values captured at submission so an approval cannot erase them (PRD §14).
  originalValues   Json             @map("original_values")
  approvedValues   Json?            @map("approved_values")
  status           CorrectionStatus @default(SUBMITTED)
  reviewedById     String?          @map("reviewed_by_id")
  decidedAt        DateTime?        @map("decided_at") @db.Timestamptz(3)
  decisionNote     String?          @map("decision_note")
  createdAt        DateTime         @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime         @updatedAt @map("updated_at") @db.Timestamptz(3)

  business   Business   @relation(fields: [businessId], references: [id], onDelete: Restrict)
  attendance Attendance @relation(fields: [attendanceId], references: [id], onDelete: Restrict)
  requestedBy User      @relation("CorrectionRequester", fields: [requestedById], references: [id], onDelete: Restrict)
  reviewedBy  User?     @relation("CorrectionReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)
  revisions  AttendanceCorrectionRevision[]

  @@index([businessId, status])
  @@index([businessId, reviewTier])
  @@index([attendanceId])
  @@index([requestedById])
  @@map("attendance_corrections")
}

/// One row per proposal, decision and applied change on a correction (O17, §9).
/// Append-only: no `updatedAt` and no update or delete path (§10). `valuesBefore` and
/// `valuesAfter` hold the attendance fields at that step.
model AttendanceCorrectionRevision {
  id           String   @id @default(uuid())
  businessId   String   @map("business_id")
  correctionId String   @map("correction_id")
  revisionNo   Int      @map("revision_no")
  /// PROPOSED, DECIDED or APPLIED. **Provisional name** for the step discriminator.
  action       String
  valuesBefore Json?    @map("values_before")
  valuesAfter  Json?    @map("values_after")
  actorId      String   @map("actor_id")
  reason       String?
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  business   Business             @relation(fields: [businessId], references: [id], onDelete: Restrict)
  correction AttendanceCorrection @relation(fields: [correctionId], references: [id], onDelete: Restrict)
  actor      User                 @relation("CorrectionRevisionActor", fields: [actorId], references: [id], onDelete: Restrict)

  @@unique([correctionId, revisionNo])
  @@index([correctionId, revisionNo])
  @@index([businessId, createdAt])
  @@map("attendance_correction_revisions")
}

// ── Policy and versions ──────────────────────────────────────────────────────

model WorkplacePolicy {
  id         String   @id @default(uuid())
  businessId String   @map("business_id")
  /// null = the business default; set = a shift-specific override (PRD §12).
  shiftId    String?  @map("shift_id")
  name       String
  isDefault  Boolean  @default(false) @map("is_default")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  business Business        @relation(fields: [businessId], references: [id], onDelete: Restrict)
  shift    Shift?          @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  versions PolicyVersion[]

  @@unique([businessId, name])
  // Partial unique: one default policy per business,
  // CREATE UNIQUE INDEX workplace_policies_default_uq ON workplace_policies(business_id)
  //   WHERE shift_id IS NULL;
  @@map("workplace_policies")
}

model PolicyVersion {
  id                       String   @id @default(uuid())
  businessId               String   @map("business_id")
  policyId                 String   @map("policy_id")
  versionNumber            Int      @map("version_number")
  effectiveFrom            DateTime @map("effective_from") @db.Timestamptz(3)
  effectiveTo              DateTime? @map("effective_to") @db.Timestamptz(3)
  graceEarlyMinutes        Int      @default(0) @map("grace_early_minutes")
  graceLateMinutes         Int      @default(0) @map("grace_late_minutes")
  earlyThresholdMinutes    Int      @default(0) @map("early_threshold_minutes")
  autoClockOutEnabled      Boolean  @default(false) @map("auto_clock_out_enabled")
  autoClockOutOffsetMinutes Int?    @map("auto_clock_out_offset_minutes")
  /// Auto clock-out buffer past shift end, in minutes (O8, default two hours).
  autoClockOutBufferMinutes Int     @default(120) @map("auto_clock_out_buffer_minutes")
  /// Maximum open session with no shift, in minutes (O8, default 14 hours).
  autoClockOutMaxOpenMinutes Int    @default(840) @map("auto_clock_out_max_open_minutes")
  /// Days an employee may correct their own record (O17, default seven).
  correctionWindowDays     Int      @default(7) @map("correction_window_days")
  /// Geo-fence radius used when a site does not override it (O4, example 150 m).
  geoFenceRadiusMeters     Int      @default(150) @map("geo_fence_radius_meters")
  /// Accuracy above this is UNKNOWN, never OUTSIDE (O4, R1, example 50 m).
  locationAccuracyThresholdMeters Int @default(50) @map("location_accuracy_threshold_meters")
  /// A capture older than this is stale and gives UNKNOWN (O4, R1, example 60 s).
  gpsFreshnessSeconds      Int      @default(60) @map("gps_freshness_seconds")
  /// Whether the business observes public holidays (O16).
  observePublicHolidays    Boolean  @default(false) @map("observe_public_holidays")
  createdByUserId          String?  @map("created_by_user_id")
  createdAt                DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  business Business        @relation(fields: [businessId], references: [id], onDelete: Restrict)
  policy   WorkplacePolicy @relation(fields: [policyId], references: [id], onDelete: Restrict)
  attendances Attendance[]

  @@unique([policyId, versionNumber])
  @@index([businessId, policyId, effectiveFrom])
  @@map("policy_versions")
}

// ── Work calendar ────────────────────────────────────────────────────────────

/// A business working week (O16, O22). The schema allows more than one calendar per
/// business; one row carries `isDefault`. The flags are the working-week weekdays.
model WorkCalendar {
  id         String   @id @default(uuid())
  businessId String   @map("business_id")
  name       String
  /// Working-week weekday flags. The defaults describe a Monday-to-Friday week.
  monday     Boolean  @default(true)
  tuesday    Boolean  @default(true)
  wednesday  Boolean  @default(true)
  thursday   Boolean  @default(true)
  friday     Boolean  @default(true)
  saturday   Boolean  @default(false)
  sunday     Boolean  @default(false)
  timezone   String   @default("UTC") // IANA name, for example Africa/Accra
  isDefault  Boolean  @default(false) @map("is_default")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  business   Business            @relation(fields: [businessId], references: [id], onDelete: Restrict)
  exceptions CalendarException[]

  @@unique([businessId, name])
  @@index([businessId, isDefault])
  // Partial unique: one default calendar per business (O22).
  // CREATE UNIQUE INDEX work_calendars_default_uq ON work_calendars(business_id)
  //   WHERE is_default;
  @@map("work_calendars")
}

/// A dated exception to a calendar (O16). Covers a public or company holiday and a
/// special working day that falls on a normally non-working weekday.
model CalendarException {
  id         String                @id @default(uuid())
  businessId String                @map("business_id")
  calendarId String                @map("calendar_id")
  date       DateTime              @map("date") @db.Date
  kind       CalendarExceptionKind
  name       String
  createdAt  DateTime              @default(now()) @map("created_at") @db.Timestamptz(3)

  business Business     @relation(fields: [businessId], references: [id], onDelete: Restrict)
  calendar WorkCalendar @relation(fields: [calendarId], references: [id], onDelete: Restrict)

  @@unique([calendarId, date])
  @@index([businessId, date])
  @@index([businessId, calendarId])
  @@map("calendar_exceptions")
}

// ── Account recovery ─────────────────────────────────────────────────────────

/// A single-use email recovery code (O6). Account recovery only, never a kiosk clock-in.
/// Stored as a keyed hash with a per-record salt; the plaintext is never stored.
model EmailRecoveryCode {
  id           String    @id @default(uuid())
  businessId   String    @map("business_id")
  userId       String    @map("user_id")
  codeHash     String    @map("code_hash")
  salt         String
  expiresAt    DateTime  @map("expires_at") @db.Timestamptz(3)
  usedAt       DateTime? @map("used_at") @db.Timestamptz(3)
  attemptCount Int       @default(0) @map("attempt_count")
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  user     User     @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([businessId, userId, createdAt])
  @@index([userId, expiresAt])
  @@map("email_recovery_codes")
}

// ── Audit ────────────────────────────────────────────────────────────────────

model AuditLog {
  id            String         @id @default(uuid())
  businessId    String         @map("business_id")
  actorType     AuditActorType @map("actor_type")
  actorUserId   String?        @map("actor_user_id")
  actorKioskId  String?        @map("actor_kiosk_id")
  action        String
  entityType    String         @map("entity_type")
  entityId      String?        @map("entity_id")
  beforeValues  Json?          @map("before_values")
  afterValues   Json?          @map("after_values")
  reason        String?
  correlationId String?        @map("correlation_id")
  ip            String?
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)

  business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  actor    User?    @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([businessId, createdAt])
  @@index([businessId, entityType, entityId])
  @@index([businessId, action])
  @@map("audit_logs")
}
```

Notes on the schema block:

- `AuditLog.actorKioskId` is a plain column without a relation, so a revoked or later
  purged kiosk does not constrain the log. The design keeps audit rows independent of
  the objects they describe.
- `AttendanceAttempt.verificationSessionId` is also a plain column. The attempt log stays
  readable after a session is purged, which is what the failure-evidence rule asks for
  (O7).
- No cascade reaches `Attendance`. Deleting a user, site, kiosk or session sets a
  reference to null; it never erases history (PRD §15, §17).
- `AttendanceCorrectionRevision` has no `updatedAt` and no update or delete path. The
  three enforcement layers are in §10. Site, calendar and exception rows are tenant-owned:
  their foreign keys are `Restrict` or `SetNull`, and none of them reaches `Attendance`.

---

## 3. Status vocabulary and the mapping from today's enum

PRD §12 lists early, on time, late, open session, clock-out missing, automatically
closed, absent, and requires review. The eight values of `AttendanceStatus` above match
that list in order. The current enum offers `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`,
`ON_LEAVE`, which do not map onto it cleanly.

| Current value | New value | Rationale |
|---------------|-----------|-----------|
| `PRESENT` | `ON_TIME` | A present record with no lateness computed becomes on time |
| `LATE` | `LATE` | Direct |
| `ABSENT` | `ABSENT` | Direct |
| `HALF_DAY` | `REQUIRES_REVIEW` | No equivalent in §12; preserving it as a review case avoids inventing a rule |
| `ON_LEAVE` | `REQUIRES_REVIEW` | No equivalent in §12; HR decides the correct handling |

Every converted row keeps its original value in a new `legacy_status` text column, so no
information is lost even where the mapping is a judgement call.

Two statuses describe a session still in progress rather than a finished result:
`OPEN_SESSION` is the state of a row with `session_status = OPEN`, and
`CLOCK_OUT_MISSING` covers an open session past its shift window that automatic closure
left for review. Automatic closure writes `AUTO_CLOSED`; HR-assisted closure writes the
value HR selects and records `closure_reason = HR_ASSISTED`.

`ABSENT` is written by the day-close job, not by a punch, and always with
`closure_reason = ABSENT_NO_SHOW`. Section 8 states the rule that produces it.

---

## 4. Migration strategy

### 4.1 Migration files

Existing history has one migration, `20261005000000_init`, which creates `users`,
`shifts`, and `attendances` with no RLS. It is not modified: the M1 instruction and PRD
§22 both require changes to go forward, not backward. The plan adds nine migrations. The
first eight create tables and enable RLS on each of them; the last adds role grants,
triggers and function hardening.

| # | File name | Creates | Also does |
|---|-----------|---------|-----------|
| 1 | `20261015120000_business_tenancy` | `businesses` | adds `business_id` to the three existing tables and backfills; enables RLS on `users`, `shifts`, `attendances`, `businesses`; business-scoped indexes; employee-code uniqueness per business |
| 2 | `20261015130000_identity_security_and_recovery` | `email_recovery_codes` | adds `pin_hash`, `pin_salt`, `pin_updated_at`, `pin_failed_count`, `pin_locked_until`, `pin_last_failed_at`, `must_change_pin` and `token_version` to `users`; RLS on the recovery table |
| 3 | `20261015140000_shift_scheduling_and_policies` | `shift_assignments`, `workplace_policies`, `policy_versions` | adds shift `start_minute`, `end_minute`, `crosses_midnight`; backfills from the text columns; RLS on the new tables |
| 4 | `20261015150000_attendance_evaluation_and_status` | none | adds evaluation snapshot columns, `closure_reason`, `alert_dismissed_at`, `legacy_status`; converts `date` to `date`; converts the status enum; adds the one-open-session partial index |
| 5 | `20261015160000_kiosk_and_verification` | `kiosk_terminals`, `qr_credentials`, `verification_sessions`, `attendance_attempts` | RLS on all four; append-only policies on `attendance_attempts` |
| 6 | `20261015170000_sites_and_location` | `sites` | adds the location columns and `site_id` to `attendance_attempts`, and `site_id` to `kiosk_terminals`; RLS on `sites` |
| 7 | `20261015180000_work_calendar_and_absence` | `work_calendars`, `calendar_exceptions` | RLS on both; creates one default `WorkCalendar` per existing business |
| 8 | `20261015190000_help_and_corrections_and_revisions` | `attendance_help_requests`, `attendance_corrections`, `attendance_correction_revisions` | RLS on all three; append-only policies on the revision table |
| 9 | `20261015200000_audit_log_and_integrity` | `audit_logs` | RLS with append-only policies; role grants; the `BEFORE UPDATE OR DELETE` append-only trigger; the `SECURITY DEFINER` login function with a pinned `search_path` |

Each migration is additive. The only schema-shape change that removes something is the
enum swap in migration 4, handled with a save of the old value (§4.4) and never touching
a row's existence.

### 4.2 RLS requirement on every created table

Every table created in these migrations runs, in the same file, in this form:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
```

The tables that need it: `businesses`, `users`, `shifts`, `attendances`,
`email_recovery_codes`, `shift_assignments`, `workplace_policies`, `policy_versions`,
`kiosk_terminals`, `qr_credentials`, `verification_sessions`, `attendance_attempts`,
`sites`, `work_calendars`, `calendar_exceptions`, `attendance_help_requests`,
`attendance_corrections`, `attendance_correction_revisions`, `audit_logs`. That is the
nineteen tables of the nineteen models in §2.

The initial migration predates this rule. Because it cannot be edited, `db-check.sh`
will keep flagging `users`, `shifts`, and `attendances` until the owner decides how to
reconcile the historical file. Migration 1 enables RLS on all three at runtime, which is
the security fix; the scanner's complaint about the old file is a documentation
reconciliation item, not a live exposure. **Open item for the owner** (see §7).

### 4.3 Migrating the three existing tables without data loss

Migration 1 uses this order, which never makes a column NOT NULL before it is filled:

1. `CREATE TABLE businesses` with the columns from §2.
2. Insert one bootstrap business row to own the existing users, shifts, and attendances.
   Its name is taken from the deployment, its timezone defaulted from `APP_TIMEZONE`, and
   its id fixed by the migration so the backfill is deterministic. A bootstrap row is the
   only way to add a required tenant to rows that predate tenants; if the deployment has
   no data, the row is still created so the schema is uniform.
3. `ALTER TABLE users ADD COLUMN business_id TEXT;` (and the same for `shifts` and
   `attendances`), initially nullable.
4. `UPDATE users SET business_id = '<bootstrap id>' WHERE business_id IS NULL;` and the
   same for the other two.
5. `ALTER TABLE ... ALTER COLUMN business_id SET NOT NULL;` and add the foreign key with
   `ON DELETE RESTRICT`.
6. Replace the global unique index on `employee_code` with `UNIQUE (business_id,
   employee_code)`. The `email` unique index stays global because login is by email
   alone. Dropping the old single-column unique index loses no row.
7. `ENABLE ROW LEVEL SECURITY` and the policies from §5.

No existing row is deleted or rewritten. Shifts keep their text times in migration 1;
migration 3 adds the minute columns, backfills by parsing `HH:MM`, and leaves the text
columns in place, marked deprecated, until an approved destructive migration removes
them. **Provisional:** the bootstrap business id and name.

### 4.4 Converting the status enum

Migration 4 converts `attendances.status` from the old enum to the new one in place:

```sql
ALTER TABLE attendances ADD COLUMN legacy_status TEXT;
UPDATE attendances SET legacy_status = status::text;
ALTER TABLE attendances ALTER COLUMN status DROP DEFAULT;
CREATE TYPE "AttendanceStatus_new" AS ENUM
  ('EARLY','ON_TIME','LATE','OPEN_SESSION','CLOCK_OUT_MISSING','AUTO_CLOSED','ABSENT','REQUIRES_REVIEW');
ALTER TABLE attendances ALTER COLUMN status TYPE "AttendanceStatus_new"
  USING (
    CASE status::text
      WHEN 'PRESENT'  THEN 'ON_TIME'
      WHEN 'LATE'     THEN 'LATE'
      WHEN 'ABSENT'   THEN 'ABSENT'
      WHEN 'HALF_DAY' THEN 'REQUIRES_REVIEW'
      WHEN 'ON_LEAVE' THEN 'REQUIRES_REVIEW'
      ELSE 'REQUIRES_REVIEW'
    END
  )::"AttendanceStatus_new";
DROP TYPE "AttendanceStatus";
ALTER TYPE "AttendanceStatus_new" RENAME TO "AttendanceStatus";
ALTER TABLE attendances ALTER COLUMN status SET DEFAULT 'OPEN_SESSION';
```

This is a dry-run-worthy operation under the DBA agent's rules even though no row is
deleted, because it renames a type. The plan is: capture `legacy_status` first, convert,
then verify row counts are unchanged and no `status` is null before dropping the old
type. `closure_reason` is a new column created in this same migration, so its enum
(`ClosureReason`, which now includes `ABSENT_NO_SHOW`) needs no conversion. The same
migration converts `date` to a real date column with `USING date AT TIME ZONE 'UTC'` on a
`date` cast, and converts the instant columns to `timestamptz` with
`USING col AT TIME ZONE 'UTC'`.

### 4.5 Indexes to add

The M0 reality check found only four indexes on `attendances`. The design adds the
following, grouped by the query they serve.

For business, employee, shift, and date-range queries on attendance:

- `attendances (business_id, date)` for a day or range within one business
- `attendances (business_id, user_id, date)` for one employee's history
- `attendances (business_id, shift_id, date)` for shift reporting
- `attendances (business_id, status)` and `(business_id, session_status)` for exceptions
- `attendances (user_id, session_status)` for the open-session check at punch time
- `attendances (business_id, closure_reason)` for the auto-closure report
- the partial unique `attendances (user_id) WHERE session_status = 'OPEN'`

For related tables:

- `users (business_id)`, `(business_id, is_active)`, `(business_id, department)`,
  `(business_id, shift_id)`, unique `(business_id, employee_code)`
- `shifts (business_id, is_active)`, unique `(business_id, name)`
- `shift_assignments (business_id, user_id, effective_from)`, `(business_id, shift_id)`,
  partial unique `(user_id) WHERE effective_to IS NULL`
- `sites` unique `(business_id, name)`, `(business_id, is_active)`
- `kiosk_terminals (business_id, state)`, `(business_id, site_id)`, `(token_hash)`,
  unique `(public_id)`
- `qr_credentials` unique `(token_hash)`, `(business_id, employee_id)`, partial unique
  `(employee_id) WHERE revoked_at IS NULL`
- `verification_sessions` unique `(session_id_hash)`, `(business_id, employee_id)`,
  `(kiosk_id)`, `(state, expires_at)`
- `attendance_attempts (business_id, created_at)`, `(business_id, employee_id, created_at)`,
  `(kiosk_id, created_at)`, `(business_id, site_id, created_at)`
- `email_recovery_codes (business_id, user_id, created_at)`, `(user_id, expires_at)`
- `attendance_help_requests (business_id, status)`, `(requester_id)`
- `attendance_corrections (business_id, status)`, `(business_id, review_tier)`,
  `(attendance_id)`, `(requested_by_id)`
- `attendance_correction_revisions` unique `(correction_id, revision_no)`,
  `(correction_id, revision_no)`, `(business_id, created_at)`
- `work_calendars` unique `(business_id, name)`, `(business_id, is_default)`, partial
  unique `(business_id) WHERE is_default`
- `calendar_exceptions` unique `(calendar_id, date)`, `(business_id, date)`,
  `(business_id, calendar_id)`
- `workplace_policies` unique `(business_id, name)`, partial unique `(business_id) WHERE
  shift_id IS NULL`
- `policy_versions` unique `(policy_id, version_number)`, `(business_id, policy_id,
  effective_from)`
- `audit_logs (business_id, created_at)`, `(business_id, entity_type, entity_id)`,
  `(business_id, action)`

Every foreign key column is covered by at least one of these, which is what
`db-check.sh` §3 looks for.

### 4.6 Each migration: timestamp, dependency, backfill and ordering

| # | File name | Depends on | Backfill | Ordering |
|---|-----------|-----------|----------|----------|
| 1 | `20261015120000_business_tenancy` | `20261005000000_init` | inserts one bootstrap business and sets `business_id` on `users`, `shifts`, `attendances` | first: every later migration references `businesses` |
| 2 | `20261015130000_identity_security_and_recovery` | 1 | none; the PIN fields default, and `email_recovery_codes` starts empty | after 1: the policy reads `users` through its tenant |
| 3 | `20261015140000_shift_scheduling_and_policies` | 1 | converts `shifts.start_time` and `shifts.end_time` (`HH:MM`) into `start_minute` and `end_minute` | after 1: needs `shifts.business_id` |
| 4 | `20261015150000_attendance_evaluation_and_status` | 1, 3 | copies the old status into `legacy_status`, converts `status`, and converts instants to `timestamptz` | after 3: the shift columns exist for the snapshot columns it adds |
| 5 | `20261015160000_kiosk_and_verification` | 1, 2 | none; all four tables start empty | after 2: a verification session binds a PIN-bearing user |
| 6 | `20261015170000_sites_and_location` | 1, 5 | none; `sites` starts empty and the location columns are nullable | after 5: the foreign key targets `attendance_attempts` and `kiosk_terminals` |
| 7 | `20261015180000_work_calendar_and_absence` | 1, 4 | creates one default `WorkCalendar` per existing business, seeded from `Business.timezone` and a Monday-to-Friday week | after 4: absence reads the converted `Attendance` status |
| 8 | `20261015190000_help_and_corrections_and_revisions` | 1, 4 | none; corrections and revisions start empty | after 4: a correction references a converted `Attendance` row |
| 9 | `20261015200000_audit_log_and_integrity` | 1 to 8 | none | last: the grants and the append-only trigger name every table, and the login function reads `users` |

The ordering rule is forward only: timestamps increase and an applied file is never
rewritten. Section 4.7 states the transaction and backup rules that surround the order.

### 4.7 Migration safety

A migration here changes a database that holds attendance history, so the plan treats a
forward migration as a change that needs a proven restore path before it runs.

- **Backup first.** Before any forward migration, take a full `pg_dump` of the target
  database as `attendpro_owner`. The dump is timestamped, stored outside the repository,
  and named after the migration it precedes. Nothing runs until the dump completes and
  its size is non-zero.
- **Restore rehearsal.** Restore the latest dump into the isolated test database (O14)
  and run the pending migration against the restored data. The rehearsal is re-run before
  every forward migration against the current dump, so the restore path is exercised on
  recent data rather than assumed from an earlier run. A rehearsal that fails stops the
  forward migration.
- **Test database guard.** The migration runner refuses to touch a database whose name
  does not end in `_test`, and it verifies the configured host before a destructive
  reset. Fake data only; real employee data is never copied into the test database (O14).
  The suffix check alone is not sufficient, so the connection is confirmed as well.
- **Forward only, one transaction per file.** Migrations run in timestamp order and an
  applied file is never rewritten. Each file runs inside a single transaction, so a
  failure rolls the whole file back instead of leaving a half-applied schema. A migration
  that cannot run in one transaction would be split into smaller files at design time.
- **Recovery.** A failed or partially applied migration is recovered by restoring from
  the backup taken before it, fixing the migration, and replaying it through the
  rehearsal. There is no down-migration path, and a partially applied file is not patched
  by hand.
- **Verification.** After each migration, check the row count of every pre-existing
  table against the count taken before the migration, confirm each new column carries the
  expected type, and confirm no `NOT NULL` column was added ahead of its backfill. Record
  the counts and the check results with the migration. Section 4.8 lists the legacy checks
  in full.

### 4.8 Legacy migration verification

The three tables that predate M1 (`users`, `shifts`, `attendances`) are converted without
losing a row.

- **Timestamps are preserved.** The instants written by the current code are UTC.
  Migration 4 converts each column to `timestamptz` with `USING col AT TIME ZONE 'UTC'`,
  which keeps the same point in time. There is no lossy retype and no store of a local
  wall-clock value.
- **Enum values are preserved.** Migration 4 copies `status::text` into `legacy_status`
  before the enum swap, so every original value survives the conversion.
- **Row counts are checked.** The count of `users`, `shifts` and `attendances` is captured
  before migration 4 and again after; the two counts must match. Migration 1 runs the same
  check on `business_id` coverage after its backfill.
- **Ambiguous rows stay distinguishable.** `HALF_DAY`, `ON_LEAVE` and any unknown value
  remain visible in `legacy_status`. They are mapped to `REQUIRES_REVIEW` and are never
  treated as a confirmed on-time, late or absent result. A review query lists rows whose
  `legacy_status` is one of the ambiguous values so HR decides each one.

---

## 5. Row Level Security policies

Every tenant table carries `business_id`, so each policy is the same one-column
predicate. The settings and roles are described in `M1-ARCHITECTURE.md` §3.

```sql
-- One per tenant table, with the table name substituted:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <table>_tenant_isolation ON <table>
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
```

`businesses` is scoped on its own id:

```sql
CREATE POLICY businesses_tenant_isolation ON businesses
  USING (id = current_setting('app.business_id', true))
  WITH CHECK (id = current_setting('app.business_id', true));
```

`audit_logs`, `attendance_correction_revisions` and `attendance_attempts` are append-only,
so each gets a `SELECT` policy and an `INSERT` policy and no update or delete policy:

```sql
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (business_id = current_setting('app.business_id', true));
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (business_id = current_setting('app.business_id', true));
-- The same two-policy form is repeated for attendance_correction_revisions
-- and attendance_attempts, with the table name substituted.
```

Section 10 states the full three-layer protection, of which these policies are the second
layer.

The login lookup runs outside a tenant context. It is a `SECURITY DEFINER` function
owned by `attendpro_owner`, and it is the only path by which the app role reads `users`
without a `business_id` setting (`M1-ARCHITECTURE.md` §3.7).

| Table | Policy type | Predicate |
|-------|-------------|-----------|
| `businesses` | all commands | `id = setting` |
| `users` | all commands | `business_id = setting` |
| `shifts` | all commands | `business_id = setting` |
| `shift_assignments` | all commands | `business_id = setting` |
| `attendances` | all commands | `business_id = setting` |
| `sites` | all commands | `business_id = setting` |
| `kiosk_terminals` | all commands | `business_id = setting` |
| `qr_credentials` | all commands | `business_id = setting` |
| `verification_sessions` | all commands | `business_id = setting` |
| `attendance_attempts` | select + insert only | `business_id = setting` |
| `attendance_help_requests` | all commands | `business_id = setting` |
| `attendance_corrections` | all commands | `business_id = setting` |
| `attendance_correction_revisions` | select + insert only | `business_id = setting` |
| `work_calendars` | all commands | `business_id = setting` |
| `calendar_exceptions` | all commands | `business_id = setting` |
| `workplace_policies` | all commands | `business_id = setting` |
| `policy_versions` | all commands | `business_id = setting` |
| `email_recovery_codes` | all commands | `business_id = setting` |
| `audit_logs` | select + insert only | `business_id = setting` |

---

## 6. Constraint-to-requirement map

| PRD requirement | Constraint or mechanism |
|-----------------|-------------------------|
| One open session per employee (§17) | Partial unique index on `attendances(user_id) WHERE session_status = 'OPEN'` |
| Idempotent clocking (§17) | `attendances.source_verification_session_id` unique; single-use verification session |
| No cascade erases attendance (§15, §17) | Every `Attendance` foreign key is `Restrict` or `SetNull`, and no relation cascades into it |
| Preserve shift and policy context (§12) | `Attendance` snapshot columns and `policyVersionId` |
| QR plus PIN verification (O2) | `User.pinHash` and `pinSalt` with `pinFailedCount`, `pinLockedUntil`; `VerificationSession.pinAttemptCount` and `lockedAt`; states `QR_ACCEPTED`, `PIN_PENDING`, `VERIFIED`, `LOCKED`, `EXPIRED`, `CONSUMED` |
| One active QR per employee (kiosk §3.3) | Partial unique index on `qr_credentials(employee_id) WHERE revoked_at IS NULL` |
| Device pairing and token (O3) | `KioskTerminal.pairingCodeHash`, `pairingCodeExpiresAt`, `tokenHash`, `tokenVersion`, `tokenExpiresAt`; state `PENDING_PAIRING`, `ACTIVE`, `REVOKED`, `EXPIRED` |
| Location assessment (O4) | `Site.latitude`, `longitude`, `radiusMeters`; `AttendanceAttempt.locationResult`, coordinates, `distanceMeters`, `capturedAt`; poor accuracy is `UNKNOWN` |
| Reviewable history (§14) | `AttendanceCorrection.originalValues` and `approvedValues`; append-only `AuditLog` |
| Correction window and tier (O17) | `AttendanceCorrection.requestedAt` and `reviewTier`; `PolicyVersion.correctionWindowDays` |
| Tenant boundaries (§5, §17) | `business_id` on every tenant table plus RLS policies |
| Audit for sensitive changes (§17) | `AuditLog` with `actorType`, before and after values |
| Consistent timestamps (§17) | `@db.Timestamptz(3)` on every instant; business-local `date` column |
| Absence from the working calendar (§12, §13, O16) | The day-close job writes `Attendance` with `status = ABSENT` and `closure_reason = ABSENT_NO_SHOW`, only when the date was scheduled, no clock-in occurred, and no leave source exists in v1 (§8) |
| Session revocation (O12) | `User.tokenVersion` checked on every authenticated request |
| Account recovery (O6) | `EmailRecoveryCode.codeHash`, `salt`, `expiresAt`, `usedAt`, `attemptCount` |
| Append-only history (§17, §20, O21) | Grants, RLS policies and the `BEFORE UPDATE OR DELETE` trigger in §10 |

---

## 7. Ambiguities and open items

**PRD ambiguities hit while modelling:**

1. **Off-day calendar.** PRD §7 and §9 mention off-days and a work calendar, and §17
   lists no entity for them. Owner direction (O16) settles this: `WorkCalendar` and
   `CalendarException` model the working week and its holidays in §2, and §8 states how
   they feed the absence rule. The staff schedule endpoint in
   `M1-API-CONTRACTS.md` still returns assignments only; wiring it to the calendar is a
   follow-up.
2. **Assignment representation.** PRD §17 omits an assignment entity and the current
   schema keeps `User.shiftId`. The design uses `ShiftAssignment` for dated history and
   keeps `shiftId` as a maintained current pointer, which reconciles the two rather than
   dropping a field the existing API reads.
3. **Absent determination.** PRD §12 ties `ABSENT` to "an approved schedule and
   attendance evaluation". Section 8 now states the rule: the day-close job writes an
   `Attendance` row with `status = ABSENT` and `closure_reason = ABSENT_NO_SHOW` when the
   employee was scheduled, had no clock-in by shift end plus grace, and no leave source
   applies in v1.
4. **Correction revision history.** PRD §14 asks that an approval not erase the original
   record. Owner direction (O17) settles this: `AttendanceCorrectionRevision` records
   every proposal, decision and applied change, append-only (§9). The correction row keeps
   `originalValues` and `approvedValues` for the common display path; the revision table
   is the replayable history.
5. **Enum swap and the historical migration.** The `init` migration will keep failing
   `db-check.sh` because it cannot be edited. The owner should decide whether to accept
   the scanner's report as a known historical item or to retro-annotate that file in a
   later, approved change.

**Provisional names introduced here** (not fixed by the register or the kiosk document):
`Site` and `EmailRecoveryCode` as model names, the `Pin`/pairing/location field names on
`User`, `KioskTerminal` and `AttendanceAttempt`, minute-of-day shift fields, the bootstrap
business, the `legacy_status` column, the `action` step discriminator on
`AttendanceCorrectionRevision` (`PROPOSED`, `DECIDED`, `APPLIED`), the `step` discriminator
on `AttendanceAttempt`, and the `name` and weekday-flag fields on `WorkCalendar`.

Open items that set values inside this model, not its shape: R1 (the GPS accuracy
threshold and the stale-capture definition, both carried as defaults on `PolicyVersion`)
and R5 (PIN length, attempt limit and lockout duration, carried as fields on `User` and
`VerificationSession`).

---

## 8. Calendars and absence

The working week and its holidays decide whether a date counts as a working day for an
employee. `WorkCalendar` and `CalendarException` supply that. Leave is deferred to version
two (O16), so no leave source exists in v1.

A date is a **scheduled working day** for an employee when all of these hold:

1. The employee has a `ShiftAssignment` effective on the date.
2. The business default `WorkCalendar` (`isDefault = true`) marks that weekday as a
   working day. More than one calendar can exist (O22); wiring a non-default calendar to
   a shift or an employee is a later step.
3. No `CalendarException` of kind `HOLIDAY` falls on the date. A `CalendarException` of
   kind `WORKING_OVERRIDE` turns a normally non-working weekday back into a working day.

**Absence rule.** The day-close job writes an `Attendance` row with `status = ABSENT` and
`closure_reason = ABSENT_NO_SHOW` when, for a business date, all of these hold:

- the employee was scheduled on that working day (per the `WorkCalendar`, and not a
  non-working `CalendarException`),
- the employee never clocked in by shift end plus grace.

If either condition fails, the job writes no absence row. A day the calendar marks as
non-working produces no row at all. A clock-in inside the window is evaluated by the
punctuality rule as late or on time rather than by the absence rule. Because leave is
deferred to v2, there is no leave source to consult in v1, and an approved-leave exemption
is not part of the rule until that work returns.

Absence is not a new table. It reuses `Attendance`, and the existing attendance indexes
cover the day-close scan. Calendar rows are tenant-owned; their foreign keys are
`Restrict` or `SetNull`, and none of them reaches `Attendance`.

---

## 9. Correction revisions

Every step on an `AttendanceCorrection` writes one `AttendanceCorrectionRevision` row, so
the full history of a correction is replayable. The three steps in an M1 correction:

| Step | `action` | `valuesBefore` | `valuesAfter` | `actorId` |
|------|----------|----------------|---------------|-----------|
| Staff submits | `PROPOSED` | the attendance fields at submission | the proposed values | the requester |
| HR decides | `DECIDED` | the values before the decision | the decision outcome | the reviewer |
| Change applied | `APPLIED` | the attendance values before the write | the values written to `Attendance` | the reviewer |

`revisionNo` starts at 1 for a correction and increments within it;
`@@unique([correctionId, revisionNo])` holds across the three steps. `valuesBefore` and
`valuesAfter` are JSON, so the exact fields at each step survive a later change to the
`Attendance` columns.

The correction itself records `requestedAt` when the employee raised it and `reviewTier`
(`SAME_DAY` or `ESCALATED`) for the path it follows (O17). The seven-day window comes from
`PolicyVersion.correctionWindowDays`.

The table is append-only (§10): there is no `updatedAt` and no update or delete path.
Reads reconstruct a correction by ordering its revisions on `revisionNo`.
`AttendanceCorrection.originalValues` and `approvedValues` stay for the common display
path; the revision rows are the full history the PRD §14 review asks for.

---

## 10. Append-only protection

Three tables keep history that must not be rewritten or deleted: `audit_logs`,
`attendance_correction_revisions` and `attendance_attempts`. Three layers enforce it, so
no single mistake removes a row.

**Layer 1: grants.** The application role `attendpro_app` is granted `SELECT` and
`INSERT` on each of the three tables and nothing else. It is never granted `UPDATE` or
`DELETE`. A statement that tries to update or delete fails at the privilege check, before
any policy or trigger runs.

```sql
GRANT SELECT, INSERT ON audit_logs, attendance_correction_revisions, attendance_attempts
  TO attendpro_app;
REVOKE UPDATE, DELETE ON audit_logs, attendance_correction_revisions, attendance_attempts
  FROM attendpro_app;
```

**Layer 2: policies.** Each of the three tables carries a `SELECT` policy and an `INSERT`
policy, and no `UPDATE` or `DELETE` policy. With RLS enabled and no policy for those
commands, they are denied even if the grant were widened by mistake. The policy form is
in §5.

**Layer 3: trigger.** A `BEFORE UPDATE OR DELETE` trigger on each of the three tables
raises an exception, so an owner-role statement that bypasses RLS is still refused unless
the trigger is deliberately disabled for a lawful purge.

```sql
CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
```

The grants, the trigger and its function are created in migration 9
(`audit_log_and_integrity`). The owner role `attendpro_owner` keeps `UPDATE` and `DELETE`
on the three tables for lawful retention and purge work under O10; the trigger is disabled
only for that recorded work.
