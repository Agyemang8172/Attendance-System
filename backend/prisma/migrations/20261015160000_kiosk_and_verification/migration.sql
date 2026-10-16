-- Migration 5 of 9 (M1-DATA-MODEL.md §4.1): kiosk and verification.
--
-- Depends on:
--   * 20261005000000_init             (users, shifts)
--   * 20261015120000_business_tenancy (businesses table, business_id columns)
--   * 20261015130000_identity_security_and_recovery (users PIN columns: a
--     verification session binds a PIN-bearing user, §4.6)
--
-- Creates kiosk_terminals, qr_credentials, verification_sessions and
-- attendance_attempts with every column, index, unique constraint and foreign key
-- the schema.prisma models declare. All four tables start empty; no backfill.
--
-- Forward-only and additive. ROW LEVEL SECURITY is enabled on all four tables in
-- this file (§4.2). attendance_attempts is append-only (§10): it gets a SELECT
-- policy and an INSERT policy only, never UPDATE or DELETE.


-- ── Enums (schema.prisma) ────────────────────────────────────────────────────

CREATE TYPE "KioskState" AS ENUM
  ('PENDING_PAIRING','ACTIVE','REVOKED','EXPIRED');
CREATE TYPE "VerificationState" AS ENUM
  ('QR_ACCEPTED','PIN_PENDING','VERIFIED','LOCKED','EXPIRED','CONSUMED');
CREATE TYPE "AttendanceAction" AS ENUM ('CLOCK_IN','CLOCK_OUT');
CREATE TYPE "AttemptOutcome" AS ENUM ('SUCCESS','REJECTED');
CREATE TYPE "LocationResult" AS ENUM ('INSIDE','OUTSIDE','UNKNOWN');


-- ── kiosk_terminals ──────────────────────────────────────────────────────────

CREATE TABLE "kiosk_terminals" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    -- site_id is created WITHOUT a foreign key: sites is created in migration 6
    -- (20261015170000_sites_and_location), which adds the FK constraint there.
    "site_id" TEXT,
    "label" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "pairing_code_hash" TEXT,
    "pairing_code_expires_at" TIMESTAMPTZ(3),
    "paired_at" TIMESTAMPTZ(3),
    "token_hash" TEXT,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "token_issued_at" TIMESTAMPTZ(3),
    "token_expires_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "state" "KioskState" NOT NULL DEFAULT 'PENDING_PAIRING',
    "registered_by_user_id" TEXT,
    "revoked_by_user_id" TEXT,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "kiosk_terminals_pkey" PRIMARY KEY ("id")
);


-- ── qr_credentials ───────────────────────────────────────────────────────────

CREATE TABLE "qr_credentials" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    -- issued_by_user_id / revoked_by_user_id are plain columns with no relation in
    -- schema.prisma, so they carry no foreign key by design.
    "issued_by_user_id" TEXT,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qr_credentials_pkey" PRIMARY KEY ("id")
);


-- ── verification_sessions ────────────────────────────────────────────────────

CREATE TABLE "verification_sessions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "kiosk_id" TEXT NOT NULL,
    "session_id_hash" TEXT NOT NULL,
    "state" "VerificationState" NOT NULL DEFAULT 'QR_ACCEPTED',
    "pin_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "verification_sessions_pkey" PRIMARY KEY ("id")
);


-- ── attendance_attempts ──────────────────────────────────────────────────────
-- Append-only kiosk step log (kiosk §6.1, O7, O21; protection in §10). The
-- location assessment columns belong to the table and are created with it.
--
-- site_id: column created WITHOUT a foreign key; sites arrives in migration 6
--   (20261015170000_sites_and_location), which adds the FK constraint there.
-- verification_session_id: plain column with no relation in schema.prisma, so it
--   never gets a foreign key — the attempt log stays readable after a session is
--   purged (failure-evidence rule, O7). attendances.source_verification_session_id
--   (migration 4) is likewise a plain column with no FK; nothing here references
--   attendances, so no FK to attendances is added.

CREATE TABLE "attendance_attempts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "kiosk_id" TEXT,
    "site_id" TEXT,
    "verification_session_id" TEXT,
    "action" "AttendanceAction",
    "step" TEXT,
    "outcome" "AttemptOutcome" NOT NULL,
    "reason" TEXT,
    "location_result" "LocationResult",
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy_meters" DOUBLE PRECISION,
    "distance_meters" DOUBLE PRECISION,
    "captured_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_attempts_pkey" PRIMARY KEY ("id")
);


-- ── Unique indexes expected by schema.prisma (@unique) ───────────────────────

CREATE UNIQUE INDEX "kiosk_terminals_public_id_key" ON "kiosk_terminals"("public_id");
CREATE UNIQUE INDEX "kiosk_terminals_token_hash_key" ON "kiosk_terminals"("token_hash");
CREATE UNIQUE INDEX "qr_credentials_token_hash_key" ON "qr_credentials"("token_hash");
CREATE UNIQUE INDEX "verification_sessions_session_id_hash_key"
  ON "verification_sessions"("session_id_hash");


-- ── Indexes (M1-DATA-MODEL.md §4.5) ──────────────────────────────────────────
-- kiosk_terminals(token_hash): schema.prisma also declares @@index([tokenHash]),
-- but the unique index above already covers that column, so no second identical
-- index is created.

CREATE INDEX "kiosk_terminals_business_id_state_idx"
  ON "kiosk_terminals"("business_id", "state");
CREATE INDEX "kiosk_terminals_business_id_site_id_idx"
  ON "kiosk_terminals"("business_id", "site_id");

CREATE INDEX "qr_credentials_business_id_employee_id_idx"
  ON "qr_credentials"("business_id", "employee_id");
-- Partial unique: one active credential per employee (kiosk §3.3).
CREATE UNIQUE INDEX "qr_credentials_active_uq"
  ON "qr_credentials"("employee_id") WHERE "revoked_at" IS NULL;

CREATE INDEX "verification_sessions_business_id_employee_id_idx"
  ON "verification_sessions"("business_id", "employee_id");
CREATE INDEX "verification_sessions_kiosk_id_idx"
  ON "verification_sessions"("kiosk_id");
CREATE INDEX "verification_sessions_state_expires_at_idx"
  ON "verification_sessions"("state", "expires_at");

CREATE INDEX "attendance_attempts_business_id_created_at_idx"
  ON "attendance_attempts"("business_id", "created_at");
CREATE INDEX "attendance_attempts_business_id_employee_id_created_at_idx"
  ON "attendance_attempts"("business_id", "employee_id", "created_at");
CREATE INDEX "attendance_attempts_kiosk_id_created_at_idx"
  ON "attendance_attempts"("kiosk_id", "created_at");
CREATE INDEX "attendance_attempts_business_id_site_id_created_at_idx"
  ON "attendance_attempts"("business_id", "site_id", "created_at");


-- ── Foreign keys ─────────────────────────────────────────────────────────────
-- onDelete per schema.prisma: Restrict on tenant and required relations, SetNull
-- on optional ones. No cascade reaches attendance history.

ALTER TABLE "kiosk_terminals"
  ADD CONSTRAINT "kiosk_terminals_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kiosk_terminals"
  ADD CONSTRAINT "kiosk_terminals_registered_by_user_id_fkey"
  FOREIGN KEY ("registered_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kiosk_terminals"
  ADD CONSTRAINT "kiosk_terminals_revoked_by_user_id_fkey"
  FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "qr_credentials"
  ADD CONSTRAINT "qr_credentials_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qr_credentials"
  ADD CONSTRAINT "qr_credentials_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "verification_sessions"
  ADD CONSTRAINT "verification_sessions_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_sessions"
  ADD CONSTRAINT "verification_sessions_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_sessions"
  ADD CONSTRAINT "verification_sessions_kiosk_id_fkey"
  FOREIGN KEY ("kiosk_id") REFERENCES "kiosk_terminals"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_attempts"
  ADD CONSTRAINT "attendance_attempts_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_attempts"
  ADD CONSTRAINT "attendance_attempts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_attempts"
  ADD CONSTRAINT "attendance_attempts_kiosk_id_fkey"
  FOREIGN KEY ("kiosk_id") REFERENCES "kiosk_terminals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Row Level Security (M1-DATA-MODEL.md §5) ─────────────────────────────────

ALTER TABLE "kiosk_terminals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kiosk_terminals_tenant_isolation" ON "kiosk_terminals"
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

ALTER TABLE "qr_credentials" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr_credentials_tenant_isolation" ON "qr_credentials"
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

ALTER TABLE "verification_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verification_sessions_tenant_isolation" ON "verification_sessions"
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

-- attendance_attempts is append-only (§5, §10): SELECT and INSERT policies only,
-- no UPDATE or DELETE policy. Grants and the mutation trigger are added in
-- migration 9 (20261015200000_audit_log_and_integrity).
ALTER TABLE "attendance_attempts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_attempts_select" ON "attendance_attempts" FOR SELECT
  USING (business_id = current_setting('app.business_id', true));
CREATE POLICY "attendance_attempts_insert" ON "attendance_attempts" FOR INSERT
  WITH CHECK (business_id = current_setting('app.business_id', true));
