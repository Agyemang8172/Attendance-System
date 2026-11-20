# Phase 1 Git recovery record — 2026-11-16

Non-destructive recovery only. No commit, push, migration or RLS change was performed.

## Verified history

```text
5c5542c  fix(shifts): recover definition contracts and workflow   (previous detached HEAD)
   |
ed6410c  feat(assignments): complete P11.2 effective-dated assignment lifecycle backend
   |     (branch tip, codex/attendpro-phased-delivery)
d89133f  test(backend): baseline failure fix group 1 ...          (reflog-only; actually the
         full 124-path platform snapshot, mislabeled as Group 1)
```

- `ed6410c` is reachable from `codex/attendpro-phased-delivery` and is now also pinned by
  `recovery/p112-backend-ed6410c`.
- `d89133f` had no branch. It is now pinned by `recovery/platform-snapshot-d89133f`.
- No separate commits for Groups 1–4 exist. The reused hashes in earlier reports were
  incorrect; `b4cc2b6` is an older attendance-recovery commit, not a platform group.
- Cause of the backward move: an earlier agent committed the whole shared index as
  `d89133f`, then ran `git reset --hard ed6410c` and checked out `5c5542c` (detached).
  No server-side event was involved.

## Preservation refs

| Ref | Commit |
|---|---|
| `refs/heads/codex/attendpro-phased-delivery` | `ed6410c815ad3225b00ff2e45131b70b49122675` |
| `refs/heads/recovery/p112-backend-ed6410c` | `ed6410c815ad3225b00ff2e45131b70b49122675` |
| `refs/heads/recovery/platform-snapshot-d89133f` | `d89133fe38d246f99e78e8520a829c943614a622` |
| `refs/heads/recovery/m10-committed-baseline` (pre-existing) | `18045823cc64eecfbac4b48d9dab4cf497c7fa0e` |

## Backup of untracked documents

Location: `C:/Users/USER/AppData/Local/Temp/opencode/p11-phase1-backup/`
(original relative paths preserved; `SHA256SUMS.txt` verified OK after the branch switch).

| Document | SHA-256 |
|---|---|
| `docs/attendpro/P11.2-ASSIGNMENT-UI-DESIGN.md` | `7c62d90d…42a182` |
| `docs/attendpro/P11A-EMPLOYEE-WEEKLY-SCHEDULES-TECHNICAL-DESIGN.md` | `046d38bb…94153d` |
| `docs/attendpro/STAGED-PLATFORM-CLASSIFICATION-2026-11-15.md` | `5d1afe1f…205bfa` |
| `docs/superpowers/plans/2026-11-15-attendpro-p11-2-assignment-ui.md` | `10a092e5…345177` |

Reflog, `git show-ref`, `git fsck --dangling`, worktree list, status and a copy of
`.git/logs` are stored under `git-meta/` in the same backup directory.

## Discarded unstaged edits — recoverable vs. lost

The reset discarded worktree-only edits. Everything that had been staged survives inside
`d89133f`; the following did not, and no editor history or dangling blob contains them.
VS Code local history has no entries for these paths.

| File | Lost content | Status |
|---|---|---|
| `backend/docs/swagger.ts` | Three hunks removing `shiftId` from user schemas (P11.1 contract cleanup) | **Lost** — `d89133f` still contains all three `shiftId` lines |
| `backend/scripts/verify-auth.ts` | One line `delete process.env.DATABASE_URL_APP` | **Lost** — absent from `ed6410c` and `d89133f` |
| `src/__tests__/admin-flows.test.jsx` | Two-line `success: true` fix in the shared `paginated` mock | **Lost** — `d89133f` mock still lacks it; fix is documented and re-appliable |
| `docs/attendpro/M1-API-CONTRACTS.md` | P11a schedule endpoint and `shiftId`-refusal rows | **Lost** — recoverable in intent from the P11a design doc |
| `docs/attendpro/M1-ROLE-EXPERIENCES.md` | P11a employee-schedule paragraphs | **Lost** — same |
| `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md` | P11a matrix row | **Lost** — same |
| `docs/attendpro/PHASED-IMPLEMENTATION-PLAN.md` | P11a section and P16 `DependsOn` change | **Lost** — same |
| `docs/attendpro/P05-DETAIL-CONTEXT-CONTRACTS.md` | One-line `shiftId` correction in employee-detail overview | **Lost** — `d89133f` still lists `shiftId` |
| `docs/attendpro/P03-CONTRACT-FIXTURES.md` | Unknown single-file edit (never staged) | **Lost** — content unknown |

Not lost: `admin-flows.test.jsx`'s staged suite, `PHASED-IMPLEMENTATION-PLAN.md`'s staged
add, the M1 REC-06 staged notes, and all P11.2 governance records (`TASK_BOARD`,
`CURRENT_STATE`, handoff, lessons) are present in `ed6410c`/`d89133f`.

None of the lost items is part of Groups 5–11. The P11a documentation rows belong to the
deferred P11a slice; the swagger and P05 corrections are P11.1 cleanup follow-ups.

## Final state after Phase 1

- Branch: `codex/attendpro-phased-delivery`, HEAD `ed6410c`
- Staged: 0 paths
- Unstaged tracked: 0 paths
- Untracked: the four preserved documents plus this record and the security finding
- Remote: untouched (`origin/main` at `acc0ff5`); nothing pushed

## Proposed DevOS Git safety controls

1. **Destructive operations require explicit owner approval per invocation:** `reset --hard`,
   `clean -fd`, `checkout --force`, `restore` over modifications, force-push and history
   rewriting. Default to refusing.
2. **No shared-index batch commits.** Compose each commit from a temporary `GIT_INDEX_FILE`
   containing only the reviewed paths. Never commit whatever happens to be in the index.
3. **Verify before reporting.** After every commit, print `git show --stat`, confirm the
   commit is reachable from the intended branch (`git branch --contains`), and compare the
   path count to the approved group. Do not report a hash that has not been re-read.
4. **Record the slice baseline first.** Capture the starting commit and the working-tree
   state (staged/unstaged/untracked) before implementation begins, and diff against it.
5. **Preserve work in place.** Never discard staged, unstaged or untracked changes. Back up
   untracked documents off-tree before any branch operation.
6. **Isolate slices.** Use a dedicated branch or worktree per slice; keep the shared
   checkout on the intended branch.
7. **Pin recoverable state.** Before any risky sequence, create `recovery/*` refs for every
   commit or snapshot that might become unreachable, and save reflog/fsck metadata.
