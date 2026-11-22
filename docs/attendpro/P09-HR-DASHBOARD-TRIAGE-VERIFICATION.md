# P09 — HR dashboard triage verification

2026-11-07. Owner authorized P09 as the next slice after P08c committed as 6d2ec85. The slice repairs the HR dashboard composition and its reads. It adds no route, permission, schema or migration.

## Existing code reviewed first

`src/pages/HrDashboard.tsx` existed and was mounted at `/hr-dashboard` behind the HR and Superadmin route guard. The review found these gaps:

- Both report calls omitted `startDate` and `endDate`. The validators require the pair, so `/reports/punctuality-summary` and `/reports/exceptions` answered 400. The page caught the rejection with a toast and left every metric at zero.
- The exception rows were read as `user`, but the report returns `employee`. Every row therefore rendered as a former employee. Attempt rows also have no `status`, so their type pill was empty.
- The page counted absences from exception rows. The exception report only carries review and location rows, so the absence tile was effectively always zero. It also counted a location flag field the response does not contain.
- The attendance table used `/attendance/all-attendance`, which the API contract marks as superseded by the tenant-scoped register read. It also read only the first page without stating the total, so the charts and table could undercount without a visible limit.
- The full attendance table and its search duplicated the register screen. The screen review names that composition as invalid for this page.
- "Not Yet Clocked Out" counted open sessions from earlier days, not today, and the hero described a live headcount while reading stored rows.
- The page had no help-request or correction attention counts and no links to those queues.
- The today calculation used the device date without saying so. P17 has not yet supplied the business timezone read, so the page must flag the pending behavior rather than invent a conversion.

## Changes

### Data reads

`src/pages/HrDashboard.tsx` now reads only supported dated report and queue contracts:

- `GET /api/reports/punctuality-summary?groupBy=day&startDate&endDate` supplies the daily counts.
- `GET /api/reports/exceptions?startDate&endDate&page=1&limit=5` supplies the recent review rows and their total.
- `GET /api/reports/attendance-register?startDate&endDate&page=1&limit=100` supplies the bounded attendance preview and the chart rows.
- `GET /api/hr/help-requests?status=OPEN` and `status=IN_REVIEW` supply the two help totals.
- `GET /api/hr/corrections?status=SUBMITTED` supplies the awaiting-decision total.

The window is the device's current date and the six days before it. A visible note states that the window uses the device date and that business-timezone handling is pending P17. No temporary timezone calculation was added.

Queue totals use a one-row page and read `pagination.total`, so a large queue cannot be mistaken for a small one. The exceptions and register previews state how many rows are shown against the period total. When the register holds more than the 100 rows the charts read, the chart captions name the coverage; the register preview has a link to the full register. The date range refreshes when the device day changes while the page remains open.

### Composition

- The hero reports attendance rows recorded today, with the open-session count as a pill. The two dense cards report late arrivals and active staff without a record today.
- A "Needs attention" row links to open help requests, help requests in review, corrections awaiting a decision, and the last seven days of review exceptions. Help and corrections keep separate names and separate filtered links.
- The exception preview maps `employee`, `status`, `locationResult` and `reason` from the real response. Attendance rows link to the record with the exception range and origin, so the detail's Back to Exceptions link returns to the same range. Attempt rows link to the exceptions queue with the date range, but there is no attempt-ID drill-through until P28.
- The attendance preview shows five rows from the dated register. It links to the register with the same date range. The full register and its search box are gone from this page.
- A failed load or a daily summary missing today's bucket shows an inline alert and Try again. No metric, chart or preview renders in the failure state, so a failed read cannot look like zero. A successful zero-count bucket still renders zeros and the two empty messages.

## Verification

- Focused frontend suite: 8 cases in `src/__tests__/hr-dashboard.test.tsx` passed. They cover the dated and status-filtered requests, the distinct daily counts, exception field mapping and links, the separate queue names and links, the bounded previews and chart coverage, the failure and retry state, a successful zero, a missing today bucket and a device-day rollover.
- Browser: 2 Playwright cases passed at 375px and 1440px. They cover the P17 note, the daily counts, the attention links, the exception and attendance previews, the absence of the old full register and search, no page-wide horizontal overflow, the failure state and a retry with zero writes.
- Full frontend suite after the date-state fix: 344 passed, 4 failed. The four failures are the known legacy cases in the two untracked files `admin-flows.test.jsx` (three) and `admin-screens.test.jsx` (one). The new focused file passes.
- Frontend and backend typechecks passed. The backend was not changed, so the backend suites were not rerun for this slice.
- Mechanical gates: UI taste, environment parity, humanizer and the redacted secret scan were run for the changed files.

## QA review

The acceptance points in the plan were checked against the rendered page and the mocked contracts:

- Dated report and queue contracts: the requests carry the range and status filters.
- Distinct concepts: recorded rows, late rows, absent staff, open sessions, help requests, corrections and review exceptions are separate.
- Exception rows are not treated as absent employees.
- Meaningful links: every count and preview row reaches its owning screen with the relevant range or status.
- No complete register or queue duplicate: the page shows bounded previews and counts only.
- No silent pagination undercount: totals come from the response, and the previews and charts state their coverage.
- Zero versus failure: the failure state hides all figures and offers a retry; a successful empty response renders zeros.
- Business-local today: the page uses the device date and says so, with P17 named as the pending dependency.

Independent QA requested changes for the missing daily bucket and the stale date after midnight. Both are addressed and covered by focused tests; the rollover test also checks the refreshed figure. QA's follow-up approved P09 with minor findings. The existing exceptions list offers no attempt ID filter or Attempt Detail route; P28 owns that destination. The P09 link keeps the date range and opens the owning queue, but not the individual attempt. The missing-bucket failure uses the same generic copy as a network failure. No P28 route or API was added.

## Security review

No route, role, permission, schema or migration changed. The page reads the same HR and Superadmin report and queue endpoints the other HR screens already use. Every read is tenant-scoped in its handler. The page sends no write, no mutation and no credential. The queue totals come from the server's pagination, not from a client count. The page does not expose another employee's private self-service records; it reads the business review queues and the dated attendance register. The P17 note prevents the device date from being presented as a business-local fact.

The bounded register read asks for 100 rows. That is a presentation cap, not a new permission. The page states when the cap applies. Security noted that `limit=1` queue reads still return one full help or correction row even though the dashboard uses only the total. Existing role and tenant gates apply; a count-only contract would need a separate approved change.

## Limits

Live authentication, database RLS, PostgreSQL concurrency and the database-backed suites were not run. The focused and browser checks use mocked responses. The charts use at most the 100 most recent register rows in the period and say so when the period holds more. Business-time display still waits for P17. Four known legacy frontend failures remain in untracked test files. The attempt preview links to the queue because Attempt Detail remains P28.

## Checkpoint

No commit, push or deploy. Proposed message: `feat(hr): recover dashboard triage`.
