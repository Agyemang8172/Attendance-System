# P07b — Exceptions verification

2026-11-05. QA approved P07b with no findings. P07a was committed through commit.sh as b4cc2b60134865cc80677bae08d52b1398c82726.

The Exceptions screen requires an explicit date range, renders attendance and kiosk attempt summaries separately, and removes the unsupported Search, Type and Dismiss controls. Only attendance rows link to Attendance Detail. The return link restores the validated Exceptions range and page. Attempt timestamps are shown in UTC. Attendance rows use the stored attendance date.

The report handler now bounds the attempt fetch by page capacity and remaining attempt rows. The existing route guards, tenant predicates, ordering and projections are preserved.

## Changed files

- src/pages/HrExceptions.tsx and src/pages/HrAttendanceDetail.tsx
- src/lib/exceptions-context.ts, src/lib/exceptions-data.ts and src/lib/use-exceptions.ts
- backend/controllers/reportController.ts
- src/__tests__/hr-exceptions.test.tsx, src/__tests__/e2e/hr/exceptions.spec.ts and backend/tests/unit/exceptionsReport.contract.test.ts
- P07b execution plan, testing guide, task board, state and this report

## Verification

- 20 Exceptions frontend tests and 29 P07a regression tests passed.
- 20 backend contract tests passed with mocked persistence. Pagination, tenant predicates and role and forced-password refusals were verified through the existing router and handler.
- Three intercepted browser cases passed at 375px and 1440px. Five screenshots were inspected. Coverage includes date application, later pages, UNKNOWN and unidentified employees, inline retry, direct detail URL and refresh, and return to the original range and page.
- Frontend, backend production and backend test TypeScript checks passed. UI taste, environment parity, scoped Gitleaks, whitespace and document checks passed.
- All 74 captured unrelated tracked-file fingerprints matched.

## Limits and review

Live authenticated browser verification remains outstanding because the native browser tool could not identify the existing session under its URL policy. The browser and backend contract checks used intercepted responses and mocked persistence respectively. Full Attempt Detail remains assigned to P28. Existing ESLint configuration excludes the affected TypeScript files.

P07b is at the owner review checkpoint with an empty staging index. Proposed commit message is fix(exceptions): recover kinds and pagination.
