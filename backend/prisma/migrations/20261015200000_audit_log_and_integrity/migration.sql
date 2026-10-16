-- Migration 9: audit log, roles, grants, append-only trigger and hardened login lookup
-- Depends on: migrations 1 to 8 (every table named in the grants exists by now).
-- Forward-only, additive. Column names, types, nullability and FK onDelete follow
-- backend/prisma/schema.prisma (AuditLog) exactly.
-- See docs/attendpro/M1-DATA-MODEL.md §4.1 (file 9), §4.5 (indexes), §5 (policies),
-- §10 (append-only: grants, policies, trigger); M1-ARCHITECTURE.md §3.1 (roles),
-- §3.5 (grant matrix), §3.6 (append-only), §3.7 (login lookup).
-- IMPORTANT: this file must run as attendpro_owner (the DATABASE_URL role). The
-- SECURITY DEFINER function below is owned by the role that creates it, and the owner
-- role is also the owner of every table, which is what lets the login lookup read
-- users outside a tenant setting while RLS applies to everyone else.

-- CreateEnum
-- AuditActorType is used only by audit_logs, so it is introduced here.
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'KIOSK', 'SYSTEM');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_kiosk_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_values" JSONB,
    "after_values" JSONB,
    "reason" TEXT,
    "correlation_id" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (§4.5)
CREATE INDEX "audit_logs_business_id_created_at_idx" ON "audit_logs"("business_id", "created_at");
CREATE INDEX "audit_logs_business_id_entity_type_entity_id_idx" ON "audit_logs"("business_id", "entity_type", "entity_id");
CREATE INDEX "audit_logs_business_id_action_idx" ON "audit_logs"("business_id", "action");

-- AddForeignKey (onDelete per schema.prisma: Restrict on the tenant, SetNull on the
-- actor so removing a user does not erase audit history; actor_kiosk_id and entity_id
-- are plain audit columns with no relation, so they carry no FK)
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supporting index for the actor FK (SetNull checks and per-actor audit queries).
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (§4.2, §5): append-only, so the two-policy form only. A SELECT
-- policy and an INSERT policy and nothing else; UPDATE and DELETE are denied by RLS
-- because no policy covers them (layer 2 of §10).
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON "audit_logs" FOR SELECT
  USING ("business_id" = current_setting('app.business_id', true));

CREATE POLICY "audit_logs_insert" ON "audit_logs" FOR INSERT
  WITH CHECK ("business_id" = current_setting('app.business_id', true));

-- ── Layer 1: roles and grants (§10, §3.5) ─────────────────────────────────────
-- attendpro_owner connects via DATABASE_URL (prisma migrate, seed fixtures, retention
-- work); attendpro_app connects via DATABASE_URL_APP (the running API and jobs).
-- Both statements are idempotent so a database where the roles already exist is fine.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendpro_owner') THEN
    CREATE ROLE attendpro_owner;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendpro_app') THEN
    CREATE ROLE attendpro_app;
  END IF;
END
$$;

-- attendpro_app is never given BYPASSRLS (§3.1, §3.5); assert the attribute explicitly
-- so a drift in role attributes cannot weaken the tenant policy.
ALTER ROLE attendpro_app NO BYPASSRLS;

-- The table grants below need schema-level USAGE to be effective on a database whose
-- public schema no longer grants it to new roles.
GRANT USAGE ON SCHEMA public TO attendpro_app;

-- Append-only tables: SELECT and INSERT only, never UPDATE or DELETE (§10). attendance_attempts
-- was created by migration 5, attendance_correction_revisions by migration 8, audit_logs here.
GRANT SELECT, INSERT ON audit_logs, attendance_correction_revisions, attendance_attempts
  TO attendpro_app;
REVOKE UPDATE, DELETE ON audit_logs, attendance_correction_revisions, attendance_attempts
  FROM attendpro_app;

-- The sixteen business-scoped tables the API mutates get full DML, each scoped by RLS
-- (§3.5 matrix; the owner role keeps everything as table owner).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  businesses,
  users,
  shifts,
  attendances,
  shift_assignments,
  workplace_policies,
  policy_versions,
  sites,
  kiosk_terminals,
  qr_credentials,
  verification_sessions,
  attendance_help_requests,
  attendance_corrections,
  work_calendars,
  calendar_exceptions,
  email_recovery_codes
  TO attendpro_app;

-- ── Layer 3: append-only trigger (§10) ────────────────────────────────────────
-- A BEFORE trigger on each of the three history tables, so an owner-role statement that
-- bypasses RLS is still refused unless the trigger is deliberately disabled for a
-- lawful, recorded retention purge (O10).
CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER attendance_correction_revisions_append_only
  BEFORE UPDATE OR DELETE ON attendance_correction_revisions
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER attendance_attempts_append_only
  BEFORE UPDATE OR DELETE ON attendance_attempts
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ── Hardened login lookup (§3.7, verbatim sketch adapted to the users table) ───
-- users.id and users.business_id are TEXT, users.password is TEXT, users.role is the
-- "Role" enum and is cast to text so the RETURNS TABLE types match the sketch.
-- SECURITY DEFINER runs as this function's owner, which is attendpro_owner when the
-- migration runs as attendpro_owner; the owner of users bypasses its RLS policy, so
-- this is the only path by which attendpro_app reads users without a tenant setting.
-- The pinned search_path stops a caller redirecting an unqualified name.
CREATE FUNCTION authenticate_lookup(p_email text)
  RETURNS TABLE (id text, business_id text, password text, role text, is_active boolean)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.business_id, u.password, u.role::text, u.is_active
  FROM users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION authenticate_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authenticate_lookup(text) TO attendpro_app;
