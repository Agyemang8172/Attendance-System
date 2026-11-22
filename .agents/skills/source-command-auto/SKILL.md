---
name: "source-command-auto"
description: "Launch autonomous SDLC mode to build an MVP or feature hands-off"
---

# source-command-auto

Use this skill when the user asks to run the migrated source command `auto`.

## Command Template

Execute autonomous SDLC mode on behalf of the startup founder or product sponsor.

1. **Inception:** Invoke the Architect agent with skill `grill-me` to produce `docs/PROJECT_REQUIREMENTS.md`.
2. **Design System:** Invoke the UI Designer agent with skill `ui-ux-pro-max` to produce `DESIGN.md` at the project root.
3. **Database Architecture:** Invoke the DBA agent to design migrations and realistic seed fixtures with runtime-supplied test credential `ATTENDPRO_TEST_PASSWORD`.
4. **Task DAG:** Initialize `docs/TASK_BOARD.md` and sequence subtasks.
5. **Implementation:** Supervise the Developer implementing features sequentially.
6. **Testing & QA Guide:** Trigger the Tester agent to run test suites and author `docs/TESTING_GUIDE.md` with step-by-step verification flows.
7. **Triple Gate Review:** Run QA review, Security scan, and Humanizer audit (`.agents/scripts/humanize-check.sh`).
8. **Final Presentation:** Present a clean executive summary of the staged changes and testing instructions to the user.

## Dev-OS Routing

- Adopt the persona defined in `.agents/agents/executive-proxy.md` (delegate to the `executive-proxy` subagent if available).
- Triage level: STANDARD. Workflow: autonomous-sdlc. Follow the matching protocol in `.agents/AGENTS.md`.
- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).
