# Proposal B — P11.2 assignment lifecycle

2026-11-10, rules approved 2026-11-13. Prepared by the Orchestrator after P11.1 was accepted. Nothing is implemented and no migration exists. The six product rules below were approved by the owner on 2026-11-13 and are recorded in `P11-SHIFT-ASSIGNMENTS-TECHNICAL-DESIGN.md`, in decision row O26 of the decision register, and in the assignment rows of the API contracts.

## The rules, now approved

| # | Rule | Consequence for the code |
|---|---|---|
| 1 | An assignment may begin on any future business-local date, at midnight | The effective instant is derived from the business date in the business's zone. The client sends a date, never an instant |
| 2 | An overnight shift belongs to the business date it starts on | The resolver keeps the window whose start is at or before the instant, and looks at the business date of the instant and the one before it |
| 3 | Historical backdating is refused; a same-day change must not rewrite realized attendance or a completed period | A date before the current business date is refused. A same-day request begins at the instant the write runs, not at that day's midnight |
| 4 | An active assignment is replaced through an audited effective-dated change, never by rewriting its historical start | Every change closes the predecessor and inserts a successor. No row's `effective_from` is edited |
| 5 | Cancelling a future assignment restores the predecessor's coverage and keeps durable cancellation evidence | The cancelled row is closed onto itself, and the predecessor's coverage resumes |
| 6 | Stored instants survive a business timezone change; new assignments use the currently configured zone | The zone is read when a request is written, and never applied to rows that already exist |

The cancellation representation is settled with the rules: the cancelled future row is closed onto itself, the predecessor's end is restored through the next non-empty successor's start, or reopened when there is no later successor, and the audit row records both changes and the reason. This keeps the evidence without adding a status column or a duplicate successor for the predecessor's shift.

## The representation, reviewed

**A same-day replacement** cannot begin at that day's midnight, because the day's earlier period may already be realized and rule 3 forbids rewriting it. The write acquires the employee advisory lock first, then captures and reuses one `clock_timestamp()` value as its boundary. This closes the predecessor at the serialized write instant and leaves everything before it untouched. No attendance row is recalculated and no completed period is re-interpreted. A future date keeps the midnight anchor of rule 1, because nothing before that date has happened yet.

**Cancellation evidence** has to survive the cancellation itself, so the row is not deleted and not emptied silently: its interval is closed onto itself, which leaves a row that existed and was withdrawn, and the audit row names the cancelled row, the predecessor whose coverage was restored, and the reason. The predecessor ends at the next non-empty successor's start, or is reopened when there is no later successor. This moves only its future tail and handles cancellation in the middle of a chain without overlap; its realized span and start are untouched, which keeps rule 4 intact.

## The migration the slice needs

One migration file, applied only after the DBA gate, in the order the P11 design sets out.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE UNIQUE INDEX "users_business_id_id_key" ON "users"("business_id","id");
CREATE UNIQUE INDEX "shifts_business_id_id_key" ON "shifts"("business_id","id");

ALTER TABLE shift_assignments
  ADD CONSTRAINT shift_assignments_period_ck
    CHECK (effective_to IS NULL OR effective_to >= effective_from);

ALTER TABLE shift_assignments
  ADD CONSTRAINT shift_assignments_no_overlap
    EXCLUDE USING gist (business_id WITH =,
      user_id WITH =,
      (tstzrange(effective_from, effective_to, '[)')) WITH &&);

ALTER TABLE shift_assignments
  ADD CONSTRAINT shift_assignments_business_user_fkey
    FOREIGN KEY (business_id,user_id) REFERENCES users(business_id,id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE shift_assignments
  ADD CONSTRAINT shift_assignments_business_shift_fkey
    FOREIGN KEY (business_id,shift_id) REFERENCES shifts(business_id,id) ON DELETE RESTRICT ON UPDATE CASCADE;
```

The exclusion constraint is what makes "no overlapping periods" a database fact rather than an application promise. The two unique indexes exist only because PostgreSQL needs an exact unique index on the referenced pair for a composite foreign key, and the new index on `users` makes the existing `users_business_id_idx` redundant. The row level security posture does not change: it is already enabled on the table with the tenant isolation policy, and the composite foreign keys close the gap that the policy cannot, namely a row pointing at another tenant's user or shift.

`schema.prisma` gains the two unique pairs in the same change. Prisma cannot express the check, exclusion constraint or additive composite foreign keys without changing relation ownership around the shared `businessId` field, so those safeguards remain explicit raw SQL and their expected schema-diff behavior must be verified before approval. The existing single-column foreign keys remain.

## Audit persistence

Every assignment write must leave a durable row in `audit_logs`, written inside the same transaction as the write, through the transaction client with `tx.auditLog.create`. The shared `writeAudit` helper swallows insert failures and warns instead, so it cannot be the only guarantee; the pattern to copy is `persistAudit` in `backend/controllers/userController.ts`.

| Event | Trigger | Payload |
|---|---|---|
| `assignment.created` | a new row | the actor, the business, the entity, the superseded row before and the new row after, the effective dates and a reason |
| `assignment.rescheduled` | a future row amended | both versions of the row |
| `assignment.cancelled` | a future row withdrawn | the row before and after, and the fact that the predecessor resumed |
| `assignment.deactivated` | the current row closed | the row before and after, and the instant it closed at |

The reason field is not currently required on assignment writes and the contract does not ask for one. Whether it becomes required is part of the owner's decision. Settled at the 2026-11-14 database-integrity checkpoint: `reason` is a required body field on every assignment mutation, recorded in the same-transaction audit row, and the owner may amend that at the migration-approval gate.

## Tenant safeguards

- The composite foreign keys above, so a row cannot name another tenant's user or shift.
- The tenant-scoped pointer write that P11.1 already introduced.
- After the tenant proxy sets `app.business_id`, the first lifecycle statement takes `pg_advisory_xact_lock(hashtextextended('attendpro:assignment:' || $businessId || ':' || $employeeId, 0))` with bound parameters. The existing 15-second tenant transaction timeout bounds waiting. The write then re-reads the chain; an existing non-empty row at the requested effective start returns `409` without a write.
- The existing row level security, which continues to bind the tenant for anything that reaches the database.
- The `businessId` filter that every read already carries, extended to the list and to the reschedule and cancel paths.

## Concurrency and constraint tests

These are the acceptance tests for the slice, and they run against the isolated instance.

1. Overlapping intervals for one employee are rejected with `23P01`; adjacent intervals, where one ends exactly where the next begins, are accepted; two employees never conflict.
2. Two open-ended rows for one employee are rejected.
3. `effective_to` before `effective_from` is rejected.
4. A row naming another tenant's user or shift is rejected with `23503`.
5. Two concurrent inserts of overlapping intervals: one commits, the other is rejected, and no orphaned row is left behind.
6. Two concurrent creates through the API for one employee and the same effective start: one answers 201, the other re-reads under the lock and answers 409, and the chain stays consistent.
7. The exact namespaced 64-bit transaction lock serialises the two concurrent creates while a different employee remains independent.
8. A failure between closing the predecessor and inserting the new row leaves no closed-without-successor row, and the pointer is unchanged.
9. The overlap violation maps to 409 rather than 500. Today only `P2002` is mapped, and its message misstates the conflict, since the index limits open rows per employee rather than duplicate employee and shift pairs.
10. The migration applies to a restored copy, `pg_constraint` and `pg_indexes` show every object, and Prisma reports no drift.

Empty cancellation ranges intentionally do not participate in exclusion overlap checks. They remain durable evidence, are ignored by the effective resolver, cannot be reopened, and can only be created with a same-transaction audit row.

## Is the isolated environment suitable

Yes, and it is already proving it.

- The instance is PostgreSQL 16.10, matching the pipeline's major version, and the extension the exclusion constraint needs was installed by the application role during this work: `btree_gist` 1.7, created and dropped again in a scratch database.
- All ten existing migrations applied cleanly through the project's own guarded script, so the schema the new migration builds on is known good.
- The guard accepted the target and refused nothing, and the tenant policy was proved directly against the instance with the non-superuser application role.
- The crud suite now runs 20 of 20, which is the harness the new assertions will use.

One limit the owner should know: the database-backed suites connect as a superuser of the throwaway cluster, exactly as the pipeline does, so row level security is bypassed during a suite run. The policies are proved separately, by connecting as the non-superuser application role, as was done for this verification. The slice therefore carries four tenant-policy tests that must run as that non-superuser role: with no tenant set the application role reads nothing and a write is refused; with the tenant set to one business a write naming another business is refused by the policy; with the tenant set to the same business the write is accepted; and a join across the assignment and its tenant returns only the calling tenant's rows.

## What this proposal does not include

No implementation, no migration file, no change to the P11.1 work, no change to the shared Git index, and no change to P11a, which stays blocked behind this slice and its five answers.
