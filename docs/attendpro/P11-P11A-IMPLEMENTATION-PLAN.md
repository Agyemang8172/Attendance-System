# P11 and P11a — phased implementation plan

2026-11-10. Prepared at the owner's implementation-plan checkpoint by the Orchestrator with the Architect, DBA and Security reviewers. No application code, migration or schema change was made, and the shared Git index was not touched. The designs this plan implements are `P11-SHIFT-ASSIGNMENTS-TECHNICAL-DESIGN.md` and `P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md`.

## Phase 0 — Governance amendments (complete)

The approved direction is recorded in the governance documents: the role matrix gains the schedule capabilities, four footnotes, five route rows and a screen row; the role experiences document gains the employee schedule surface and the amended HR paragraph; the API contracts gain the five new route rows and the reshaped staff schedule, assignment and audit rows; the decision register gains row O25 in a new dated section; and the phased plan gains the P11a unit between P15 and P16.

## Dependency chain

```
P10 (committed 5c5542c)
  └─ P11  assignment lifecycle
       ├─ P11.1  pointer deprecation          (security change, no schema)
       └─ P11.2  assignment API, UI, audit
  └─ P12  business calendar administration
       └─ P11a  employee weekly schedules     (reads the calendar rows)
            ├─ P11a.1  schema, two coordinated migrations
            ├─ P11a.2  schedule writes, API, UI
            └─ P11a.3  resolver, provenance, staff schedule
                 └─ P16  timing semantics and the split-shift gate
```

P11a reads the P12 calendar rows, so P12 precedes it. P16 depends on P11a, because P16 fixes the timing semantics both features stand on, and P16 carries the gate that enables split shifts.

## Phase P11.1 — Pointer deprecation

**Depends on:** nothing. **Migrations:** none. **Full slice review:** `P11A-P11.1-POINTER-DEPRECATION-SLICE.md`.

The slice review carries the exact file and symbol scope, the API compatibility effects, the seven security tests and the acceptance criteria. In summary: the field leaves the create and update schemas, the controller writes and the public projection; the assignment path becomes the only writer and its write becomes tenant-scoped; the column, its foreign key and its index stay; and no frontend change is needed, because no screen reads the field off a user object.

**Application changes**

- `backend/validators/index.ts`: remove `shiftId` from `createUserSchema.body` and `updateUserSchema.body`. The `shiftId` fields in the policy, registration and export schemas are different fields and stay.
- `backend/controllers/userController.ts`: remove `shiftId` from `PUBLIC_USER`, delete the `validShift` helper and remove both call sites. The writes spread the parsed object rather than the raw body, and an object schema strips unknown keys, so removing the field from the schema is what closes the write. The controller parses the body itself, so the protection does not depend on the middleware.
- `backend/controllers/assignmentController.ts`: keep the pointer write, which becomes the only writer, and add `businessId` to its `where` clause.
- `backend/docs/swagger.ts`: remove the field from the user, create and update schemas.

**Security checks**

- HR cannot move the pointer through the employee endpoints; the field is ignored rather than honoured.
- The pointer no longer appears in any user projection.
- The assignment path remains the only writer.

**Tests** — the contract test replaces "refuses a shift that is not an active shift" with "ignores a shift sent on the employee endpoints"; the CRUD test keeps the pointer assertion and adds the employee-endpoint case.

**Exit** — pointer unchanged after any employee edit, assignment sync still true, both typechecks and the backend suites green.

## Phase P11.2 — Assignment lifecycle

**Depends on:** P11.1. **Migrations:** the first migration file, applied only after the DBA gate in P11a.1.

**API changes**

| Method | Path | Roles | Change |
|---|---|---|---|
| POST | `/api/business/shifts/:id/assignments` | SUPERADMIN | body takes a business date; response carries the derived status, the effective-now flag and the business dates |
| PATCH | `/api/business/assignments/:id` | SUPERADMIN | new, future rows only |
| DELETE | `/api/business/assignments/:id` | SUPERADMIN | closes the current row at now, cancels a future row |
| GET | `/api/business/assignments` | HR read, SUPERADMIN | paginated envelope with the derived status, filters for employee, shift, status, search and date range |

**UI changes** — `src/pages/Scheduling.tsx`: searchable paginated employee and shift pickers instead of `limit: 1000`; read the pagination envelope; split create from edit, where edit becomes a `PATCH` on a future row and an in-force row becomes read-only with a "schedule change from date" action; default the date to the business date; replace the `isActive` pill with the derived status and keep rows for deactivated shifts visible.

**Security checks** — Superadmin-only writes, tenant and active checks on both referenced records, no backdating below the current business date, exclusion and one-open-row violations mapped to 409 rather than 500, and a durable `audit_logs` row for every write. The audit row is written through the transaction client with `tx.auditLog.create`, the pattern in `backend/controllers/userController.ts:89-94`, so it commits or rolls back with the write it describes. The shared `writeAudit` helper swallows insert failures, so it is not sufficient as the only guarantee, and the stdout logging the path uses today stays a log line rather than the audit.

**History preservation** — no operation deletes an assignment row and no operation edits a realized period. Closing a row sets its end, cancelling a future row empties its interval and restores the predecessor through the next non-empty successor's start — or reopens it when no later successor exists — and both leave the rows in place for evidence.

**PostgreSQL acceptance** — overlapping ranges for one employee rejected; adjacent ranges accepted; two open-ended rows rejected; `effective_to` before `effective_from` rejected; two concurrent overlapping inserts settle with one commit; identical API creates take the exact namespaced employee advisory lock, re-read the chain and settle as one 201 and one 409; a cross-tenant employee or shift rejected; the migration rehearsal applies cleanly with unchanged row counts.

## Phase P11a.1 — Schema

**Depends on:** the DBA review gate. **Migrations:** two coordinated files, each applying alone and separately reviewable.

- File one: the `btree_gist` extension, the unique indexes on `users(business_id, id)` and `shifts(business_id, id)`, the assignment period check and exclusion constraint, and the composite tenant foreign keys on the assignment table.
- File two: the four schedule tables, their checks, exclusion constraints and triggers, the row level security enable and policies, the attendance snapshot columns, and the application role grants inside the existing role-existence guard.

**DBA review gate, before either file is applied** — file order and the idempotent extension; permission to install `btree_gist` on the pilot host, which fails closed without it; the prerequisite unique indexes and the now-redundant `users_business_id_idx`; the referential actions, including `RESTRICT` on the snapshot provenance so the source survives; the added lock cost on live tables; the behaviour of `migrate deploy` for objects Prisma cannot model; the policies and grants; the all-days-off reason check and the audit write path; and the rollback scripts with an export plan.

**PostgreSQL acceptance** — every constraint above exercised with the real error codes; the deferred triggers firing at commit; row level security under the application role with the tenant set; the composite foreign keys rejecting cross-tenant references; the grants confirmed insert-only for the audit table; the migration rehearsal on a restored copy with a Prisma drift check.

## Phase P11a.2 — Schedule writes

**Depends on:** P11a.1. **Migrations:** none beyond phase P11a.1.

**API changes** — the five rows added to the API contracts: read and write an employee's schedule, grant and revoke a personal day off, and grant a holiday exception.

**UI changes** — the employee detail gains a schedule surface with a Monday-to-Sunday editor, one period per weekday, a reason field, a personal days-off list and, for Superadmin only, the holiday exception. The existing raw template link on the employee drawer is replaced by the schedule view.

**Security checks** — HR acts only on STAFF targets in its own tenant; the body may not carry a tenant or more than one employee; the holiday exception route is Superadmin only; every write requires a reason, is effective-dated, never backdated, and writes one audit row inside the write transaction; the `schedule.` prefix is added to the HR audit filter; the write is rate limited on the actor, because one HR account can otherwise restate hours for the whole company; no secret material reaches an audit row.

**PostgreSQL acceptance** — the constraint set exercised through the API: a second period on one weekday refused, a missing reason refused, a backdated date refused with no rows written, an all-days-off version accepted with its reason and audit row, and a refused write leaving neither a row nor an audit row.

## Phase P11a.3 — Resolver, provenance and the staff schedule

**Depends on:** P11a.2. **Migrations:** none.

**Application changes** — one shared resolver resolves the working window for a business date in the order the design sets out, used by the punch resolver, the staff schedule and the assignment overlap checks. The punch path stops using UTC for the business date, and the grading arithmetic in `backend/utils/shiftWindow.ts` and `backend/utils/statusEngine.ts` moves to the business zone. The attendance snapshot records the resolved window in the existing minute columns and the source beside them.

**API changes** — `GET /api/staff/schedule` returns the reshaped per-day rows with periods, statuses and sources.

**UI changes** — `src/pages/StaffSchedule.tsx`, `src/pages/StaffDashboard.tsx` and `src/pages/StaffOffDays.tsx` send the required date range, read the new shape, and stop overriding the employee's own days off locally.

**Security checks** — the staff route is scoped to the caller's own rows; the range is bounded; the resolver never returns another employee's rows.

**PostgreSQL acceptance** — the resolver returns the schedule version in force now, the assignment version in force before it and the legacy pointer only when neither exists; a punch after midnight resolves against the window that started the previous business date; a snapshot row carries the source and the provenance; a superseded version's day rows stay byte-identical.

## Phase P16 gate — split-shift enablement (not in this plan)

Split-shift attendance behaviour is deferred to P16. The database carries several periods per day from the start, but a deferred trigger holds production to one period per weekday, and no route, flag or interface enables the split mode. The trigger is dropped only in P16, after the per-period window, the per-period automatic clock-out, the daily total and the absence treatment are verified, and only with a separate owner-approved change and its own migration review.

## Isolated PostgreSQL test environment (proposal, needs approval)

The environment was inspected on 2026-11-10. No PostgreSQL server runs, and the development machine has no container runtime. The project already ships a guarded path for this, and the guard is fully configured.

`backend/tests/dbGuard.ts` refuses a target unless it passes seven checks, and `backend/tests/setup.ts` calls it before any test file imports Prisma:

1. `TEST_DATABASE_URL` is set and parses.
2. Its host equals `TEST_DB_HOST`.
3. Its database equals `TEST_DB_NAME`.
4. `TEST_DB_NAME` ends in `_test`.
5. The database is not `postgres`.
6. The host does not end in `prisma.io`.
7. It is neither equal to `DATABASE_URL` nor on `DEV_DB_HOST`, the development host.

`backend/.env` satisfies all seven today. `TEST_DATABASE_URL` names `localhost:5432/attendpro_test`, `TEST_DB_HOST` is `localhost`, `TEST_DB_NAME` is `attendpro_test`, `DATABASE_URL` points at the managed development database on `pooled.db.prisma.io`, and `DEV_DB_HOST` is that same host. The guard therefore refuses the development database by URL and by host, and refuses any managed Prisma host outright. The live suite confirmed this: it printed `Verified test database target: localhost:5432/attendpro_test` and then failed to connect. An earlier note in this plan claimed the development-host exclusion was unconfigured; that was wrong, and the correction is recorded here.

`backend/scripts/test-db.ts` exposes `check`, `deploy` and `reset` behind the same guard, so a deploy refuses an unverified target in the same way.

Three ways to stand up the database, none of them started and none of them configured without approval:

| Option | What it needs | Isolation | Notes |
|---|---|---|---|
| A. The PostgreSQL already on this machine | Starting the installed cluster at `C:/ServBay/db/postgresql/16`, version 16.15, with `btree_gist` present in the build | Lowest: the same cluster may hold other databases | No download and no install. The stale `postmaster.pid` must be cleared before it starts, and the `attendpro_test` role and database confirmed or created |
| B. Portable PostgreSQL 16 binaries in a temporary directory | Downloading and extracting the binaries, then `initdb` into a temporary data directory on a spare port | Highest: a throwaway cluster with throwaway credentials | No system install and no interference with the existing cluster, but it is a software acquisition that needs approval. The full procedure is in `P11A-TEST-DATABASE-ENVIRONMENT-PROPOSAL.md` |
| C. The continuous integration service image | Installing a container runtime and running the `postgres:16` image the pipeline uses | Highest, and the closest match to the pipeline | The runtime is not installed, and an install needs approval |
| D. The continuous integration runner | Pushing a branch and letting the pipeline run the database-backed suites | The environment is the pipeline's own | Requires remote access and a push, which is outside this session's scope |

The recommendation is option B for the isolation the acceptance work needs, with option A as the fallback when no download is wanted. Either way the database is local, disposable and created for the purpose.

Whichever is chosen, the guard configuration is the same shape. `TEST_DATABASE_URL` points at the chosen cluster, `TEST_DB_HOST` and `TEST_DB_NAME` name it exactly, the name keeps the `_test` suffix, `DEV_DB_HOST` keeps naming the managed development host, and `DATABASE_URL` keeps pointing at the development database so the collision checks stay live. The only change to `backend/.env` is the port in `TEST_DATABASE_URL` when the cluster does not use 5432. After that: run `npm run test:db:check` and then `npm run test:db:deploy` from `backend/`, and confirm the `btree_gist` extension can be installed as the superuser, which is the extension check the DBA gate needs.

## Sequencing and gates

1. P11.1, then P11.2, then P11a.1, then P11a.2, then P11a.3.
2. The first migration file is written and reviewed in phase P11.2 but applied only after the P11a.1 DBA gate, so the two files land together in one release and each is separately reviewable.
3. No phase proceeds without QA, Security and secret-scanning evidence, and each stops at the human commit checkpoint.
4. A real PostgreSQL instance is a prerequisite for the acceptance tests of every phase that touches persistence. None is reachable from the development machine, so the tests cannot run until one exists.
5. The deprecation of the pointer stops at stage one. The later stages, and the removal of the column, need their own owner approval.
