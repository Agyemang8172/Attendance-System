---
name: "source-command-mode"
description: "Inspect or switch the locked Dev-OS SDLC execution mode"
---

# source-command-mode

Use this skill when the user asks to run the migrated source command `mode`.

## Command Template

Inspect or switch the session execution mode.

The active mode is locked in `.agents/memory/session.json`. It must never be switched
silently; an explicit invocation is required.

1. Run `devos mode status` to show the current locked mode, orchestrator lock, and
   whether delegation is required.
2. To switch, run `devos mode <interactive|guided|auto|audit>`. This is the ONLY
   supported way to change modes.
3. After switching, confirm the new mode and delegation requirement to the human.

Available modes:
- `interactive` — pair-programming with staged human reviews (default).
- `guided` — step-by-step confirmation at each SDLC stage (delegation enforced).
- `auto` — hands-off MVP builder; routes to the Executive Proxy (delegation enforced).
- `audit` — read-only diagnostics; no production writes.

Never change mode implicitly based on task content.

## Dev-OS Routing

- Adopt the persona defined in `.agents/agents/orchestrator.md` (delegate to the `orchestrator` subagent if available).
- Triage level: TRIVIAL. Workflow: direct. Follow the matching protocol in `.agents/AGENTS.md`.
- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).
