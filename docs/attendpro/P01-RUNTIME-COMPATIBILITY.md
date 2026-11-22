# P01 runtime compatibility evidence

Date: 2026-11-01. Assignee: DevOps, coordinated by Orchestrator. State: evidence ready for QA/Tester/Security and human review. P01 has not selected or configured a runtime, installed packages, or authorized P02.

## Recommendation and boundary

Recommend the Node 26 line, with the installed **26.12.1** as the concrete compatibility-tested candidate. It is the only runtime exercised in this session. The owner must approve the concrete selection before runtime declarations, CI or deployment configuration changes and before installations. The installed executable's distribution provenance/checksum and exact patch release metadata were not independently verified by these local checks.

Node 22.20.0 and 24.12.0 also satisfy the scanned lockfile engine declarations, but were not installed or executed here. Engine compatibility alone does not select a supported runtime. The existing CI Node 20 setting cannot cover the current frontend dependency set because locked `@testing-library/jest-dom` 7.0.1 requires Node >=22; official Node 20 support is also ended.

The current user-controller Mongoose/missing-handler regression is an application defect for P02. It is not evidence against Node 26. P01 tool/native smoke success does not imply application startup, complete tests, reproducible install, Linux CI, database connectivity, production RLS or deployment success.

## Installed environment

| Observation | Result |
|---|---|
| `node -p` version/platform/architecture | v26.12.1 / win32 / x64 |
| `process.execPath` | `C:\Program Files\nodejs\node.exe` |
| npm command resolution | `C:\Users\USER\AppData\Roaming\npm\npm.ps1` |
| Other version manager | fnm executable found; usable installed-version list unavailable |
| fnm read limitation | `fnm list` tried to initialize absent AppData configuration directories; sandbox denied creation. No alternate runtime evidence obtained and no escalation/install/configuration attempted. |

No environment files were read or changed. No application server, database connection, migration, seed or fixture suite was invoked. All writes owned by this task are confined to this report.

## Lockfile and installed-package evidence

Both lockfiles are version 3. Engine checks parsed every package's declared `engines.node` using the installed semver 6.3.1 implementation and `semver.satisfies`. The check includes cross-platform optional packages so it does not overlook the Linux CI dependency tree.

| Scope | Lock package entries including root | Packages declaring Node engines | Present dependency manifests checked (excluding root) | Absent optional package manifests | Absent nonoptional manifests | Present version mismatches |
|---|---:|---:|---:|---:|---:|---:|
| Frontend/root | 629 | 397 | 534 | 94 | 0 | 0 |
| Backend | 455 | 266 | 385 | 69 | 0 | 0 |

The absent entries are all marked optional in their respective lockfiles. This check does not establish why each is absent, validate file integrity, or replace a clean install. No install was attempted.

| Candidate tested against declarations | Root result | Backend result | Executed locally? |
|---|---|---|---|
| 20.19.0 | Fails jest-dom >=22 and optional Linux lzma range | Fails optional Linux lzma range | No |
| 22.12.0 | Fails newer inquirer ranges and optional Linux lzma range | Fails optional Linux lzma range | No |
| 22.20.0 | No unsatisfied declared ranges | No unsatisfied declared ranges | No |
| 24.0.0 | Fails optional Linux lzma range | Fails optional Linux lzma range | No |
| 24.12.0 | No unsatisfied declared ranges | No unsatisfied declared ranges | No |
| 26.12.1 | No unsatisfied declared ranges | No unsatisfied declared ranges | Yes |

The optional `@napi-rs/lzma-linux-x64-gnu` declaration is `^22.20 || ^24.12 || >=25`. Vite requires `^20.19.0 || >=22.12.0`. Candidate results are evaluated samples, not a claim that every version within a major line was tested. Packages without an engine declaration provide no affirmative compatibility guarantee.

## Actual locked tool versions

| Package | Root | Backend | Relevant declared Node requirement |
|---|---|---|---|
| Vite | 7.3.7 | Not direct | ^20.19.0 or >=22.12.0 |
| Vitest | 3.2.7 | 3.2.7 | ^18, ^20 or >=22 |
| JSDOM | 27.0.1 | Not direct | >=20 |
| TypeScript | 7.0.2 | 7.0.2 | >=16.20.0 |
| bcrypt | Not direct | 6.0.0 | >=18 |
| Prisma CLI / Client | 6.19.3 | 6.19.3 | >=18.18 |
| Prisma pg adapter | 6.19.3 | 6.19.3 | No engine declaration on adapter entry |
| tsx | 4.23.12 | 4.23.15 | >=18 |
| Testing Library jest-dom | 7.0.1 | Not direct | >=22 |

Manifest version ranges and actual lock versions are different concepts: for example, root package.json permits Vite ^7.2.4, while the lock and installed package resolve 7.3.7. No mismatch was found among the installed manifests checked against their own lockfile.

## Executed smoke checks

| Command or direct API probe | Result | What it establishes |
|---|---|---|
| `node node_modules/vite/bin/vite.js --version` | PASS, 7.3.7 | Vite CLI launches under installed Node |
| `node node_modules/vitest/vitest.mjs --version` | PASS, 3.2.7 | Root Vitest CLI launches |
| `node backend/node_modules/vitest/vitest.mjs --version` | PASS, 3.2.7 | Backend Vitest CLI launches |
| `node node_modules/typescript/bin/tsc --version` | PASS, 7.0.2 | Root compiler entry launches |
| `node backend/node_modules/typescript/bin/tsc --version` | PASS, 7.0.2 | Backend compiler entry launches |
| `new JSDOM` with localhost URL, DOM lookup, localStorage set/get/clear, close | PASS | Installed JSDOM DOM/storage work in an isolated in-memory window |
| Backend bcrypt hash and positive/negative compare on a disposable random probe | PASS | Installed Windows native binding loads and operates; cost 4 used only for this disposable smoke |
| `require('./backend/generated/prisma')`, inspect PrismaClient function export | PASS | Generated client module imports; no client instance/query/connection |
| Require backend pg adapter, inspect PrismaPg function export | PASS | Adapter module imports; no database operation |
| `esbuild.transformSync` on an in-memory TypeScript declaration | PASS | Installed native transform path executes without a file write |

The JSDOM probe creates no application globals and does not reopen the accepted REC-02 storage repair. It is a runtime smoke only. Hash/probe values were neither printed nor stored. The source was not built/emitted and no full test suite was run.

### Probe corrections and limitations

An initial combined smoke assumed the historical TypeScript JavaScript compiler API. In this installed TypeScript 7.0.2 package, `require('typescript')` exposes only `version` and `versionMajorMinor`; `ScriptTarget` is absent. The harness stopped at that unsupported API assumption, not at a Node compiler failure. The corrected probe uses the actual compiler CLI; the independent bcrypt/JSDOM/esbuild checks were rerun and passed.

A proposed semver subset calculation was unavailable in semver 6.3.1. The report therefore gives directly evaluated candidate versions rather than claiming a formally simplified engine intersection. Neither probe error was hidden or fixed by changing dependencies.

## Official support evidence supplied by Orchestrator

The Orchestrator verified the official sources on 2026-11-01:

- [Node previous releases](https://nodejs.org/en/about/previous-releases) identifies Node 26 as LTS, updated October 28.
- [Node Release schedule](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json) records Node 26 start 2026-05-05, LTS 2026-10-28, maintenance 2027-10-20 and end 2029-04-30; Node 20 end is 2026-04-30.

These establish the major-line support context, not provenance of the installed exact patch or application/platform certification. No mutable dependency recommendation is inferred from an old audit count.

## Gate and next step

1. QA/Tester/Security review the scoped evidence and limitations.
2. Present the concrete Node 26.12.1 candidate and any exact-patch provenance requirement to the owner.
3. After selection approval, align declarations/CI/runtime guidance through a separately reviewed bounded change. Do not install, upgrade dependencies or alter environment/host configuration implicitly.
4. P02 repairs application contracts; P32 establishes full application and actual Linux/CI/deployment evidence on the approved runtime. P01 does not require known application defects to disappear before recording tool compatibility.

Commit, if separately approved after review, must use `.agents/scripts/commit.sh`; only this report is owned by this task. Existing uncommitted files are not part of an implied P01 commit. No commit or push was performed.
