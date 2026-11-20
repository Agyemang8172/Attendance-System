# Ordinary Change Password — P04a completion slice

Owner approved proceeding after the reviewed P04 PIN commit. This bounded slice implements the approved Public/Auth account-security specification, not a new credential policy.

## Ownership and scope

Developer owns new src/pages/ChangePassword.tsx and narrow changes to src/App.jsx, src/pages/Profile.tsx and src/api/axios.ts. Tester owns new src/__tests__/change-password.test.tsx plus narrow interceptor-policy tests. Preserve all unrelated staged and unstaged changes.

## Behavior

Use /profile/change-password in the authenticated account shell for STAFF, HR and SUPERADMIN whose forced-password flag is explicitly false. Unauthenticated visitors return to login; accounts owing setup use /set-password. Profile's ordinary password action points to the new route. The forced screen remains separate.

Show current, new and confirmation fields, the existing shared password policy, accessible visibility controls, one submit action and Back to profile. Use root DESIGN.md and anti-ai-ui. Validate locally, prevent duplicate submits, clear secrets after accepted completion, and show inline loading/errors/success. No password logging or new storage of password input.

Call existing PUT /users/change-password. Only accepted success with a fresh token and validated own-user response permits session refresh through existing auth utilities. Incomplete responses must not claim success. Keep server failures actionable without revealing internal details.

The current server returns 401 with the exact message Invalid current password for a wrong current credential. Exempt only this exact endpoint/status/message combination from the client's global logout policy; genuine authentication failures, including other 401 responses from the same endpoint, still clear the session. No broad authentication bypass flag or backend policy change.

## Verification and stop

Tester covers all-role access, forced/unauthenticated boundaries, policy/confirmation validation, busy submission, accepted refresh, incomplete/rejected responses and the narrowly scoped interceptor exception. Run relevant frontend tests, typecheck, UI taste, environment parity, humanizer and redacted Gitleaks. QA and Security review the actual diff before owner review.

No database/schema/migration/backend changes, dependency installation, live environment changes, staging, commit or push are part of this slice. Stop with a concrete diff and evidence for owner approval.
