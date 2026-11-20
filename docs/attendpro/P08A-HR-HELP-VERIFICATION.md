# P08a — HR Help Requests verification

2026-11-05. P07b was committed through commit.sh as 1826452. P08a passed QA and the scoped access review with no findings.

The HR Help queue uses the supported status and page filters. Direct links and refresh load the selected request by ID, and Back to queue restores the previous status and page. Resolve and Close require a trimmed note in the UI. The API retains its optional note contract. Final requests are read-only.

The detail GET uses the same guards, tenant scope and projection as the business queue. Missing and foreign IDs share a 404. The conditional write matches the tenant and observed status, and a lost race returns 409 before the audit call. The UI reloads the current request after an update or conflict and suppresses results from a stale route or session.

## Changed files

- src/pages/HrHelpRequests.tsx and src/pages/HrHelpRequestDetail.tsx
- src/lib/hr-help-requests.ts and src/lib/use-hr-help-requests.ts
- backend/controllers/helpRequestController.ts and backend/routes/hrRoutes.ts
- src/__tests__/hr-help-requests.test.tsx, src/__tests__/e2e/hr/help-requests.spec.ts and backend/tests/unit/hrHelpRequests.contract.test.ts
- docs/TESTING_GUIDE.md, docs/CURRENT_STATE.md, docs/TASK_BOARD.md and this report

## Verification

- 15 HR Help tests, 26 Staff Help regression tests and 10 mocked backend router and controller tests passed.
- Two intercepted Chromium cases passed at 375px and 1440px. Four screenshots were inspected. Coverage includes keyboard navigation, direct refresh, return context and the resolution form.
- Frontend, backend production and backend test TypeScript checks passed. Scoped UI taste, environment parity, document and whitespace checks and Gitleaks passed. All 74 captured unrelated tracked-file fingerprints matched.

## Limits and checkpoint

Live authentication and database RLS remain unverified by these mocked checks. Existing ESLint configuration excludes the affected TypeScript files. The existing audit helper can catch and warn on insert failure, so the transaction test establishes the audit call on a winning write without establishing rollback for every audit failure.

P08a awaits owner review with an empty staging index. Proposed message is fix(help): recover HR request detail and review.
