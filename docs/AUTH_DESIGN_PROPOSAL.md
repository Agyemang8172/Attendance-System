# AUTH_DESIGN_PROPOSAL.md — Authentication & User Management

> **Status: PROPOSED — NOT APPROVED. No implementation performed.**
> Orchestrator / Security pass, 2026-10-08. Branch `checkpoint-rebuild` @ `a700123`.
> Complements `docs/DESIGN_PROPOSAL.md` (approved: Claude structure, Login palette).
> Every finding below cites the file and line it was observed on. Nothing has been changed.

---

## 1. Mandate

Three roles — `SUPER_ADMIN`, `HR`, `STAFF`. Seed only the required initial privileged accounts. Initial privileged accounts sign in with configured credentials. **First successful login forces a password change before the application is reachable.** Thereafter the new password is used. SUPER_ADMIN and HR manage staff within their authority. STAFF cannot create or delete users.

---

## 2. Requirement → Current State

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Three roles exist | ✅ | `schema.prisma:74` — `enum Role { SUPERADMIN HR STAFF }` |
| R2 | Only required initial privileged accounts | ✅ | `seed.ts:76,96` — exactly **1 SUPERADMIN + 1 HR**; 5 STAFF |
| R3 | Initial privileged accounts authenticate with configured credentials | ✅ | `seed.ts:35-43` reads `SUPERADMIN_PASSWORD`/`HR_PASSWORD` from env, throws if absent |
| R4 | **First login → mandatory password change before app access** | ❌ **client-only** | Flag is set (`seed.ts:80`) and returned (`authcontroller.ts:73`), but **no middleware enforces it**. `grep mustChangePassword backend/middleware` → no hits |
| R5 | New password used thereafter | ✅ | `userController.ts:346-353` rehashes and clears the flag |
| R6 | SUPER_ADMIN **and HR** manage staff | ❌ | `userRoutes.ts:29` create = `authorizeRole("SUPERADMIN")`; `userRoutes.ts:65` delete = `authorizeRole("SUPERADMIN")`. Tests assert HR gets 403 (`user.test.ts:106,260`). UI too: `App.jsx:105` `SuperAdminRoute`, `Sidebar.tsx:58` `roles: ['SUPERADMIN']` |
| R7 | STAFF cannot create or delete users | ✅ | `user.test.ts:115,268` — 403 asserted |

**Two requirements are unmet (R4, R6). R4 is the more serious: the mandatory first-login gate does not exist server-side.**

---

## 3. Security Analysis

Severity is assigned on the assumption that attendance records feed payroll and are contractually auditable.

### CRITICAL

**S1 — Mandatory password change is not enforced by the server.**
`authMiddleware` verifies only the JWT signature (`authMiddleware.ts:29-37`); it never loads the user. No route checks `mustChangePassword`. A holder of a temporary password can call **any** endpoint directly — clock in, read all users, create users — and never touch `/set-password`. The frontend redirect in `Login.tsx:42-45` is a courtesy, not a control. Anyone with `curl` bypasses R4 completely.

**S2 — Horizontal privilege escalation on `GET /api/users/:id`.**
`userRoutes.ts:47` grants the route to `authorizeRole("SUPERADMIN","HR","STAFF")` — i.e. any authenticated user — and `userController.ts:100-139` fetches by ID with **no ownership check**. Any STAFF member can read any colleague's record: `email`, `phoneNumber`, `department`, `jobTitle`, `isActive`, `mustChangePassword`, `shiftId`, `createdAt`. Confirmed by `user.test.ts:149` which only asserts self-access *succeeds*; there is no test that cross-access *fails*.

**S3 — Vertical privilege escalation via `PUT /api/users/:id`.**
`userController.ts:214` does `const updates = req.body`, then deletes only `employeeCode`, `password`, `id`. The zod schema (`validators/index.ts:23-38`) explicitly **allows `role` and `isActive`**. `validate.ts:29` replaces `req.body` with parsed data, so unknown keys are stripped — which usefully blocks `mustChangePassword` injection — but the permitted fields still permit:

- **HR promoting themselves (or anyone) to `SUPERADMIN`** — route allows HR (`userRoutes.ts:56`).
- **HR deactivating a `SUPERADMIN`** (`isActive: false`) → organisational lockout.
- **SUPERADMIN changing their own role** — blocked in the browser only (`EditEmployeeModal.jsx:219`, client-side `if`), not on the server.

### HIGH

**S4 — No password recovery path exists at all.**
`userController.ts:218` deletes `password` from any update, and no other endpoint writes it. There is no forgot-password, no admin reset, no re-issue. **If a temporary password is lost before first use, that account is permanently unrecoverable** — not even SUPERADMIN can restore it. This makes the account-management workflow incomplete by construction.

**S5 — Deactivating an account does not invalidate its session.**
`deleteUser` sets `isActive: false` (`userController.ts:284-287`), but `isActive` is evaluated **only at login** (`authcontroller.ts:50`). `authMiddleware` never re-checks it. A deactivated employee's JWT keeps working for up to 24h — they can keep clocking in after being offboarded.

**S6 — Password change does not revoke existing tokens.**
JWT payload is `{userId, role}` with `expiresIn: "24h"` (`authcontroller.ts:58-62`); no `jti`, no revocation store, no logout endpoint (`grep logout backend/routes` → none; logout is `localStorage.removeItem` in `utils/auth.ts:9`). After a password change — the exact action taken when an account is suspected compromised — **every previously issued token stays valid for the full remaining TTL.**

**S7 — Client/server password policy mismatch.**
`SetPassword.jsx:81` rejects `newPassword.length < 6`; server zod requires `min(8)` (`validators/index.ts:43`). A 6–7 character password clears the browser, then fails server-side with a generic message. The user is told their password is fine and then it isn't.

### MEDIUM

**S8 — No privileged-action audit trail.** Only errors are logged (`logError`, `authcontroller.ts:78`; `userController` logs none). Login success, login failure, password change, user create/update/deactivate are unrecorded. For a payroll-adjacent system this is an accountability gap.

**S9 — No security headers.** No `helmet`, no CSP, no `X-Frame-Options`, no `X-Content-Type-Options` anywhere in `server.ts`.

**S10 — Rate limiting is IP-only.** 10 logins / 15 min / IP (`server.ts:70-79`). Correct and worth keeping, but there is no per-account failed-attempt counter, so a distributed or proxy-based attempt is not slowed.

**S11 — Temporary password entropy ≈ 23 bits, from `Math.random()`.**
`userController.ts:7-14`: 32 adjectives × 32 nouns × 9000 ≈ 9.2M combinations, generated with a non-cryptographic PRNG. It is returned in the API body (`:189`) and displayed in a modal. The forced first-login change narrows the exposure window, but the value should be unguessable within it.

**S12 — No password history or reuse check.** Only `SetPassword.jsx:89` checks new ≠ temp, and only on first login. A Settings-driven change can reuse the current password.

**S13 — bcrypt 72-byte truncation.** `z.string().min(8)` has no upper bound (`validators/index.ts:43`); bcrypt silently ignores bytes past 72.

**S14 — Employee-code generation race.** `generateEmployeeCode` (`:16-29`) does read-then-increment with no transaction or retry; concurrent creates collide on `users_employee_code_key`, surfacing as a 409/500.

### LOW

**S15** — `/set-password` is reachable by any authenticated user with no guard (`App.jsx:112-117`); harmless but sloppy.
**S16** — 500 responses return `error.message` to the client in `userController` (four sites) — internal detail disclosure.
**S17** — No `iss`/`aud` claim validation on incoming tokens.

### What is already strong (keep it)

- **User enumeration is closed off**: unknown email and wrong password return an identical `401` with an identical body, and a real bcrypt compare runs against `DUMMY_HASH` to equalise timing (`authcontroller.ts:14-36`). Tested at `auth.test.ts:87`.
- **Deactivation is checked after password proof**, not before (`authcontroller.ts:47-52`), so a 403 never confirms an account exists.
- **Password hash is never serialised** — every `select` block omits it; tested at `auth.test.ts:59`.
- **Zod validation on every route**; `validate.ts` strips unknown body keys.
- **`changePassword` verifies the current password** server-side (`userController.ts:336`).
- **Deactivation is soft** (`isActive: false`), preserving attendance history — no destructive delete.
- **Seed passwords come from env and are never committed**; `env-check.sh` passes 9/9.
- **bcrypt cost 10** across seed, create, and change (raise to 12 is optional, see D9).
- **CORS is origin-allowlisted**, JSON body capped at 10kb, correlation-ID request logging in place.

---

## 4. Proposed Design

### D1 — Server-side mandatory-change gate *(fixes S1, R4)*

A `requirePasswordChange` middleware sits after `authMiddleware` on **every** authenticated route, with a minimal allowlist:

```
allowlist while mustChangePassword === true:
  PUT  /api/users/change-password
  POST /api/auth/logout          (new, see D6)
  GET  /api/auth/me              (new, read-only identity)
```

Anything else → `403 { code: "PASSWORD_CHANGE_REQUIRED" }`.

The **error code** matters: a generic 403 is indistinguishable from a permission failure. The frontend axios interceptor keys on `code` and routes to `/set-password`, so the gate works even if a user deep-links or a stale tab fires a request.

Frontend keeps the existing post-login redirect (`Login.tsx:42`) as a fast path; the middleware is the authority.

### D2 — Per-request account state check *(fixes S5)*

`authMiddleware` gains a single `prisma.user.findUnique` after signature verification:

- user missing → `401`
- `isActive === false` → `401 ACCOUNT_DEACTIVATED` (clears client, forces logout)
- `mustChangePassword === true` → deferred to D1

This is one indexed primary-key read per request and requires **no migration**.

### D3 — Token revocation on password change *(fixes S6)*

Two options. **Both are presented because Option B needs a migration, which is out of scope until you approve it separately.**

| | Option A — no schema change | Option B — recommended |
|---|---|---|
| Mechanism | Store `passwordChangedAt`… not available. Instead: embed `iat`, and reject tokens where `iat` predates a value | Add column `passwordChangedAt DateTime?` (or `tokenVersion Int @default(0)`); compare against JWT `iat` |
| Revocation latency | ≤ token TTL | Immediate |
| Migration required | **No** | **Yes** — DBA gate |
| Interim mitigation | Reduce TTL from 24h to 1h for privileged roles | — |

**Recommendation:** ship A (shortened TTL) now; promote to B under a separately approved migration.

### D4 — Permission matrix *(fixes R6)*

Least privilege, expressed as who may do what **to whom**:

| Action | SUPER_ADMIN | HR | STAFF |
|---|---|---|---|
| List all users | ✅ | ✅ | ❌ 403 |
| Read user by id | ✅ any | ✅ any | ✅ **self only** *(fixes S2)* |
| Create account | ✅ `STAFF` always; `HR` with explicit confirm | ✅ **`STAFF` only** | ❌ 403 |
| Edit profile fields¹ | ✅ any | ✅ **`STAFF` only** | ❌ 403 |
| Change a role | ✅ **any except self** | ❌ never | ❌ 403 |
| Deactivate / reactivate | ✅ **not self, not last SUPER_ADMIN** | ✅ **`STAFF` only** | ❌ 403 |
| Admin password reset | ✅ any except self | ✅ **`STAFF` only** | ❌ 403 |
| Change own password | ✅ | ✅ | ✅ |
| Attendance read | ✅ all | ✅ all | self |
| Attendance write | ✅ | ✅ | self |

¹ `firstName, lastName, email, department, jobTitle, phoneNumber, shiftId`

**Why HR gets `STAFF`-scoped write but never role change:** R6 grants HR staff management; R1 makes role the privilege boundary. Letting HR mint a SUPER_ADMIN would make the second requirement undo the first. Role assignment stays SUPER_ADMIN-only.

**Consequence for the UI:** `/manage-staff` moves from `SuperAdminRoute` to a shared admin route, and `Sidebar.tsx:58` becomes `roles: ['SUPERADMIN','HR']`. HR sees the same screen with role-editing and privileged-create controls disabled rather than absent — hiding controls without enforcing server-side is exactly how S3 happened.

### D5 — Server-side field allowlist *(fixes S3)*

Replace `const updates = req.body` + three `delete`s with an **explicit allowlist** built per role:

- Unknown fields are already stripped by zod — keep that.
- `role` and `isActive` are removed from the generic update path and handled by dedicated guarded operations (D4).
- Enforce: cannot change own role; cannot deactivate self; cannot deactivate the final active SUPER_ADMIN; cannot demote the final SUPER_ADMIN.
- Guards live in the **controller/service**, not the browser. The existing client check in `EditEmployeeModal.jsx:80` is retained purely as UX.

### D6 — Account lifecycle workflow

```
[BOOTSTRAP — seed, one time]
  1 SUPER_ADMIN + 1 HR, credentials from env, mustChangePassword = true
  5 STAFF fixtures, same forced-change state
        │
        ▼
[ACTIVATION — every account's first login]
  login (initial/temp credential)
    → JWT issued, D2/D1 gate engaged
    → 403 PASSWORD_CHANGE_REQUIRED on any other call
    → SetPassword screen: temp + new + confirm
    → PUT /users/change-password
         · verifies temp against hash          (already exists)
         · policy check (D7)
         · mustChangePassword → false          (already exists)
         · revoke sessions (D3)
    → fresh token returned, redirect to role home
        │
        ▼
[NORMAL OPERATION]
  login with the new password → role home directly
        │
        ├─► VOLUNTARY CHANGE (Settings)
        │     verify current → policy → hash → revoke → re-login or fresh token
        │
        ├─► ADMIN RESET (new — fixes S4)
        │     SUPER_ADMIN, or HR for STAFF
        │     → generates high-entropy temp (D8)
        │     → sets mustChangePassword = true
        │     → returns temp ONCE, never re-retrievable
        │     → revokes all target sessions (D3)
        │     → target repeats ACTIVATION
        │
        └─► DEACTIVATE (soft, preserves attendance)
              isActive → false
              → revoke sessions immediately (D2 makes this effective)
              → REACTIVATE mirrors it, and by default resets to forced change
```

**Key property:** deactivation is reversible and never destroys attendance history (`attendances.userId` has `ON DELETE CASCADE` on hard delete only — soft delete sidesteps it entirely, which is why `deleteUser` is already correct in shape).

### D7 — Password policy (NIST SP 800-63B shaped)

One shared definition used by **both** client and server — the S7 mismatch disappears by construction.

| Rule | Value | Rationale |
|---|---|---|
| Minimum length | **10** | Length beats composition |
| Maximum length | **72** | bcrypt truncation (S13) |
| Must differ from current | **yes** | S12 |
| Must differ from temporary | **yes** | already client-side only |
| Blocklist | deny-list of ~200 common passwords + `AttendPro`, `password`, `changeme`, email local-part | real protection, no complexity theater |
| Composition rules | **none** | NIST explicitly discourages forced upper/lower/symbol |
| Periodic rotation | **none** | NIST discourages; forced change only on activation, reset, or suspicion |
| Breach corpus check | optional, offline list | nice-to-have |

Server is authoritative; client mirrors for instant feedback.

### D8 — Temporary credential hardening *(fixes S11)*

`crypto.randomInt` instead of `Math.random`. Format: 3 words from a 256-word list + 4 digits ≈ **34 bits**, or a straight 14-character `crypto.randomBytes` base62 ≈ **83 bits**. Returned once in the create/reset response, never persisted in plaintext, never logged. The copy-once modal behaviour in `AddEmployeeModal` step 2 is correct and stays.

### D9 — Session & token parameters

| Parameter | Current | Proposed |
|---|---|---|
| TTL | 24h flat | **1h STAFF/HR, 8h SUPER_ADMIN** — or 1h flat if no refresh token |
| Payload | `{userId, role}` | + `iat` (present implicitly), validate against revocation |
| Refresh token | none | **not proposed** — adds a store and an attack surface; short TTL is enough for this product |
| Logout endpoint | none (client-only clear) | **add `POST /api/auth/logout`** — returns 204 so the client has a defined call; revocation itself comes from D3 |
| `iss`/`aud` | unset | set and validated |
| bcrypt cost | 10 | **12** (≈300ms at create/change only — no login-path impact) |
| Security headers | none | `helmet` with a strict CSP |
| Login rate limit | 10/15min/IP | keep, **plus** per-account counter keyed on email, `skipSuccessfulRequests: true` (in-memory — no migration) |

### D10 — Audit trail *(fixes S8)*

Two tiers, because tier 2 needs a migration:

- **Tier 1 (no migration):** structured Pino records — already wired with correlation IDs — for `login.success`, `login.failure`, `password.change`, `password.reset.issued`, `user.create`, `user.update`, `user.deactivate`, `user.reactivate`, `role.change`. Each carries actor id, actor role, target id, IP, correlationId.
- **Tier 2 (migration, DBA gate):** append-only `auth_events` table with a retention policy, giving a queryable, tamper-evident history for payroll disputes.

Tier 1 ships first.

---

## 5. First-Login Experience (ties to approved design)

`SetPassword.jsx` already has the right **structure** — split panel mirroring Login, no sidebar, no escape route, three fields, show/hide toggles, error bar. It is the right screen. What changes:

| Aspect | Today | Proposed |
|---|---|---|
| Design language | **C** — `auth-*` light tokens, 20 of them | **Unified** — Login's split screen with the approved Claude-structure / slate-brass palette; dark brand panel left, paper form right |
| Reachability | unguarded route (S15) | redirect *in* only; if `mustChangePassword === false`, bounce to role home |
| Validation | min 6 client / min 8 server (S7) | single shared policy D7 |
| Enforcement | client redirect | server 403 + client interceptor (D1) |
| Post-success | navigate, token unchanged | fresh token issued, sessions revoked (D3) |
| Copy | "Set your password." | keep — it is direct and human |

The psychological beat to preserve: **this screen is a door you must walk through, not a modal you can dismiss.** No skip, no "do this later", no sidebar. That already holds.

---

## 6. Test Plan (for the Tester agent, post-approval)

Existing suites: `auth.test.ts` 13, `user.test.ts` 18, `attendance.test.ts` 18 — **49 cases, all requiring a live database.** They were not executed in this pass (they write rows).

New coverage required:

1. `mustChangePassword === true` → **every** non-allowlisted route returns 403 `PASSWORD_CHANGE_REQUIRED`
2. allowlisted three routes return 200 in that state
3. STAFF → `GET /users/:id` for **another** user's id → 403 *(S2 — currently untested and failing)*
4. HR → `PUT /users/:id` with `role: "SUPERADMIN"` → 403 *(S3)*
5. HR → `PUT /users/:id` with `isActive:false` on a SUPER_ADMIN → 403
6. SELF → change own role → 403
7. Deactivated user's **existing** token → 401 *(S5)*
8. After password change, a **previously issued** token → 401 *(S6, if D3 Option B)*
9. 6-character password → 400 from **both** client policy and server *(S7)*
10. Lost temp password → admin reset → login with new temp → forced change *(S4)*
11. Deactivate last active SUPER_ADMIN → 409
12. Self-deactivate → 403
13. HR creates STAFF → 201; HR creates HR → 403
14. STAFF create/delete → 403 *(regression, already passing)*
15. Policy: >72 chars rejected; common password rejected; reuse rejected

---

## 7. Dependencies & Gates

| Item | Gate |
|---|---|
| `D3` Option B (`passwordChangedAt` column) | **Migration → DBA gate → your explicit approval** |
| `D10` Tier 2 (`auth_events` table) | **Migration → DBA gate** |
| `D6` admin reset endpoint | backend source change → implementation approval |
| `D4` UI change to `/manage-staff` + Sidebar | frontend source change → implementation approval, after `DESIGN_PROPOSAL` phases |
| Seed password values | already in `backend/.env`, untracked; **you own rotation** |

**Ordering note:** the design proposal puts a polarity flip across `src/`. Authentication touches `Login.tsx`, `SetPassword.jsx`, `App.jsx` route guards, `ManageStaff`, modals, and `Sidebar`. These two efforts **must be sequenced, not interleaved** — otherwise every page gets redesigned twice.

---

## 8. Open Questions

1. **Role spelling.** The brief says `SUPER_ADMIN`; the enum, API, and frontend all use `SUPERADMIN`. Rename (migration + code) or adopt `SUPERADMIN` in documentation? **Recommendation: adopt `SUPERADMIN`, document it.**
2. **HR and `STAFF` creation.** Confirm HR may create accounts but *only* with role `STAFF`, and may never mint HR or SUPER_ADMIN.
3. **D3 Option B migration** — approved in principle, or ship Option A (shortened TTL) and defer?
4. **Token TTL.** Is 1h with re-login acceptable, or do you want a refresh-token store? (Adds a table → migration.)
5. **Admin reset for HR on STAFF** — confirm the scope split in D4.
6. **Seed fixtures.** The 5 STAFF records are `John Doe`-class placeholders HR will see. Replace as part of this work, separately? (Touches data, needs its own approval.)
7. **Password policy** — is NIST-style (length + blocklist, no forced rotation) acceptable, or does your organisation require composition rules and periodic rotation?
8. **bcrypt cost 12** — adds ~300ms to create/change only. Acceptable?

---

*No code, route, middleware, migration, seed, or database object was modified. Awaiting approval.*
