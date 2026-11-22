# P11a — Isolated test database environment, Option B proposal

2026-11-10. Proposal only. Nothing was installed, downloaded, started, reset or connected to, and no database configuration was modified. The owner approves each step before any of it runs.

## Outcome

The owner authorized this on 2026-11-10 and it has been carried out. The instance is PostgreSQL 16.10 from the official EnterpriseDB portable binaries, downloaded over TLS, matching the published content length exactly and passing the archive's CRC test. The SHA-256 of the archive is `ebb3b6af4fa69dea9951b66855bc4d42dc04e56ccb9aa7024ce3c58bd89d6b0c`. No upstream checksum is published for these archives, so the archive was verified by transport, length, CRC and the extracted binaries' own reported version, and the digest is recorded here for any later comparison.

Two Windows-specific details were needed, and they are the reason a naive attempt fails:

- **The `pgsql/bin` and `pgsql/lib` folders must be on `PATH`.** The server starts without them, but every forked backend process dies with `0xC0000142`, a DLL initialisation failure, and the server then aborts with a startup failure. The symptom appears only when a client connects.
- **The Windows tools must be given a closed standard input.** `pg_ctl` and `psql` otherwise wait on the console, and `psql` consumes the remainder of a script as a password prompt. Both were run with `pg_ctl start` detached, `psql --no-password`, and standard input redirected from the null device.

The instance listens on port 5433 on the loopback interface only. The data directory is `C:\Users\USER\AppData\Local\Temp\opencode\pg16data`, outside every installation and outside the repository, and the throwaway credentials live in two files beside it. The guard accepted the target, `localhost:5433/attendpro_test`, and all ten existing migrations were applied to it and nowhere else.


## What is proposed

A throwaway PostgreSQL 16 cluster, built from portable binaries in a temporary directory, on a spare port, with throwaway credentials. It exists only to run the database-backed suites and the exclusion-constraint acceptance tests, and it is removed afterwards.

This is the highest-isolation option that needs no system-level installation. It does not touch the PostgreSQL that is already on this machine, it does not touch the managed development database, and it leaves no service registered and no configuration behind.

## Why this shape

- The major version matches the pipeline's service image (`postgres:16`) and the build already installed on this machine (16.15), so the acceptance tests exercise the same engine the guard and the migrations expect.
- `btree_gist` ships with the standard Windows binary distribution, which is what the exclusion constraints in the P11 and P11a migrations require.
- Portable binaries run from a folder. There is no installer, no Windows service, no registry entry and no `Program Files` change.
- A temporary data directory means the cluster and its credentials disappear with the folder.

## Prerequisites the owner approves

1. Download the PostgreSQL 16 binary archive for Windows x64 from the official EnterpriseDB distribution, into a temporary working directory.
2. Extract it into the same temporary directory.
3. Run `initdb` to create a cluster in a second temporary directory.
4. Start that cluster on a spare port with `pg_ctl`.
5. Create the `attendpro_test` role and database inside it.
6. Change `TEST_DATABASE_URL` in `backend/.env` to point at the new cluster.
7. Run the project's own `test:db:check` and `test:db:deploy` scripts.

No other configuration is touched. `DATABASE_URL` keeps pointing at the managed development database, `DEV_DB_HOST` keeps naming that host, and no environment file other than the one test URL line changes.

## The guard configuration, exactly

The guard in `backend/tests/dbGuard.ts` is called by `backend/tests/setup.ts` before any test file imports Prisma, and by `backend/scripts/test-db.ts` before any migration or reset. It refuses a target unless all seven checks pass.

| # | Guard check | Current value in `backend/.env` | Required for the proposed cluster | Status |
|---|---|---|---|---|
| 1 | `TEST_DATABASE_URL` is set and parses | `postgresql://attendpro_test:***@localhost:5432/attendpro_test?schema=public` | Same shape, port `5433` | One line changes |
| 2 | The host equals `TEST_DB_HOST` | `localhost` | `localhost` | Unchanged |
| 3 | The database equals `TEST_DB_NAME` | `attendpro_test` | `attendpro_test` | Unchanged |
| 4 | `TEST_DB_NAME` ends in `_test` | `attendpro_test` | `attendpro_test` | Unchanged |
| 5 | The database is not `postgres` | passes | passes | Unchanged |
| 6 | The host does not end in `prisma.io` | `localhost` | `localhost` | Unchanged |
| 7 | The target is neither `DATABASE_URL` nor on `DEV_DB_HOST` | `DATABASE_URL` is the managed development database and `DEV_DB_HOST` is `pooled.db.prisma.io` | Unchanged, and this is the check that keeps the development database safe | Unchanged |

The development-host exclusion is live today, not inert. An earlier note in the implementation plan said otherwise; that was wrong and is corrected there and in the task board.

Because the guard is positive verification rather than a heuristic, the proposed cluster passes only when it is the exact target that was declared. A typo in the host, the name or the port makes the suite refuse to start rather than write somewhere unexpected.

## Procedure, once approved

1. Create a working directory, for example `C:\Users\USER\AppData\Local\Temp\opencode\pgsql16`, with a `bin` folder for the extracted binaries and a `data` folder for the cluster.
2. Run `initdb` against the `data` folder with the throwaway superuser password, choosing the `UTF8` encoding and the `Windows` locale, and trust the local authentication for the directory only.
3. Start the cluster with `pg_ctl` on port `5433`, writing its log inside the working directory and its socket nowhere shared.
4. Create the role and the database with `psql`: role `attendpro_test` with a throwaway password, database `attendpro_test` owned by that role, and the `public` schema owned by the role so the migrations can create their objects.
5. Confirm `btree_gist` is installable as the superuser with `CREATE EXTENSION btree_gist;` in a scratch database, then drop it. That single check answers the extension question the DBA gate needs, on the exact engine the acceptance tests will run against.
6. Update `TEST_DATABASE_URL` in `backend/.env` to the new port, leaving every other line alone.
7. From `backend/`, run `npm run test:db:check`, which verifies the target through the same guard and prints it, then `npm run test:db:deploy`, which applies the migrations to the verified target.
8. Run the database-backed suites. `adminCrud.test.ts` carries the new pointer assertions that cannot execute without a database.
9. Stop the cluster with `pg_ctl`, then remove the working directory. The database and its credentials go with it.

## What this proposal does not do

- It does not install software onto the machine or register a service.
- It does not start, reset or connect to the PostgreSQL already installed here.
- It does not touch the managed development database, and the guard would refuse to run against it.
- It does not change `DATABASE_URL`, `DEV_DB_HOST`, `TEST_DB_HOST` or `TEST_DB_NAME`.
- It does not create, alter or drop any project migration, and it does not apply anything the owner has not approved.

## Risks and limits

- The archive is downloaded from a third party. Its checksum should be verified against the published value before the binaries are run.
- The throwaway credentials live in a temporary folder and in one line of `backend/.env`. The line must be reverted or repointed afterwards, and the folder deleted.
- The cluster holds only test data. It is disposable by construction.
- A port conflict on 5433 is the only expected obstacle; another spare port is equally acceptable, and the guard simply needs the matching port in the one URL line.

## The fallback

Option A, starting the PostgreSQL 16.15 cluster already installed at `C:/ServBay/db/postgresql/16`, needs no download at all. It is less isolated, because that cluster may hold the developer's other databases, and it carries a stale `postmaster.pid` that has to be cleared before it starts. It satisfies the same guard configuration with no change to `TEST_DATABASE_URL`, because it already listens on 5432.
