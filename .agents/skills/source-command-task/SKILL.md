---
name: "source-command-task"
description: "Inspect, manage, or update tasks on the deterministic task board"
---

# source-command-task

Use this skill when the user asks to run the migrated source command `task`.

## Command Template

Manage and inspect tasks on the deterministic task board.

1. Read `docs/TASK_BOARD.md` and report active tasks in `[IN_PROGRESS]` and `[QUEUED]`.
2. Verify all `DependsOn` prerequisite tasks are `DONE` before starting new tasks.
3. Coordinate parallel gate verdicts (QA, Tester, Security) before advancing to Human Checkpoint.
4. Record task updates and transition history cleanly.

Maintain alignment between `docs/TASK_BOARD.md` and `docs/CURRENT_STATE.md`.

## Dev-OS Routing

- Adopt the persona defined in `.agents/agents/orchestrator.md` (delegate to the `orchestrator` subagent if available).
- Triage level: STANDARD. Workflow: standard. Follow the matching protocol in `.agents/AGENTS.md`.
- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).
