# P04 — Password and PIN security operations

- Date: 2026-11-01
- Status: verification complete, awaiting Security verdict and owner review
- Owner slice: `docs/attendpro/PHASED-IMPLEMENTATION-PLAN.md` §P04
- Surfaces: `backend/controllers/authController.ts`, `backend/controllers/userController.ts`, `backend/controllers/staffProfileController.ts`, `backend/middleware/authMiddleware.ts`, `backend/middleware/requirePasswordChange.ts`, the mounted auth/user/HR/staff-profile routes, and the shared Security entry in `src/`.
- New suite: `backend/tests/unit/authSecurity.contract.test.ts`
- Run: `cd backend && npx vitest run --config vitest.unit.config.ts`

## 1. Result

The password and PIN lanes hold the approved rules in source and in the no-database contract suite. Four defects were found in the self-service PIN lane and in the shared Security entry; they are repaired in this slice. The database-backed suites were not run, so RLS, real row locking and PostgreSQL serialisation remain unverified.

No schema, migration, dependency, environment, commit or push change was made.

## 2. Verified surfaces

### 2.1 Sign-in

`POST /api/auth/login` answers one generic `401 Invalid email or password` for an unknown address and a wrong password. The unknown-account path still performs password work at the account cost. An inactive account is refused only after the password matches, so the response does not turn the endpoint into an account-status oracle. Two limiters sit in front of the route: ten attempts per IP and eight per account in a fifteen-minute window (`backend/server.ts`).

The access token carries `userId`, `role`, `tokenVersion` and `businessId`, with an eight-hour lifetime. `authMiddleware` reloads the account row, rejects a missing tenant claim, a different tenant, an inactive account, and a `tokenVersion` that no longer matches. The request role is the account row's role, not the signed claim.

The database-backed login suite (`backend/tests/auth.test.ts`) was not run. The token and middleware contract is covered without a database by `authSecurity.contract.test.ts`.

### 2.2 Forced set-password

`/set-password` is guarded by `SetPasswordRoute`: an unauthenticated visitor goes to sign-in, an account with `mustChangePassword === false` goes to its role home, and an account that still owes a password stays on the screen.

`PUT /api/users/change-password` is deliberately mounted without `requirePasswordChange`, so the temporary credential can be replaced. The controller calls `caller(req, prisma, true)` to permit the forced change, requires the current password, enforces the shared password policy, rejects reuse, and uses an observed-password/`tokenVersion`/`isActive` guard. A successful change increments `tokenVersion`, clears `mustChangePassword`, and returns a freshly signed token. The old token fails on its next request.

Frontend tests cover STAFF, HR and SUPERADMIN on `/set-password`, including the invalid-policy case and the post-change landing.

### 2.3 Own change-password

The same endpoint serves the Security entry for every role. The current password is required, the new password must pass the shared policy and differ from the current one, and the response carries a new token. The old token is refused because the version moved.

### 2.4 Authorized administrator reset

`PUT /api/users/:id/reset-password` is mounted with `authMiddleware`, `requirePasswordChange()` and `authorizeRole("SUPERADMIN", "HR")`. The controller refuses self-reset, scopes HR to STAFF targets, and runs the write under the business row lock with an actor/target recheck.

The server generates the replacement password. The response carries it once with `Cache-Control: no-store`; the account is forced to change it; `tokenVersion` increments; open kiosk verification sessions expire; the audit row records the actor and target, not the credential.

### 2.5 One-time reset PIN

`POST /api/hr/users/:id/reset-pin` is mounted with `authMiddleware`, `requirePasswordChange()` and `authorizeRole("HR", "SUPERADMIN")`. The controller requires a reason of at most 500 characters, refuses non-STAFF targets, and fails closed when `PIN_HMAC_KEY` is absent.

The replacement is four digits from a CSPRNG, stored as an HMAC-SHA256 over employee id, PIN and a fresh 16-byte salt. The response carries the PIN once with `Cache-Control: no-store`. The write clears the failure counters, sets `mustChangePin`, expires open verification sessions, and audits the reason. The PIN is not in the audit row or the pino stream.

### 2.6 Self-service PIN change

`POST /api/staff/profile/change-pin` is mounted with `authMiddleware`, `requirePasswordChange()`, `authorizeRole("STAFF")` and the shared validator. The controller:

- rejects a missing, malformed or reused PIN before reading the account;
- refuses an inactive or foreign account;
- refuses a locked PIN before comparing it;
- compares the current PIN with `constantTimeEqual`;
- charges a wrong current PIN to the same cumulative counter the kiosk lane uses, and trips the R5 lock at ten;
- stores only the keyed salted hash and clears the failure counters;
- expires every open kiosk verification session for the employee;
- uses an observed `pinHash`/`pinSalt` guard so a concurrent administrator reset wins;
- returns no PIN, hash, salt or token.

The R5 values now live in `backend/utils/pinPolicy.ts` and are imported by both `kioskVerifyController.ts` and `staffProfileController.ts`, so the two lanes cannot drift into different guessing budgets.

### 2.7 Shared Security entry by role

| Entry | STAFF | HR | SUPERADMIN | Evidence |
|---|---|---|---|---|
| `/set-password` | yes, while the flag is set | yes, while the flag is set | yes, while the flag is set | `auth-routing.test.jsx` |
| `/profile` Change Password | yes | yes | yes | `admin-screens.test.jsx` |
| `/profile` Change PIN | yes | no | no | `Profile.tsx`; `admin-screens.test.jsx` |
| `/profile/change-pin` route | renders | bounces to HR home | bounces to Superadmin home | `auth-routing.test.jsx` |
| Account-menu Change PIN | yes | no | no | `sidebar-account-menu.test.jsx` |

The PIN is a STAFF kiosk credential. The backend already refused HR and SUPERADMIN, so the shared entry now matches that boundary instead of offering a dead-end action.

## 3. Defects found and repaired

| # | Surface | Defect | Repair | Evidence |
|---|---|---|---|---|
| 1 | Self-service PIN change | The endpoint verified the current PIN but ignored `pinLockedUntil` and never incremented `pinFailedCount`. A staff session could use it as a cheaper guessing lane outside the kiosk budget. | Shared R5 policy; locked PIN refused; wrong current PIN increments the cumulative counter and trips the five-minute lock. | `authSecurity.contract.test.ts` (locked, charged, tripped) |
| 2 | Self-service PIN change | A successful change did not expire open kiosk verification sessions. A session opened with the old PIN could still be consumed after the credential was replaced. | `verificationSession.updateMany` for the employee's unconsumed sessions inside the change transaction. | `authSecurity.contract.test.ts` (expiry assertion) |
| 3 | Self-service PIN change | The update had no observed-value guard. A concurrent administrator reset could be overwritten by the self-change, clearing the forced PIN change and restoring the old holder's choice. | `updateMany` guarded on the observed `pinHash`/`pinSalt`; a mismatch answers `409 PIN_CHANGED` and the reset wins. | `authSecurity.contract.test.ts` (conflict on failure and success) |
| 4 | Shared Security entry | HR and SUPERADMIN saw a Change PIN link and could open `/profile/change-pin`, but the backend answers `403` for both. The route used `ProtectedRoute`, not `StaffRoute`. | Link, menu item and route are STAFF-only. | `auth-routing.test.jsx`, `sidebar-account-menu.test.jsx` |
| 5 | PIN screen copy | The hint said a locked PIN can only be reset by HR. The lock clears after five minutes; HR is needed for a forgotten PIN, not for a temporary lock. | Corrected the hint. | `src/pages/StaffChangePin.tsx` |

## 4. Decisions and non-changes

- A self-service PIN change does not increment `tokenVersion`. The PIN is a kiosk credential; the staff web session is not proved by it. Open kiosk verification sessions do expire. Security should confirm this split.
- `mustChangePin` is set by an administrator reset and cleared by a self-service change, but the kiosk verification path does not refuse a punch while the flag is set. The approved scope names a mandatory password-change gate, not a mandatory PIN-change gate, so this slice records the gap instead of inventing enforcement.
- A locked PIN answers `429 PIN_LOCKED` to the authenticated owner. The kiosk lane keeps its generic refusal so a badge holder cannot learn the attempt budget. The owner already knows the PIN is theirs, so the clearer body is acceptable; Security should confirm.
- A wrong current PIN writes one `pin.change_failed` audit row inside the counter transaction. This mirrors the kiosk lane's `pin.verify_failed` evidence and carries no secret.
- Login limits stay in-memory and single-process. They are a throttle, not a durable ledger; this slice did not change that design.
- No routine OTP, new authentication transport, schema field or dependency was added.

## 5. Verification evidence

| Check | Command | Result |
|---|---|---|
| Backend unit contracts | `cd backend && npx vitest run --config vitest.unit.config.ts` | 65 tests in 3 files pass |
| Backend typecheck | `cd backend && npx tsc --noEmit` | 0 errors |
| Frontend suite | `npx vitest run` | 166 tests in 14 files pass |
| Frontend typecheck | `npx tsc --noEmit` | 0 errors |
| UI taste | `bash .agents/scripts/ui-taste-check.sh <changed file>` | clean for `StaffChangePin.tsx`, `Profile.tsx`, `Sidebar.tsx`, `App.jsx` |
| Secret scan | `gitleaks detect --no-git --redact` | One pre-existing finding in the ignored `backend/.env` (live `JWT_SECRET`); no P04 file flagged. The commit gate scans the staged diff. |
| Environment parity | `bash .agents/scripts/env-check.sh` | pass |
| Humanizer | `bash .agents/scripts/humanize-check.sh docs/attendpro/P04-AUTH-SECURITY-VERIFICATION.md` | clean |

The P02 suite gained two assertions in this slice: an administrator password reset expires open verification sessions, and the generated temporary password is absent from the audit calls.

## 6. Limits

- The database-backed suites (`auth.test.ts`, `user.test.ts`, `accountEdges.test.ts`, `staffSelfService.test.ts`) were not run because no isolated-target authorization was given. Real RLS, row locking, concurrent updates and PostgreSQL response serialisation remain unverified.
- The P04 suite mocks Prisma. It proves the controller's decisions, not the SQL those decisions compile to.
- The ten-attempt counter is read back inside the transaction, but concurrent-failure behaviour under PostgreSQL isolation was not exercised.
- The frontend tests replace the API client. They prove route guards, menu filtering and request shape, not a live server.
- The login database suite was not re-run; its assertions are described in section 2.1 from the source and the existing suite, not from a fresh run.

## 7. Security verdict requested

1. Accept the split where a PIN change expires kiosk sessions but leaves the web token valid.
2. Decide whether `mustChangePin` must block kiosk verification before a punch, or remain a bookkeeping flag until a later slice.
3. Confirm that `429 PIN_LOCKED` is acceptable for the authenticated PIN owner and that one audit row per wrong current PIN is acceptable.
4. Confirm the precedence rule: a concurrent administrator reset wins, and the self-change answers `409 PIN_CHANGED`.

## 8. Stop

P04 stays at the human checkpoint until the Security verdict and owner approval are recorded. No commit or push is performed before that approval.

## Security correction follow-up — 2026-11-02

Security found an in-flight PIN request could clear a newer lock because the write observed only the credential hash/salt. Both writes now also require the observed failure count and lock timestamp. A concurrent change returns 409 without overwriting that state. Required PIN audit events now use strict transaction writes; audit rejection returns a generic server error instead of normal success. Raw exception messages are no longer logged in this handler.

Tester reproduced four failures before repair and verified all four pass after repair. The isolated backend suite passes 69 contracts in three files with no database setup. Backend and frontend typechecks pass; scoped redacted secret scanning and whitespace checks pass. Real PostgreSQL concurrency, transaction rollback and production RLS remain unverified; no database operation ran.

P04 is not complete: Profile still links ordinary password change to forced /set-password. The approved separate ordinary password-change destination is the next bounded UI slice. Do not infer that endpoint verification supplies that missing screen. Current working-tree corrections are not staged; preserve the existing index until owner review and deliberate commit preparation.
