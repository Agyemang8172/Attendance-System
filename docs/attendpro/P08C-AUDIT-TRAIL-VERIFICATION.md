# P08c — audit history and correction trail verification

2026-11-07. Owner authorized P08c as the next slice after P08b2a committed as 1bd833b. The slice repairs the generic audit listing and the read-only correction trail. It adds no permission, schema or migration.

## Existing code reviewed first

The backend trail read (`GET /api/audit/corrections/:attendanceId`), the generic listing (`GET /api/audit`) and the single-entry read already existed with tenant scoping and the HR supervised subset. `HrCorrectionTrail.tsx`, its App route and the detail link from HR attendance also existed but were untracked. The audit screen existed and was reachable at `/hr-audit` and the SUPERADMIN alias `/audit-log`.

The review found these gaps:

- The audit table rendered the actor name as a literal string containing `{entry.actor.firstName} {entry.actor.lastName} <span …>`.
- A null `entityId` reached `entityId.slice(0, 8)` and would throw.
- The action and entity labels described events the backend no longer writes and omitted the events it does write.
- The date inputs sent `YYYY-MM-DD`, but the validator requires ISO instants, so every date filter answered 400. The end date also excluded the day's later events.
- The detail drawer never showed the audit reason, and system and kiosk actors had no useful identity.
- A failed list load produced only a toast, with no inline state or retry.
- The search placeholder promised actor search, which the API does not support.
- On mobile the drawer's scrim sat above the dialog, so the close button could not be clicked.
- The trail page showed local-time stamps without a UTC label, raw snapshot keys, no approved values, no revision before/after evidence, and a "Decided" line that would also label a withdrawn request.
- The trail error state had no retry and did not separate a missing record from a transport failure.
- Audit reads carried no cache header.

## Changes

### Backend

- `backend/controllers/auditController.ts`: `Cache-Control: no-store` on the trail, the listing and the single-entry read. The trail audit select now joins the acting user's id and name so the page can show an actor string. No query scope changed.
- `backend/validators/index.ts`: the audit listing gets the same safe page bound as the correction lists, and a reversed date range is refused with 400. The date fields remain ISO instants, matching the contract.
- `backend/tests/unit/audit.contract.test.ts`: 13 isolated cases for role gates, HR scope, search separation, date range, invalid input, nullable entity ids, trail nesting, uniform 404 and single-entry scope.

### Audit screen

`src/pages/HrAudit.tsx` keeps the existing layout and classes. It now renders real actor names, handles a null entity id, lists the events the backend actually writes, scopes the action choices to the signed-in role, shows the reason and actor type in the drawer, links attendance entities to their record, and uses an inline failure state with retry. Date inputs send inclusive UTC instants (`T00:00:00.000Z` to `T23:59:59.999Z`), a reversed range is refused before the request, and the search placeholder names only what the API searches. The drawer sits above its mobile scrim.

### Correction trail

`src/pages/HrCorrectionTrail.tsx` uses the shared correction status and tier labels, shows original and approved values with readable labels, formats clock values in UTC, shows revision before/after evidence, and treats `WITHDRAWN` as a withdrawal rather than a decision. The return link goes to the attendance record when the id is known. A 404 gets a distinct message, transport failures get a retry, and an empty history stays separate from both. The raw revision action and audit event keys remain visible, because they are the truthful event names.

## Verification

- Backend isolated suite: 155 tests in 9 files passed, including the 13 new audit contracts.
- Frontend focused suite: 9 cases in `src/__tests__/hr-audit-trail.test.tsx` passed.
- Browser: 2 Playwright cases passed at 375px and 1440px. They cover the audit table, actor name, date instants, drawer reason, trail evidence, return link, no horizontal overflow and zero writes.
- Full frontend suite: 336 passed, 4 failed. The same four failures remain in the two untracked legacy files (`admin-flows.test.jsx` three, `admin-screens.test.jsx` one). The new focused file passes, and the stale trail cases still pass.
- Frontend and backend typechecks passed.
- Mechanical gates: UI taste, environment parity, humanizer and redacted secret scan passed for the changed files.

## Security review

No route, role or permission changed. All three reads remain tenant-scoped, and the HR listing keeps its supervised action subset with the search clause AND-ed rather than merged. The single-entry read still answers one 404 for an unknown, cross-tenant or out-of-scope row. The trail shows the same correction fields the HR business list already exposes. Audit responses now carry `no-store`. The page bound keeps an absurd page from reaching Prisma as a float offset. No secret, credential or token is displayed.

## Limits

Live authentication, database RLS, PostgreSQL concurrency and the database-backed audit suite were not run. The isolated contracts use mocked Prisma. The handler enforces the HR subset; RLS only scopes the tenant. The correction trail remains keyed by attendance id because `audit_logs` has no attendance column. Business-time display still waits for P17.

## Checkpoint

No commit, push or deploy. Proposed message: `fix(audit): recover audit history and correction trail`.
