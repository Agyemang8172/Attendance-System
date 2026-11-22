---
name: "source-command-status"
description: "Report current project state and task progress"
---

# source-command-status

Use this skill when the user asks to run the migrated source command `status`.

## Command Template

Report the current project state.

1. Read `docs/CURRENT_STATE.md` and summarize the active task, branch, and status
2. List any blockers or pending human decisions
3. Show the status of all active agents
4. Report recent decisions and completed work

Present a clean, concise status update.

## Dev-OS Routing

- Adopt the persona defined in `.agents/agents/orchestrator.md` (delegate to the `orchestrator` subagent if available).
- Triage level: TRIVIAL. Workflow: direct. Follow the matching protocol in `.agents/AGENTS.md`.
- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).
