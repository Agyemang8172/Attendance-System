# AttendPro M1 — Security and Test Strategy

- **Date:** 2026-10-15
- **Baseline commit:** `f87ce1d`
- **Milestone:** M1
- **Owner:** Security Agent
- **Companions:** `docs/attendpro/M1-ARCHITECTURE.md`, `docs/attendpro/M1-DATA-MODEL.md`, `docs/attendpro/M1-API-CONTRACTS.md`, `docs/attendpro/M1-KIOSK-SECURITY.md`, `docs/attendpro/M1-ATTENDANCE-LIFECYCLE.md`
- **Status:** design only. No test is implemented here.

This document states how the M1 design is verified: the tests that must exist, the abuse
cases the kiosk must survive, and the privacy obligations that shape both. It answers PRD
§5 rule 8 (prove tenant isolation), §10.3 (kiosk security), §16 (verification failure handling), §20
(security and privacy) and the security checklist in `.agents/agents/security.md`.

Values marked **Provisional** follow `docs/attendpro/DECISION-REGISTER.md`. A provisional
value is a proposal for the owner to accept or change.

---

## 0. Provisional assumptions carried in

| Ref | Decision adopted (owner-confirmed 2026-10-16) | Register state |
|-----|-----------------------------------------------|----------------|
| O2 | QR badge plus a PIN; no SMS codes for kiosk clock-in; email codes for account recovery only; the PIN is stored hashed with attempt limits, rate limits, lockouts and an audited HR reset | Confirmed |
| O3 | A one-time pairing code (10-minute expiry) issues a kiosk token; 30-day lifetime, renewed on use, 90-day maximum then re-pair; the server rechecks device and token status on every request | Confirmed |
| O4 | Every attempt records a location assessment; outside the geo-fence is flagged, not blocked; poor accuracy gives location unknown | Confirmed |
| O5 | Server-generated hashed QR credential, shown once, reissue revokes; a QR alone never authorizes a punch | Confirmed |
| O6 | Email recovery code: six digits, ten-minute expiry, single use, lock after five attempts, one resend per 60 seconds, stored hashed, no account enumeration | Confirmed |
| O7 | Failed verification order: audited HR PIN reset, badge reissue, correction request; a failed attempt is never a successful punch | Confirmed |
| O12 | `tokenVersion`; deactivation increments it, revokes the QR credential, disables or resets the PIN, blocks attendance actions and preserves history | Confirmed |
| O14 | Tests refuse to run unless the database name ends in `_test`; host and database verified before any destructive reset | Confirmed |
| O16 | Calendars, working-day and off-day configuration and absence stay in v1; leave requests are deferred to v2 | Confirmed |
| O17 | Corrections within 7 days with a reason; SAME_DAY and ESCALATED review tiers; no self-approval | Confirmed |
| O21 | Append-only: `audit_logs`, `attendance_correction_revisions`, `attendance_attempts` carry no UPDATE/DELETE | Confirmed |
| O20 | Repository and test safety: preserve nested `backend/.git` and unpushed root commits; the test guard refuses the development database | Owner requirement |
| O21b | DB roles `attendpro_owner` (migrations and seed) and `attendpro_app` (RLS, restricted writes); transaction-scoped tenant context; pooling pinned to transaction mode | Design |
| O21c | SECURITY DEFINER `authenticate_lookup(email)` with pinned `search_path`, EXECUTE revoked from PUBLIC, granted only to the app role | Design |

The verification-session and kiosk-token lifetimes come from `M1-KIOSK-SECURITY.md`
§4.3 and §2.3 rather than from an OTP window; they are stated once there.

---

## 1. Test strategy

### 1.1 Tiers

| Tier | What it covers | Where it runs | Isolation |
|------|----------------|---------------|-----------|
| Unit | Pure functions: timezone conversion, status classification (§5 of the lifecycle doc), PIN HMAC and recovery-code HMAC, rate-limit key builders | Vitest, no database | none needed |
| Integration | Services and repositories against PostgreSQL: transactions, unique constraints, RLS | Vitest + Supertest | isolated database (O14) |
| Contract | Request and response shapes, status codes, error codes, safe messages | Vitest + Supertest | isolated database |
| Concurrency | Two transactions racing the same row | Vitest with parallel requests or two clients | isolated database |

### 1.2 The isolated database is a precondition, not a nice-to-have

M0 finding F7 records that `backend/tests/setup.ts` sets only `NODE_ENV` and `PORT`, that
`backend/vitest.config.ts` describes the suite as running against local development data,
and that `backend/tests/fixtures.ts` upserts real accounts into whatever `DATABASE_URL`
names. The suite can modify and delete development records today.

Under the M1 design this is a harder failure rather than a quieter one: the API connects
as `attendpro_app`, which is subject to Row Level Security, and a query without a tenant
setting returns no rows (`M1-ARCHITECTURE.md` §3.2, §3.4). A test that writes without the
setting fails closed. O14's isolated database is therefore the gate for every
database-backed test in this document. Until it exists, the integration and concurrency
tiers cannot run.

### 1.3 Fixtures

Every database-backed test seeds at least two businesses so isolation is testable:

- **Business A** (`AttendPro Test A`): one SUPERADMIN, one HR, two STAFF (one active, one
  deactivated), one `Shift`, one `WorkplacePolicy` with a `PolicyVersion`, one `Site`, one
  `WorkCalendar` with a `CalendarException`, one `KioskTerminal`, one `QrCredential`, and one
  `EmailRecoveryCode` issued to an A user.
- **Business B** (`AttendPro Test B`): the same shape, so each A-user has a B-counterpart
  to attempt access against.

Fixtures run as `attendpro_owner` so RLS does not block seeding
(`M1-ARCHITECTURE.md` §3.4). The test credential is supplied via `ATTENDPRO_TEST_PASSWORD` (Hard Rule 17).
No fixture writes a real phone number or a real employee record.

---

## 2. Tenant isolation tests (PRD §5 rule 8)

PRD §5 rule 8 requires tests to prove that one business cannot access or modify another
business's data. This is the largest test group and it runs at two layers: the API layer
(the request is refused) and the database layer (RLS refuses the same row even when the
application check is bypassed).

### 2.1 Cross-tenant read and mutate matrix (including new models)

New models introduced: `WorkCalendar`, `CalendarException`, `AttendanceCorrectionRevision`, `Site`, `EmailRecoveryCode` (`KioskTerminal` and `VerificationSession` are reworked rather than new). Tenant isolation tests must cover them explicitly.

Each row is a test. The actor is a real session for business A; the target is a row that
belongs to business B. "404" means the resource is not found within the caller's scope,
which is deliberate: it does not confirm the row exists elsewhere
(`M1-ARCHITECTURE.md` §2.3).

| # | Actor (business A) | Attempt | Expected |
|---|--------------------|---------|----------|
| T1 | HR | `GET /api/hr/attendance` (B's rows in the result set) | Only A rows returned; B rows absent |
| T2 | HR | `GET /api/hr/attendance?employeeId=<B staff id>` | Empty result, not a 200 with B data |
| T3 | HR | `PATCH /api/hr/corrections/<B correction id>/decision` | `404` |
| T4 | HR | `PATCH /api/hr/help-requests/<B request id>` | `404` |
| T5 | HR | `PATCH /api/hr/employees/<B employee id>` | `404` |
| T6 | SUPERADMIN | `PATCH /api/business/settings` for B | Writes only A's row; a body carrying a `businessId` has no effect |
| T7 | SUPERADMIN | `POST /api/business/kiosks/:id/revoke` on B's kiosk | `404` |
| T8 | SUPERADMIN | `POST /api/business/employees/<B employee id>/qr-credential` | `404` |
| T9 | STAFF | `GET /api/staff/attendance?userId=<B staff id>` | Only the caller's own rows; the injected id is ignored |
| T10 | STAFF | `GET /api/attendance/my-attendance` with a B date range | Only A self rows |
| T11 | any | `GET /api/audit?entityId=<B row>` (HR or SUPERADMIN) | Only A audit rows |
| T12 | HR | `GET /api/reports/attendance-register?shiftId=<B shift id>` | Empty result |
| T12a | HR | `GET /api/hr/work-calendars` (B calendar visible) | Only A business calendars returned |
| T12b | HR | `PATCH /api/hr/work-calendars/<B id>` | `404` |
| T12c | HR | `GET /api/sites` (B's sites listed) | Only A sites returned |
| T12d | SUPERADMIN | `PATCH /api/sites/<B site id>` | `404` |
| T12e | HR | `GET /api/audit/corrections/<B attendance id>` | Only A corrections and revisions, or empty |
| T12f | SUPERADMIN | `GET /api/business/work-calendars/<B id>` | `404` |
| T12g | any | `POST /api/auth/recovery/verify` carrying a code issued to a B user | Same failure as a wrong or expired code, with no enumeration of which part failed |

### 2.2 Cross-tenant kiosk binding

| # | Attempt | Expected |
|---|---------|----------|
| T13 | Business A kiosk presents a business B employee's QR token to `/api/kiosk/identify` | `404` with the same message as an unknown token; no `VerificationSession` created |
| T14 | A kiosk device token whose claims name business A calls `/api/kiosk/identify` for a B employee | Refused server-side by the kiosk-to-employee check (`M1-KIOSK-SECURITY.md` §2.4), regardless of the request body |
| T15 | A response body or client header carries `businessId: B` on any kiosk call | Ignored; the scope comes from the device token alone (`M1-ARCHITECTURE.md` §2.1) |

### 2.3 RLS backstop tests

These prove the database refuses an operation even if a repository query forgets its
`businessId` filter. They run as `attendpro_app`, the runtime role, not as the owner. The application role may SELECT and INSERT only on append-only tables. A BEFORE UPDATE OR DELETE trigger raises an exception. RLS defines only SELECT/INSERT policies. Repository/test safety requires an isolated test database (O14). The test suite must refuse to run against the development database (guard). Preserves nested `backend/.git` and unpushed root commits.

| # | Attempt | Expected |
|---|---------|----------|
| T16 | `SELECT * FROM attendances` with `app.business_id = 'A'` after seeding A and B | Only A rows |
| T17 | The same `SELECT` with no `app.business_id` set | Zero rows (fail closed) |
| T18 | `INSERT INTO attendances (... business_id = 'B')` with `app.business_id = 'A'` | Rejected by the `WITH CHECK` policy |
| T19 | `UPDATE attendances SET ... WHERE business_id = 'B'` with `app.business_id = 'A'` | Zero rows affected |
| T20 | `DELETE FROM audit_logs WHERE business_id = 'A'` with `app.business_id = 'A'` | Rejected: append-only; trigger raises exception (no DELETE/UPDATE permitted) |
| T20a | `UPDATE attendance_correction_revisions SET ...` as `attendpro_app` | Rejected by append-only trigger (no UPDATE/DELETE) |
| T20b | `DELETE FROM attendance_attempts` as `attendpro_app` | Rejected by append-only trigger (no UPDATE/DELETE) |
| T21 | Two requests in the same connection pool, different tenants, run back to back | `set_config(..., is_local = true)` reverts at transaction end (transaction pooling compatible); second sees only its own rows. Statement pooling is unsafe - verify configuration. |

T21 is the test that guards against a pooled connection leaking a tenant setting. It runs
one tenant transaction, then a second on the same pool, and asserts the second sees only
its own rows.

---

## 3. OWASP Top 10 mapping for AttendPro

The checklist is `.agents/agents/security.md`'s, applied to this design. Each row names
the concrete exposure in AttendPro and the control that answers it.

| # | OWASP item | AttendPro exposure | Control | Test |
|---|-----------|--------------------|---------|------|
| A1 | Broken Access Control | Cross-tenant reads or writes; a staff token reaching the punch; HR approving their own correction | Tenant scope from identity plus RLS (§2 here); punches require a kiosk token; reviewer identity check | T1 to T21, §7 self-approval test |
| A2 | Cryptographic Failures | QR tokens, PINs, pairing codes and email recovery codes at rest; password storage | Keyed HMAC with a per-record salt for QR tokens, PINs, pairing codes and recovery codes; bcrypt for passwords; HTTPS in production | §5 PIN abuse, §6 QR revocation, secret-handling tests |
| A3 | Injection | Prisma parameterises SQL; Zod validates input; HTML injection into the kiosk display | Typed Zod schemas per route; parameterised queries only; the kiosk renders text nodes, not HTML | Contract tests on malformed input; a stored-XSS test that submits a name containing markup and asserts it is not rendered as HTML |
| A4 | Insecure Design | A punch without a second factor; a universal grace or 23:59 rule; a QR-only fallback | QR identifies and the PIN authorizes; per-shift grace snapshots; no fixed closure time; the recovery path is HR-assisted and audited, never QR-only | §4 kiosk abuse cases; lifecycle edge cases |
| A5 | Security Misconfiguration | CORS, security headers, error detail, debug endpoints, RLS left off | Strict CORS allowlist; `securityHeaders` (`nosniff`, `DENY`, `no-referrer`); typed errors with no `error.message`; RLS enabled on every tenant table; no debug endpoint in production | Header tests, safe-error tests, `db-check.sh` |
| A6 | Vulnerable and Outdated Components | Outdated Prisma, Express, bcrypt, jsonwebtoken, the location library | Pinned versions; a dependency audit in the pipeline; Researcher confirmation before any upgrade | Dependency audit step |
| A7 | Identification and Authentication Failures | PIN brute force; a reused verification session; a token with no revocation; login enumeration | PIN attempt limits, temporary lockout and rate limits; `tokenVersion` revocation; identical login failure body for unknown email and wrong password | §5 PIN abuse; auth tests |
| A8 | Software and Data Integrity Failures | Unsigned job trigger; unchecked migrations; tampered audit rows | The job trigger requires `JOB_TOKEN`; migrations run as owner with dry-run for destructive changes; `audit_logs` is append-only | Job-auth test; `db-check.sh`; T20 |
| A9 | Security Logging and Monitoring Failures | A failed PIN entry, a revoked QR use or a cross-tenant attempt not recorded | `AttendanceAttempt` records every identification and verification outcome; `AuditLog` is append-only; redaction keeps secrets out of logs | Audit-write tests; redaction tests |
| A10 | Server-Side Request Forgery | An outbound request built from user input | With no SMS provider the outbound surface is configuration-driven only; no external call is made from request data | Review of external integrations |

---

## 4. Kiosk abuse cases

Each case names what an attacker does and what the system returns. The safe messages are
the table in `M1-KIOSK-SECURITY.md` §10.

| # | Abuse case | Expected handling |
|---|-----------|-------------------|
| K1 | A photographed QR is presented by someone else at a registered kiosk | The PIN is required and only the employee knows it, so the punch fails at verification. A copied QR identifies a candidate and nothing more. |
| K2 | A QR token is guessed or enumerated | 192-bit random tokens make guessing infeasible; the kiosk-identify limiter (60/min per kiosk) bounds attempts; unknown and cross-business tokens return the same message. |
| K3 | A browser that is not a registered kiosk calls `/api/kiosk/identify` | Rejected at the kiosk middleware with `401`; no session is created. |
| K4 | A revoked kiosk keeps calling with its unexpired kiosk token | The kiosk row is reloaded every call, so the next request fails even inside the 30-day token life (PRD §10.3). |
| K5 | A revoked QR credential is presented | Lookup fails; the kiosk shows the no-longer-valid message; `403`. |
| K6 | A client tries to supply its own location result | The result is computed server-side from the submitted coordinates against the configured `Site` geo-fence; `locationResult` is never taken from the request body. |
| K7 | Guess the PIN repeatedly | After the configured wrong attempts the account locks for the lockout window and the employee is directed to HR-assisted recovery; attempts-remaining is never disclosed. |
| K8 | Reuse a valid verification session | The session is single-use and moves to `CONSUMED` in the punch transaction; a used session verifies nothing. |
| K9 | Race two verify calls with the same session id | The session is single-use and moves to `CONSUMED` in the punch transaction; the second call finds `CONSUMED` and is refused. |
| K10 | Flood the PIN endpoint to lock other employees out | Attempts are keyed on the employee, so one account's failures cannot lock another's; kiosk-keyed limits bound mass input. |
| K11 | Move between kiosks to keep guessing | Guessing is keyed on the employee, not the device, so the employee-keyed verify limit still applies. |
| K12 | A failed verification tries to create a record | Only a `VERIFIED` session reaches the punch; a failure writes an `AttendanceAttempt` with `outcome = REJECTED` and no `Attendance` row. |
| K13 | Replay an old verification session id from another kiosk | Sessions are bound to the creating `kioskId`; a foreign session id fails. |
| K14 | Read the kiosk screen after an employee walks away | The kiosk clears local state after every result, on cancel, and after 20 seconds idle; the ready screen shows no employee data. The server-side session also expires. |
| K15 | Brute-force the pairing code at `/api/kiosk/pair` | The code is one-time and expires after 10 minutes; the limiter bounds attempts; comparison is constant-time; a redeemed code cannot be redeemed again. |
| K16 | Log in as a deactivated employee to reach the punch | The punch path requires a kiosk token; `authMiddleware` also refuses a deactivated account (`401 ACCOUNT_DEACTIVATED`), and the kiosk path checks `User.isActive`. |
| K17 | Spoofed coordinates that claim the punch was inside the site | The assessment is recorded but is never treated as proof of identity; outside the fence is flagged for review rather than blocked, and a reading below the accuracy threshold gives `UNKNOWN`. |
| K18 | Replay a stale location read from an earlier attempt | A capture older than `gpsFreshnessSeconds` gives `UNKNOWN`, never `OUTSIDE`. |

---

## 5. Rate-limit tests

The existing server rate-limits by IP only (100 per 15 minutes on `/api/`, 10 per 15
minutes on login, and an account-keyed login limiter). The kiosk design adds kiosk-keyed
and employee-keyed limiters (`M1-KIOSK-SECURITY.md` §7). All limiters are disabled under
`NODE_ENV=test`, so these tests run with the limiters force-enabled by an explicit flag in
the test harness rather than by the production default.

| # | Limiter | Key | Provisional limit | Test |
|---|---------|-----|-------------------|------|
| R1 | Kiosk identify | `kioskId` | 60 per minute | 61 requests in the window: the 61st returns `429`; a second kiosk is unaffected |
| R2 | Pairing-code redemption | `kioskId` | 10 per 15 minutes | The 11th redemption in the window returns `429`; a different kiosk is unaffected |
| R3 | PIN verify | `employeeId` | 10 per 15 minutes | The 11th verify in the window returns `429`; a different employee still verifies |
| R4 | Employee verify | `employeeId` | 5 per session, 10 per 15 minutes | The session attempt cap fires at 5; cross-session guessing trips at 10 |
| R5 | Device token | `kioskId` | 10 per 15 minutes | The 11th secret presentation returns `429` |
| R6 | IP (existing) | `ip` | 100 per 15 minutes | Unchanged; asserted still present so the kiosk limiters sit alongside it, not instead of it |

Two properties matter beyond the counts. R3 and R4 must key on the employee, so one
employee cannot be shielded by another employee's activity. R1 and R2 must key on the
kiosk, so one device cannot spray lookups or attempt pairing-code redemption across
businesses. The test asserts
that a limit on one key does not consume budget on another.

---

## 6. QR credential revocation test

PRD §10.3 requires revocation to take effect, and O4 makes the credential opaque and
hashed. The test walks the full lifecycle:

1. A SUPERADMIN issues a QR credential for an active A employee
   (`POST /api/business/employees/:id/qr-credential`). The response contains the payload
   once; the database stores only `tokenHash`.
2. Assert the stored row has no plaintext token, and that the payload is not recoverable
   from `tokenHash` without `QR_SECRET_KEY`.
3. A registered A kiosk identifies with the token: `POST /api/kiosk/identify` returns
   `200` and creates a `VerificationSession`.
4. The SUPERADMIN revokes the credential
   (`POST /api/business/qr-credentials/:id/revoke`). `revokedAt` is set.
5. The same kiosk identifies with the same token again: `403` with the no-longer-valid
   message, and no new `VerificationSession` is created.
6. Re-issuing a credential for the employee revokes the previous active row in the same
   transaction, and the one-active-per-employee partial unique index
   (`qr_credentials(employee_id) WHERE revoked_at IS NULL`) holds throughout.
7. Deactivating the employee revokes all of that employee's credentials, and their tokens
   fail from that moment (PRD §15).

---

## 7. Migration safety and repository/test safety

| # | Test | Expected |
|---|------|----------|
| M1 | Restore rehearsal | Restore from pre-migration backup into isolated test DB, verify schema and data |
| M2 | Legacy verification | Preserve timestamps, enum mapping via `legacy_status`, row counts match, ambiguous (HALF_DAY, ON_LEAVE, unknown) remain distinguishable |
| M3 | Backup path | Recovery: restore-from-backup then fix forward (documented procedure) |
| M4 | Migration transactionality | Each migration runs in a transaction where supported; forward-only |
| M5 | Dev DB guard | Test suite refuses to run against development DB (fail fast) |
| M6 | Repo integrity | Nested `backend/.git` preserved; unpushed root commits preserved |

## 8. RLS/privileged function tests

| # | Test | Expected |
|---|------|----------|
| RLS1 | Transaction-scoped tenant context via `SET LOCAL app.business_id` | Scoped to transaction; cleared on commit/rollback |
| RLS2 | Pooled connections | Transaction pooling compatible (SET LOCAL); statement pooling unsafe - configuration verified |
| RLS3 | DB roles | `attendpro_owner` bypasses RLS for migrations/seed; `attendpro_app` has RLS and write restrictions (INSERT only where permitted) |
| RLS4 | SECURITY DEFINER `authenticate_lookup(email)` | Has pinned `search_path`; EXECUTE revoked from PUBLIC; granted only to `attendpro_app`; no privilege escalation |

## 9. Other security tests

| # | Test | Expected |
|---|------|----------|
| S1 | Force a `500` on a business route | Body is `{ success: false, code: "INTERNAL_ERROR", message: "Something went wrong." }`; no `error.message`, no stack, in any environment. This is the M0 finding N4 regression. |
| S2 | Submit malformed input to every route | `400` with a per-field list; no unhandled exception |
| S3 | Log in with an unknown email and with a wrong password | Identical status and body; the timing-equalising dummy hash keeps the two cases close in time |
| S4 | Call a protected route with a token for a deactivated account | `401 ACCOUNT_DEACTIVATED`; the account row is reloaded from the database on every request |
| S5 | Reach a password-change-gated route while `mustChangePassword` is true | `403 PASSWORD_CHANGE_REQUIRED` |
| S6 | HR approves a correction they submitted | `403`; the reviewer-equals-requester check fires regardless of role |
| S7 | A STAFF token calls `/api/attendance/clock-in` | Refused: the punch requires a kiosk token (PRD §7, M0 finding N5) |
| S8 | Run the automatic job twice for the same open rows | The second run closes nothing; only `OPEN` rows are touched (idempotency) |
| S9 | Run two job processes at once | The advisory lock lets one proceed and the other exits without work |
| S10 | Inspect every log line produced by a kiosk flow | No PIN, no QR token, no pairing code, no kiosk token, no full phone number, no password |
| S11 | Inspect `.env.example` and the code for secrets | Only dummy values; all secrets read from `process.env.*`; `env-check.sh` passes |
| S12 | Call the manual job trigger without `JOB_TOKEN` | `401` |

---

## 8. Privacy and Ghanaian data-protection notes (PRD §20)

PRD §20 places a Ghanaian data-protection review before production and states the PRD is
not legal advice. This section records the design's privacy position so the review has a
starting point. It is not a compliance assessment.

### 8.1 What personal data AttendPro processes

| Data | Where it lives | Purpose | Sensitivity |
|------|----------------|---------|-------------|
| Name, email, employee code, department, job title | `User` | Employment administration and dashboards | Personal |
| Phone number | `User.phoneNumber` | Account recovery only | Personal |
| Timing of clock-in and clock-out | `Attendance` | Attendance record | Personal |
| PIN hash, QR token hash, pairing code hash, kiosk token hash, recovery code hash | `User`, `KioskTerminal`, `QrCredential`, `EmailRecoveryCode` | Verification; stored non-reversibly | Credential |
| Audit and attempt rows | `AuditLog`, `AttendanceAttempt` | Accountability for sensitive actions | Personal in part |
| Last two digits of a phone number in logs | Log output | Diagnostics | De-identified |

### 8.2 Controls the design already provides

- **Data minimisation.** The kiosk returns no employee id and no phone number
  (`M1-KIOSK-SECURITY.md` §10). The public preview reads no tenant table and uses static
  sample rows (PRD §6).
- **Storage protection.** PINs, QR tokens, pairing codes, kiosk tokens and email recovery
  codes are keyed-HMAC-hashed, with a per-record salt where the secret is short (PINs and
  recovery codes), so a database copy does not yield a usable secret and a bare SHA-256
  table is not reusable (PRD §20, `M1-KIOSK-SECURITY.md` §5 and §6).
- **No secret in logs.** The redaction rules drop PINs, QR tokens, pairing codes, kiosk
  tokens, recovery codes, passwords, and full phone numbers (`M1-ARCHITECTURE.md` §8).
- **Access limitation.** Tenant scope plus RLS means a business sees only its own people
  (§2 here). Staff see only themselves (PRD §5 rule 5).
- **Retention.** O10 proposes a 7-year window stored as `Business.retentionYears`, with
  soft delete rather than hard delete, so attendance history survives accidental removal
  and a scheduled purge honors the window.
- **Accountability.** Corrections and configuration changes are append-only in
  `AuditLog`, so a change to a person's record can be reconstructed.

### 8.3 Ghanaian obligations to confirm with counsel

The Ghana Data Protection Act, 2012 (Act 843) governs processing of employee data here.
The design assumes, and the owner should confirm:

1. **Lawful basis.** Employment administration is the basis for attendance data.
   Verification uses a hashed PIN and a QR token, so no telecom message content is
   processed and no channel-consent question arises.
2. **Data-subject rights.** Access, correction, and (where applicable) erasure. The
   correction workflow answers the correction right. Erasure must not conflict with the
   attendance-retention obligation in §15 of the PRD; those two must be reconciled in the
   retention policy.
3. **Cross-border transfer.** If the hosting or any subprocessor stores data outside
   Ghana, the transfer needs a lawful basis and a check on the provider's safeguards.
   The hosting choice is where this is settled.
4. **Registration and reporting.** Whether the platform or each business must register as
   a data controller, and any breach-notification duty, is a legal question for counsel.
5. **Security safeguards.** Act 843 expects appropriate technical and organisational
   measures. The RLS layer, hashing, rate limits, and audit trail are the technical side;
   staff access policy is the organisational side.

**Owner action:** commission the privacy review, and treat O10 (retention) and the open
R-series decisions (R5 PIN policy, R8 retention categories) as the register rows that
carry the most privacy weight.

---

## 9. Risk to acceptance-test map

Each risk is rated with the severity scale from `.agents/agents/security.md`. The
acceptance test is the one that must pass before the risk is considered handled.

| Risk | Severity | Description | Acceptance test |
|------|----------|-------------|-----------------|
| R-ISO-1 | CRITICAL | Business A reads business B attendance through the API | T1, T2, T9, T10 |
| R-ISO-2 | CRITICAL | Business A mutates business B records | T3 to T8, T12 |
| R-ISO-3 | CRITICAL | A repository query forgets the tenant filter and RLS is absent | T16 to T20 |
| R-ISO-4 | HIGH | A pooled connection leaks one tenant setting into the next request | T21 |
| R-KIOSK-1 | CRITICAL | A copied QR authorizes a punch without the PIN | K1, K12 |
| R-KIOSK-2 | HIGH | An unregistered device creates attendance | K3, K4 |
| R-KIOSK-3 | HIGH | A QR from one business is accepted at another business's kiosk | T13, T14 |
| R-PIN-1 | HIGH | PIN guessed by unlimited attempts | K7, K10, K11, R3, R4 |
| R-PIN-2 | HIGH | A verification session reused across punches | K8, K9, K13 |
| R-PAIR-1 | MEDIUM | Pairing code brute-forced at the pairing endpoint | K15, R2 |
| R-DUP-1 | HIGH | Duplicate punches from a retry or a double tap | Lifecycle §3.4; K9 |
| R-DUP-2 | HIGH | Two open sessions for one employee under concurrency | Lifecycle §3.2; the concurrency tier |
| R-AUTH-1 | HIGH | A deactivated account keeps working | S4, K16 |
| R-AUTH-2 | MEDIUM | Login reveals whether an account exists | S3 |
| R-LEAK-1 | HIGH | `error.message` leaks in a 500 body | S1 |
| R-LEAK-2 | HIGH | A secret or full phone number reaches a log | S10, S11 |
| R-QR-1 | MEDIUM | A revoked QR credential still works | §6 steps 4 and 5 |
| R-CORR-1 | HIGH | A requester approves their own correction | S6, Lifecycle §8.3 |
| R-JOB-1 | MEDIUM | Auto clock-out closes a row twice or overwrites a real punch | S8, S9 |
| R-CALC-1 | MEDIUM | A shift edit rewrites historical status | Lifecycle §5; the snapshot reads |
| R-A6-1 | MEDIUM | A vulnerable dependency ships | The dependency audit step |
| R-MIG-1 | HIGH | Migration loses legacy data | M1-M4 |
| R-ISO-5 | HIGH | Cross-business access via new models | T12a-T12f |
| R-APPEND-1 | CRITICAL | Update/delete on append-only tables | T20, T20a, T20b |
| R-DB-1 | CRITICAL | Tests run against dev DB | M5 |
| R-POOL-1 | HIGH | Connection pool leaks tenant context | T21, RLS1, RLS2 |

---

## 10. Traceability to PRD and standards

| Source | Covered by |
|--------|-----------|
| PRD §5 rules 6 to 8 | §2 tenant isolation tests |
| PRD §10.3 | §4 kiosk abuse, §6 QR revocation |
| PRD §12 | §1 unit tier on status classification |
| PRD §13 | S8, S9 |
| PRD §15 | K16, S4, §6 step 7 |
| PRD §16 | K8 to K11, §5 rate limits |
| PRD §17 | §2, R-DUP-1, R-DUP-2 |
| PRD §20 | §3 OWASP mapping, §8 privacy |
| `.agents/agents/security.md` | §3 OWASP checklist, §9 severity ratings |
| Decision register O2, O3, O4, O5, O6, O7, O12, O14 | §0 assumptions, applied throughout |

---

## 11. Open items for the owner

1. O14 is resolved (isolated test DB required). Implement test guard refusing to run against dev DB (M5). Preserve nested `backend/.git` and unpushed root commits.
2. Confirm O6, O7 and O8 so the abuse cases in §4 and the rate limits in §5 have final numbers.
3. Confirm O10 (retention) and the open R-series decisions (R5 PIN policy, R8 retention categories). These carry the most privacy weight under the Ghanaian review in §8.3.
4. Commission the privacy review. PRD §20 places it before production and says the PRD is not legal advice.
5. Decide whether the IP limiter stays alongside the kiosk and employee limiters (R6 assumes it does).
6. O16/O17/O19/O20/O21/O22 resolved; verify implementation details (append-only triggers, SECURITY DEFINER search_path, pooled connection mode).
