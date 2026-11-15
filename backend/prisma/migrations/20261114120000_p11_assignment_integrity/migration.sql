-- P11.2 assignment integrity. Additive only: no row-level security policy is
-- added, removed or altered by this migration.

-- GiST equality for the TEXT user_id column in the exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- PostgreSQL requires an exact unique key on each composite foreign-key target.
CREATE UNIQUE INDEX "users_business_id_id_key"
    ON "users"("business_id", "id");
CREATE UNIQUE INDEX "shifts_business_id_id_key"
    ON "shifts"("business_id", "id");

-- Keep each assignment's tenant equal to the tenant of its user and shift.
-- The existing single-column foreign keys remain in place as additive guards.
ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_business_user_fkey"
    FOREIGN KEY ("business_id", "user_id")
    REFERENCES "users"("business_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_business_shift_fkey"
    FOREIGN KEY ("business_id", "shift_id")
    REFERENCES "shifts"("business_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Equal endpoints are valid: cancelling a future assignment leaves an empty
-- [effective_from, effective_to) interval as durable evidence.
ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_period_ck"
    CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

-- Assignment periods are half-open, so adjacent periods do not conflict.
ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_no_overlap"
    EXCLUDE USING gist (
        "user_id" WITH =,
        (tstzrange("effective_from", "effective_to", '[)')) WITH &&
    );
