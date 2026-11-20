# Ordinary Change Password verification — 2026-11-02

State: implementation and verification approved by owner; commit checkpoint authorized. This is the bounded P04a completion slice, following PIN security commit 2d11801. No backend, database, schema, migration, dependency or live environment change.

## Resulting behavior

Profile opens /profile/change-password in the account shell for authenticated STAFF, HR and SUPERADMIN with initial setup complete. Forced setup remains /set-password. The form uses the existing password policy, visible labels, keyboard-accessible visibility controls, current/new/confirmation inputs, guarded submission and inline feedback.

Only accepted success with a fresh token, valid own-user data and an unchanged originating session refreshes local session state. Successful completion clears password inputs. A wrong current-password refusal remains inline only for the exact established endpoint/status/message; genuine authentication failures still sign out.

## Verification

- 31 focused form, route and interceptor tests pass after the refactor.
- Frontend typecheck and scoped JavaScript lint pass. Existing ESLint configuration does not match TypeScript files; do not claim TypeScript lint coverage.
- Two existing-tool Playwright checks pass at 375px and 1440px. Empty-form screenshots were visually inspected; no horizontal overflow observed. Browser requests were intercepted, not sent to a live backend.
- Changed UI files pass ui-taste; environment parity and whitespace checks pass.
- Redacted Gitleaks scan across the slice passes without suppression. An illustrative test literal was rewritten as a constructed fixture after a scanner finding.
- Security approved the supplied current source and isolated evidence. QA final verdict follows the full frontend suite.
- Testing guide includes isolated commands and manual checks.

## Review boundaries

No passwords were added to persistent application storage, logs, URLs or screenshots. Browser sessions and API responses are fabricated fixtures. Live authentication, database concurrency, production RLS and deployment remain separately unverified.

Existing unrelated changes in App, Sidebar and other files remain outside this slice. The existing sidebar still has older labels; approved navigation consolidation remains future phased work. P05 contracts remain proposals, not mounted endpoints.

No ordinary-password changes have been staged or committed. Owner review precedes commit.sh and the next implementation slice.
