# AttendPro Deployment Runbook

- **Applies to:** AttendPro v1 (frontend, Express API, PostgreSQL via Prisma)
- **Audience:** The owner or a DevOps operator running a release
- **Status:** Documentation only. M9 adds no deploy workflow, and every
  deployment remains a manual, owner-approved action.

This runbook describes the current repository, including the gaps that must be
closed before a public launch. Read Section 9 before scheduling a release.

---

## 1. Shape of the deployment

| Piece | Technology | Default port | Build output |
|---|---|---|---|
| Frontend | React 19 + Vite | 5173 (dev) | `dist/` |
| Backend API | Express 5 + TypeScript | 8000 | `backend/dist/` |
| Database | PostgreSQL through Prisma 6 | 5432 or provider | Migrations in `backend/prisma/migrations/` |
| Auto clock-out job | External scheduler calling the API | none | n/a |

The frontend is a static build. The API is a long-running Node process. The
database is the only stateful service. The job is an HTTP call, not a process
inside the API.

Local development starts a Prisma Postgres proxy with `cd backend && npx prisma
dev`, then the API with `cd backend && npm run dev`, then the frontend with
`npm run dev`. A hosted deployment replaces the proxy with a managed
PostgreSQL connection string.

---

## 2. Prerequisites

- Node.js 20 on the build machine and the API host.
- A PostgreSQL 15+ database reachable from the API host.
- A database role that can run migrations (`attendpro_owner` in the target
  architecture).
- A second runtime role (`attendpro_app`) if the RLS split is provisioned.
- Five server-side secrets: `JWT_SECRET`, `PIN_HMAC_KEY`, `QR_SECRET_KEY`,
  `KIOSK_PAIRING_KEY`, and `KIOSK_TOKEN_KEY`, plus `JOB_TOKEN` for the
  scheduler.
- A static host for `dist/` with SPA rewrites to `index.html` (the current
  `vercel.json` does this).
- A TLS-terminating reverse proxy in front of the API.

---

## 3. Environment variables

### Frontend (build time)

| Name | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | Yes | Absolute API base, for example `https://api.example.com/api` |

Vite inlines `VITE_*` values at build time. Rebuild the frontend when the API
URL changes.

### Backend (runtime)

| Name | Required | Purpose |
|---|---|---|
| `PORT` | No | API port; defaults to `8000` |
| `DATABASE_URL` | Yes | Prisma connection used by the current client |
| `DATABASE_URL_APP` | No | Intended RLS-scoped runtime connection. Documented in the architecture, but the current client does not read it (SEC-07) |
| `JWT_SECRET` | Yes | Signs user JWTs (8-hour lifetime) |
| `PIN_HMAC_KEY` | Yes | Hashes kiosk PINs; the PIN endpoints fail closed without it |
| `QR_SECRET_KEY` | Yes | Hashes QR badge tokens; badge issuance fails closed without it |
| `KIOSK_PAIRING_KEY` | Yes | Hashes pairing codes; pairing fails closed without it |
| `KIOSK_TOKEN_KEY` | Yes | Hashes kiosk device tokens; kiosk auth fails closed without it |
| `JOB_TOKEN` | Yes | Bearer for the job routes; an unset value rejects every caller |
| `CORS_ORIGIN` | Yes | Browser origin allowed to call the API |
| `LOG_LEVEL` | No | Pino level: `fatal`, `error`, `warn`, `info`, `debug`, or `trace` |
| `TEST_DATABASE_URL` | No | Test run target; must be the local test database |
| `TEST_DB_HOST` | No | Exact expected host of the test database |
| `TEST_DB_NAME` | No | Exact expected name, must end in `_test` |
| `DEV_DB_HOST` | No | Development host; tests and the dev seed refuse this target |
| `DEV_DATABASE_URL` | No | Optional dev-URL snapshot used by the test guard |
| `TEST_DB_ALLOW_RESET` | No | Must equal `yes` before `test:db:reset` may drop the test database |
| `SEED_CONFIRM` | No | Must equal `development` before `npm run db:seed` writes |
| `SEED_SUPERADMIN_EMAIL` | No | Development seed SUPERADMIN email |
| `SEED_HR_EMAIL` | No | Development seed HR email |
| `SEED_BUSINESS_TIMEZONE` | No | Development business timezone; defaults to `UTC` |
| `SUPERADMIN_PASSWORD` | No | Development seed password; gitignored env only |
| `HR_PASSWORD` | No | Development seed password; gitignored env only |

`backend/.env.example` currently omits the five kiosk keys and `JOB_TOKEN`
(SEC-16). Use the root `.env.example` as the complete reference until the two
files are reconciled.

### Generating secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run that once per secret. Store the values in the host's secret manager or a
gitignored env file. Never put them in `.env.example`, CI logs, or the
repository.

### CI secrets

The M9 workflow needs no database secret. Its backend job starts a throwaway
Postgres 16 service container, applies the migrations, and runs
`npm run test:coverage` against `attendpro_test` inside that container, so the
90% statement / 85% branch gate is enforced on every push. `tests/dbGuard.ts`
refuses a hosted Prisma host or a target that does not exactly match
`TEST_DB_HOST` / `TEST_DB_NAME`, so the container is the only accepted database.
The frontend job runs the staged coverage ratchet before the production build.

The e2e suite is not part of CI; it needs a running backend with fixture
accounts. Run it locally after `scripts/test-seed.ts`.

---

## 4. Database provisioning

1. Create the database and the owner role.
2. Set `DATABASE_URL` to the owner connection string.
3. If the two-role split is provisioned, create `attendpro_app` with the
   privileges required by the application and set `DATABASE_URL_APP`. The
   current code ignores that variable, so the split provides no protection yet.
4. Run migrations from the backend directory:

   ```bash
   cd backend
   npx prisma migrate deploy
   ```

5. Verify the migration state:

   ```bash
   npx prisma migrate status
   ```

6. Confirm RLS is enabled on tenant tables:

   ```sql
   SELECT relname, relrowsecurity
   FROM pg_class
   WHERE relname IN ('users', 'attendances', 'audit_logs');
   ```

All three rows should report `relrowsecurity = true`. The application still
connects as the table owner, so RLS is not enforced at runtime until SEC-07 is
fixed.

### First administrator

No production bootstrap path exists yet (SSB-2). `backend/prisma/seed.ts` is a
development seed: it refuses unless `SEED_CONFIRM=development` and
`DATABASE_URL` matches `DEV_DB_HOST`, and it creates one SUPERADMIN and one HR
account. `backend/scripts/test-seed.ts` writes the three fixture accounts into
`attendpro_test` only. Neither is a production path. Before a real deployment,
create the first SUPERADMIN through a reviewed one-off script or add a supported
production seed. Do not copy test fixtures into production.

### Backups

Take a verified backup before every migration. The migrations are forward-only.
A failed release rolls back the application artifact, not the schema, unless
the owner approves a restore.

---

## 5. Build

### Frontend

```bash
npm ci
npm run build
```

Upload `dist/` to the static host. Keep the SPA rewrite so deep links such as
`/hr-reports` resolve to `index.html`.

### Backend

```bash
cd backend
npm ci
npx prisma generate
npm run build
```

The build emits `backend/dist/`. Note the known packaging gap in Section 9:
`npm run build` does not copy `backend/generated/prisma` into `dist/`, while
the compiled client imports `../generated/prisma/index.js`. Until that is
fixed, `npm start` cannot serve the API from `dist/`.

Start the API with the process manager your host provides:

```bash
node dist/server.js
```

Run it as a non-root user, behind TLS, with a restart policy.

---

## 6. Auto clock-out scheduler

The job is an external call, once every 15 minutes:

```bash
curl -X POST https://api.example.com/api/jobs/auto-clock-out/run \
  -H "Authorization: Bearer $JOB_TOKEN"
```

Use cron, systemd timers, a container CronJob, or Windows Task Scheduler. The
route returns `{ closed, flagged, businesses }`; a 409 means another pass holds
the lock. `GET /api/jobs/status` reports the last pass. Full behaviour is in
`docs/runbook-jobs.md`.

---

## 7. Health checks and smoke tests

### Health endpoint

```bash
curl -i https://api.example.com/api/health
```

Expected: `200` with `{"status":"ok","database":"connected"}`. A `503` with
`{"status":"error","database":"disconnected"}` means the API cannot reach
PostgreSQL.

### Post-deploy smoke checks

- [ ] `GET /api/health` returns 200.
- [ ] The frontend loads at `/` and the landing page renders.
- [ ] `POST /api/auth/login` with a known account returns a token and the
  expected role.
- [ ] The role redirect lands on the correct dashboard.
- [ ] `/hr-reports` loads and a small CSV export downloads.
- [ ] `/api/jobs/status` returns the last pass with the job token.
- [ ] An invalid token gets 401, and a staff token on an HR route gets 403.
- [ ] A revoked kiosk device token is refused.

---

## 8. Rollback

1. Stop the scheduler so no job runs against a half-restored database.
2. Redeploy the previous frontend build and backend artifact.
3. Keep the schema in place. The migrations are forward-only; a schema rollback
   needs a reviewed down-migration or a restore.
4. Restore the pre-migration backup only with owner approval.
5. Re-run the health check and smoke tests.
6. Log the incident in `docs/LESSONS.md`.

---

## 9. Known deployment blockers

| ID | Blocker | Effect | Required action |
|---|---|---|---|
| DEP-1 | `npm run build` does not copy `backend/generated/prisma` into `dist/` | `node dist/server.js` cannot resolve the Prisma client | Add a copy step to the backend build or change the import path |
| DEP-2 | No production bootstrap path; `prisma/seed.ts` is development-only and `test-seed.ts` writes `attendpro_test` only | No supported way to create the first production administrator | Add a reviewed production seed or one-off bootstrap once the owner rules on seed policy (SSB-2) |
| DEP-3 | `DATABASE_URL_APP` is not read | RLS policies are bypassed at runtime (SEC-07) | Wire the runtime connection to the app role and set `app.business_id` per transaction |
| DEP-4 | Critical and high dependency advisories remain | Known exploitable packages ship in the tree | Schedule the dependency upgrade before a public launch |
| DEP-5 | No CSP and bearer tokens live in `localStorage` | XSS becomes token theft (SEC-09) | Add a Content-Security-Policy and revisit token storage |
| DEP-6 | CORS always allows localhost origins | Production accepts browser calls from local origins (SEC-11) | Make the localhost list development-only |
| DEP-7 | `/api/docs` is public | Full API surface is disclosed (SEC-10) | Disable it in production or put it behind authentication |
| DEP-8 | Nine staff screens build `/api/api/...` URLs | Schedule, off-days, help requests, corrections, and PIN change return 404 (SEC-20) | Remove the duplicate `/api` prefix in the staff calls |

A private pilot can proceed with DEP-1 and DEP-2 fixed and the remaining items
accepted in writing. A public launch should also close DEP-3 through DEP-7.

---

## 10. Release checklist

- [ ] Owner approval recorded for this deployment.
- [ ] Database backup taken and restore tested.
- [ ] `DATABASE_URL` points at the intended database.
- [ ] All six backend secrets are set on the host.
- [ ] `CORS_ORIGIN` names the production frontend origin.
- [ ] `npm ci && npm run build` passes for the frontend.
- [ ] `npm ci && npx prisma generate && npm run build` passes for the backend.
- [ ] `npx prisma migrate deploy` completes.
- [ ] Frontend `dist/` uploaded and SPA rewrite verified.
- [ ] API process started under the process manager.
- [ ] Health check returns 200.
- [ ] Scheduler configured for the 15-minute job.
- [ ] Smoke checks in Section 7 pass.
- [ ] The release version and known open findings are recorded in
      `docs/CHANGELOG.md` and `docs/attendpro/M9-SECURITY-REVIEW.md`.
