# AttendPro — Employee Attendance Management

AttendPro records attendance through a paired kiosk: an employee presents a QR
badge, confirms a four-digit PIN, and the punch is written against their shift,
policy, and site. Staff, HR, and SUPERADMIN portals read the result and manage
the setup behind it.

The repository is a React frontend and an Express/PostgreSQL backend. It is not
a MERN or MongoDB application.

## Live demo

The public demo at
[https://attendance-system-seven-mocha.vercel.app](https://attendance-system-seven-mocha.vercel.app)
predates the M8 and M9 rework. Treat it as a legacy preview and run the
repository locally for the current behaviour.

## Tech stack

**Frontend**
- React 19 + Vite 7
- React Router 7
- Tailwind CSS 3
- Axios
- Recharts
- React Hot Toast and React Icons
- Vitest + Testing Library, Playwright for e2e

**Backend**
- Node.js 20 + Express 5
- PostgreSQL 15+ through Prisma 6 and the `@prisma/adapter-pg` driver
- JWT authentication with bcrypt password hashing
- Zod request validation
- Pino logging
- Swagger UI at `/api/docs`
- Vitest + Supertest

**Deployment**
- Frontend: static host with SPA rewrites (the repository includes
  `vercel.json`)
- Backend: a Node process behind TLS
- Database: managed PostgreSQL
- Auto clock-out: an external scheduler calls the job route every 15 minutes

## Features

- **Kiosk attendance** — QR badge identification, PIN verification, and an
  atomic clock-in or clock-out tied to the employee's shift
- **Role-based portals** — separate staff, HR, and SUPERADMIN navigation and
  route guards
- **Attendance history** — staff read their own rows; HR and SUPERADMIN read the
  business register with filters, sorting, and detail drawers
- **Corrections** — staff request a fix within seven days; HR decides with a
  no-self-approval rule and a revision history
- **Help requests** — five staff categories, an HR queue, and resolution notes
- **Reports** — attendance register, punctuality summary, exceptions, and CSV
  export with an audit row
- **Setup screens** — shifts, assignments, attendance policies and versions,
  calendars and exceptions, sites and geo-fences, and kiosk devices
- **Audit trail** — authentication, attendance, correction, help, PIN, and
  export events
- **Automatic clock-out** — a shift-aware job that closes or flags open sessions

There are no clock-in or clock-out buttons in the staff portal. Punching happens
at the kiosk by design (PRD §7).

## Test accounts

Supply a policy-compliant test credential privately through `ATTENDPRO_TEST_PASSWORD` before running the fixture initializer or tests. Do not log it or commit it. Do not run concurrent suites against the same test database.

| Account | Role | Employee code |
|---|---|---|
| `superadmin@test.attendpro.com` | SUPERADMIN | `EMP-9001` |
| `hr@test.attendpro.com` | HR | `EMP-9002` |
| `staff@test.attendpro.com` | STAFF | `EMP-9003` |

The development seed (`cd backend && npm run db:seed`) creates one SUPERADMIN
and one HR account. It refuses unless `SEED_CONFIRM=development` and
`DATABASE_URL` matches `DEV_DB_HOST`. There is still no production bootstrap
path (SSB-2). The automated suite uses the separate `attendpro_test` database:
`backend/tests/fixtures.ts` (or `scripts/test-seed.ts`) writes the three
test accounts there, and the guard refuses the development database. Persistent development bootstrap credentials are configured separately.

## Running locally

### Prerequisites

- Node.js 20
- PostgreSQL, or a Prisma Postgres instance
- Two terminals for the API and the frontend, plus one for the database proxy if
  you use `prisma dev`

### 1. Install dependencies

```bash
npm install
cd backend
npm install
cd ..
```

### 2. Start PostgreSQL

Use the hosted Prisma Postgres instance already named by `DATABASE_URL` in
`backend/.env`, or a local PostgreSQL 16 server. If you prefer Prisma's local
dev server, run:

```bash
cd backend
npx prisma dev
```

It prints a connection string; put that in `backend/.env` as `DATABASE_URL`.
The automated suite does not use this database: it reads `TEST_DATABASE_URL`
(the local `attendpro_test`) and the guard refuses the development host.

### 3. Configure the environment

Create `backend/.env` for the API:

```bash
cp backend/.env.example backend/.env
```

Fill in at least:

```
PORT=8000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=<32-byte hex>
PIN_HMAC_KEY=<32-byte hex>
QR_SECRET_KEY=<32-byte hex>
KIOSK_PAIRING_KEY=<32-byte hex>
KIOSK_TOKEN_KEY=<32-byte hex>
JOB_TOKEN=<32-byte hex>
CORS_ORIGIN=http://localhost:5173
```

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`backend/.env.example` is missing the five kiosk keys and `JOB_TOKEN` (SEC-16).
The root `.env.example` lists every variable and is the complete reference.

Create a root `.env` for the frontend:

```
VITE_API_URL=http://localhost:8000/api
```

### 4. Create the schema and fixtures

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

Then run the backend suite once to upsert the fixture accounts:

```bash
npx vitest run
```

This writes rows to the database in `DATABASE_URL`. Use a development database,
not production.

### 5. Start the services

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2, from the repository root:

```bash
npm run dev
```

Open `http://localhost:5173`. The public landing page appears at `/`; choose
**Sign in to your AttendPro workspace** to reach `/login`.

## Scripts

| Command | Scope | Purpose |
|---|---|---|
| `npm run dev` | root | Vite dev server on 5173 |
| `npm run build` | root | Production build to `dist/` |
| `npm run lint` | root | ESLint |
| `npm run typecheck` | root | `tsc --noEmit` |
| `npm run test:unit` | root | Vitest unit and component tests |
| `npm run test:e2e` | root | Playwright, Chromium |
| `npm run test:coverage` | root | Vitest with coverage; staged ratchet in `vitest.config.ts` |
| `npm run dev` | backend | Nodemon + tsx API server |
| `npm run build` | backend | TypeScript build to `backend/dist/` |
| `npm test` | backend | Vitest + Supertest suite against `attendpro_test` |
| `npm run test:coverage` | backend | Coverage run; enforces 90% statements / 85% branches |
| `npm run db:seed` | backend | Development seed (SUPERADMIN + HR); requires `SEED_CONFIRM=development` |
| `npm run test:db:check` | backend | Verify `TEST_DATABASE_URL` without connecting |
| `npm run test:db:reset` | backend | Drop and rebuild `attendpro_test`; requires `TEST_DB_ALLOW_RESET=yes` |
| `npx prisma migrate deploy` | backend | Apply migrations |
| `npx prisma generate` | backend | Regenerate Prisma Client |

## API overview

All routes are under `/api`. `Authorization: Bearer <token>` is required unless
the Access column says otherwise.

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/health` | Database health check | Public |
| POST | `/auth/login` | Sign in | Public |
| POST | `/auth/logout` | Sign out | Any signed-in user |
| GET | `/attendance/my-attendance` | Own attendance history | STAFF |
| GET | `/attendance/all-attendance` | Business attendance | HR, SUPERADMIN |
| POST | `/attendance/clock-in` | Kiosk clock-in | Kiosk device token |
| POST | `/attendance/clock-out` | Kiosk clock-out | Kiosk device token |
| GET | `/hr/employees` | Employee directory | HR, SUPERADMIN |
| POST | `/hr/employees` | Create an employee | HR, SUPERADMIN |
| PATCH | `/hr/employees/:id` | Update an employee | HR, SUPERADMIN |
| POST | `/hr/users/:id/reset-pin` | Reset a kiosk PIN | HR, SUPERADMIN |
| POST | `/kiosk/pair` | Pair a device with a code | Public |
| POST | `/kiosk/pairing-codes` | Generate a pairing code | SUPERADMIN |
| POST | `/kiosk/identify` | Identify a QR badge | Kiosk device token |
| POST | `/kiosk/verify-pin` | Verify the PIN and unlock a punch | Kiosk device token |
| GET | `/reports/attendance-register` | Attendance register | HR, SUPERADMIN |
| GET | `/reports/attendance-register/export` | CSV export | HR, SUPERADMIN |
| GET | `/reports/punctuality-summary` | Punctuality summary | HR, SUPERADMIN |
| GET | `/reports/exceptions` | Exception list | HR, SUPERADMIN |
| POST | `/jobs/auto-clock-out/run` | Run the auto clock-out pass | `JOB_TOKEN` |
| GET | `/jobs/status` | Last job pass | `JOB_TOKEN`, or SUPERADMIN for its own business |
| GET | `/docs` | Swagger UI | Public (SEC-10) |

## Documentation

- `docs/TESTING_GUIDE.md` — step-by-step UI and API walkthroughs
- `docs/attendpro/M9-SECURITY-REVIEW.md` — M9 findings and release gate
- `docs/attendpro/DEPLOYMENT-RUNBOOK.md` — deployment, health checks, rollback
- `docs/attendpro/M8-GAP-REGISTER.md` — design and accessibility gaps
- `docs/runbook-jobs.md` — auto clock-out job details
- `docs/CHANGELOG.md` — release history

## Known limitations

- No kiosk UI exists; the kiosk API is complete and tested, but pairing and
  punching are currently API-only.
- RLS is enabled in the migrations but bypassed at runtime because the API
  connects as the table owner (SEC-07).
- Password changes and resets do not revoke existing JWTs (SEC-08).
- Several staff screens return 404 because they call `/api/api/...` (SEC-20).
- Critical and high dependency advisories remain in both dependency trees
  (SEC-01 through SEC-06).
- The backend production build does not copy the generated Prisma client into
  `dist/` (DEP-1 in the deployment runbook).

## Author

**Godfred Agyemang**

- GitHub: [https://github.com/Agyemang8172](https://github.com/Agyemang8172)

## License

MIT
