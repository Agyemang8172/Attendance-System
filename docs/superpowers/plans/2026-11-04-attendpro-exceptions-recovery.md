# P07b — Exceptions kinds and pagination recovery

Date:2026-11-04. Owner authorized the next eligible approved slice after P07a commitb4cc2b6. Authority remains the Decision Register, root DESIGN, approved Master Plan/IA and phase P07b. Architect confirmed this is contract recovery without a new owner decision.

## Owned scope

Developer exceptions_developer owns HrExceptions.tsx, new feature-local exceptions context/data/read helpers, the minimal existing HrAttendanceDetail return target/label adjustment and only the existing exceptions pagination calculation in backend/controllers/reportController.ts. Tester exceptions_tester owns new frontend/backend/browser tests and append-only testing guide. QA exceptions_qa reviews the bounded diff. Preserve all unrelated edits and legacy tests. No new route, endpoint, projection, dependency, schema/migration, permissions, Staff, Register, dashboard or audit workflow edits. No commit/push for P07b.

## Actual contracts

GET /reports/exceptions is HR/SUPERADMIN-only under existing auth, forced-password, role and query guards. It requires real startDate/endDate YYYY-MM-DD, end>=start and the existing maximum190-day difference, plus page/limit. Search and type filters are unsupported. The response is success/data/pagination.currentPage,totalPages,total, with attendance-first pagination followed by attempts. Counts are exception rows, never unique people or incidents.

ATTENDANCE summary: kind/id/date/employee/status/sessionStatus/reason. ATTEMPT summary: kind/id/date/nullable employee/action/outcome/step/kiosk/site/locationResult/reason. Attendance date is the stored attendance date; attempt date is its recorded creation instant filtered by UTC boundaries. No current business-timezone/today assumption or new absence meaning is selected.

Backend defect: attemptTake subtracts attemptSkip from remaining page capacity, hiding later attempt pages. Bound take by remaining page capacity and remaining attempt rows while preserving predicates, projections and ordering. No data writes or database-backed fixture tests are authorized; mock persistence and tenant lookup under existing unit configuration.

## UI behavior

Require an explicit blank initial From/To range and Apply before fetch. Restore valid range/page from URL, validate real dates/order/span, and reset page on applying a new range. Keep draft input edits distinct from applied results. Render distinct loading/initial-empty/filtered-empty/out-of-range/error/malformed/count-unavailable states, abort obsolete reads and protect pending/loaded account/token/role/forced-password changes.

Display employee names/codes where known, with unidentified/unavailable wording for null attempt employees. Keep attendance classification separate from session state. Display recorded attempt outcome/action/step/site/terminal/location assessment as summary evidence; UNKNOWN never means OUTSIDE. Native attendance drill-down uses P07a; attempt IDs never enter attendance URLs. Full Attempt Detail is pending P28; no dead View control or inferred attendance-attempt relationship. Remove Dismiss, PATCH, confirmation and associated toasts entirely under approved D-11. Do not modify backend dismissal routes or facts.

Attendance Detail may accept only a fixed origin=exceptions marker and validated range/page to return to /hr-exceptions with label Back to Exceptions. Never accept arbitrary URLs. Existing Attendance return behavior is preserved otherwise. Reuse DESIGN primitives/frozen status tokens, responsive labelled rows/cards and accessible keyboard controls. No map, guessed numeric evidence, business defaults or attendance overlays.

## Verification and checkpoint

Capture meaningful RED then GREEN frontend contract tests, real report handler/router with mocked Prisma/tenant/audit dependencies and no DB/environment setup, bounded transition/attempt-only/later/out-of-range pages and tenant predicates. Verify query guards/HR/SA and STAFF/forced negatives through existing middleware seams. Focused browser375px/1440px intercepted read flows cover range/apply/page, distinct row actions, UNKNOWN/null employee, attendance direct/refresh/back-context and partial/error/retry. No credentials/data changes; preserve existing servers. Run focused existing P07a regression checks, frontend/backend typechecks, applicable lint limits, UI taste, environment, scoped secret/whitespace/document checks and QA. Live authenticated verification remains unverified if the existing native URL-policy limitation persists. Stop for owner review; no next slice.
