-- Migration 8: help requests, attendance corrections and correction revisions
-- Depends on: 20261015120000_business_tenancy (businesses, users, business_id columns)
-- and 20261015150000_attendance_evaluation_and_status (attendances, for the correction
-- FK). Forward-only, additive. Column names, types, nullability and FK onDelete follow
-- backend/prisma/schema.prisma (AttendanceHelpRequest, AttendanceCorrection,
-- AttendanceCorrectionRevision) exactly. Run as attendpro_owner via DATABASE_URL.
-- See docs/attendpro/M1-DATA-MODEL.md §4.1 (file 8), §4.5 (indexes), §5 (policies),
-- §9 (revisions), §10 (append-only).

-- CreateEnum
-- These three enums are used only by the tables this file adds, so they are introduced
-- here, in the value order of the schema.
CREATE TYPE "HelpRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');
CREATE TYPE "CorrectionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "CorrectionReviewTier" AS ENUM ('SAME_DAY', 'ESCALATED');

-- CreateTable
CREATE TABLE "attendance_help_requests" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_id" TEXT,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "attendance_help_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_tier" "CorrectionReviewTier" NOT NULL,
    "proposed_clock_in" TIMESTAMPTZ(3),
    "proposed_clock_out" TIMESTAMPTZ(3),
    "original_values" JSONB NOT NULL,
    "approved_values" JSONB,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewed_by_id" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Append-only (§10): no updated_at column, and no update or delete path anywhere in
-- this file; it gets SELECT and INSERT policies only.
CREATE TABLE "attendance_correction_revisions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "correction_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "values_before" JSONB,
    "values_after" JSONB,
    "actor_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_correction_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (§4.5)
CREATE INDEX "attendance_help_requests_business_id_status_idx" ON "attendance_help_requests"("business_id", "status");
CREATE INDEX "attendance_help_requests_requester_id_idx" ON "attendance_help_requests"("requester_id");

CREATE INDEX "attendance_corrections_business_id_status_idx" ON "attendance_corrections"("business_id", "status");
CREATE INDEX "attendance_corrections_business_id_review_tier_idx" ON "attendance_corrections"("business_id", "review_tier");
CREATE INDEX "attendance_corrections_attendance_id_idx" ON "attendance_corrections"("attendance_id");
CREATE INDEX "attendance_corrections_requested_by_id_idx" ON "attendance_corrections"("requested_by_id");

-- unique (correction_id, revision_no) holds across the three steps of one correction
-- (§9); (correction_id, revision_no) also serves the replay ordering, and
-- (business_id, created_at) serves the tenant timeline.
CREATE UNIQUE INDEX "attendance_correction_revisions_correction_id_revision_no_key" ON "attendance_correction_revisions"("correction_id", "revision_no");
CREATE INDEX "attendance_correction_revisions_correction_id_revision_no_idx" ON "attendance_correction_revisions"("correction_id", "revision_no");
CREATE INDEX "attendance_correction_revisions_business_id_created_at_idx" ON "attendance_correction_revisions"("business_id", "created_at");

-- AddForeignKey (onDelete per schema.prisma: Restrict on the tenant, attendance and
-- requester; SetNull on the reviewer who may later be removed)
ALTER TABLE "attendance_help_requests" ADD CONSTRAINT "attendance_help_requests_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_help_requests" ADD CONSTRAINT "attendance_help_requests_requester_id_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_help_requests" ADD CONSTRAINT "attendance_help_requests_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_id_fkey"
  FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_revisions" ADD CONSTRAINT "attendance_correction_revisions_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_revisions" ADD CONSTRAINT "attendance_correction_revisions_correction_id_fkey"
  FOREIGN KEY ("correction_id") REFERENCES "attendance_corrections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_revisions" ADD CONSTRAINT "attendance_correction_revisions_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security (§4.2, §5).
-- The two mutable tables get the full tenant predicate (all commands, USING and WITH
-- CHECK), matching the §5 policy table.
ALTER TABLE "attendance_help_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_help_requests_tenant_isolation" ON "attendance_help_requests"
  USING ("business_id" = current_setting('app.business_id', true))
  WITH CHECK ("business_id" = current_setting('app.business_id', true));

ALTER TABLE "attendance_corrections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_corrections_tenant_isolation" ON "attendance_corrections"
  USING ("business_id" = current_setting('app.business_id', true))
  WITH CHECK ("business_id" = current_setting('app.business_id', true));

-- The append-only revision table gets the two-policy form of §5: a SELECT policy and an
-- INSERT policy and nothing else, so UPDATE and DELETE are denied by RLS (layer 2 of
-- §10; the grants and the trigger are in migration 9).
ALTER TABLE "attendance_correction_revisions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_correction_revisions_select" ON "attendance_correction_revisions" FOR SELECT
  USING ("business_id" = current_setting('app.business_id', true));

CREATE POLICY "attendance_correction_revisions_insert" ON "attendance_correction_revisions" FOR INSERT
  WITH CHECK ("business_id" = current_setting('app.business_id', true));
