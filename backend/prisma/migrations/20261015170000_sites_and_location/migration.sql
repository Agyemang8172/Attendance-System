-- Migration 6 of 9 (M1-DATA-MODEL.md §4.1): sites and location.
--
-- Depends on:
--   * 20261015120000_business_tenancy (businesses table, business_id columns)
--   * 20261015160000_kiosk_and_verification (kiosk_terminals and
--     attendance_attempts, which already hold their site_id columns)
--
-- Creates sites, then adds the two deferred site_id foreign keys. Migration 5
-- created site_id on kiosk_terminals and attendance_attempts as plain nullable
-- TEXT columns because sites did not exist yet; the constraints are attached
-- here, where the target table finally exists.
--
-- NOTE ON LOCATION COLUMNS: latitude, longitude, accuracy_meters,
-- distance_meters, captured_at and received_at are columns of AttendanceAttempt
-- and were created together with that table in migration 5, per schema.prisma.
-- Nothing is re-added here.
--
-- Forward-only and additive. No column is added twice and no data is dropped.


-- ── sites ────────────────────────────────────────────────────────────────────

CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 150,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sites_business_id_name_key" UNIQUE ("business_id", "name")
);

ALTER TABLE "sites"
  ADD CONSTRAINT "sites_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Deferred site_id foreign keys from migration 5 ───────────────────────────
-- Plain ALTERs: the columns already exist (created nullable in migration 5), only
-- the constraints are missing. ON DELETE SET NULL per schema.prisma — removing a
-- site never erases a kiosk row or an attempt log row.

ALTER TABLE "kiosk_terminals"
  ADD CONSTRAINT "kiosk_terminals_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_attempts"
  ADD CONSTRAINT "attendance_attempts_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Indexes (M1-DATA-MODEL.md §4.5) ──────────────────────────────────────────
-- Unique (business_id, name) is created with the table above; the remaining
-- indexes cover the two new foreign keys and the sites activation filter.

CREATE INDEX "sites_business_id_is_active_idx"
  ON "sites"("business_id", "is_active");
CREATE INDEX "kiosk_terminals_site_id_idx"
  ON "kiosk_terminals"("site_id");
CREATE INDEX "attendance_attempts_site_id_idx"
  ON "attendance_attempts"("site_id");


-- ── Row Level Security (M1-DATA-MODEL.md §5) ─────────────────────────────────

ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sites_tenant_isolation" ON "sites"
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
