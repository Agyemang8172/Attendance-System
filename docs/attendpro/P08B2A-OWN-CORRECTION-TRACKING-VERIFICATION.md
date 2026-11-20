# P08b2a — HR own correction tracking verification

2026-11-06. P08b1 was committed through commit.sh as 9458cda. P08b2b submission remains deferred until an authorized current business-timezone read and the applicable P17b prerequisites exist.

HR can now track the correction requests it submitted. The work has two parts: the narrow own list and detail reads authorized as part of P05, and a read-only HR screen that uses them.

## API

- `GET /api/attendance/corrections` returns the caller's own corrections, newest first. It filters on the caller's business from `callerBusinessId` and on `requestedById` from the authenticated account. Supplied `businessId`, `requestedById` and `reviewTier` query values do not widen the result.
- `GET /api/attendance/corrections/:id` reads one own correction. The query filters on id, business and requester. A same-tenant request from another user answers 403; a foreign or absent record answers the same 404 body.
- Both routes are STAFF and HR only, carry the forced-password gate, and set `Cache-Control: no-store`. The list handler sets it for both mounts, so the existing staff self list inherits the header too.
- The list reuses `listMyCorrections` and its pagination and status vocabulary (SUBMITTED, APPROVED, REJECTED, WITHDRAWN). The shared list validator now refuses a page number that would produce an unsafe integer offset, so an absurd page answers 400 instead of reaching Prisma as a float and returning 500. The bound uses the maximum allowed limit and does not change any realistic page. The same guard covers the staff self list and the HR business list because they share the validator. The detail uses an explicit projection and a key allowlist for `originalValues` and `approvedValues`, so business, requester and reviewer identifiers and unknown JSON keys do not leave the server.
- The correction namespace pass-through in `attendanceRoutes.ts` still sits before the generic attendance `/:id` route. The contract suite mounts both routers in the same order as `server.ts` and confirms the attendance detail route still answers.
- No write path changed. Submission, the staff self surface, the reviewer queue and the decision route retain their previous behavior.

## HR screen

- `/hr-corrections/mine` and `/hr-corrections/mine/:id` are guarded by an HR-only route that also enforces the forced-password redirect.
- The Corrections header shows a My corrections link to HR. SUPERADMIN does not see it and is redirected away from the route.
- The list supports a status filter and paging. Row links carry the status and page back to the list. The detail is read-only and shows the attendance date, status, tier, reason, original, proposed and approved values, and the decision note and time where recorded.
- Loading, empty, retry and out-of-range page states are handled. Timestamps are labelled UTC while the business-time form dependency remains open.

## Changed files

- `backend/controllers/correctionController.ts`, `backend/routes/correctionRoutes.ts`
- `backend/tests/unit/ownCorrections.contract.test.ts`, `backend/tests/controllerGuards.test.ts`, `backend/tests/controllerFailures.test.ts`
- `src/pages/HrOwnCorrections.tsx`, `src/pages/HrCorrections.tsx`, `src/lib/use-hr-corrections.ts`, `src/App.jsx` (own-corrections hunks only)
- `src/__tests__/hr-own-corrections.test.tsx`, `src/__tests__/hr-corrections.test.tsx`, `src/__tests__/e2e/hr/own-corrections.spec.ts`
- `docs/TESTING_GUIDE.md`, the execution plan, task board, current state and this report

`src/App.jsx` also carries an unrelated `/hr-audit/corrections/:id` route for the untracked `HrCorrectionTrail` page. That hunk belongs to a different slice and is excluded from this one. The same applies to the Sidebar navigation removals and the SEC-19 staff attendance filter work present in the working tree.

## Verification

- Backend isolated suite: 142 tests in 8 files passed, including 13 own-correction contract cases.
- Targeted guard and failure matrices: the four new `getOwnCorrectionDetail` cases passed.
- Frontend focused suites: 8 own-tracking cases and 12 reviewer-correction cases passed.
- Playwright: 4 cases passed at 375px and 1440px, including direct refresh, return context, no writes, Superadmin refusal and the forced-password redirect.
- Full frontend suite: 327 passed, 4 failed in two untracked legacy test files. The same four failures were present before this slice. They expect the pre-P08b1 "Corrections Queue" heading and an old requester field name.
- Frontend and backend typechecks passed.
- UI taste passed over 146 files. Environment parity passed with 27 documented variables.
- Redacted secret scanning found only the known ignored `backend/.env` JWT value. No slice file was flagged.

## Review

QA reviewed the implementation and required one change: keep the P08c trail hunk out of this slice's commit scope. That boundary is recorded above and in the task board. QA also asked for the missing guard and failure matrix entries, which are now added.

Security approved with minor findings. The tenant source, ownership filters, role and forced-password gates, projections, 403/404 behavior and route precedence were verified. Two minor items were fixed after review: the list read now sends `Cache-Control: no-store`, and the shared list validator refuses a page number that would produce an unsafe offset. The remaining minor item is the `attendance_corrections` index: it covers tenant plus requester only, so per-requester scope stays application-enforced and RLS remains tenant-only. A composite index is a schema change and waits for separate DBA authorization.

## Limits and checkpoint

Live authentication, database RLS and PostgreSQL concurrency were not exercised. The database-backed backend suites were not run. The isolated contracts use mocked Prisma. The business-timezone read and the HR submission screen remain P08b2b.

P08b2a is unstaged at the owner review checkpoint. Proposed message is `feat(corrections): add HR own correction tracking`.
