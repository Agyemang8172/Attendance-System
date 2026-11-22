-- Migration 20261015120000_business_tenancy (M1 migration 1 of 9).
-- Sources: M1-DATA-MODEL.md 4.1 (file plan), 4.2 (RLS on every table), 4.3
-- (backfill order), 4.5 (indexes), 5 (policies); M1-ARCHITECTURE.md 3 (roles
-- and the app.business_id tenant setting).
-- Forward-only: 20261005000000_init is never modified and no row is deleted.
-- Prisma applies one migration file in one transaction, so there is no
-- BEGIN/COMMIT here.

-- ---------------------------------------------------------------------------
-- 1. Tenant root (M1-DATA-MODEL.md 4.3 step 1). Column names, types, nullability
--    and defaults match the Business model in schema.prisma.
-- ---------------------------------------------------------------------------
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "support_email" TEXT,
    "support_phone" TEXT,
    "retention_years" INTEGER NOT NULL DEFAULT 7,
    "retention_enabled" BOOLEAN NOT NULL DEFAULT false,
    "attendance_retention_days" INTEGER,
    "audit_retention_days" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- PROVISIONAL bootstrap business (M1-DATA-MODEL.md 4.3 step 2 and 7). The id and
-- the slug are fixed constants in this file so the backfill below is
-- deterministic: every legacy user, shift and attendance row lands on this one
-- tenant. It is created even on an empty deployment so the schema is uniform.
-- The id must not change while legacy rows reference it; the deployment may
-- rename the row and set its timezone (here it takes the column default, UTC,
-- standing in for APP_TIMEZONE) once it runs.
INSERT INTO "businesses" ("id", "name", "slug", "timezone", "updated_at")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Default Business',
    'default-business',
    'UTC',
    CURRENT_TIMESTAMP
);

-- Schema-level unique on Business.slug (@unique) and the business-scoped index.
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");
CREATE INDEX "businesses_is_active_idx" ON "businesses"("is_active");

-- ---------------------------------------------------------------------------
-- 2. business_id on the three legacy tables (4.3 steps 3-5): add nullable,
--    backfill, then SET NOT NULL, then the foreign key. No column becomes NOT
--    NULL before it is filled and no existing row is rewritten beyond that fill.
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN "business_id" TEXT;
ALTER TABLE "shifts" ADD COLUMN "business_id" TEXT;
ALTER TABLE "attendances" ADD COLUMN "business_id" TEXT;

UPDATE "users"
   SET "business_id" = '00000000-0000-4000-8000-000000000001'
 WHERE "business_id" IS NULL;

UPDATE "shifts"
   SET "business_id" = '00000000-0000-4000-8000-000000000001'
 WHERE "business_id" IS NULL;

UPDATE "attendances"
   SET "business_id" = '00000000-0000-4000-8000-000000000001'
 WHERE "business_id" IS NULL;

-- Backfill coverage is now proven: SET NOT NULL fails and rolls the file back if
-- any row was missed (M1-DATA-MODEL.md 4.8).

ALTER TABLE "users" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "shifts" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "attendances" ALTER COLUMN "business_id" SET NOT NULL;

ALTER TABLE "users"
    ADD CONSTRAINT "users_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendances"
    ADD CONSTRAINT "attendances_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. employee_code unique per business (4.3 step 6). The old single-column
--    unique index (name taken from the init migration) is dropped; no row is
--    lost, and global uniqueness of (business_id, employee_code) is strictly
--    weaker than the global employee_code uniqueness it replaces, so it cannot
--    fail on existing data. users_email_key stays global: login is by email
--    alone.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "users_employee_code_key";

ALTER TABLE "users"
    ADD CONSTRAINT "users_business_id_employee_code_key"
    UNIQUE ("business_id", "employee_code");

-- ---------------------------------------------------------------------------
-- 4. Business-scoped indexes from 4.5 for businesses, users, shifts and
--    attendances. The pre-existing init indexes on (email), (employee_code),
--    (department), (is_active), attendances (user_id), (date),
--    (session_status) and (user_id, date) are left in place.
--    Note: unique (business_id, name) on shifts will refuse duplicate legacy
--    names within the bootstrap tenant; init declared no such constraint. A
--    duplicate rolls this file back, which is the intended fail-safe.
-- ---------------------------------------------------------------------------
CREATE INDEX "users_business_id_idx" ON "users"("business_id");
CREATE INDEX "users_business_id_is_active_idx" ON "users"("business_id", "is_active");
CREATE INDEX "users_business_id_department_idx" ON "users"("business_id", "department");
CREATE INDEX "users_business_id_shift_id_idx" ON "users"("business_id", "shift_id");

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_business_id_name_key"
    UNIQUE ("business_id", "name");

-- CREATE INDEX "shifts_business_id_is_active_idx" is NOT here: init declares no
-- shifts.is_active and this migration must not index a column a later file
-- adds. The composite index is created by
-- 20261015140000_shift_scheduling_and_policies right after the column itself.
CREATE INDEX "attendances_business_id_date_idx" ON "attendances"("business_id", "date");
CREATE INDEX "attendances_business_id_user_id_date_idx" ON "attendances"("business_id", "user_id", "date");
CREATE INDEX "attendances_business_id_status_idx" ON "attendances"("business_id", "status");
CREATE INDEX "attendances_business_id_session_status_idx" ON "attendances"("business_id", "session_status");
CREATE INDEX "attendances_user_id_session_status_idx" ON "attendances"("user_id", "session_status");

-- Deferred to 20261015150000_attendance_evaluation_and_status, which creates the
-- columns they need: attendances (business_id, shift_id, date) [shift_id does
-- not exist yet], (business_id, closure_reason), and the partial unique
-- (user_id) WHERE session_status = 'OPEN'.

-- ---------------------------------------------------------------------------
-- 5. Row level security (4.2 and 5) on the tenant root and the three legacy
--    tables. The bootstrap insert and the backfill above ran before RLS was
--    enabled; they run as attendpro_owner, which bypasses RLS as table owner
--    (M1-ARCHITECTURE.md 3.1). Fail-closed: with app.business_id unset the
--    predicate is NULL and never true.
-- ---------------------------------------------------------------------------
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY businesses_tenant_isolation ON businesses
  USING (id = current_setting('app.business_id', true))
  WITH CHECK (id = current_setting('app.business_id', true));

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY shifts_tenant_isolation ON shifts
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

ALTER TABLE "attendances" ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendances_tenant_isolation ON attendances
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
