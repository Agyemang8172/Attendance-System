-- Migration 20261015130000_identity_security_and_recovery (M1 migration 2 of 9).
-- Sources: M1-DATA-MODEL.md 4.1 (file plan), 4.2, 4.5 (indexes), 4.6 (depends
-- on migration 1), 5 (policies); M1-KIOSK-SECURITY.md 5.1 (kiosk PIN); O6
-- (email recovery codes); O12 (token_version).
-- Forward-only and additive: 20261005000000_init is never modified, nothing is
-- dropped, and no backfill is needed. Applied inside one Prisma transaction.

-- ---------------------------------------------------------------------------
-- 1. Kiosk PIN and session-revocation columns on users. Names come from the
--    User model @map values in schema.prisma; types follow the documented
--    mapping (String -> TEXT, DateTime @db.Timestamptz(3) -> TIMESTAMPTZ(3),
--    Int -> INTEGER, Boolean -> BOOLEAN). Existing rows take the defaults, so
--    no column is added NOT NULL without one. All PIN columns are nullable:
--    a user without a PIN simply cannot clock in at a kiosk yet.
--    must_change_pin defaults to false, exactly as User.mustChangePin does in
--    schema.prisma (Prisma Client sets the flag when an HR reset happens).
-- ---------------------------------------------------------------------------
ALTER TABLE "users"
    ADD COLUMN "pin_hash" TEXT,
    ADD COLUMN "pin_salt" TEXT,
    ADD COLUMN "pin_updated_at" TIMESTAMPTZ(3),
    ADD COLUMN "pin_failed_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "pin_locked_until" TIMESTAMPTZ(3),
    ADD COLUMN "pin_last_failed_at" TIMESTAMPTZ(3),
    ADD COLUMN "must_change_pin" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. email_recovery_codes (O6): a single-use, hashed, rate-limited recovery
--    code. It starts empty (4.6: no backfill). Column names match the
--    EmailRecoveryCode model @map values in schema.prisma.
-- ---------------------------------------------------------------------------
CREATE TABLE "email_recovery_codes" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3. Indexes from 4.5. Both foreign keys are Restrict, per the EmailRecoveryCode
--    relations in schema.prisma: recovery history must survive neither a user
--    nor a business being deleted by accident, and attendance history is never
--    cascaded into.
-- ---------------------------------------------------------------------------
CREATE INDEX "email_recovery_codes_business_id_user_id_created_at_idx"
    ON "email_recovery_codes"("business_id", "user_id", "created_at");
CREATE INDEX "email_recovery_codes_user_id_expires_at_idx"
    ON "email_recovery_codes"("user_id", "expires_at");

ALTER TABLE "email_recovery_codes"
    ADD CONSTRAINT "email_recovery_codes_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_recovery_codes"
    ADD CONSTRAINT "email_recovery_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Row level security (M1-DATA-MODEL.md 4.2, 5). This file creates one table
--    and it gets RLS plus its tenant-isolation policy here, in the same file.
-- ---------------------------------------------------------------------------
ALTER TABLE "email_recovery_codes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_recovery_codes_tenant_isolation ON email_recovery_codes
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
