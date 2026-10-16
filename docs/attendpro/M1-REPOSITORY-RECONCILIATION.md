# AttendPro M1 — Repository Reconciliation Plan

- **Date:** 2026-10-16
- **Milestone:** M1
- **Status:** plan; M1 not approved, M2 not authorized
- **Owner:** Architect Agent (author). Every gate below belongs to the project owner (Engineering Lead).
- **Companions:** `docs/attendpro/DECISION-REGISTER.md` (O13 and section D govern this file), `docs/attendpro/M0-FORENSIC-RECONCILIATION.md`, `docs/attendpro/M0-REALITY-CHECK.md`
- **Baseline commit:** `f87ce1d`

This document is a plan only. No git command was run to produce it, nothing was deleted,
and `src/`, `backend/` and `backend/prisma/migrations` were not touched. Every command
below is a PROPOSED example for a later, authorised step.

---

## 1. Verified repository state versus unverified

Left column: facts this session can attribute to the M0 evidence artefacts or to the
owner's written instruction for the 2026-10-16 review. Right column: everything else,
which stays open until the owner or phase 2 supplies it.

| Verified (with source) | Unverified — to be supplied by the owner, or not yet verified |
|---|---|
| A root repository exists at the project working tree, and a second repository exists at `backend/.git` (M0 forensic F5; reality check §9). | The exact current `git status` of both repositories today. M0 ran on 2026-10-14; two days have passed. |
| The nested repository is on branch `design/linear-migration`, HEAD `7ab73eb`, "feat: migrate backend files to TypeScript" (M0 F5). | Whether the nested HEAD is still `7ab73eb` and the branch still checked out. |
| The nested repository has no remote configured (M0 F5). | The root remote's URL, reachability, and what `origin/main` actually contains. |
| The nested repository held 17 tracked files and 40 dirty paths at M0 (M0 F5). | Whether those 40 dirty paths are still present, and what they contain. |
| The root repository is on `main` with a clean working tree, 6 commits ahead of `origin/main`, none pushed (M0 F6; reality check §9). | Whether the root tree is still clean, and whether the ahead-count is still 6. |
| Nothing has been pushed; the push is held by owner instruction (M0 F6) and by section D of the decision register. | The root remote tracking configuration beyond what M0 recorded. |
| Nothing has been merged between the two repositories (owner instruction, 2026-10-16). | Whether the two histories share any common ancestor commit, and where the merge base sits. |
| The M0 and M1 documents are written at baseline `f87ce1d` (register header). | The register header reads "M0 and M1 documents are written but uncommitted", while the owner's instruction for this review says M0 is committed. Which is true right now is not yet verified; phase 2 resolves it with `git status`. |
| M0's verdicts: 7 of 7 Phase 1 findings reproduced against `f87ce1d`, plus N1–N5 (M0 forensic §6). | The commit lists `git log --oneline -20` from each repository — the owner supplies these in phase 0. |
| Preservation is held, not done: the nested repo was inspected and left untouched (M0 §5 items 6 and 8). | What unique content exists in each history, beyond what section 2 reconstructs. |

Anything in the right column may not be stated as fact in any later document until it
moves left through phase 0 or phase 2 evidence.

---

## 2. Why the two histories exist, and what each contains

**Reconstructed from the M0 documents. Not confirmed by inspection in this session.**

M0 recorded the shape of the anomaly (forensic F5, reality check §9) but did not explain
its origin. The reconstruction below is the reading that fits the recorded evidence:

1. `backend/.git` is a full second repository inside the backend directory, created at
   some point by a `git init` inside `backend/` or by a separate clone landing there. The
   branch name `design/linear-migration` and the HEAD message "feat: migrate backend files
   to TypeScript" suggest it was opened to carry a TypeScript migration of the backend
   files as its own line of work. *(Reconstructed.)*
2. While that second repository held the backend files, the root repository continued on
   `main`, and the two histories grew side by side with no remote on the nested one and no
   merge between them. *(Reconstructed from F5 and F6 plus the owner's "nothing has been
   merged".)*
3. What the nested history actually contains — how many commits, whether any of them
   overlap with root `main`, and whether the backend TypeScript files on disk come from
   the nested commits or from root commits — is not established. The M0 count of 17
   tracked files in the nested repo says how much is recorded there, not how much of it is
   unique. *(Not yet verified; phase 0 and phase 2 decide it.)*
4. The root `main` holds the six unpushed commits and, at minimum, the state that M0
   examined against `f87ce1d`. Whether the six commits touch `backend/` in ways that
   collide with the nested history is not yet verified. *(Not yet verified.)*

The point of section 3 is to replace this reconstruction with observed output before any
history is moved.

---

## 3. The plan

Nine phases. Each lists PROPOSED commands, the condition that stops the phase, and who
authorises moving on. No phase may be started before the previous one has a recorded
result.

### Phase 0 — Obtain the owner's commit logs

**Purpose.** O13 puts the two `git log --oneline -20` outputs in the owner's hands.

**PROPOSED commands for the owner to run and paste back:**

```bash
git log --oneline -20          # in the repository root
git -C backend log --oneline -20   # in the nested repository
```

**Stops if:** either output is missing. Reconciliation halts here and stays halted; no
later phase may begin on assumption or on remembered output.

**Authorises proceeding:** the owner, by supplying both outputs and confirming they were
taken on 2026-10-16.

### Phase 1 — Back up both histories, outside the working tree

**Purpose.** O13 requires backups before any reconciliation step. Both repositories are
preserved as immutable copies before anything is inspected for change.

**PROPOSED commands (target directory chosen and approved by the owner, outside the
project tree — for example a dated folder under the user's own backup area):**

```bash
# PROPOSED — not run
git bundle create "<BACKUP_DIR>/root-all-2026-10-16.bundle" --all
git -C backend bundle create "<BACKUP_DIR>/nested-all-2026-10-16.bundle" --all
git -C backend diff > "<BACKUP_DIR>/nested-uncommitted-2026-10-16.patch"
git status --porcelain > "<BACKUP_DIR>/root-status-2026-10-16.txt"
git -C backend status --porcelain > "<BACKUP_DIR>/nested-status-2026-10-16.txt"
git bundle verify "<BACKUP_DIR>/root-all-2026-10-16.bundle"
git bundle verify "<BACKUP_DIR>/nested-all-2026-10-16.bundle"
```

The dirty-patch line exists because M0 recorded 40 dirty paths in the nested working
tree; those changes are not in any commit and a bundle alone would not carry them.

**Stops if:** `git bundle verify` fails, the backup directory is inside the project tree,
or either status snapshot cannot be written. Nothing in phase 2 begins until both bundles
verify.

**Authorises proceeding:** the owner, by confirming the backup location and the verify
output.

### Phase 2 — Read-only inspection

**Purpose.** O13 requires remotes, uncommitted changes, `git log --oneline` comparison and
merge-base comparison. Every command here is read-only.

**PROPOSED commands:**

```bash
# PROPOSED — not run
git remote -v; git status -sb; git branch -vv; git log --oneline -20
git -C backend remote -v; git -C backend status -sb
git -C backend branch -vv; git -C backend log --oneline -20
git merge-base <root-sha> <nested-sha>        # if a common ancestor exists
git log --oneline <root-sha>..<nested-sha>    # what the nested history adds
git log --oneline <nested-sha>..<root-sha>    # what the root history adds
git diff --stat <root-sha> <nested-sha>
```

The two `<root-sha>` / `<nested-sha>` values come from the owner's phase 0 output, not
from memory.

**Stops if:** any command is not read-only, if `merge-base` reports no common ancestor,
if the working trees are dirty in a way phase 1 did not snapshot, or if the observed logs
contradict section 2. A contradiction is written down and reported; it is never papered
over.

**Authorises proceeding:** the Orchestrator records the comparison; the owner signs it off
as the input to phase 3.

### Phase 3 — Decide the source of truth (owner decision gate)

**Purpose.** O13 requires identifying the source of truth. This plan does not choose it.

**PROPOSED output:** a written entry in `docs/attendpro/DECISION-REGISTER.md` naming the
chosen source, the rejected option, and the reason, dated 2026-10-16, added through the
normal review path. The options and the provisional recommendation are in §6.

**Stops if:** no written decision exists. Every later phase stays closed; a verbal or
assumed choice does not open the gate.

**Authorises proceeding:** the owner, and only the owner.

### Phase 4 — Open a new reconciliation branch

**Purpose.** O13 requires reconciliation on a new branch, never on `main`.

**PROPOSED commands:**

```bash
# PROPOSED — not run
git switch -c reconcile/m1-2026-10-16 <base-from-phase-3>
```

**Stops if:** the branch cannot be created from the phase 3 base, if creating it would
require switching the nested repository's checkout, or if `main` would have to move. The
nested checkout stays exactly as it is until phase 3 is signed off and its own branch
strategy is written down.

**Authorises proceeding:** the owner, confirming the base SHA written in phase 3.

### Phase 5 — Replay or cherry-pick the chosen history

**Purpose.** Bring the agreed commits onto the reconciliation branch without altering
either original history.

**PROPOSED commands:**

```bash
# PROPOSED — not run
git cherry-pick <sha> <sha> ...        # individual commits from the secondary history
git diff <source-sha> <reconciled-sha>  # what the replay changed
```

An alternative, merging the secondary history into the reconciliation branch, is a
proposal the owner may pick in phase 3; it is still confined to the reconciliation
branch and still never touches `main`.

**Stops if:** a conflict cannot be resolved without discarding either side's work, if a
commit would have to be dropped, or if the replay would require `--force`, `-f`, a reset
on `main`, or a deletion. Conflicts are reported with both versions preserved.

**Authorises proceeding:** the owner, after reading the conflict list and the diff
summary.

### Phase 6 — Verification

**Purpose.** Prove the reconciled branch behaves like the histories it came from.

**PROPOSED checks:**

```bash
# PROPOSED — not run
npm run build                  # root, Vite
npx tsc --noEmit               # root — compare against M0's 43 errors, no new ones
npm run lint
npx tsc --noEmit               # in backend/ — M0 recorded exit 0
git diff --stat main...reconcile/m1-2026-10-16
```

Two known baselines from M0 carry into this phase. The root type check had 43 errors
across seven files, so the gate is "no errors beyond that count", not "zero". The backend
suite writes to whatever `DATABASE_URL` names and M0 left the isolated test database open
(decision register: PRD §22 item 5; O14), so **backend tests do not run in this phase
until an owner-approved `_test` database exists**. Running them against the development
database is not an acceptable substitute.

**Stops if:** the build fails, the type check exceeds the M0 baseline, lint fails, the
diff shows changes outside what phase 3 authorised, or someone proposes running the
backend suite against the development database.

**Authorises proceeding:** QA reads the diff against the phase 3 decision; the owner
approves.

### Phase 7 — Approval gate

**Purpose.** Nothing reaches a remote without a written yes.

**Stops if:** approval is verbal, conditional on unlisted work, or given before the phase
6 output was read.

**Authorises proceeding:** the owner, in writing, referencing the reconciliation branch
name and the phase 6 result.

### Phase 8 — Push

**Purpose.** Publish the reconciliation branch only.

**PROPOSED command:**

```bash
# PROPOSED — not run
git push origin reconcile/m1-2026-10-16
```

**Stops if:** phase 7 approval is absent, if the push target is `main`, if the push would
be non-fast-forward, or if anyone reaches for `--force` or `+`. The nested repository has
no remote (M0 F5), so pushing it anywhere is a new decision requiring its own approval.

**Authorises proceeding:** the owner, per section D ("do not push to `origin` until the
owner approves").

---

## 4. Hard prohibitions

Checklist. Each item stays checked-off-by-absence: any tick means the plan was broken and
work halts for the owner.

- [ ] No force-push, no `--force`, no `-f`, no `+ref:ref` pushspec, at any point.
- [ ] No deleting branches, tags, bundles, or history without the owner's written approval.
- [ ] No rewriting `main` — no reset, no rebase, no commit rewrite on `main`.
- [ ] No touching the nested repository's checkout (no `switch`, no `stash`, no `clean`)
      until the phase 3 source-of-truth decision is written down.
- [ ] No migration work of any kind as part of reconciliation: no new migration, no edit
      to `backend/prisma/migrations`, no dropping, no `migrate reset`.
- [ ] No production or destructive database action, and no backend test run against the
      development database.
- [ ] No merge of either repository into the other before the phase 3 gate.
- [ ] No push to `origin` before the phase 7 approval and phase 8 authorisation.
- [ ] No deletion of the nested `backend/.git`, the bundles, or the phase 1 snapshots.

---

## 5. Risks and what a wrong choice costs

| Risk | Cost if it happens | Mitigation |
|---|---|---|
| Wrong source of truth chosen in phase 3 | The winning history is built on the wrong base; the other history's unique commits end up as orphaned or reverted work, and the correction means redoing phases 4 to 6. | Phase 1 bundles make both histories recoverable; phase 2 diff shows what each side adds; phase 3 is a written owner decision; phase 6 diff review catches a replay of the wrong side. |
| The histories share no common ancestor | Cherry-picks collide file-by-file and every conflict has to be judged by hand, with a real chance of silently dropping a change. | `git merge-base` in phase 2 reports this before phase 4 opens; the phase 3 decision then includes how to handle a disjoint pair. |
| The 40 dirty paths in the nested working tree are uncommitted work | Those edits are lost by any checkout or clean, and no bundle would contain them. | Phase 1 captures them as a `.patch` file outside the tree before anything else runs; the prohibition on touching the nested checkout stays until phase 3. |
| Backend tests run against the development database during verification | Attendance and user rows in the development database are modified or deleted, and the damage is blamed on git. | Phase 6 blocks backend tests until an approved `_test` database exists (O14, PRD §22 item 5); only build, typecheck and lint run. |
| Force-push or a `main` rewrite | Remote history and any cloned copies are permanently altered; six unpushed root commits could be lost. | Prohibition checklist §4; push targets the reconciliation branch only, and the phase 1 bundles are the recovery path. |
| Backup written inside the working tree | The backup becomes an untracked path that a later commit or clean could remove, so the safety net disappears with the accident. | Phase 1 stops if the target directory is under the project tree; verify output is recorded before phase 2. |
| Frontend type errors treated as a new regression | Verification either fails outright and blocks the plan, or the 43 known errors hide a handful of genuine new ones. | Phase 6 compares against the M0 count of 43 across the same seven files, and rejects only new errors. |
| Uncommitted M0 and M1 documents mix into reconciliation commits | Design evidence ends up inside replay commits and the baseline `f87ce1d` stops being readable as a clean reference. | Phase 2 records the document status; the owner commits or explicitly parks the documents through `.agents/scripts/commit.sh` before phase 4, as a separate step from reconciliation. |

---

## 6. Open decisions for the owner

### R9 — Forward-only migrations or a fresh database

Carried from the decision register §C, to be settled after M0.

| Option | What it means |
|---|---|
| (a) Forward-only migrations on the existing database | Keep `20261005000000_init` and the data in place; add new migrations for tenancy, RLS, the status vocabulary, and the cascade change. |
| (b) Rebuild on a fresh database | Create a new database, write the corrected schema as one clean migration, and load or discard existing rows. |

**M0-based recommendation:** (a) forward-only. M0 found exactly one migration with no
destructive history to unwind, and the register records that forward-only is viable with
the bootstrap business row and RLS. The cost of (b) is a data-migration question (O18)
that no evidence has forced yet.

**Scope note:** this decision is recorded here because it was asked for; acting on either
option is migration work and is excluded from this plan by §4.

### Source of truth for the two repositories

| Option | What it means |
|---|---|
| (a) Root `main` is the source of truth | The nested `design/linear-migration` commits are cherry-picked onto a reconciliation branch off `main`; the nested repo stays as an archive. |
| (b) Nested `design/linear-migration` is the source of truth | The root's six unpushed commits are replayed onto a branch derived from the nested history. |
| (c) Both, as a union on a new branch | Neither side is declared primary; the phase 2 comparison identifies unique commits on each side and they are replayed together onto `reconcile/m1-2026-10-16`. |

**Provisional recommendation:** (c), with (a) as the fallback if phase 2 shows the nested
history is a subset of the root. The root carries the unpushed work and the `origin`
relationship, which makes it the safer base, and the nested repository has no remote to
protect — but this stays provisional until the phase 0 logs and the phase 2 merge-base
result exist. The owner confirms or replaces it in phase 3.

---

## 7. Requirement-to-mechanism map (O13)

| O13 clause | Where this plan satisfies it |
|---|---|
| Do not merge yet | §4 prohibition; phase 3 gate precedes any history movement; merge is only ever a phase 5 option on the reconciliation branch |
| Back up both histories first | Phase 1, including the uncommitted dirty patch |
| Inspect remotes and uncommitted changes before any reconciliation step | Phase 2, ahead of phases 4 and 5 |
| Compare `git log --oneline` across both repositories | Phase 0 (owner supplies) and phase 2 (comparison) |
| Compare merge bases | Phase 2, `git merge-base` and the two range logs |
| Identify the source of truth | Phase 3, as a written owner decision; options in §6 |
| Reconcile on a new branch, never on `main` | Phases 4 and 5; §4 prohibition on rewriting `main` |
| Avoid force-push | §4 prohibition; phase 8 stop condition |
| Delete nothing without explicit approval | §4 prohibition; phases 1, 5 and 8 stop conditions |
| Owner supplies `git log --oneline -20` from each repository | Phase 0, the entry gate |
| Section D: no push to `origin` until the owner approves | Phase 7 approval gate and phase 8 |
| Section D: no repository merges or destructive actions without explicit authorization | §4 prohibition list in full |
