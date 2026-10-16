-- Migration 4 of 9 (M1-DATA-MODEL.md §4.1): attendance evaluation and status.
--
-- Depends on:
--   * 20261005000000_init            (attendances table, old AttendanceStatus enum)
--   * 20261015120000_business_tenancy (attendances.business_id NOT NULL)
--   * 20261015140000_shift_scheduling_and_policies (policy_versions table; shift
--     start_minute/end_minute/crosses_midnight columns)
--
-- Forward-only and additive. No row is deleted and no existing migration file is
-- modified. The only schema-shape change is the status enum swap, which saves every
-- old value into legacy_status first (§4.4).
--
-- NOTE ON RLS: ROW LEVEL SECURITY on "attendances" was already enabled, with the
-- tenant-isolation policy, in migration 1 (20261015120000_business_tenancy). It is
-- NOT re-enabled here and no policy is duplicated (M1-DATA-MODEL.md §4.2, §5).


-- ── 1. Status enum conversion ────────────────────────────────────────────────
-- M1-DATA-MODEL.md §4.4, verbatim.

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

-- legacy_status is a migration-only audit column (§3, §4.4). It is deliberately
-- not declared in schema.prisma; Prisma never reads or writes it.


-- ── 2. ClosureReason enum and closure_reason column ──────────────────────────
-- New enum from schema.prisma (includes ABSENT_NO_SHOW). The column is new, so no
-- conversion of existing rows is needed (§4.4).

CREATE TYPE "ClosureReason" AS ENUM
  ('VERIFIED_CLOCK_OUT','AUTO_CLOCK_OUT','HR_ASSISTED','CORRECTION','ABSENT_NO_SHOW');

ALTER TABLE attendances ADD COLUMN closure_reason "ClosureReason";


-- ── 3. New evaluation columns ────────────────────────────────────────────────
-- Every column the Attendance model in schema.prisma has that the init migration
-- lacks. All nullable; no backfill data needed.

ALTER TABLE attendances ADD COLUMN requires_review_reason TEXT;
ALTER TABLE attendances ADD COLUMN alert_dismissed_at TIMESTAMPTZ(3);

-- Historical snapshots: the shift and policy used at evaluation time (PRD §12).
ALTER TABLE attendances ADD COLUMN shift_id TEXT;
ALTER TABLE attendances ADD COLUMN shift_name_snapshot TEXT;
ALTER TABLE attendances ADD COLUMN shift_start_minute_snapshot INTEGER;
ALTER TABLE attendances ADD COLUMN shift_end_minute_snapshot INTEGER;
ALTER TABLE attendances ADD COLUMN shift_crosses_midnight_snapshot BOOLEAN;
ALTER TABLE attendances ADD COLUMN timezone_snapshot TEXT;
ALTER TABLE attendances ADD COLUMN grace_early_minutes_snapshot INTEGER;
ALTER TABLE attendances ADD COLUMN grace_late_minutes_snapshot INTEGER;
ALTER TABLE attendances ADD COLUMN policy_version_id TEXT;
ALTER TABLE attendances ADD COLUMN policy_snapshot JSONB;

-- Source references.
--
-- created_by_kiosk_id and source_verification_session_id intentionally carry NO
-- foreign key constraint: their targets (kiosk_terminals, verification_sessions)
-- are created in migration 5 (20261015160000_kiosk_and_verification), which runs
-- after this one, and later migrations must NOT add FKs back onto attendances.
-- The design keeps the historical attendance row even if the source kiosk or
-- session is later removed — no cascade erases history (PRD §15, §17).
ALTER TABLE attendances ADD COLUMN created_by_kiosk_id TEXT;
ALTER TABLE attendances ADD COLUMN source_verification_session_id TEXT;


-- ── 4. Type conversions ──────────────────────────────────────────────────────
-- date: TIMESTAMP(3) -> DATE. Instants: TIMESTAMP(3) -> TIMESTAMPTZ(3), treating
-- the stored wall-clock values as UTC (§4.4, §4.8): the same point in time is
-- kept, no row is rewritten beyond the retype. Defaults are dropped before the
-- type change and restored afterwards where schema.prisma still declares one.
--
-- Pin the session timezone so the intermediate timestamptz of the date conversion
-- renders deterministically (SET LOCAL: scoped to this migration's transaction,
-- no schema change).

SET LOCAL TIME ZONE 'UTC';

-- date: init had DEFAULT CURRENT_TIMESTAMP; schema.prisma gives `date` no default,
-- so the default is dropped and none is restored.
ALTER TABLE attendances ALTER COLUMN date DROP DEFAULT;
ALTER TABLE attendances ALTER COLUMN date TYPE DATE USING (date AT TIME ZONE 'UTC')::date;

ALTER TABLE attendances ALTER COLUMN clock_in DROP DEFAULT;
ALTER TABLE attendances ALTER COLUMN clock_in TYPE TIMESTAMPTZ(3) USING clock_in AT TIME ZONE 'UTC';
ALTER TABLE attendances ALTER COLUMN clock_in SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE attendances ALTER COLUMN clock_out TYPE TIMESTAMPTZ(3) USING clock_out AT TIME ZONE 'UTC';

ALTER TABLE attendances ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE attendances ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
ALTER TABLE attendances ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- updated_at is @updatedAt: no default in init, none restored.
ALTER TABLE attendances ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';

-- §4.8: the same conversion for the two other legacy tables. `users` and `shifts`
-- instants were written as UTC by the current code; retyping keeps the same point
-- in time and brings the live schema in line with schema.prisma's
-- @db.Timestamptz(3) annotations, so `prisma migrate diff` sees no drift.
ALTER TABLE users ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE shifts ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE shifts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
ALTER TABLE shifts ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


-- ── 5. Foreign keys ──────────────────────────────────────────────────────────
-- Both targets already exist (shifts from init, policy_versions from migration 3),
-- so the FKs are added here. Both are SetNull per schema.prisma: deleting a shift
-- or policy version never erases attendance history.

ALTER TABLE attendances ADD CONSTRAINT attendances_shift_id_fkey
  FOREIGN KEY (shift_id) REFERENCES shifts("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
-- devos:no-index attendances_shift_id_fkey covered by attendances_shift_id_idx (below) and attendances_business_id_shift_id_date_idx (§4.5).

ALTER TABLE attendances ADD CONSTRAINT attendances_policy_version_id_fkey
  FOREIGN KEY (policy_version_id) REFERENCES policy_versions("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
-- devos:no-index attendances_policy_version_id_fkey covered by attendances_policy_version_id_idx (below).

-- The init migration created attendances_user_id_fkey with ON DELETE CASCADE,
-- which contradicts schema.prisma (Attendance.user is onDelete: Restrict) and the
-- design rule that no cascade may erase attendance history (PRD §15, §17,
-- M1-DATA-MODEL §6). The constraint is recreated with RESTRICT. No row is touched:
-- only the constraint definition changes, and no data ever depended on cascading.
ALTER TABLE attendances DROP CONSTRAINT attendances_user_id_fkey;
ALTER TABLE attendances ADD CONSTRAINT attendances_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
-- devos:no-index attendances_user_id_fkey covered by attendances_user_id_session_status_idx (migration 1), which leads on user_id.


-- ── 5b. Supporting indexes for the FK columns ────────────────────────────────
-- (business_id, shift_id, date) from §4.5 does not lead on shift_id, so the
-- RESTRICT check on a shift delete and per-shift lookups need their own index.
-- policy_version_id has no other index (§4.5 gap noted in review).
CREATE INDEX "attendances_shift_id_idx" ON "attendances"("shift_id");
CREATE INDEX "attendances_policy_version_id_idx" ON "attendances"("policy_version_id");


-- ── 6. Unique indexes expected by schema.prisma ──────────────────────────────
-- source_verification_session_id is @unique (idempotent clocking, §6).

CREATE UNIQUE INDEX "attendances_source_verification_session_id_key"
  ON "attendances"("source_verification_session_id");


-- ── 7. Indexes (M1-DATA-MODEL.md §4.5) ───────────────────────────────────────
-- Five of the §4.5 attendances indexes (business_id+date, business_id+user_id+date,
-- business_id+status, business_id+session_status, user_id+session_status) are created
-- by migration 1, 20261015120000_business_tenancy, which is where §4.1 assigns the
-- business-scoped indexes. Postgres rebuilds them automatically when this migration
-- retypes `date` and swaps the status enum, so they are not recreated here.
-- Only the indexes whose columns first exist in this migration are added:

CREATE INDEX "attendances_business_id_shift_id_date_idx"
  ON "attendances"("business_id", "shift_id", "date");
CREATE INDEX "attendances_business_id_closure_reason_idx"
  ON "attendances"("business_id", "closure_reason");

-- Partial unique: one open session per employee (PRD §17, M0 finding F3).
CREATE UNIQUE INDEX "attendances_open_per_user_uq"
  ON "attendances"("user_id") WHERE "session_status" = 'OPEN';
