#!/bin/bash

# Dev-OS Pre-Push Secret Gate
#
# Scans ONLY the commits being pushed, not the whole history. Legacy findings
# recorded in .gitleaks-baseline are ignored so they cannot block a push, while
# any secret introduced by a new commit stops the push dead.
#
# Why this exists: the pre-commit gate scans the staged diff, which does not see
# secrets that arrive through rebase, merge, amend, or a branch cut from an old
# commit. This hook closes that gap at the last point before data leaves the
# machine.

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "$REPO_ROOT" ] && cd "$REPO_ROOT" || true

# ── Locate gitleaks ──────────────────────────────────────────────────────────
GITLEAKS_EXEC=""
if command -v gitleaks >/dev/null 2>&1; then
    GITLEAKS_EXEC="gitleaks"
elif [ -x ".agents/bin/gitleaks" ]; then
    GITLEAKS_EXEC=".agents/bin/gitleaks"
elif [ -n "${REPO_ROOT:-}" ] && [ -x "$REPO_ROOT/.agents/bin/gitleaks" ]; then
    GITLEAKS_EXEC="$REPO_ROOT/.agents/bin/gitleaks"
fi

if [ -z "$GITLEAKS_EXEC" ]; then
    echo "[ WARN ] Pre-push gate: gitleaks not found. History was NOT scanned."
    echo "[ WARN ] Install gitleaks or re-run .agents/scripts/install-hooks.sh"
    exit 0
fi

ZERO_SHA="0000000000000000000000000000000000000000"
BASELINE_ARGS=()
[ -f ".gitleaks-baseline" ] && BASELINE_ARGS=(--baseline-path ".gitleaks-baseline")

echo "[ INFO ] Dev-OS pre-push secret gate: scanning commits to be pushed..."

FAILED=0
SCANNED=0

# git push passes one line per ref: <local ref> <local sha> <remote ref> <remote sha>
while read -r LOCAL_REF LOCAL_SHA REMOTE_REF REMOTE_SHA; do
    [ -z "${LOCAL_SHA:-}" ] && continue

    # Deleting a remote ref: nothing to scan.
    [ "$LOCAL_SHA" = "$ZERO_SHA" ] && continue

    # New branch or first push: scan commits not already on any remote.
    if [ -z "${REMOTE_SHA:-}" ] || [ "$REMOTE_SHA" = "$ZERO_SHA" ]; then
        RANGE_OPT="$LOCAL_SHA --not --remotes"
    else
        RANGE_OPT="$REMOTE_SHA..$LOCAL_SHA"
    fi

    # Nothing new ahead of the remote.
    NEW_COUNT="$(git log --format=%H $RANGE_OPT 2>/dev/null | wc -l | tr -d ' ')"
    if [ "${NEW_COUNT:-0}" -eq 0 ]; then
        continue
    fi

    SCANNED=$((SCANNED + NEW_COUNT))

    if ! "$GITLEAKS_EXEC" git . --log-opts="$RANGE_OPT" --redact=100 \
        "${BASELINE_ARGS[@]}" >/dev/null 2>&1; then
        echo ""
        echo "[ FAIL ] PRE-PUSH SECRET SCAN: hardcoded secret detected in commits being pushed."
        echo "         Ref:    $LOCAL_REF"
        echo "         Range:  $RANGE_OPT ($NEW_COUNT commit(s))"
        echo "         Fix:    remove the secret, commit, then push again."
        echo "         NOTE:   if the secret is already committed, rotating the"
        echo "                 credential is the real fix. History rewrite is a"
        echo "                 separate decision requiring explicit approval."
        echo ""
        FAILED=1
    fi
done

if [ "$SCANNED" -eq 0 ]; then
    echo "[ OK ] Pre-push gate: no new commits to scan."
    exit 0
fi

if [ "$FAILED" -ne 0 ]; then
    exit 1
fi

echo "[ OK ] Pre-push gate: $SCANNED commit(s) scanned, no secrets found."
exit 0
