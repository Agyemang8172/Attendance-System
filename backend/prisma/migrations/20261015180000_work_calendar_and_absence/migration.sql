-- Migration 7: work calendars and calendar exceptions
-- Depends on: 20261015120000_business_tenancy (businesses). Forward-only, additive.
-- Column names, types, nullability and FK onDelete follow backend/prisma/schema.prisma
-- (WorkCalendar, CalendarException) exactly. Run as attendpro_owner via DATABASE_URL
-- (M1-ARCHITECTURE.md §3.1); the owner bypasses RLS as table owner, so the backfill
-- below is not blocked by the policies this file adds.
-- See docs/attendpro/M1-DATA-MODEL.md §4.1 (file 7), §4.5 (indexes), §4.6 (backfill),
-- §5 (policies).

-- CreateEnum
-- CalendarExceptionKind is used only by calendar_exceptions, so it is introduced here.
CREATE TYPE "CalendarExceptionKind" AS ENUM ('HOLIDAY', 'WORKING_OVERRIDE');

-- CreateTable
CREATE TABLE "work_calendars" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monday" BOOLEAN NOT NULL DEFAULT true,
    "tuesday" BOOLEAN NOT NULL DEFAULT true,
    "wednesday" BOOLEAN NOT NULL DEFAULT true,
    "thursday" BOOLEAN NOT NULL DEFAULT true,
    "friday" BOOLEAN NOT NULL DEFAULT true,
    "saturday" BOOLEAN NOT NULL DEFAULT false,
    "sunday" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "work_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_exceptions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CalendarExceptionKind" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calendar_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- M1-DATA-MODEL.md §4.5: work_calendars unique (business_id, name); the schema marks
-- (business_id, is_default) as a plain index; the partial unique enforces one default
-- calendar per business (O22) and takes its name from the schema comment.
CREATE UNIQUE INDEX "work_calendars_business_id_name_key" ON "work_calendars"("business_id", "name");
CREATE INDEX "work_calendars_business_id_is_default_idx" ON "work_calendars"("business_id", "is_default");
CREATE UNIQUE INDEX "work_calendars_default_uq" ON "work_calendars"("business_id") WHERE is_default;

-- M1-DATA-MODEL.md §4.5: calendar_exceptions unique (calendar_id, date); the two
-- business-scoped lookups are plain indexes, as @@index in the schema.
CREATE UNIQUE INDEX "calendar_exceptions_calendar_id_date_key" ON "calendar_exceptions"("calendar_id", "date");
CREATE INDEX "calendar_exceptions_business_id_date_idx" ON "calendar_exceptions"("business_id", "date");
CREATE INDEX "calendar_exceptions_business_id_calendar_id_idx" ON "calendar_exceptions"("business_id", "calendar_id");

-- AddForeignKey (onDelete: Restrict on both relations, per schema.prisma)
ALTER TABLE "work_calendars" ADD CONSTRAINT "work_calendars_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_calendar_id_fkey"
  FOREIGN KEY ("calendar_id") REFERENCES "work_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill (§4.6): one default WorkCalendar per existing business, seeded
-- Monday-to-Friday (the schema's weekday flag columns, which default exactly so) with
-- the business name and business_id taken from businesses, and the timezone copied from
-- the business row. The id is provisional and deterministic ('cal-' || business id, a
-- TEXT uuid-style id) so a re-run inserts the same value. Insert only while the business
-- has no default calendar yet; ON CONFLICT DO NOTHING also covers a pre-existing row
-- that already holds the (business_id, name) pair.
INSERT INTO "work_calendars"
    ("id", "business_id", "name", "monday", "tuesday", "wednesday", "thursday",
     "friday", "saturday", "sunday", "timezone", "is_default", "created_at", "updated_at")
SELECT
    'cal-' || b."id",
    b."id",
    b."name",
    true, true, true, true, true, false, false,
    b."timezone",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "businesses" b
WHERE NOT EXISTS (
    SELECT 1
    FROM "work_calendars" wc
    WHERE wc."business_id" = b."id"
      AND wc."is_default"
)
ON CONFLICT DO NOTHING;

-- Row Level Security (§4.2, §5): one-column tenant predicate, all commands,
-- USING and WITH CHECK identical so reads and writes fail closed without a tenant.
ALTER TABLE "work_calendars" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_calendars_tenant_isolation" ON "work_calendars"
  USING ("business_id" = current_setting('app.business_id', true))
  WITH CHECK ("business_id" = current_setting('app.business_id', true));

ALTER TABLE "calendar_exceptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_exceptions_tenant_isolation" ON "calendar_exceptions"
  USING ("business_id" = current_setting('app.business_id', true))
  WITH CHECK ("business_id" = current_setting('app.business_id', true));
