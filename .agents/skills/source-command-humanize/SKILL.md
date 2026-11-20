---
name: "source-command-humanize"
description: "Audit and scrub AI writing tells from documentation and marketing copy"
---

# source-command-humanize

Use this skill when the user asks to run the migrated source command `humanize`.

## Command Template

Audit markdown prose, PRDs, and documentation against AI writing patterns:

1. Run `.agents/scripts/humanize-check.sh` against the target document (e.g. `docs/`, `README.md`).
2. Apply `.agents/skills/humanizer/SKILL.md` rules to eliminate robotic tells:
   - Not-X-but-Y formulas
   - Forced triads
   - Dramatic one-line closers
   - Inflated significance and filler words ('testament', 'pivotal', 'delve')
   - Chatbot residue
3. Preserve all technical commands, links, and code blocks unchanged.
4. Verify the rewritten copy sounds human, clear, and direct.

## Dev-OS Routing

- Adopt the persona defined in `.agents/agents/release-manager.md` (delegate to the `release-manager` subagent if available).
- Triage level: STANDARD. Workflow: standard. Follow the matching protocol in `.agents/AGENTS.md`.
- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).
