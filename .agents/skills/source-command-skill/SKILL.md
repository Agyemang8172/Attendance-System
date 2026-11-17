---
name: "source-command-skill"
description: "Synchronize, audit, or discover agent skills from the ecosystem"
---

# source-command-skill

Use this skill when the user asks to run the migrated source command `skill`.

## Command Template

Manage, audit, and synchronize specialist agent skills:

1. **Audit skills against Agent Skills Standard & token budgets:**
   ```bash
   devos skill audit
   devos skill audit --json
   ```
2. **List installed skills with token weight estimates:**
   ```bash
   devos skill list
   devos skill list --json
   ```
3. **Diff-aware synchronization & customization safety backup:**
   ```bash
   devos skill sync --dry-run
   devos skill sync
   ```
4. **Check for upstream updates & local modifications:**
   ```bash
   devos skill check
   devos skill check --json
   ```
5. **Discover & install skills from skills.sh:**
   ```bash
   devos skill find <query>
   devos skill add <owner/repo>
   ```

## Dev-OS Routing

- Adopt the persona defined in `.agents/agents/devops.md` (delegate to the `devops` subagent if available).
- Triage level: TRIVIAL. Workflow: direct. Follow the matching protocol in `.agents/AGENTS.md`.
- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).
