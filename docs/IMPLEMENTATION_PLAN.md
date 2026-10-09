# IMPLEMENTATION_PLAN.md

> **Status: PROPOSED — NOT APPROVED. No implementation performed.**
> Orchestrator, 2026-10-08. Branch `checkpoint-rebuild` @ `a700123`.
> Builds on approved `docs/DESIGN_PROPOSAL.md` and `docs/AUTH_DESIGN_PROPOSAL.md`.

---

## 1. Decisions Captured

| Decision | Effect |
|---|---|
| **HR creates STAFF accounts** | HR gains create / edit / deactivate **scoped to role `STAFF` only**. HR can never mint `HR` or `SUPERADMIN`. Role assignment stays SUPERADMIN-only (R6 without undoing R1). |
| **Seed fixtures omitted** | `seed.ts` provisions **only the 2 privileged accounts**. The 5 `John Doe`-class STAFF records are removed from seed. |

### Two consequences found while checking these — they must be handled in the plan

**C1 — Removing seed fixtures breaks 4 files.** These hardcode `john.doe@company.com`:

| File | Impact |
|---|---|
| `backend/tests/auth.test.ts:17` | STAFF 403 test dies |
| `backend/tests/user.test.ts:15,41` | STAFF token for 6 tests dies |
| `backend/tests/attendance.test.ts:17,43` | STAFF token for attendance suite dies |
| `backend/test-suite.mjs:60` | (currently staged) script dies |

**Resolution:** tests stop depending on seed data. `tests/setup.ts` provisions its own STAFF fixture in `beforeAll` and removes it in `afterAll`. This is correct practice — automated tests should own their fixtures — and it means the production seed can be minimal without weakening coverage. `backend/test-suite.mjs` gets the same treatment or is retired (see Q4).

**C2 — Omitting from seed does not delete existing rows.** Seed uses `upsert` with `update: {}`. Removing a record from `seed.ts` only stops *future* creation. The 5 rows already in your local database **stay there**. Removing them from the database is a destructive data operation requiring a separate, explicitly approved dry-run. **Not in this plan.** Flagged as Q3.

**C3 — `seed.ts:36-43` hard-requires `STAFF_PASSWORD`.** It throws if the variable is absent. Once STAFF accounts are gone, that requirement must be dropped or the seed still fails. Included in Milestone 1.

---

## 2. Git Foundation

### Branch base — verified facts

```
origin/main  b91b983  (merge of PR #4)
HEAD         a700123  (checkpoint-rebuild = design/linear-migration)
merge-base   28bc135  (feature/prisma-postgresql)

divergence:  1 commit only in origin/main   → b91b983 (the merge commit itself)
             5 commits only in HEAD         → the Linear design migration
local main:  31 behind origin/main, 0 ahead → safe fast-forward, nothing unique
```

`b91b983`'s second parent is `28bc135`, which **is** in our history. So content-wise our branch already contains `origin/main`; only the merge *object* differs. Merging back is trivial — no conflicts expected.

**No local branch contains `origin/main`.** Local `main` is stale and must be fast-forwarded before anything merges into it.

### Branch model — one branch per task

Per `git-workflow`: short-lived feature branches, PRs under ~400 lines, squash-merge to `main`, delete after merge.

| # | Milestone | Branch | Base |
|---|---|---|---|
| 0 | Git foundation + approved specs | `chore/git-foundation` | `checkpoint-rebuild` |
| 1 | Authentication / user-management foundation | `feat/auth-foundation` | M0 |
| 2 | Shared design system (token layer) | `feat/design-tokens` | M0 |
| 3 | Login redesign | `feat/login-redesign` | M2 |
| 4 | Dashboard redesign | `feat/dashboard-redesign` | M2 |
| 5 | Sidebar / navigation | `feat/sidebar-navigation` | M2 |
| 6 | Staff management | `feat/staff-management` | M1 + M5 |
| 7 | HR / Super Admin workflows | `feat/hr-superadmin-workflows` | M6 |
| 8 | Regression testing | `test/regression-suite` | M7 |
| 9 | Security testing | `test/security-suite` | M8 |
| 10 | Final UI/UX verification | `qa/final-uiux-verification` | M9 |

### One deviation from your ordering — please confirm

You listed **2. Login redesign** before **3. Shared design system**. The plan runs the **token layer first**, then Login.

**Why:** the token layer (`index.css` + `tailwind.config.js` value swap) is a *pure value change with no component edits* — every page keeps rendering exactly as today, just through named tokens. Login is then re-tokenised in one pass with zero visual churn. Doing Login first would mean writing it twice: once with raw `slate-*`/`yellow-*` classes, once more when the tokens appear. And every milestone after M3 needs the tokens anyway.

Your priority *intent* is preserved — auth foundation still leads, and the design system remains the shared backbone. Only the position of the token definition moves. **Confirm or override.**

---

## 3. The Stage Protocol (runs at every milestone)

The AI never commits. You do. Every milestone follows this identical sequence.

### Step 1 — Branch
```bash
git checkout <parent-branch>
git checkout -b <branch-for-this-milestone>
```

### Step 2 — Automated gates (AI runs, read-only)
```bash
# Backend
cd backend && npx tsc --noEmit && npx vitest run && cd ..

# Frontend
npx tsc --noEmit
npx eslint src
npx vitest run
npx vite build

# Dev-OS layer gates
bash .agents/scripts/ui-taste-check.sh .    # any *.tsx/*.jsx touched
bash .agents/scripts/env-check.sh .         # any process.env.* touched
bash .agents/scripts/db-check.sh .          # any *.sql touched
bash .agents/scripts/humanize-check.sh <doc> # any docs/*.md touched
```

> **Known blockers in these gates today** (must be fixed in M0 or they mask real failures):
> - `npx eslint .` → 1515 errors from `backend/generated` not being ignored. Use **scoped** `eslint src` / `eslint backend` until M0 fixes the ignore list.
> - `db-check.sh` → **false PASS**; `python3` is a Windows Store stub so RLS extraction silently no-ops.
> - Backend `vitest` **writes rows to Postgres** — I will not run it without your explicit go-ahead each time.

### Step 3 — Staged review (AI presents, you inspect)
The AI reports: files changed, lines added/removed, gate results, anything it could not verify. You review.

```bash
git diff              # full working-tree diff
git diff --staged     # what is about to be committed
git status -sb
```

### Step 4 — You commit (never the AI)
```bash
git add <specific-files-only>        # never `git add -A`
./.agents/scripts/commit.sh
```
The script prompts for: **approval token** (`approve`) → **type** → **message**. It exports `DEVOS_COMMIT_APPROVED=true`, which the pre-commit hook requires, then runs gitleaks + env-check + db-check + ui-taste + humanize on the staged diff.

> **Limitation you should know:** `commit.sh:78` emits `"$commit_type: $commit_message"` — **it cannot produce a scope.** The git-ops standard says `<type>(<scope>): <desc>`, but the script will emit `feat: add the thing`, not `feat(auth): add the thing`.
> Options: **(A)** accept `type: message` and fold the scope into the wording — no tooling change; **(B)** add an optional scope prompt to `commit.sh` — a small tooling change requiring your approval in M0. The commit messages below are written for **(A)**.

### Step 5 — You push
```bash
git push origin <branch>
```
The pre-push hook runs `pre-push-gate.sh`, which gitleaks-scans **only the commits being pushed** (baseline-aware, so legacy findings don't block).

### Step 6 — Merge
Open a PR against `main`, squash-merge, delete the branch. Screenshots required for anything UI-facing.

---

## 4. Milestones

### M0 — Git foundation & approved specs · `chore/git-foundation`

**Scope**
1. Fast-forward local `main` to `origin/main` (`git checkout main && git pull --ff-only origin main`).
2. Commit the three approved documents: `docs/DESIGN_PROPOSAL.md`, `docs/AUTH_DESIGN_PROPOSAL.md`, `docs/IMPLEMENTATION_PLAN.md`.
3. Resolve the pending staged files — `backend/test-suite.mjs` and `check.cjs` are staged; `CURRENT_STATE.md` decision C says test-suite stays untracked while your earlier instruction staged it. **Settle it (Q4).**
4. Fix gate hygiene so later milestones aren't lying to us:
   - `eslint.config.js` — add `backend/generated` to ignores (restores a usable `npm run lint`)
   - `db-check.sh` — make the RLS extraction fail loudly when `python3` is unavailable instead of silently passing
5. Decide **(A)** or **(B)** on commit scopes.

**Exit:** `npm run lint` is meaningful; `db-check.sh` cannot false-pass; all three docs committed; base reconciled.

**Commit:** type `chore` → `add approved design, auth and implementation specs; repair lint and db gate hygiene`

---

### M1 — Authentication / user-management foundation · `feat/auth-foundation` ← *your priority 1*

**Scope — backend only, no design-system dependency**
- **D1** `requirePasswordChange` middleware + allowlist (`change-password`, `logout`, `me`) → `403 PASSWORD_CHANGE_REQUIRED`
- **D2** per-request account load in `authMiddleware` → deactivated tokens die immediately *(no migration)*
- **D4** permission matrix: HR create/edit/deactivate **STAFF-only**; role change SUPERADMIN-only, never self
- **D5** explicit server-side field allowlist replacing `const updates = req.body`
- Guards: no self-deactivate, no self-role-change, no deactivating the last SUPERADMIN
- **S2 fix** — `GET /users/:id` ownership check
- **S4 fix** — admin password-reset endpoint (SUPERADMIN any; HR for STAFF)
- **D7** shared password policy (min 10, max 72, blocklist)
- **D8** `crypto.randomInt` temp credentials
- **D9** `POST /auth/logout`, helmet, per-account login limiter, bcrypt cost 12, shorter TTL
- **D10 tier 1** structured audit events
- **Seed**: drop STAFF fixtures, drop the `STAFF_PASSWORD` hard requirement *(C3)*
- **Tests**: `tests/setup.ts` provisions its own STAFF fixture *(C1)*

**Deferred (needs migration, DBA gate, your approval):** D3 Option B (`passwordChangedAt`), D10 tier 2 (`auth_events` table).

**Exit:** all 15 security test cases from the auth proposal pass; existing 49 still green; `mustChangePassword` enforced server-side.

**Commit:** type `feat` → `enforce mandatory first-login password change and least-privilege user management`

---

### M2 — Shared design system (token layer) · `feat/design-tokens`

**Scope — values only, zero component edits**
- `index.css`: `--canvas`/`--surface-*`/`--ink*`/`--hairline*`/`--accent*` → §5 paper/chrome/brass palette; retire `--auth-*`
- `tailwind.config.js`: remap colour, add the three type tiers (serif/mono/sans), keep spacing + radius verbatim
- 3-tier elevation tokens (§7)
- Dual-polarity brass: `#eab308` chrome-only, `#b45309` paper-only

**Exit:** every page renders pixel-equivalent to today **except** through the new palette; `ui-taste-check` passes; no raw `slate-*`/`stone-*`/`yellow-*` outside token definitions.

**Commit:** type `feat` → `define shared design tokens derived from the Login palette`

**Notes recorded during implementation**

- The raw-token exit rule is met progressively, not in M2. 91 `slate-*`/`stone-*`/`yellow-*` values remain inside components this milestone is not allowed to touch: `Login.tsx` (33) is M3's, and `AddEmployeeModal`/`EditEmployeeModal` (58) are M6's. The two modals already match the palette by accident — `bg-slate-900` is chrome, `bg-yellow-500` with `text-slate-900` is the brass fill with dark ink — so they are correct, just untokenised.
- §14 of the design proposal settles the ordering question: its Phase 1 is this milestone (values only, no component), Phase 2 is the layout shell where the sidebar becomes chrome. The sidebar is therefore paper at the end of M2 and goes dark in M5. That is the approved sequence, not a regression.
- Two measured misses are carried forward rather than papered over:
  1. `placeholder-ink-subtle` on a paper-sunken input measures **4.40:1** against the 4.5 requirement. §9 specifies `#78716c` without stating a ratio for the `#f5f5f4` pairing, and §5.2 measures it only against `#fafaf9` (4.59:1). Affects `.input` and `.input-auth`.
  2. `--ink-tertiary` measures **2.41:1** and §5.2 permits it for decorative and disabled marks only. Seven call sites use it, and five of those carry information (a sidebar timestamp, two table captions, a Profile paragraph, the Schedule weekend label). They belong on `--ink-subtle`. Fixing them is a component edit and lands with the primitives phase.


---

### M3 — Login redesign · `feat/login-redesign` ← *your priority 2*

**Scope**
- Re-tokenise `Login.tsx` (0 tokens → all tokens), fix measured contrast: focus ring **1.84:1 → 4.81:1**, subtext **2.46:1 → 4.59:1**
- Replace the `bg-yellow-500 opacity-5 blur-3xl` radial blob (anti-ai-ui §14)
- Rebuild `SetPassword.jsx` on the same split-screen, killing design language **C** (`auth-*`)
- Wire the M1 `PASSWORD_CHANGE_REQUIRED` interceptor → `/set-password`
- Guard `/set-password`: bounce to role home if `mustChangePassword === false` (S15)
- Unify client/server password policy (S7)

**Exit:** one identity across Login → SetPassword → app entry; contrast table all PASS; auth tests green.

**Commit:** type `feat` → `redesign Login and SetPassword on the approved palette with corrected contrast`

**Notes recorded during implementation**

- Chrome becomes a real surface in M3, not M5: the Login brand panel is the first chrome consumer, so `--chrome*` tokens (§5.1) and their `tailwind.config` keys were added here. M5 adds the sidebar and modal shells **without new colours** — the panel comment in `index.css` now says exactly that.
- `auth-*` is fully retired, not just aliased: SetPassword **and** ErrorBoundary (the only two live consumers, 27 refs) were rebuilt on the system, then `--auth-*`, `.input-auth`, `.btn-auth` and the auth utilities were deleted. Zero `auth-` references remain in `src` or the built CSS. Settings already used `.input`/`.btn-primary`, so it only needed the S7 validation swap below.
- §8.3 input spec pulled forward: `.input` moved from `bg-surface-1`/`bg-hairline` to the approved sunken `bg-surface-2`/`border-hairline-strong`/`ring-accent`. Login and SetPassword use the `.input` primitive, and every in-app form inherits it — one object, not two.
- `.btn-inverse` added as the §8.1 Inverse button (login submit: ink fill, paper label, brass hover) and used at its single correct call site. `active:scale-[0.98]` moved into the `.btn` base (anti-ai-ui §9 / R8 pulled forward one milestone).
- The `ring: 2px` / `ring-offset: 2px` declarations in `index.css` were invalid CSS that the browser dropped — focus rings never rendered at 2px. `*:focus-visible` now `@apply ring-2 ring-accent ring-offset-2 ring-offset-canvas`, which is also what makes the "focus ring 1.84:1 → 4.81:1" fix real.
- The radial blob is replaced by a fine 1px ledger grid (`.chrome-grid`, 64px cells at 10% on chrome) — sanctioned anti-ai-ui §14 replacement, and the grid leans on the ledger metaphor instead of a glow.
- S7 lands in one shared module (`src/utils/passwordPolicy.ts`) that mirrors the backend validator byte-for-byte: min 10 / max 72 bcrypt ceiling / 28-entry blocklist, same message order as zod (length before blocklist). SetPassword and Settings both validate through it; login validation still only requires a non-empty password, exactly as the server allows.
- The M1 interceptor seam is `handleApiError` in `src/api/axios.ts`, which returns the redirect path (`/login`, `/set-password`) so the decision is unit-testable — jsdom cannot follow a `location.href` navigation. The interceptor itself performs the assignment.
- Contrast re-verified for every new pairing: Login subtext 4.59:1 ✓, focus ring 4.81:1 ✓, error text 5.93:1 ✓, brass-on-chrome 9.31:1 ✓, chrome ink tiers 16.36/6.96 ✓, `.btn-inverse` 17.09:1 resting and 9.31:1 hover ✓, accent ring against chrome 3.56:1 (≥3 bar) ✓. The only FAIL is the inherited placeholder 4.40:1 miss, already documented with M2.
- `interceptors.test.js` is new; the auth-routing suite gains the S15 guard (three roles bounced to their own home), the SetPassword policy rejection, and the success path (flag cleared in the stored session, `PUT /users/change-password` payload asserted). `matchMedia` is stubbed in `test/setup.ts` because react-hot-toast consults it the moment the first toast renders.
- Out of scope, unchanged (as agreed): the duplicate `/profile` route, the `text-ink-tertiary` five-site swaps, and Settings' visuals (M4).

---

### M4 — Dashboard redesign · `feat/dashboard-redesign`

**Scope:** `Dashboard`, `HrDashboard`, `SuperAdminDashboard`, `KpiCard`, `AttendanceTable`, `Profile`, `Schedule`, `Settings`, charts.
Asymmetric KPI bento (R10), sticky headers + sort + pagination (R5), skeletons (§17), `active:scale` (R8), drop 49× `uppercase tracking-widest` down to status/code labels only.

**Commit:** type `feat` → `redesign dashboards and data tables on the approved design system`

**Notes recorded during implementation**

- Cut from `feat/login-redesign` at `15be18c`, not from `feat/design-tokens` as the base table says, so M4 inherits the M3 `.input` spec, `.btn` `active:scale`, chrome tokens, and S7 Settings validation. Now that the sidebars are crossed, the M5 cut point only needs to reach back for account-popover chrome tokens, which M3 already supplies.
- Soft tints are implemented as `color-mix` utilities in `index.css` (`.bg-*-soft`, `.border-*-soft`) rather than Tailwind opacity modifiers, which Tailwind silently drops on `var()` colours. The M2 Option 1 leaves were no-ops as a result; every M4 surface that uses a tint renders a real, blended colour. `border-l-warning` was verified present in the emitted CSS after `vite build`.
- Bento composition (R10): new `KpiHero` (two-column, primary figure + action slot) and a dense `KpiCard` with a soft icon square and mono display value. Per-role bentos: STAFF = Weekly Hours + Streak + Attendance Rate (Late Arrivals dropped, §11 3-metrics cap); HR = Clocked In Today + Late Today + Not Yet Clocked Out; SA = Total Employees + Clocked In + Late.
- Tables (R5): sticky header inside a `max-h-[560px]` scroll region, six sortable columns with `aria-sort` and fa6 indicators, pagination at 12/page with a "Showing X–Y of N records" footer, real zebra rows (`bg-surface-2` odd, `bg-surface-3` hover). The HR table sorts exceptions-first: a status-rank key puts LATE above OPEN above CLOSED, and late rows carry `border-l-warning`.
- Page reset lives in the sort click handler, not an effect, to keep `react-hooks/set-state-in-effect` out of the tree. Out-of-range pages are clamped with `safePage = min(page, totalPages)`, so shrinking data (a search narrowing the set) never strands the user on an empty page.
- Two pre-existing chart bugs fixed. HoursChart was reading `clockInTime` off already-aggregated `{ day, hours }` records and drew all-zero bars; it now plots the `data` prop directly. The HR SessionsChart was handed sentence-case labels (`Closed`) that never matched the uppercase `STATUS_COLORS` keys; labels are uppercased before lookup.
- Schedule, Profile, and Settings use sentence-case eyebrows and section titles (role chips keep uppercase: they are codes), real day-cell tints with solid legend dots, and accent dividers written as `opacity-40` — the `/40` modifier is another Tailwind-on-`var()` no-op.
- Skeleton primitives (§17) land in a new `src/components/ui/Skeleton.jsx` with a sibling `Skeleton.d.ts`. The declaration matters: without it, the three TypeScript pages importing `Skeleton` each add a TS7016. Types are exported for `Skeleton`, `BentoSkeleton`, `TableSkeleton(showEmployee)`, `ChartSkeleton`, `CalendarSkeleton`, and `BadgeGridSkeleton`, and their geometry matches the content they replace.
- The fa6 sort indicator is `FaArrowsUpDown` — `FaArrowUpDown` does not exist.
- `attendance-table.test.jsx` adds five cases: default `aria-sort`, date toggle asc → desc, pagination at 12/page plus footer text, `exceptionsFirst` ordering with the border class on late rows, and the empty state. Fixture note: an "on-time" record must use `at(6, 0)`; `at(7, 0)` is already past the 06:30 threshold and reads as late.
- Gate results at commit time: vitest 28/28 (23 prior + 5 new); eslint at the known 5, all in files M4 does not touch; tsc 43 against a 45 baseline (the `Skeleton.d.ts` removed three fresh TS7016s); `vite build` green; ui-taste 25/25; env-check 9/9. The `gitleaks dir` scan flags `backend/.env` (the local `JWT_SECRET`), which is gitignored and untracked, so the git-based pre-push gate never sees it; no path exists for it into a commit.

---

### M5 — Sidebar / navigation · `feat/sidebar-navigation`

**Scope:** `Sidebar.tsx`, `Layout.tsx`, `App.jsx` guards. Chrome becomes the Login brand panel (continuity after sign-in). Replace profile-pill + naked logout with an accessible account popover (R7). Consolidate 5 icon families → `fa6` (R9). Fix route guards: role-aware `/` landing, wrong-role redirect to own home, remove duplicate `/profile` (R12).

**Commit:** type `feat` → `rebuild sidebar and navigation with accessible account menu`

**Notes recorded during implementation**

- Cut from `feat/dashboard-redesign` at `fe7c993`, so M5 builds on M4's bentos and tables with M3's chrome tokens already in place. M3's note predicted this: the account popover only needs chrome tokens, and M3 supplied them.
- The sidebar is a chrome consumer. It uses `bg-chrome` with a `chrome-line` border, the Login brand panel's ledger grid (`chrome-grid opacity-10`), brass signature (top strip, corner brackets, serif wordmark, tagline on `chrome-ink-muted`), and chrome nav states (`chrome-elevated` active + brass left indicator). The mobile drawer scrim and modal surfaces share `--chrome-elevated`; the scrim is a new utility.
- Tailwind dropped `bg-[#0f172a]/55` and `opacity-[0.07]` from the build without warning — the same silent-drop family as M4's `var()` opacity findings. The fix is `.overlay-scrim` (real CSS, `rgba(15,23,42,.55)` per §7) and Login's existing `opacity-10`; both verified present in the emitted CSS.
- R7 account menu: the profile-pill + naked logout row is gone. One trigger button (`aria-expanded`, `aria-haspopup`, `aria-controls`) with a double-chevron that rotates `rotate-180` on open (fa6 has no `FaAnglesUpDown`, so the pair is one glyph flipped), opening a `role="menu"` popover with three `role="menuitem"` entries — My Profile, Settings, Sign out. Keyboard behaviour: first item focused on open, focus returned to the trigger on close, Escape, click-outside, and Arrow Up/Down cycling.
- R9 icon consolidation: four families (`fa`, `fa6`, `sl`, `ci`) collapsed to `react-icons/fa6` in ten files. FA6 renamed three classics — `FaHome`→`FaHouse`, `FaSearch`→`FaMagnifyingGlass`, `FaExclamationTriangle`→`FaTriangleExclamation` — and the sweep had to catch both the import and every JSX usage (two `<FaSearch>` elements in the dashboards were the easy miss).
- R12 route guards: wrong-role visitors now bounce to `roleHome(role)` instead of `/login`; `/` is a role-aware landing (`AuthenticatedHome`); the duplicate `/profile` route declared twice in `App.jsx` is deleted. `auth-routing.test.jsx` wrong-role assertions were updated to the new destinations and a root-landing block asserts each role arrives on its own home.
- Tests: `sidebar-account-menu.test.jsx` adds 9 cases — role-filtered nav for all three roles, `aria-expanded` open/close, Escape, click-outside, arrow-key cycling, sign-out (session cleared, app left), and menu navigation to Settings. Suite is 41/41.
- Gate results at commit time: vitest 41/41, eslint 0 in changed files, tsc 43 against a 43 baseline (the Sidebar `initials` and Layout `children` errors are inherited identities, not new), `vite build` green with the chrome classes and `.overlay-scrim` present, ui-taste 25/25, env-check 9/9.

---

### M6 — Staff management · `feat/staff-management`

**Scope:** `ManageStaff`, `AddEmployeeModal`, `EditEmployeeModal`. Re-tokenise both modals (already slate+gold — now correct by construction). **Open `/manage-staff` to HR** (`SuperAdminRoute` → shared admin route; `Sidebar` roles `['SUPERADMIN','HR']`). Disable rather than hide role-editing for HR — hiding without server enforcement is exactly how S3 happened.

**Commit:** type `feat` → `rebuild staff management for SUPERADMIN and HR with HR scoped to STAFF accounts`

---

### M7 — HR / Super Admin workflows · `feat/hr-superadmin-workflows`

**Scope:** HR exception-first home (late/unrecorded rows with brass left-border), SUPERADMIN monthly report + export, admin password-reset UI, reactivate flow, empty states with real actions.

**Commit:** type `feat` → `complete HR and SUPERADMIN account and attendance workflows`

---

### M8 — Regression testing · `test/regression-suite`

**Scope:** full 49-case backend suite + 12 frontend tests green against the rebuilt UI; snapshot the 15 auth security cases; confirm no functional drift from M1–M7.

**Commit:** type `test` → `add regression coverage for rebuilt authentication and management flows`

---

### M9 — Security testing · `test/security-suite`

**Scope:** the 15 cases in the auth proposal — mandatory-change gate, IDOR, HR escalation, deactivated-token, revocation, policy mismatch, last-admin lockout, entropy, rate limits, headers.

**Commit:** type `test` → `add security suite covering the seventeen authenticated findings`

---

### M10 — Final UI/UX verification · `qa/final-uiux-verification`

**Scope:** human browser walkthrough of all three roles against `DESIGN_PROPOSAL` §10.1–10.3; all 20 anti-ai-ui rules; contrast table re-measured in-browser; `ui-taste-check` 0 violations; `CURRENT_STATE.md` + `AUDIT_REPORT.md` refreshed.

**Commit:** type `chore` → `complete final UI and UX verification against the approved design`

---

## 5. Open Questions

1. **Ordering** — confirm the M2/M3 token-layer-before-Login swap, or override?
2. **Commit scopes** — option **(A)** no tooling change, or **(B)** add an optional scope prompt to `commit.sh`?
3. **Existing seed fixture rows** — 5 STAFF rows sit in your local Postgres. Omitting them from seed leaves them in place. Delete them (destructive, needs a separate dry-run approval), leave them, or leave them and let HR deactivate them through the new UI?
4. **`backend/test-suite.mjs`** — currently staged; it's a hand-rolled script duplicating the vitest suites, and C1 breaks it anyway. Commit it as-is, rework it alongside the fixture change, or drop it in favour of `backend/tests/`?
5. **`check.cjs`** — a 7-line scratch script. Commit or discard?
6. **Backend test execution** — the backend suite writes to Postgres. Confirm I may run it at each gate, or do you want to run it yourself and hand me the output?
7. **Deferred migrations** — D3 Option B (`passwordChangedAt`) and D10 tier 2 (`auth_events`). Approve in principle now so they can be scheduled, or defer until after M10?
8. **Seed STAFF_PASSWORD** — `.env` still carries it. Remove the variable once fixtures are gone?

---

*No code, migration, seed, or database object was modified. Awaiting approval.*
