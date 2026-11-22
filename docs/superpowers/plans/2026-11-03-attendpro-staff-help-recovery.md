# P06c — Staff Help Requests list/detail recovery

Owner authorized the next dependency-eligible approved slice. P06c can run independently of Schedule/off-days; its existing self-service contracts do not depend on pending calendar/timing consumers. P06a remains complete at25864de.

## Ownership and scope

Developer owns StaffHelpRequests.tsx, StaffHelpRequestDetail.tsx and feature-local helper(s). Tester owns new focused/browser tests and append-only testing guide; existing test updates require narrow ownership. Preserve current user modifications. Do not edit StaffHelpRequestNew.tsx, backend/routes, schema/migrations, credentials/data, shared navigation or other screens. No installation, staging, commit or push.

## Contract and UI

List uses GET /staff/help-requests with only actual status/page/limit support. Read pagination.total/currentPage/totalPages, not a top-level total. Keep OPEN,IN_REVIEW,RESOLVED,CLOSED vocabulary and existing twelve-row page size. Remove the unsupported search control/query rather than invent backend search. Preserve known bounded status/page context through fixed-local list/detail links, refresh and return.

Detail directly loads GET /staff/help-requests/:id and displays subject, category, original body, actual status, created timestamp and flat resolutionNote/resolvedAt where present. Do not synthesize timelines, resolver identities, private IDs or nested resolution fields. Use explicit recorded UTC event timestamps while no permitted current business-timezone read is available; do not claim these are the business zone or add settings access. No shifts/calendar/business-hour assumptions.

Preserve the matched category/subject/body creation flow and existing New Request route without editing its source. Help remains separate from Corrections. Reuse root DESIGN and valid shared primitives with visible labels, keyboard links, inline states and responsive layouts.

Requests must cancel/ignore stale filter/page/ID results and reject originating account/token changes. Read only displayed fields; React text rendering, no raw HTML/errors/secrets. Loading, genuine empty, filtered empty, out-of-range page, unavailable counts,403/404 and retry states must not collapse into false zeros or blank success. Existing STAFF route/backend guards remain authoritative.

## Verification

Tester captures RED contract failures and verifies correct envelopes/statuses, direct detail, factual resolution, unknown/partial evidence, status/page return, stale/session and missing payload paths, and preserved creation behavior. Run focused/relevant frontend tests, typecheck, applicable scoped lint/UI taste, secret/env/doc/whitespace checks and QA. No new security/permission boundary is introduced; escalate any discovered authorization issue rather than changing it.

Existing local frontend5173 and API8000 health endpoints return200. No existing authenticated Staff session is available in the isolated browser runner; root may inspect existing task browser windows without reading credentials. Do not create accounts or alter credentials/data to enable live verification. Existing-tool mocked real-browser checks at375px/1440px must remain labelled as controlled-response UI evidence, not live authorization proof. Preserve existing server processes.

Stop after one slice with outcome, files, tests/runtime evidence, findings/limits and proposed commit. No commit/push or subsequent slice.
