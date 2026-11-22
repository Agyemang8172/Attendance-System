# P06c — Staff Help Requests verification

## Outcome and scope

Staff Help Requests list/detail now consume the existing self-service API contracts. This slice follows completed P06a at25864de; it is independent of the pending Schedule dependencies. The creation form, routes, backend, permissions, schema and migrations are unchanged.

Changed source:
- src/pages/StaffHelpRequests.tsx
- src/pages/StaffHelpRequestDetail.tsx
- src/lib/staff-help-requests.ts
- src/lib/use-staff-help-requests.ts

New tests: src/__tests__/staff-help-requests.test.tsx and src/__tests__/e2e/staff/help-requests.spec.ts. Help-only fixture/assertion repairs in pre-existing untracked admin-screens.test.jsx remain outside the proposed commit. Documentation includes this report, the P06c plan, testing guide and append-only state/task checkpoints.

## Contract recovery

List reads pagination.total/currentPage/totalPages and sends only supported status/page/limit. Unsupported search is removed. Detail reads actual flat resolutionNote/resolvedAt; fabricated timeline/resolver fields are removed. Known status/page return context survives detail, refresh and return. Loading, empty, filtered empty, out-of-range, unavailable counts, errors and retry remain distinct.

Requests cancel or ignore stale responses and account/token changes. Detail checks the requested ID and originating requester before rendering. Projected display fields exclude internal tenant/requester/assignee IDs. React renders text without raw HTML. Existing STAFF API/route guards remain authoritative; no authorization or tenant/RLS boundary changed. Recorded event times are explicitly UTC; no business timezone is invented and no privileged settings access added.

## Verification

- RED baseline:22 failures and4 passes across26 focused cases before implementation.
- Final focused tests:26 passed.
- Existing relevant screen tests:32 passed with narrow Help fixture repairs.
- Frontend TypeScript:passed.
- Three controlled-response browser checks passed at375px and1440px: keyboard list/detail entry, direct URL/refresh, return context, error/retry and missing resolution evidence. These are intercepted API UI tests, not live API/authentication proof. The latest alignment screenshots were refreshed and inspected; status pills remain compact without page overflow.
- Scoped UI taste, environment parity (27 variables), whitespace and Gitleaks checks passed. Gitleaks scanned the six slice source/test files without leaks.
- Scoped ESLint exited0; existing configuration ignores six TypeScript/TSX files, so no TypeScript lint coverage is claimed.
- Plan and testing-guide humanizer checks passed. Final report/state checks are recorded at the checkpoint.

## Runtime limitations

Existing frontend5173 and API8000 returned healthy responses and were preserved. Live authenticated Staff verification remains unverified: native browser tooling stopped because it could not confidently identify the existing browser URL under policy. No further computer-use access was attempted. No credentials, accounts or data were created or changed. Mocked browser checks do not remove this limitation.

## Review checkpoint

QA APPROVED with no issues. Final three browser checks passed after the parent alignment correction; desktop/mobile screenshots were inspected. Report and state/task humanizer checks passed. No files staged, committed or pushed. Proposed scoped commit after owner review: fix(help): recover staff request list and detail. Preserve all unrelated working-tree changes and exclude the pre-existing untracked legacy screen-test file. Do not begin another slice.

