# Changelog

All notable changes to Dev-OS and AttendPro are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

AttendPro entries use an `AttendPro` prefix so they do not collide with the
Dev-OS release numbers below.

## [AttendPro v1.0.0-rc.1] — 2026-10-19

> Release candidate. It is not cleared for a public launch: the M9 security
> review keeps SEC-01 through SEC-08 open. Backend coverage meets the 90/85
> gate (93.43% statements / 85.93% branches); frontend coverage passes the
> owner-approved staged ratchet at 29.95% statements / 71.38% branches and rises
> every milestone toward 90/85. The owner decides which findings block the
> private pilot.

### M9 — Test Suite, CI, Security Review & Close-Out

- **Playwright specs repaired and run**: Rewrote the five stale e2e specs against the real landing and login markup, fixture accounts (`devos123`), and role redirects. Renamed them to `*.spec.ts` so Playwright's default test match finds them. A live run against the backend passed 5 tests; the kiosk test is a documented skip because no kiosk UI exists.
- **Testing guide expanded**: Added Sections 5–10 for the public landing page, staff portal, HR portal, SUPERADMIN portal, kiosk current state, and responsive/keyboard checks. Fixed the stale quick start and the retired monthly-report panel, and separated the development seed accounts from the `attendpro_test` fixtures.
- **Test database isolation**: The suite now runs against a local `attendpro_test` database. `backend/tests/dbGuard.ts` verifies the exact `TEST_DB_HOST` and `TEST_DB_NAME`, requires the `_test` suffix, and refuses the development database, a hosted Prisma host, or a URL equal to `DATABASE_URL`. It runs before Prisma is imported, so a misconfigured run stops before any write. Backend duration dropped from about 7 minutes to 76 seconds.
- **GitHub Actions CI**: Added `.github/workflows/ci.yml` with `frontend` (lint, typecheck, unit tests, the staged coverage ratchet, build), `backend` (a throwaway Postgres 16 service container, Prisma generate, typecheck, migrations, `npm run test:coverage` enforcing 90/85), `docs` (humanizer audit), and `security` (gitleaks plus advisory dependency reports) jobs on Node 20 with npm caching. No deploy workflow; the e2e suite stays local because it needs a running backend.
- **Development seed**: `backend/prisma/seed.ts` now creates one SUPERADMIN and one HR account. It refuses unless `SEED_CONFIRM=development` and `DATABASE_URL` matches `DEV_DB_HOST`, reads passwords from gitignored environment variables, and never prints them. A production bootstrap is still open (SSB-2).
- **Security review**: Added `docs/attendpro/M9-SECURITY-REVIEW.md` with 23 findings across dependencies, session revocation, RLS enforcement, CORS, CSP, PIN lockout, staff API paths, and environment parity. Gitleaks 8.30.1 found no leaks across eight source directories. The dependency trees report 34 advisories in the frontend and 10 in the backend.
- **Close-out docs**: Added `docs/attendpro/DEPLOYMENT-RUNBOOK.md`, rewrote the README stack and quickstart for PostgreSQL/Prisma, and logged the M9 defect lesson in `docs/LESSONS.md`.
- **Production defects fixed**: The new tests exposed five defects and one frontend path bug. M9-B1 — Express 5 discarded validated query parameters, so several list endpoints returned 500 or a silent empty page. M9-B2 — shift creation omitted two legacy `NOT NULL` columns, so every create returned 500. M9-B3 — the generic `GET /api/audit` listing was never built, so the HR and SUPERADMIN audit screens returned 404. M9-B4 — the JSON register preferred the live shift name over the historical snapshot. M9-B5 — six user-controller catches answered only an `instanceof Error`, so a non-Error throw left the request open until the client timed out; both arms now answer 500. SEC-20 — ten staff screens double-prefixed `/api`, so fourteen requests resolved to `/api/api/...` and returned 404.
- **Backend coverage campaign**: Added account-security, shift/audit, report/attendance, utility, guard and failure-injection suites. The backend is now 22 files / 590 tests with 93.43% statements / 85.93% branches / 98.05% functions / 93.43% lines; `backend/vitest.config.ts` enforces 90/85 and CI runs `npm run test:coverage`.
- **Validation**: `npm run lint`, `npm run typecheck`, `npm run test:unit` (98 tests in 11 files), and `npm run build` all pass. Playwright passed 5 of 5 runnable tests. The frontend ratchet passes at 29.95% statements, 71.38% branches, 49.79% functions and 29.95% lines against a 29/71/49/29 floor. The final frontend 90/85 target is not met yet; the floor rises every milestone.

## [AttendPro M8] — 2026-10-17

### M8 — Design System, Landing Page & Portal Completion

- **Design system consolidation**: Added the shared `PageHeader`, `SectionHeader`, `Pill`, `SearchInput`, `Pagination`, `ModalShell`, `ConfirmDialog`, and `FilterBar` primitives, plus `src/lib/attendance-format`. Replaced ad-hoc type, radius, and colour values on the rewritten screens.
- **Public landing page**: Shipped `/` as a display-only product page with fictional sample data, a single sign-in action, and no registration or account-recovery links (O1, M8-R3). The sample table stacks into cards below the `sm` breakpoint.
- **Staff portal**: Removed the dead clock buttons, streak, and attendance-rate card. Rebuilt the dashboard around weekly hours, the current day, and recent history; added functional attendance, schedule, off-days, help-request, correction, profile, and change-PIN screens.
- **HR and SUPERADMIN portals**: Completed the HR dashboard, attendance register, exceptions, staff management, help queue, corrections queue, reports, and audit history. Added the SUPERADMIN setup screens for shifts, scheduling, policies, calendars, sites, and kiosk devices.
- **Responsive and accessible behaviour**: Verified 375, 768, and 1440 widths, added focus management to dialogs, labelled controls, text-plus-colour status, and inline error states. Recorded the remaining defects in `docs/attendpro/M8-GAP-REGISTER.md`.
  - **Correction (2026-10-21):** The viewport-verification claim above is not supported by landing-specific screenshots or visual-regression artefacts. The landing page has open gaps L1 to L9 in `docs/attendpro/M8-GAP-REGISTER.md` section C. The current acceptance contract is `docs/attendpro/LANDING-PAGE-SPEC.md`.

## [4.3.0] — 2026-10-01

### Autonomous SDLC Pipeline Runner — TASK-003

- **Stateful 10-Stage Pipeline Engine (`scripts/sdlc-runner.js` / `devos run`)**: Replaced the static `devos auto` informational printout with a real, stateful execution engine. State persists in `.agents/memory/sdlc-state.json` (`schemaVersion 1.0.0`) and survives session interruptions. Supports `devos run --resume` to continue from the current stage.
- **Gate-Enforced Stage Sequencing**: Design Gate, Mandatory Design Gate (Stage 5), and all mechanical checks are verified before each stage. The runner blocks implementation without `DESIGN.md` and blocks the design stage without `PROJECT_REQUIREMENTS.md`.
- **Per-Stage Delegation Prompts (`devos run --step <stage-id>`)**: Running `devos run --step inception` (or any of the 10 stage IDs) prints a ready-to-paste, context-aware delegation prompt for that agent — including the product idea, expected deliverable, gate status, and skill reference.
- **Dry-Run Preview (`devos run --dry-run "<idea>")**: Prints a full pipeline preview with per-stage gate status without writing any state, so founders and engineers can verify readiness before beginning.
- **`npm run auto` / `npm run sdlc` Scripts**: Added convenience npm script aliases for `scripts/sdlc-runner.js`.
- **Smoke Test Coverage (10 new assertions, 113 total)**: Added `devos auto --list`, `--dry-run`, pipeline init, `sdlc-state.json` schema validation, `--status`, `--step inception`, `--step design`, `--status --json`, and `--reset` assertions. All 113 pass.
- **Eval Suite Expanded (3 new cases, 36 total)**: Added `workflow-sdlc-runner-state`, `workflow-sdlc-runner-gates`, and `workflow-sdlc-runner-delegation` to `workflow-integrity.eval.json`.
- **`autonomous-sdlc` Skill Updated**: Added Section 4 — SDLC Pipeline Runner CLI Reference with command table, stage ID list, and typical workflow walkthrough.

## [4.2.0] — 2026-09-23

### Reliability & Evaluation Layer, pass@k Benchmark Engine, Eval CLI & Awesome Design Catalog
- **First-Class Evaluation Engine (`scripts/eval-runner.js` / `devos eval`)**: Built a zero-dependency capability and regression evaluation engine executing benchmark suites, measuring mathematical $pass@k$ curves ($k \in [1, 3, 5]$), and issuing formal `EVAL_PASSED` or `EVAL_REGRESSED` verdicts with actionable trace breakdowns.
- **Standardized Benchmark Suites (`.agents/evals/suites/`)**:
  - `gates.eval.json`: 11 automated test cases verifying mechanical enforcement of all 5 quality layers (Design Gate, UI Taste Scanner, Humanizer Scanner, Environment Parity, Database RLS Safety, and Commit Gate).
  - `harness-parity.eval.json`: 6 test cases verifying multi-platform parity across Claude Code, Google Antigravity, Gemini, Cursor, OpenCode, and Codex.
  - `memory-preservation.eval.json`: 5 test cases validating `context.json`, DAG task board transitions, `docs/CURRENT_STATE.md` alignment, and ADR/handoff templates.
  - `agent-authority.eval.json`: 6 test cases auditing specialization boundaries across Orchestrator, Developer, QA, Tester, DBA, and Security personas.
  - `workflow-integrity.eval.json`: 5 test cases testing 8-step feature delivery, circuit breaker loop halts, solo session protocol, and `devos123` password compliance.
- **Awesome Design Catalog Integration (`docs/DESIGN_CATALOG.md` / `devos design match/apply`)**: Bundled 74 real-world production design systems from `voltagent/awesome-design-md` in `.agents/catalog/designs/` with local metadata indexing. Allows deterministic matching and applying of company design systems (Linear, Stripe, Airbnb, GitHub, etc.) to root `DESIGN.md` without LLM hallucination. Added `/redesign` slash command.
- **Evaluation Scorecard System (`.agents/evals/reports/`)**: Automated generation of timestamped JSON scorecards and `latest-scorecard.json` tracking historical reliability indices, sampling trials, duration, and suite breakdowns. Accessible via `devos eval scorecard`.
- **New `/eval` and `/redesign` Slash Commands & Skills**: Added `.agents/commands/eval.md`, `.agents/commands/redesign.md`, and authored `.agents/skills/eval-harness/SKILL.md` (integrated into the `core` capability pack).
- **CLI & Diagnostic Integration**: Added `devos eval` (subcommands: `run`, `list`, `scorecard`, `--k <samples>`, `--json`), added eval benchmarks to `devos doctor` and `devos status`, and wired `npm run eval`.
- **Smoke Test Expansion (94/94 Passing)**: Added smoke test assertions verifying eval suites, `devos eval list`, `devos eval run`, and `devos eval scorecard`.

## [4.1.0] — 2026-09-15

### The 5-Layer Quality Gate Architecture, Anti-AI UI Standard & Mechanical Scanners
- **Formalized 5-Layer Quality Gate Architecture**: Established a defense-in-depth pipeline consisting of Layer 1 (Design & Architecture Gate via `pre-tool-use.sh`), Layer 2 (Mechanical Scanners: `gitleaks`, `ui-taste-check.sh`, `humanize-check.sh`, `env-check.sh`), Layer 3 (Data & Migration Safety Gate via `db-check.sh`), Layer 4 (Parallel Engineering Gate via QA + Tester + Security), and Layer 5 (Human Checkpoint Gate via `commit.sh`).
- **Environment & Config Parity Gate (`.agents/scripts/env-check.sh` / Hard Rule #20)**: Built zero-dependency scanner auditing source code against `.env.example` to guarantee all environment variables are documented with dummy placeholders and no live credentials or private keys are committed to Git.
- **Database & Migration Safety Gate (`.agents/scripts/db-check.sh` / Hard Rule #21)**: Built automated migration auditor enforcing mandatory Row Level Security (`ENABLE ROW LEVEL SECURITY`) on all created tables, foreign key indexing, and non-destructive operations (flags unapproved `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`).
- **Anti-AI UI & Distinctive Craft Standard (`.agents/scripts/ui-taste-check.sh` / Hard Rule #19)**: Authored `.agents/skills/anti-ai-ui/SKILL.md` cataloging 20 common low-effort AI UI clichés ("AI slop") and enforcing concrete human-crafted counter-patterns. Scans for raw emojis, sparkle icon clichés (`<Sparkles`, `Wand2`), lazy indigo-purple gradients, generic marketing copy, placeholder data ("John Doe"), and suppressed focus rings.
- **UI/UX Pro Max Recommendation Engine Fix**: Corrected CLI integration in `ui-designer.md` and `/design` command to invoke `python3 .../search.py "<domain>" --design-system -p "<ProjectName>" --format markdown`, ensuring complete color, typography, and layout tokens are extracted directly from the 161-product database into root `DESIGN.md`.
- **Quality Gate Integration**: Updated `developer.md`, `qa.md`, and `dba.md` to require `.agents/scripts/` verification before presenting code for review. Wired all scanners into `bin/devos.js` installer, updater, and `runDoctor`.
- **Expanded Test Suite (89/89 Passing)**: Added smoke test assertions verifying `ui-taste-check.sh`, `env-check.sh`, and `db-check.sh` catch violations and pass clean code.

## [4.0.1] — 2026-09-13

### Root Design System, Multi-Harness Governance & Automated Zero-Config Setup
- **Root `DESIGN.md` Placement**: Relocated `DESIGN.md` from `docs/DESIGN.md` to the project root (`DESIGN.md`), sitting alongside `CODING_STANDARDS.md` as a top-level architectural contract. Updated all 15 agent prompts, commands (`/design`, `/auto`), pre-tool-use hooks, and CLI doctor/status checks to coordinate with root `DESIGN.md` while maintaining backward-compatible fallback for existing clones.
- **8-Step Interactive Installer Wizard**: Upgraded `devos init` to systematically prompt for Environment Type, Tech Stack, AI Coding Platform / Harness (Google Antigravity & Gemini [Recommended], Claude Code, Cursor, OpenCode, Codex / Windsurf, All), SDLC Execution Mode (`interactive`, `guided`, `auto`, `audit`), Autonomous Goal / Product Idea, Capability Scope (Lean Stack Pack vs Full Skills Arsenal), Anonymous Telemetry buffer, and Git Pre-Commit Hook installation.
- **Enhanced Google Antigravity & Gemini Support**: Enforced open Agent Skills Standard compliance across all 66 skills in `.agents/skills/`. Extended `generateAntigravityConfig` to generate `ANTIGRAVITY.md` and `GEMINI.md` with explicit SDLC governance, Mandatory Design Gate rules, and universal test password specifications (`devos123`).
- **Autonomous MVP Goal Integration**: Autonomous product prompts entered during `devos init` or via `devos run "<goal>"` are automatically tracked in `.agents/manifest.json` and initialized as `TASK-001` in `docs/TASK_BOARD.md`.
- **Automated Hooks & Built-in Secret Scanner**: Completely eliminated manual post-installation requirements. `devos init` now ensures git repository initialization, installs `.git/hooks/pre-commit`, and configures secret scanning out of the box (with automated Gitleaks installation via Homebrew and built-in regex fallback blocking AWS, GitHub, OpenAI, Anthropic, Google, and private keys).
- **Prompting Guide ("Prompt the What, Not the How")**: Added Section 4 to `README.md`, Section 9 to `docs/TUTORIAL.md`, and onboarding tips in `bin/devos.js`. Teaches the 3-step Golden Prompt Formula (Goal + Context/Constraints + Desired Deliverable) and includes real-world Before/After case studies so users never need to micromanage agent roles or security rules.
- **Documentation & Command Reference Parity**: Completely refreshed `docs/GETTING_STARTED.md`, `README.md`, and `docs/TUTORIAL.md` with complete CLI tables, platform walkthroughs, and mechanical gate instructions.

## [4.0.0] — 2026-09-13

### Autonomous SDLC, Mechanical Enforcement & Telemetry
- **Mandatory Design Gate (Hard Rule #15)**: Integrated mechanical pre-tool-use hook (`.agents/hooks/pre-tool-use.sh`) that blocks creation or editing of frontend UI files (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.html`, `*.css`) until `docs/DESIGN.md` is authored. Added UI Designer agent (`.agents/agents/ui-designer.md`), `/design` slash command, and design token extraction from `ui-ux-pro-max`.
- **Autonomous SDLC Modes & Executive Proxy**: Added four standardized SDLC modes (`interactive`, `guided`, `auto`, `audit`) in `.agents/skills/autonomous-sdlc/SKILL.md`. Introduced the Executive Proxy persona (`.agents/agents/executive-proxy.md`) and `devos run "<idea>"` / `devos auto` CLI runners to enable hands-off MVP delivery for non-technical startup founders.
- **Default Anonymous Telemetry & Local RCA Engine**: Telemetry is now enabled by default (`telemetry: on (recommended)`). Gate rejections and failure events are buffered locally in `.agents/telemetry/events.jsonl` with strict zero-secret sanitization. Added Telemetry Agent (`.agents/agents/telemetry.md`), `/telemetry` slash command, and CLI operations (`devos telemetry status/report/enable/disable/clear`).
- **Humanizer Documentation Gate (Hard Rule #16)**: Integrated `blader/humanizer` into `.agents/skills/humanizer/SKILL.md` with an executable scanner (`.agents/scripts/humanize-check.sh`) to mechanically detect and eliminate 25 cataloged robotic AI writing tells across all markdown documents.
- **Interactive Testing Guide (Hard Rule #17)**: Authored `.agents/skills/testing-guide/SKILL.md` enforcing `docs/TESTING_GUIDE.md` deliverable with step-by-step interactive checklists and standardized universal development test credentials (`devos123`).
- **Skills Registry Integration (`skills.sh` / `npx skills`)**: Added first-class `devos skill` CLI suite (`add`, `update`, `check`, `find`, `list`) bridging Dev-OS seamlessly with the open agent skills ecosystem, supporting `.skill-lock.json` and bi-directional upstream updates.
- **Expanded Specialist Roster (15 Agents, 66 Skills)**: Added `ui-designer`, `executive-proxy`, `telemetry`, and `eval-engineer` personas, and updated capability packs (`core`, `frontend-pro`, `backend-pro`, `autonomous`, `cloud-data`).

## [3.0.0] — 2026-09-11

### Major Features & Upgrades
- **Runtime Lifecycle Hook Framework (F1)**: Introduced `.agents/hooks/` (`session-start.sh`, `pre-tool-use.sh`, `session-end.sh`) and `.claude/hooks.json` mapping `SessionStart`, `PreToolUse`, and `SessionEnd`. Mechanically enforces Hard Rule #1 (blocks destructive actions), Hard Rule #8 (blocks raw git commit), Hard Rule #13 (session-end state obligation), and Hard Rule #14 (freshness check).
- **Composable Capability Packs (F2)**: Added pack registry (`.agents/packs.json`) and project manifest (`.agents/manifest.json`). `devos init` now installs lean stack-tailored packs (`core` + target stack), reducing initial token context by 60–75%. Added `devos pack list` and `devos pack add <name>` CLI commands.
- **Structured Shared Memory Vault (F3)**: Added `.agents/memory/` containing Architecture Decision Records (`decisions/ADR-000-template.md`), session handoffs (`handoffs/handoff-template.md`), and `context.json`. Added `devos memory list`, `devos memory handoff`, and `devos memory doctor` CLI commands, along with `.agents/skills/shared-memory/SKILL.md`.
- **Deterministic Task Board & DAG Workflow State (F4)**: Added `docs/TASK_BOARD.md` state machine (`[BACKLOG]`, `[QUEUED]`, `[IN_PROGRESS]`, `[PARALLEL_GATE]`, `[HUMAN_CHECKPOINT]`, `[DONE]`), `/task` slash command (`.agents/commands/task.md`), and `.agents/skills/task-board/SKILL.md`.
- **Multi-Harness Expansion + OpenCode (F5)**: Expanded compilation engine to natively generate rules and configuration across major AI IDEs: **Claude Code** (`.claude/`), **Cursor** (`.cursor/rules/devos.mdc`, `.cursorrules`), **OpenCode** (`OPENCODE.md`, `.opencode/rules/devos-rules.md`, `.opencode/opencode.json`), **Google Antigravity & Gemini** (`ANTIGRAVITY.md`, `GEMINI.md`), and **Codex & Windsurf** (`.codex/instructions.md`, `.windsurfrules`). Added interactive platform selector (Step 3 in `devos init`) and CLI flags (`-p, --platform <name>`, `--harness <list>`) so developers can tailor their workspace for specific tools or generate universal configurations.

## [2.1.1] — 2026-09-10

- **Official npm Scope Release**: Successfully published to npm under `@olives/devos` as public package.

## [2.1.0] — 2026-09-03

- **Official npm Package Scope (`@olives/devos`)**: Formally registered under the official Olives organization on npm as `@olives/devos` (executable CLI binaries remain `devos`, `olives-devos`, and `devos-init`).
- **`devos update` CLI Command**: Safely refreshes `.agents/`, specialist skills, slash commands, and git hooks in existing projects without overwriting custom documentation or stack coding standards.
- **Automated Pre-Commit Hook Installation**: `devos init` now automatically runs `install-hooks.sh` to install `.git/hooks/pre-commit` whenever initialized within a Git repository.
- **Hard Rules Digest in CLAUDE.md**: `bootstrapClaudeMd` injects a complete 14-rule digest directly into `CLAUDE.md` to guarantee AI working agents always load the rules into active context on turn 1.
- **Solo Session Protocol**: Defined the official minimum viable quality gate in `AGENTS.md` and `CLAUDE.md` for single-agent interactive workflows (freshness check, lint/typecheck/test self-verification, standards review, staged human review, commit gate, state obligation).
- **Hard Rule #13 (Session-End State Obligation)**: Requires active agents to update `docs/CURRENT_STATE.md` (and `docs/LESSONS.md` on incidents) before concluding any working session modifying code.
- **Hard Rule #14 (Session-Start Freshness Check)**: Enforces running `git fetch --all --prune` and `git status -sb` before scoping tasks to prevent regressions against stale branches.
- **Pre-Commit Hook Reference**: Added `docs/PRE_COMMIT_HOOK.md` detailing mechanical gate architecture, Gitleaks scanning, and verification procedures.
- **Field Audit Report**: Added `docs/FIELD_REPORT_2026-08-20.md` capturing findings from a real-world multi-day project audit and documenting the resolution of all five recommendations.

### Security & Hardening
- **Un-Pipeable Human Approval Gate**: Hardened `commit.sh` to read the approval token directly from the controlling terminal (`/dev/tty`). Piped stdin (e.g. `printf 'approve\n...' | commit.sh`) is rejected by policy; automated CI environments must explicitly export `DEVOS_HEADLESS_COMMIT=1`.
- **Modern Gitleaks Subcommand**: Replaced legacy `gitleaks protect` with the officially documented `gitleaks git --staged --verbose` in `install-hooks.sh`.
- **Robust Gate Status Check**: Hardened `install-hooks.sh` from fragile `if [ $? -ne 0 ]` checking to direct command execution testing (`if ! gitleaks git --staged --verbose; then`).

## [2.0.0] — 2026-08-14

### Added
- **npm Package (`@olitech010/dev-os`)**: Installable via `npx @olitech010/dev-os init` / `npm install -g @olitech010/dev-os` (the name `devos` on npm belongs to an unrelated 2016 package, and npm blocks unscoped look-alikes such as `dev-os`). Bin commands remain `devos`, `olives-devos`, and `devos-init`
- **Claude Code Integration**: `devos init` now generates `.claude/commands/` and `.claude/agents/` (with valid frontmatter) from the `.agents/` sources, and bootstraps a project `CLAUDE.md`, so slash commands and agent personas are natively discovered by Claude Code. Skippable with `--no-claude`
- **CLI Redesign**: Block-letter DEV-OS banner with attribution, TTY/`NO_COLOR`-aware color output, styled section rules, dynamic component counts, and a boxed init summary
- **Safety**: `devos init` backs up an existing `.agents/` to `.agents/_backup/<timestamp>/` before overwriting; `install-hooks.sh` backs up an existing pre-commit hook; `doctor` now exits non-zero when checks fail
- **Smoke Test**: `npm test` runs `scripts/smoke-test.js` — a real end-to-end init/doctor/reference-integrity check
- **Slash Command System**: 10 pre-configured commands (`/review`, `/commit`, `/test`, `/secure`, `/research`, `/status`, `/fix`, `/architect`, `/refactor`, `/deploy`) with YAML frontmatter schema
- **Memory System**: Project state tracking (`CURRENT_STATE.md`), episodic memory (`LESSONS.md`), context compaction, and pinned safety rules
- **Circuit Breaker Protocol**: Agent loops exceeding 3 iterations automatically halt and escalate to human
- **Memory Manager Agent**: Dedicated agent for context preservation and session handoff
- **Release Manager Agent**: Dedicated agent for versioning, changelogs, and release notes
- **Parallel Quality Gate**: QA, Tester, and Security now run simultaneously instead of sequentially
- **Rollback Protocol**: Defined workflow for handling failed deployments
- **Exploratory Refactoring Workflow**: Safe exploration on throwaway branches
- **Hard Rules #10-12**: Circuit Breaker, Verify Before Implementing, No Heavy Dependencies Without Approval

### Changed
- **Orchestrator**: Removed TRIVIAL direct-commit loophole — all tasks now route through Developer → QA → Human
- **Commit Gate**: Added `DEVOS_COMMIT_APPROVED` token export in `commit.sh` for pre-commit hook compatibility
- **QA vs Tester**: Clarified responsibilities — QA reviews results, Tester owns test creation and execution
- **Standard Feature Delivery**: Parallelized QA + Tester + Security gate
- **Staged Review Model**: Agents write code but never auto-commit; human triggers commit after review

### Security
- **Mechanical Secret Scanning**: `gitleaks` integration via Git pre-commit hook
- **Commit Gate Enforcement**: Raw `git commit` blocked without `DEVOS_COMMIT_APPROVED` token
- **Hard Rule #8**: Mechanical Commit Gate documented and enforced
- **Hard Rule #9**: Zero hardcoded secrets policy

## [1.0.0] — Initial Release

### Added
- Multi-agent roster: Orchestrator, Developer, QA, Tester, DBA, DevOps, Security, Architect, Researcher
- Workflow protocols: Standard Feature Delivery, Bug Fix Delivery, Dependency Update
- Human-in-the-loop commit enforcement via `commit.sh`
- Skill ecosystem with 50+ modular skills
- Hard Rules 1-7
