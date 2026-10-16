-- Migration 20261015140000_shift_scheduling_and_policies (M1 migration 3 of 9).
-- Sources: M1-DATA-MODEL.md 4.1 (file plan), 4.2, 4.3 (legacy text columns are
-- retained), 4.5 (indexes), 4.6 (depends on migration 1; backfill from the text
-- times), 5 (policies). PRD 11 and 12: dated assignment history and policy
-- versions. Forward-only and additive: 20261005000000_init is never modified
-- and no row is deleted. Applied inside one Prisma transaction.

-- ---------------------------------------------------------------------------
-- 1. shift_assignments: dated assignment history. Every relation in the
--    ShiftAssignment model is onDelete: Restrict, so history is never cascaded
--    away. assigned_by_user_id is a plain column in schema.prisma (no relation
--    attribute), so it deliberately carries no foreign key: the audit trail
--    stays readable after that actor is removed.
--    Column names match the @map values of ShiftAssignment.
-- ---------------------------------------------------------------------------
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "assigned_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 2. workplace_policies: the policy header. shift_id is null for the business
--    default and set for a shift-specific override; onDelete: SetNull matches
--    the Shift relation in schema.prisma. No updatedAt default: Prisma writes
--    the column on every update, so it is NOT NULL with no database default.
-- ---------------------------------------------------------------------------
CREATE TABLE "workplace_policies" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "workplace_policies_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3. policy_versions: the dated values of a policy. It starts empty, so no
--    backfill. Columns and defaults follow the PolicyVersion model in
--    schema.prisma. created_by_user_id is a plain column with no relation
--    attribute, so it has no foreign key by design.
-- ---------------------------------------------------------------------------
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "grace_early_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_threshold_minutes" INTEGER NOT NULL DEFAULT 0,
    "auto_clock_out_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_clock_out_offset_minutes" INTEGER,
    "auto_clock_out_buffer_minutes" INTEGER NOT NULL DEFAULT 120,
    "auto_clock_out_max_open_minutes" INTEGER NOT NULL DEFAULT 840,
    "correction_window_days" INTEGER NOT NULL DEFAULT 7,
    "geo_fence_radius_meters" INTEGER NOT NULL DEFAULT 150,
    "location_accuracy_threshold_meters" INTEGER NOT NULL DEFAULT 50,
    "gps_freshness_seconds" INTEGER NOT NULL DEFAULT 60,
    "observe_public_holidays" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 4. shifts minute-of-day window. The init migration created shifts with only
--    id, name, start_time, end_time, created_at, so is_active does not exist
--    either and is added here with the schema default.
--    Legacy text columns are retained by design (schema comment on
--    Shift.startTime / Shift.endTime, M1-DATA-MODEL.md 4.3): init stored
--    NOT NULL 'HH:MM' text and this migration leaves those columns in place,
--    marked deprecated, until an approved destructive migration removes them.
-- ---------------------------------------------------------------------------
ALTER TABLE "shifts" ADD COLUMN "start_minute" INTEGER;
ALTER TABLE "shifts" ADD COLUMN "end_minute" INTEGER;
ALTER TABLE "shifts" ADD COLUMN "crosses_midnight" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shifts" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Added here, though the 4.1 row for this file does not list it: init has no
-- shifts.updated_at while Shift.updatedAt is @updatedAt and NOT NULL in
-- schema.prisma, so every Prisma write to shifts would fail without it. The
-- default is dropped immediately so the finished column is exactly the shape
-- Prisma generates (TIMESTAMPTZ(3) NOT NULL, no default); existing rows keep
-- the migration timestamp, which is the first truthful updated_at they can
-- have.
ALTER TABLE "shifts" ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "shifts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- Backfill in two statements (4.3, 4.6): the second reads the minutes the first
-- wrote. init declares start_time and end_time NOT NULL, so every row is parsed;
-- the WHERE clause keeps the statement idempotent and re-runnable. A value that
-- is not 'HH:MM' raises on the ::int cast and rolls the whole file back rather
-- than writing a wrong minute.
UPDATE "shifts"
   SET "start_minute" = split_part("start_time", ':', 1)::int * 60
                       + split_part("start_time", ':', 2)::int,
       "end_minute"   = split_part("end_time", ':', 1)::int * 60
                       + split_part("end_time", ':', 2)::int
 WHERE "start_minute" IS NULL;

UPDATE "shifts"
   SET "crosses_midnight" = ("end_minute" < "start_minute")
 WHERE "crosses_midnight" = false
   AND "start_minute" IS NOT NULL
   AND "end_minute" IS NOT NULL;

-- Only now do the minute columns become NOT NULL, after the backfill filled them.
ALTER TABLE "shifts" ALTER COLUMN "start_minute" SET NOT NULL;
ALTER TABLE "shifts" ALTER COLUMN "end_minute" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Foreign keys. Restrict everywhere a history row points at a tenant, a user
--    or a shift; SetNull from workplace_policies to shifts, matching the
--    onDelete attributes in schema.prisma.
-- ---------------------------------------------------------------------------
ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "shifts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workplace_policies"
    ADD CONSTRAINT "workplace_policies_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workplace_policies"
    ADD CONSTRAINT "workplace_policies_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "shifts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "policy_versions"
    ADD CONSTRAINT "policy_versions_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "policy_versions"
    ADD CONSTRAINT "policy_versions_policy_id_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "workplace_policies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Indexes from 4.5 for the three new tables, including both partial uniques,
--    which the Prisma schema cannot express and which are therefore written as
--    raw SQL: at most one open-ended assignment per user, and one business-
--    default (shift_id IS NULL) policy per business.
-- ---------------------------------------------------------------------------
CREATE INDEX "shift_assignments_business_id_user_id_effective_from_idx"
    ON "shift_assignments"("business_id", "user_id", "effective_from");
CREATE INDEX "shift_assignments_business_id_shift_id_idx"
    ON "shift_assignments"("business_id", "shift_id");
CREATE UNIQUE INDEX "shift_assignments_current_uq"
    ON "shift_assignments"("user_id")
    WHERE "effective_to" IS NULL;

ALTER TABLE "workplace_policies"
    ADD CONSTRAINT "workplace_policies_business_id_name_key"
    UNIQUE ("business_id", "name");
CREATE UNIQUE INDEX "workplace_policies_default_uq"
    ON "workplace_policies"("business_id")
    WHERE "shift_id" IS NULL;

ALTER TABLE "policy_versions"
    ADD CONSTRAINT "policy_versions_policy_id_version_number_key"
    UNIQUE ("policy_id", "version_number");
CREATE INDEX "policy_versions_business_id_policy_id_effective_from_idx"
    ON "policy_versions"("business_id", "policy_id", "effective_from");

-- ---------------------------------------------------------------------------
-- 7. Row level security (M1-DATA-MODEL.md 4.2, 5): one enable plus one
--    tenant-isolation policy per table created in this file. shifts already
--    carries its policy from 20261015120000_business_tenancy.
-- ---------------------------------------------------------------------------
ALTER TABLE "shift_assignments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY shift_assignments_tenant_isolation ON shift_assignments
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

ALTER TABLE "workplace_policies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workplace_policies_tenant_isolation ON workplace_policies
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

ALTER TABLE "policy_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_versions_tenant_isolation ON policy_versions
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
