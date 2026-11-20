---
name: "source-command-eval"
description: "Run capability benchmarks, measure pass@k reliability, and generate agent scorecards"
---

# source-command-eval

Use this skill when the user asks to run the migrated source command `eval`.

## Command Template

Execute Dev-OS capability benchmarks, reliability evaluations, and agent scorecards:

1. Run evaluation suites via `node scripts/eval-runner.js` or `devos eval run`.
2. Measure pass@k rates (pass@1, pass@3, pass@5) across agent workflows.
3. Validate that the 5-layer quality gates, multi-harness parity, and memory preservation do not regress.
4. Generate structured scorecards in `.agents/evals/reports/` and issue formal `EVAL_PASSED` or `EVAL_REGRESSED` verdicts.
5. If regressions are detected, provide exact file locations and remediation steps.

## Dev-OS Routing

- Adopt the persona defined in `.agents/agents/eval-engineer.md` (delegate to the `eval-engineer` subagent if available).
- Triage level: STANDARD. Workflow: direct. Follow the matching protocol in `.agents/AGENTS.md`.
- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).
