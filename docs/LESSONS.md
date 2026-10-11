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
- **What went wrong:** The live demo password `Godfred123456` was committed early in repo history inside `README.md` and `backend/test-users.md`. GitGuardian still flags those three historical rows from its server-side scan, and the local `.gitleaks-baseline` cannot suppress them (the baseline only governs local gitleaks runs).
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
