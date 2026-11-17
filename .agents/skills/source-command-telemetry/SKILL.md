---
name: "source-command-telemetry"
description: "Inspect local telemetry events, analyze failures, or generate RCA feedback report"
---

# source-command-telemetry

Use this skill when the user asks to run the migrated source command `telemetry`.

## Command Template

Inspect local telemetry logs and run failure diagnostics:

1. Read recent events from `.agents/telemetry/events.jsonl`:
   ```bash
   devos telemetry status
   devos telemetry report
   devos telemetry report --json
   ```
2. Categorize failure types (framework bugs, gate violations, circuit breaker loops).
3. If errors stem from upstream Dev-OS framework code, formulate an RCA diagnosis and synthesize a sanitized upstream issue or pull request:
   ```bash
   devos telemetry issue --dry-run
   devos telemetry pr --dry-run
   devos telemetry export
   ```
4. Strict Sanitization Gate: Ensure zero proprietary code, credentials, machine paths, or sensitive tokens are included.

## Dev-OS Routing

- Adopt the persona defined in `.agents/agents/telemetry.md` (delegate to the `telemetry` subagent if available).
- Triage level: TRIVIAL. Workflow: direct. Follow the matching protocol in `.agents/AGENTS.md`.
- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).
