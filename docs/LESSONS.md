# Lessons Learned

> This file is a persistent episodic memory store. When an agent encounters a significant error and resolves it, the root cause and resolution are logged here. Agents SHOULD query this file before starting tasks involving similar domains.

## Format
Each entry follows this structure:

```
### [DATE] — [SHORT TITLE]
- **Domain:** (e.g., Git, Auth, Deployment, UI, Database)
- **What went wrong:** (brief description of the failure)
- **Root cause:** (why it happened)
- **Resolution:** (how it was fixed)
- **Prevention rule:** (what to do differently next time)
```

---

### 2026-08-10 — Hardcoded Secret Leaked in PR
- **Domain:** Git, Security
- **What went wrong:** The Orchestrator agent directly wrote code and committed a hardcoded API key into a Pull Request, bypassing the Developer → QA → Human pipeline.
- **Root cause:** The Orchestrator's TRIVIAL triage level allowed direct code execution and commits. Combined with context window truncation, the agent fell back to raw `git commit` instead of `commit.sh`.
- **Resolution:** Removed the TRIVIAL direct-commit loophole. Added mechanical pre-commit hooks (`gitleaks` + `DEVOS_COMMIT_APPROVED` gate). Added Hard Rules #8 and #9.
- **Prevention rule:** Orchestrator NEVER writes production code. All commits route through `commit.sh`. Pre-commit hooks mechanically block secrets.

---

### 2026-10-09 — Demo Password in Repo History
- **Domain:** Git, Security
- **What went wrong:** The live demo password was committed early in repo history inside `README.md` and `backend/test-users.md`. GitGuardian still flags those three historical rows from its server-side scan, and the local `.gitleaks-baseline` cannot suppress them (the baseline only governs local gitleaks runs).
- **Root cause:** Early commits carried a real credential in documentation and a fixture file; the env-file-only pattern was not yet established.
- **Resolution:** Sensitive values are now confined to gitignored env files (`backend/.env` is excluded; `.env.example` holds dummy placeholders only). `backend/test-users.md` was removed from the tree (`d3996cd`), `README.md` now points readers to the contact links instead of a password, and `.gitignore` guards `backend/test-users.md` so any recreated copy cannot be staged. The three historical findings were handled with an Ignore action in the GitGuardian dashboard. M3 and M4 commits both scan clean with gitleaks.
- **Prevention rule:** No credentials in READMEs, docs, or fixture files, under any circumstances. Live secrets go only in gitignored env files; anything else is a documented dummy. Any doc or fixture that has carried credentials is gitignored permanently.

---

### 2026-10-11 — Leftover Token Rendered a Blank Dashboard
- **Domain:** Auth, Frontend Routing
- **What went wrong:** Visiting `/dashboard` with a stale `token` in localStorage but no usable `user` showed a blank page instead of the login screen.
- **Root cause:** `isAuthenticated()` checked for a token only. The guard passed that first check, found no recognised role, and bounced to `roleHome(undefined)`, which returns `/dashboard` — the page already rendering. The self-redirect resolved to nothing, so the outlet stayed empty.
- **Resolution:** `isAuthenticated()` now requires a token and a stored user with a known role, and `getCurrentUser()` returns `null` for corrupt JSON instead of throwing. Three regression tests cover the token-only, unknown-role and corrupt-user cases; the frontend suite is 66/66.
- **Prevention rule:** Treat a session as valid only when both the credential and the identity behind it are present and recognisable. A guard whose fallback points at its own current route can loop silently, so every role-to-destination map needs a sign-out path for unknown input.

---

### 2026-10-19 — M9 Found Six Controls That Looked Wired but Were Not
- **Domain:** Security, Testing, Documentation
- **What went wrong:** Six gaps survived earlier milestones because each one looked complete from the outside. `User.tokenVersion` existed in the schema but no user session read or incremented it, so password resets did not revoke 8-hour JWTs. RLS was enabled on 19 tables, but the runtime client connected with `DATABASE_URL` and never read `DATABASE_URL_APP`, so the table owner bypassed every policy. Kiosk PIN lockout was counted per verification session, so a new session reset the counter and a stolen badge could walk the 4-digit space over time. The staff attendance screen sent `status`, `sessionStatus`, and `search`, but the API read only the date range. Nine staff screens passed paths starting with `/api` to an axios client whose base URL also ended in `/api`, producing `/api/api/...` 404s. The Playwright specs used `.e2e.ts`, which Playwright's default test match ignores, so `npx playwright test --list` found zero tests.
- **Root cause:** Each feature was reviewed at its surface. The schema field, the RLS migration, the lockout constant, the filter controls, the API call, and the spec files all existed, and no check traced the full runtime path from input to effect. Documentation then repeated the surface claim, which made the gaps harder to see.
- **Resolution:** The M9 security review records each gap with file evidence and a severity. The testing guide now states the real filter, seed, kiosk, route, and API-prefix behaviour. The five e2e specs were renamed to `*.spec.ts`, and a live run passes 5 of 5 runnable tests. The new tests exposed four production defects and the API-prefix bug; those five were fixed with regression cover (M9-B1..B4, SEC-20). The remaining session, RLS, lockout, filter, and seed gaps stay visible in the review instead of being quietly patched.
- **Prevention rule:** Verify a control by following its runtime path, not by finding its declaration. A schema field, migration, constant, form control, or test file proves intent, not effect. Run the test runner's discovery command before claiming a suite exists, and make documentation repeat only what the code actually does.

## PIN mutation review — 2026-11-02

Credential comparisons outside a transaction need observed attempt/lock state in the write guard, not only a hash/salt guard. Required audit writes must propagate failure. Isolated contract tests reproduced four missing paths; they do not establish PostgreSQL concurrency or rollback.

---

### 2026-11-14 — P11.2 Constraint Exposed an Inverted-Period Write in Assignment Close
- **Domain:** Database, Assignments, Testing
- **What went wrong:** Applying the P11.2 integrity migration dropped the full DB-backed suite from 805/805: cancelling a future-dated assignment returned 500 with `23514 shift_assignments_period_ck`.
- **Root cause:** `deactivateAssignment` in `backend/controllers/assignmentController.ts` closed every row at `new Date()` without reading `effectiveFrom`. For a future assignment that wrote `effective_to < effective_from` — an inverted interval the old schema tolerated silently, so the test had been passing on corrupted data.
- **Resolution:** The owner authorized a minimal close-path repair outside the P11.2 lifecycle slice: a future row closes onto its own `effectiveFrom`, a row in force closes at `now`, which is the already-approved DELETE contract. Typecheck clean, focused suites 24/24, and the full suite restored.
- **Prevention rule:** A new CHECK or exclusion constraint is a live bug detector. Before applying one, probe every write path that touches the constrained columns for impossible values, and treat any test that passed with impossible data (`to < from`) as a red flag, not a green one.

---

### 2026-11-14 — Shared Seeded Staff Account Causes Intermittent Parallel 401s
- **Domain:** Testing, Auth
- **What went wrong:** One full-suite run failed `accountEdges.test.ts` twice with 401 on `change-password` for a `staffToken` issued seconds earlier. Both tests passed in isolation and in a second full run.
- **Root cause:** More than fourteen test files share the seeded `staff@test.attendpro.com` account, and several write its auth state — `accountEdges` itself rotates the password and revokes the old token, its `beforeAll` sets `mustChangePassword`, and admin/security flows elsewhere send active-flag and credential changes. Tokens die when the account's auth state moves, so a parallel file can invalidate a token another file is holding. The exact racer in that run was not isolated.
- **Resolution:** Confirmed not migration-caused: the checkpoint never touches JWT/auth code, the file passes in isolation, and a full re-run was green apart from the separately fixed constraint failure. Reported to the owner as a pre-existing parallel-isolation race.
- **Prevention rule:** Never share a mutable credential-bearing account across parallel test files. A file that mutates auth state should use its own fixture user, or the suite must serialize the files that share one.

---

### 2026-11-15 — A Forward Reschedule Exposed a Contract Conflict
- **Domain:** Assignment lifecycle, Design, Testing
- **What went wrong:** An approved PATCH rule left preceding rows unchanged. Moving a future replacement later then left a gap where the current shift was no longer effective.
- **Root cause:** The PATCH row-level instruction conflicted with the approved requirement to preserve current coverage until a future replacement begins. Tests originally asserted the row remained unchanged but did not check coverage in the gap.
- **Resolution:** The owner approved an amendment after QA and Security raised the conflict. A contiguous predecessor may move only its future end to the amended start, with before/after audit evidence. Its start and realized span remain unchanged; a true pre-existing gap stays unscheduled.
- **Prevention rule:** Test timeline-wide coverage when an effective date moves, including the interval between the old and new dates. Reconcile row-level instructions with business continuity before treating a design as settled.
