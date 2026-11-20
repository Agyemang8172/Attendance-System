# P07a — Operational Attendance verification

Date:2026-11-04. P06c was committed through commit.sh as8880a30d3649c148596f26078601e7e2ae18ab89. Its narrow legacy test adjustments and unrelated changes stayed outside that commit. P07a follows the approved eligibility rule after P06a; P06d business-time entry remains dependent on P17b.

## Delivered scope

The shared HR/SUPERADMIN Attendance register consumes the actual flat success/count/total/page/data envelope and one server pager. Filters use actual classification and session enums; unsupported search is removed. Date inputs represent explicit UTC clock-in boundaries, including the final millisecond of the To date. They do not claim business-day semantics. Recorded classification is displayed without a fixed clock-time lateness rule.

The existing /hr-attendance/:id mount loads the P05a direct record API independently of list rows. Canonical links, direct URL/refresh and safe supported filter/page return context are retained; /admin-attendance remains the existing compatibility list. Detail shows employee, recorded session/punches/hours/closure/review evidence, historical shift/policy values and available check-in coordinates/terminal label. Correction Trail remains a contextual link to the existing mounted workflow; that workflow is outside this verification.

Missing historical evidence stays unavailable. No geofence verdict, site, attempt relationship, private IDs, IP or current-policy substitution is invented. Reads project displayed fields, render text safely, cancel/ignore stale responses and hide evidence after account/token/role/forced-password changes when the screen rerenders. Existing guards and backend tenant/RLS scope remain unchanged.

## Changed files

- src/pages/HrAttendance.tsx
- src/pages/HrAttendanceDetail.tsx
- src/lib/hr-attendance-context.ts
- src/lib/hr-attendance-data.ts
- src/lib/use-hr-attendance.ts
- src/__tests__/hr-attendance.test.tsx
- src/__tests__/e2e/hr/attendance.spec.ts
- P07a-only plan, testing-guide and state/task checkpoint documentation

No backend, App route, sidebar, Staff, Exceptions, schema/migration, package, environment, credential or data edits. All74 unrelated tracked working-file fingerprints match the pre-implementation baseline. Existing untracked legacy tests remain outside this slice.

## Verification evidence

- Recorded RED baseline before implementation:23 cases,21 failures and2 passes. This baseline was not repeated on resume.
- Final focused suite:29 cases passed, including pending and loaded-session identity isolation.
- Existing authentication/routing suite:29 passed.
- Scoped secret scan:seven source/new-test files,49,002bytes, no leaks.
- Environment parity:all27 referenced variables documented.
- UI taste:both affected UI files passed. Scoped whitespace passed.
- Scoped ESLint exited0 with seven ignored-file warnings; existing configuration does not cover TypeScript/TSX. No TypeScript lint coverage is claimed.
- A new-test Array.at compiler-target mismatch was replaced with equivalent supported index access; no compiler configuration changed.
- Final frontend TypeScript passed with no diagnostics. Three intercepted-API browser cases passed: HR375px and SUPERADMIN1440px keyboard/direct URL/refresh/return-context flows, plus narrow error/retry with partial evidence. Five screenshots were inspected, with compact pills and no page overflow. The first two browser cases initially had an ambiguous test-only count locator; the exact locator was corrected without source changes. QA APPROVED with no findings.

## Runtime boundary

Read-only HTTP checks on resume returned200 for frontend5173 and API8000 health. Existing servers were preserved. Browser checks use isolated fixture sessions and intercepted fetch/XHR; no real writes, accounts or records are created. They do not prove live authentication, tenant enforcement, production RLS or database behavior. Live authenticated checking remains unverified under the previously recorded native browser URL-policy identification limitation; no credentials or profile/CDP access were used to bypass it.

## Owner checkpoint

State:HUMAN_CHECKPOINT. QA and Tester approved; focused/auth tests, frontend typecheck, browser checks and scoped mechanical checks passed. Documentation humanizer checks passed. Existing SA navigation duplication is outside P07a and remains assigned to P30. No P07a staging, commit or push. Proposed commit after owner review: fix(attendance): recover operational register and detail. No next slice started.
