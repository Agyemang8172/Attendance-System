# P05a — Direct attendance detail API

Owner approved P05 contracts and this bounded first implementation. Existing architecture and permissions remain authoritative. No schema, migration, data, dependency, live environment or frontend change.

## Ownership

Developer owns new backend/controllers/attendanceDetailController.ts and narrow additions to backend/routes/attendanceRoutes.ts. Tester owns new backend/tests/unit/attendanceDetail.contract.test.ts and only necessary obsolete P03 fixture assertions. Preserve existing working-tree and historical edits. Orchestrator owns state and this plan.

## Contract

GET /api/attendance/:id uses existing authentication, forced-password, role and UUID validation. STAFF reads own records; HR and SUPERADMIN read permitted own-business records. Derive business from authenticated context, never query/body. Unknown or foreign IDs return generic404; same-business STAFF-other access returns403. Reject unknown roles, inactive context and forced accounts.

Use a tenant-scoped explicit Prisma projection of recorded punches/hours/status/session/closure/review reasons, canonical date, historical shift/timezone/policy snapshots and safe employee/terminal labels. Check related entity business scope; no cross-tenant relation disclosure. Omit raw verification handles, kiosk secrets and network IP. No fabricated geofence verdict, checkout evidence, current-rule fallback or attendance-attempt link.

Allowlist policySnapshot keys and scalar types against its actual attendance writer; malformed snapshots remain null/partial unknown, never arbitrary JSON. Preserve absence of historical evidence. Response is success/data; personal operational data must not be cached across users.

## Routing and validation

Static list routes retain precedence. Reserve the corrections namespace from generic ID capture and prove existing server mount behavior using installed Express router tests. A corrections router passthrough is acceptable if GET remains unmounted404 and existing POST submission still reaches its handler; do not add placeholder handlers or widen correction access. Existing attendanceIdSchema is reused. No server edits unless justified and separately assigned.

## Verification and checkpoint

Tester captures failing baseline, then tests actual router/validation and isolated controller decisions with no database setup. Cover401, forced403, role403, UUID400, own200, other403, foreign/missing404, HR/SA scope, safe selections/relations, nullable snapshots, policy exclusions, error safety and static/correction precedence. Run complete isolated backend suite, backend typecheck, scoped redacted Gitleaks, environment parity and documentation checks. Mock checks do not prove production RLS or database execution.

Security approves the approach before authoring and reviews final supplied code; QA and Tester complete their gates. Stop with a reviewable diff before commit.sh. No automatic commit or push.
