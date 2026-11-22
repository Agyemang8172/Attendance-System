# P07a — Operational Attendance register and detail recovery

Owner authorized the next eligible approved slice after P06c commit8880a30. P07a is eligible after P06a25864de per the approved phase plan. Full P06d submission depends on configured business-time entry under P17b; do not introduce a UTC-input substitute for that workflow.

## Scope and ownership

Developer owns src/pages/HrAttendance.tsx, new HrAttendanceDetail.tsx and feature-local hr-attendance helpers/hooks/table as necessary. Tester owns new focused/browser tests and append-only testing guide. QA reviews the bounded diff. Preserve unrelated working-tree changes. Root DESIGN and approved screen compositions govern; no route, sidebar, Staff, Exceptions, backend, credentials/data, schema/migration or dependency changes. No commit/push for this slice.

## Contract and composition

Existing AdminRoute mounts /hr-attendance and /hr-attendance/:id to HrAttendance. Branch on ID inside that component; canonical detail links use /hr-attendance/:id. Retain existing /admin-attendance compatibility list. Preserve supported list context through direct URL, refresh and return without arbitrary return URLs.

GET /attendance/all-attendance returns flat success/count/total/page/data. Supported status/sessionStatus/page/limit and ISO startDate/endDate work; search does not. Remove unsupported search. List uses one server pagination system and factual classification/session fields; do not inherit shared table hard-coded06:30 lateness or re-pagination. Reuse valid Paper & Brass primitives and formatting without refactoring shared Staff components. Names/codes display; IDs remain internal. Render explicit loading, failure/retry, empty, filtered empty, out-of-range and unavailable-count states, with stale/session guards.

The existing date query filters clockIn instants, not attendance.date or business-local days. If retaining date controls, label them UTC clock-in date boundaries with deterministic inclusive start/end Z values and an explicit scope explanation. Do not use browser-local timezone, current settings guesses, a Today shortcut or claim business-day semantics. Business-time period consistency remains P17.

GET /attendance/:id is the completed P05a direct reader with HR/SUPERADMIN business scope. Display recorded employee, attendance/punches/hours, classification/session separately, closure/review evidence, historical shift/policy and available source coordinates/terminal. No inferred geofence, site, IP, attempts relation or current-policy substitution. Unknown/missing evidence stays unavailable. Existing correction trail route may be a contextual link only; do not implement or certify that separate workflow. No Staff correction submission controls for another employee. No attendance outcome overlays/dismiss/punch controls.

## Verification and stop

Focused tests use actual flat list/P05a envelopes, roles, supported filters, UTC boundary conversion, pagination, direct detail/reload, return context, errors/nulls/stale/session changes and truthful evidence. Browser checks at375px/1440px verify keyboard entry, direct URL/refresh, return context and partial/error states with intercepted API responses and no real writes. Existing servers must be preserved. Live authenticated checking only if already supported without credentials/data changes; preserve the previously reported native browser URL-policy limitation. Typecheck, scoped lint limits, UI taste, environment, scoped secret/whitespace/document checks and QA precede owner checkpoint. No next slice.
