# P06a — Staff Attendance Detail frontend

Owner approved this bounded frontend slice after P05a commit6391fe7. Do not change that API, database/schema/migrations, credentials, data, dependencies or unrelated screens/list logic.

## Ownership

Developer owns new StaffAttendanceDetail.tsx, feature-local detail type/format/query helpers where necessary, narrow StaffAttendance entry/context changes and the existing App detail-route mount. Tester owns new focused detail tests, scoped necessary obsolete drawer assertions, browser smoke and append-only guide. Preserve pre-existing changes and do not stage or commit.

## Screen and navigation

The existing STAFF-only /staff/attendance/:id route loads GET /attendance/:id independently of list data. Replace the old drawer entry with direct navigation, preserving only known bounded filter/page keys as query context. The list reads/synchronizes these existing controls with the URL only for return/back/refresh continuity. Detail Back always targets the fixed local /staff/attendance path with sanitized known context; no arbitrary returnTo destination.

Use root DESIGN.md and valid shared Layout/PageHeader/Pill/Skeleton patterns. Display authoritative classification and session state separately, recorded punches/hours including valid zero values, scalar historical shift/timezone/policy evidence, recorded coordinates and safe source terminal labels. Never infer location verdicts from coordinates, substitute current rules, expose IP/verification identifiers or display invented clock-out/closure evidence. Format canonical recorded date without browser-date shifting; timestamps use a valid recorded timezone or explicit ISO/UTC evidence with unavailable-timezone wording. No routine punch, fake dismiss, automatic attendance overlay or unsupported correction preselection.

Clear old detail when record changes/retry starts, cancel/ignore stale loads and reject response reuse after account/session changes. Provide loading,404,403,error/retry and partial-evidence states. Render user text safely. Preserve backend auth handling.

## Boundaries

Do not repair Attendance list pagination/date contracts, shared table lateness heuristics, dashboard, Profile or other screens in this slice. Removing the obsolete detail drawer and its control is part of replacing the entry point. No backend change or new permission.

## Verification

Capture meaningful failing tests first. Focus on direct URL/refresh, exact record-ID request, STAFF guards, known filters/page round trip and browser back, stale loads, safe context, all actual status/evidence states, absent timezone/snapshots, null/zero values and accessible errors/retry. Run frontend typecheck, applicable scoped lint/UI taste, redacted secret/env/doc checks and QA/Security review.

Local assessment found no app/API listeners on5173/8000/3000 or authorized existing authenticated Staff session. Do not create or change credentials/data to remove that blocker. A separately labelled existing-tool Playwright check may use isolated illustrative browser fixtures and intercepted responses to exercise the real frontend at desktop/mobile widths; this is not live backend/authentication verification. Exercise Attendance→detail→direct URL/refresh→return with filter context, including narrow layout. Save only non-sensitive test screenshots.

Stop with changed files, verification, exact live-runtime limitation and proposed commit action. No commit, push or next slice.
