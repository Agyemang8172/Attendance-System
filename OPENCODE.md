# Dev-OS — OpenCode Instructions

This project uses Dev-OS by Olives Technologies.

### Hard Rules Digest
1. Zero Destructive Actions: Never delete, drop, or truncate without an approved dry-run plan.
2. Zero Secrets Stored or Logged: API keys & credentials must NEVER be hardcoded. Use `process.env.*`.
3. Mechanical Commit Gate: Raw `git commit` is BLOCKED. Always commit via `.agents/scripts/commit.sh`.
4. Staged Review: Agents write code but NEVER auto-commit. Present summaries for human review first.
5. Circuit Breaker: Halt after 3 failed agent loop iterations and escalate to the human.
6. Verify Before Implementing: Confirm actual library APIs and patterns before authoring code.
7. No Heavy Dependencies: Packages >5MB or >50 dependencies require explicit human approval.
8. Documentation in /docs: All plans, PRDs, architecture notes, and reports belong in `/docs/`.
9. Session-Start Freshness: Run `git fetch --all --prune` and check `git status -sb` before scoping work.
10. Session-End State Obligation: Update `docs/CURRENT_STATE.md` before concluding any session modifying code.
11. Shared Memory Synchronization: Maintain architectural records in `.agents/memory/` (ADRs & handoffs).
12. Task Board Governance: Keep task states in `docs/TASK_BOARD.md` aligned with current execution.
13. Mandatory Design Gate: Modifying frontend UI files without an approved `DESIGN.md` at project root is strictly blocked.
14. Mechanical Humanizer Gate: Documentation in `docs/` must pass `.agents/scripts/humanize-check.sh`.
15. Universal Test Credentials: Seed data and testing accounts must use `devos123`.
16. Distinctive Craft & Anti-AI UI Gate: All frontend UI code must pass `.agents/scripts/ui-taste-check.sh` (zero raw emojis, zero sparkles, contextual navigation, tactile affordances, authentic entities).
17. Environment & Config Parity Gate: All environment variables in code must be documented in `.env.example` with zero committed secrets (`.agents/scripts/env-check.sh`).
18. Database & Migration Safety Gate: SQL migrations must enable RLS on all tables and avoid unapproved destructive operations (`.agents/scripts/db-check.sh`).

### Solo Session Protocol
- Step 1: Check freshness via `git fetch --all --prune` and `git status -sb`.
- Step 2: Implement following `CODING_STANDARDS.md`.
- Step 3: Self-verify with typecheck (`tsc --noEmit` or equivalent) and automated tests.
- Step 4: Present staged review summary to human.
- Step 5: Route commit through `.agents/scripts/commit.sh`.
- Step 6: Update `docs/CURRENT_STATE.md` and log incidents in `docs/LESSONS.md`.
- Escalation: DB schema changes (DBA), security alterations (Security), or loops exceeding 3 attempts must escalate to human.

### Core Resources
- Personas: `.agents/agents/`
- Skills: `.agents/skills/`
- Task Board: `docs/TASK_BOARD.md`
- Memory Vault: `.agents/memory/`
- Commit Gate: `.agents/scripts/commit.sh`
