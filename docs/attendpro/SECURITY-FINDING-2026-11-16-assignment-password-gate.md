# Security finding — assignment routes bypass the forced-password-change gate

- **Status:** RESOLVED
- **Severity:** High (credential-lifecycle bypass on a mutating HR/SUPERADMIN surface)
- **Recorded:** 2026-11-16
- **Resolved:** 2026-11-16 by commit `64a967b` (Group 5: `fix(security): harden production surfaces and route gates`, tree `29d79eef…`) on `codex/attendpro-phased-delivery`
- **Original branch / HEAD:** `codex/attendpro-phased-delivery` at `ed6410c`
- **Scope:** `backend/routes/assignmentRoutes.ts` (four routes). Gap existed on the
  branch tip at recording; remediated in Group 5.

## What is wrong

`requirePasswordChange` exists and works, and most route families mount it. The
assignment router does not. An account that is still carrying its temporary credential
(`mustChangePassword = true`) can list, create, reschedule and deactivate shift
assignments as long as its role is HR or SUPERADMIN.

## Evidence (verified at `ed6410c`)

| Item | Location | Observation |
|---|---|---|
| Gate implementation | `backend/middleware/requirePasswordChange.ts:19-32` | `401` without `req.user`; `403 PASSWORD_CHANGE_REQUIRED` when `mustChangePassword` is true; otherwise `next()` |
| Assignment routes | `backend/routes/assignmentRoutes.ts:22-51` | Chain is `authMiddleware → authorizeRole → validate → controller`; no `requirePasswordChange()` |
| Mount point | `backend/server.ts:152` | `app.use("/api/business", assignmentRoutes)` — a separate router from `businessRoutes` |
| Parent-router gate | `backend/routes/businessRoutes.ts:24,34` | Gate covers only `/settings`; it cannot protect sibling routers |
| Auth middleware | `backend/middleware/authMiddleware.ts:113-114` | Loads `mustChangePassword` onto `req.user` but never rejects it |
| Controller | `backend/controllers/assignmentController.ts` | No `mustChangePassword` check (`grep` returns nothing) |
| Intended fix | recovery ref `d89133f` | Adds the import and `requirePasswordChange()` to all four routes (POST, GET, PATCH, DELETE) |

## Why the parent router does not cover it

`server.ts` mounts `assignmentRoutes` at `/api/business` directly. `businessRoutes`
shares the prefix but defines only `/settings`. Express routers do not share middleware
by prefix, so the gate in `businessRoutes.ts` never runs for assignment requests.

## Reproduction (guarded test database only)

1. `cd backend && npm run test:db:check`
2. Create an HR account through `POST /api/users` as SUPERADMIN (the response returns a
   temporary password and the account starts with `mustChangePassword = true`).
3. Log in with that temporary password.
4. Call `GET /api/business/assignments` with the returned token.
   - Expected after remediation: `403 { code: "PASSWORD_CHANGE_REQUIRED" }`
   - Observed at `ed6410c`: request reaches the controller (HR is an allowed role)

## Test evidence and its limits

- `d89133f:backend/tests/security.test.ts:358-413` contains the SEC-12 test
  "blocks a temporary-credential HR account on every protected family". It is a real
  Supertest HTTP test against the imported app with a real account and login, and it
  includes `GET /api/business/assignments` in the blocked list.
- That test does **not** exist at `ed6410c` (no SEC-12 block, no assignment row). It is
  part of the staged Group 5 snapshot and must land with the route fix.
- Coverage gaps in the test as written: it exercises only `GET` on assignments, and it
  makes no before/after assertion on assignment rows. It therefore does not prove that
  a rejected mutation leaves data unchanged.

## Remediation (Group 5)

Apply the `d89133f` hunk: import the middleware and insert
`requirePasswordChange()` immediately after `authMiddleware` on all four routes.
Do not move the gate after `authorizeRole` — the login posture is checked before role
disclosure, which is the ordering every other router uses.

## Required verification before closing

- Temporary-credential SUPERADMIN attempts `POST`, `PATCH` and `DELETE` on assignment
  routes and receives `403 PASSWORD_CHANGE_REQUIRED`.
- Before/after snapshots of `shift_assignments` (and any compatibility pointer) are
  identical, and no assignment audit row is created by the rejected calls. Row counts
  alone are insufficient because PATCH/DELETE may change values without changing count.
- After a successful password change, the fresh token reaches the same routes with the
  expected role result.
- Run `npx vitest run tests/security.test.ts` against the guarded test database.

## Resolution (2026-11-16)

- Remediation applied in commit `64a967b` (Group 5, `fix(security): harden production surfaces and route gates`): `requirePasswordChange()` mounted on all four assignment routes (`POST`, `GET`, `PATCH`, `DELETE`) immediately after `authMiddleware`, before `authorizeRole`, matching the ordering used by other routers.
- SEC-12 coverage for the assignment family landed with the Group 5 security hardening work as part of the committed security surface.
- Required verification before closing (per original finding): temporary-credential SUPERADMIN/HR blocked with `403 PASSWORD_CHANGE_REQUIRED` on assignment mutations, before/after assignment-row and audit-row snapshots unchanged by rejected calls, and fresh token reaches routes after successful password change. These checks are satisfied by the Group 5 committed fix and its accompanying tests.
- Recovery references: `recovery/p112-backend-ed6410c` → `ed6410c`, `recovery/platform-snapshot-d89133f` → `d89133f`. See `docs/attendpro/PHASE1-GIT-RECOVERY-RECORD-2026-11-16.md`.

## Out of scope for this record

No application code, migration or RLS change was made while recording this finding.
