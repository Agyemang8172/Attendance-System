# Regression Snapshot — M8

> Verification pass for milestone 8 (`test/regression-suite`), 2026-10-10.
> Scope: full automated suites green against the post-M7 rebuild, the 15 auth
> security cases from `AUTH_DESIGN_PROPOSAL.md` §6 mapped to their tests, and
> no functional drift from M1–M7. Backend suite executed against the local
> Prisma Postgres (owner-authorized single run); frontend suite runs in jsdom.

## 1. Suite results

| Suite | File(s) | Cases | Result |
|---|---|---|---|
| Backend — auth | `backend/tests/auth.test.ts` | 15 | **71/71 passed** |
| Backend — user | `backend/tests/user.test.ts` | 38 | included above |
| Backend — attendance | `backend/tests/attendance.test.ts` | 18 | included above |
| Frontend — auth routing | `src/__tests__/auth-routing.test.jsx` | — | **58/58 passed** |
| Frontend — interceptors | `src/__tests__/interceptors.test.js` | — | included above |
| Frontend — staff management | `src/__tests__/staff-management.test.jsx` | — | included above |
| Frontend — staff workflows | `src/__tests__/staff-workflows.test.jsx` | — | included above |
| Frontend — attendance table | `src/__tests__/attendance-table.test.jsx` | — | included above |
| Frontend — sidebar/account menu | `src/__tests__/sidebar-account-menu.test.jsx` | — | included above |

Static gates: `eslint .` 0 findings; lint covers `src/` and `backend/` (the
`dist`/`generated`/`node_modules` trees are globally ignored by config).

## 2. The 15 auth security cases — coverage map

Cases are numbered as in `AUTH_DESIGN_PROPOSAL.md` §6. Status is **covered**
(asserted by at least one automated test), **deviation** (enforced, but the
response shape differs from the proposal's wording), **partial** (one aspect
not yet asserted), or **deferred**.

| # | Case | Backend assertion | Status |
|---|---|---|---|
| 1 | `mustChangePassword` → every non-allowlisted route → 403 `PASSWORD_CHANGE_REQUIRED` | `user.test.ts:566` blocks `GET /api/users` **and** `POST /api/attendance/clock-in` | **covered** |
| 2 | Allowlisted routes reachable in forced-change state | `user.test.ts:588` `PUT /api/users/change-password` → 200; `security.test.ts` `POST /api/auth/logout` → 200 with `mustChangePassword` true | **covered** (proposal said three routes; implementation gates everything except change-password and logout, both now asserted) |
| 3 | STAFF → `GET /users/:id` for a different user → 403 (S2) | `user.test.ts:274` | **covered** |
| 4 | HR → `PUT /users/:id` with `role: SUPERADMIN` | `user.test.ts:340` | **deviation** — privileged fields are *dropped*, not rejected: HR output is built from an explicit allowlist, so `role` never reaches the write. Same security outcome as a 403, different shape. |
| 5 | HR → `PUT /users/:id` with `isActive:false` on an admin → 403 | `user.test.ts:340` + `:384` | **deviation** — same allowlist drop for `isActive`; HR acting on an HR/SUPERADMIN target is refused outright at `:384` |
| 6 | Caller changing their own role → 403 | `user.test.ts:362` | **covered** |
| 7 | Deactivated user's pre-existing token → 401 (S5) | `user.test.ts:524` (`ACCOUNT_DEACTIVATED`) | **covered** |
| 8 | After a password change, a previously issued token → 401 (S6) | old credential blocked at `user.test.ts:604` | **partial → deferred** — credential reuse is rejected; the D3 Option B `passwordChangedAt` migration that would revoke *existing JWTs* is still pending |
| 9 | 6-char password → 400 from **both** client policy and server (S7) | backend `user.test.ts:614`; frontend `auth-routing.test.jsx:220` | **covered** |
| 10 | Lost temp password → admin reset → login with new temp → forced change (S4) | `user.test.ts:405` join `:566` | **covered** |
| 11 | Deactivate last active SUPERADMIN → 409 | `security.test.ts` — invariant: ≥1 active SUPERADMIN survives every permitted removal path (self-deactivate 403, self-demote 403, HR → SUPERADMIN 403, self-delete 403) | **covered** (see §4 note: the literal 409 branch is unreachable through the composed routes, so the invariant is asserted instead) |
| 12 | Self-deactivate → 403 | `user.test.ts:373` and `:499` | **covered** |
| 13 | HR creates STAFF → 201; HR creates HR → 403 | `user.test.ts:187`, `:204` | **covered** |
| 14 | STAFF create/delete → 403 | `user.test.ts:219`, `:491` | **covered** |
| 15 | Policy rejects >72 chars / common word / reuse | backend `security.test.ts` (>72 → 400), `user.test.ts:608` (blocklist, reuse); frontend `password-policy.test.js` (floor, >72 ceiling, blocklist mirror) | **covered** |

## 3. No functional drift from M1–M7

- Every rebuilt flow has a green test: login/role routing (`auth-routing`),
  response error policy (`interceptors`), chrome sidebar and account menu
  (`sidebar-account-menu`), staff CRUD and role-locked modals
  (`staff-management`), HR-scoped workflows, reset/reactivate and empty-state
  actions (`staff-workflows`), attendance sorting/pagination/exceptions-first/
  empty state (`attendance-table`).
- Backend contract preserved: user list (HR scoped to STAFF), create, update
  with privileged-field allowlist, soft delete, reset-password with top-level
  `tempPassword`, and forced-change gate are all green across the 71 serial
  cases.
- No frontend page, route, or API signature changed between M7 and this pass;
  the diff on `test/regression-suite` is documentation only.

## 4. M9 — Security testing (`test/security-suite`)

Delivered on `test/security-suite`. The two partial cases are now closed, the
allowlist matrix is complete, and two security controls that had no assertion
are pinned.

| Milestone item | Result |
|---|---|
| Case 11 — last active SUPERADMIN | asserted as an invariant: no permitted call leaves the directory without an active SUPERADMIN. See the reachability note below. |
| Case 15 — >72-char password | backend 400 via `PUT /users/change-password` (73 chars); frontend ceiling asserted in `password-policy.test.js` |
| Case 2 — logout during forced change | `POST /auth/logout` → 200 while `mustChangePassword` is true |
| Response headers (S9) | all six headers asserted on a 401 response; HSTS asserted absent outside production |
| Credential entropy (S11) | `generateTempPassword` shape (`word-word-####-####`) and non-repetition across a batch |

Suite totals after M9: backend **78/78** (auth 15, user 38, attendance 18,
security 7), frontend **63/63** (58 + 5 policy).

### Reachability note — the literal 409 branch

`userController.ts` guards the last active SUPERADMIN in both `updateUser` and
`deleteUser`, answering 409 when `countActiveSuperadmins(target.id) === 0`. The
composed routes cannot produce that count: the only caller permitted to alter a
SUPERADMIN is an active SUPERADMIN, and the count excludes the target only, so
the caller is always counted and the floor stays at one. Self-mutation is
refused earlier with 403. The guard stays as belt-and-braces against a future
route that lets another role write those fields; the suite asserts the
invariant it exists to protect.

### M9 hand-off to M10

- Four findings remain **deferred** or owner-run: S6 JWT revocation (D3
  Option B migration), S10 rate-limit throttling (disabled under
  `NODE_ENV=test`; verified in the browser via `TESTING_GUIDE.md`), entropy as
  a 36-bit ceiling is structural rather than asserted statistically, and the
  409 branch itself is unreachable until a future route changes the caller
  matrix.
- M10 (`qa/final-uiux-verification`) stays the last milestone: browser
  walkthrough of all three roles, contrast re-measured in-browser, and
  `CURRENT_STATE.md` + `AUDIT_REPORT.md` refreshed.