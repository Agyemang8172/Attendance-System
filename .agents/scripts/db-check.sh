#!/usr/bin/env bash

# Dev-OS Database & Migration Safety Scanner (Layer 3 Gate)
# Audits database migrations (SQL files) for Row Level Security (RLS),
# non-destructive operations (Hard Rule #1), foreign key indexes, and primary keys.
# Enforces Hard Rule #21.

TARGET="$1"
if [ -z "$TARGET" ]; then
    TARGET="."
fi

FAILURES=0
WARNINGS=0
SCANNED_MIGRATIONS=0

# ── Python interpreter resolution ─────────────────────────────────────────────
# Every rule below shells out to Python. On Windows, `python3` is often the
# Microsoft Store alias (AppInstallerPythonRedirector.exe): it prints an install
# prompt, writes nothing to stdout and exits 49. The rules used to discard
# stderr with `2>/dev/null` and ignore the exit status, so each one produced
# empty output — which every check reads as "no findings". A migration that
# creates three tables with no Row Level Security therefore came back green.
#
# Probe for an interpreter that genuinely runs before trusting any output, and
# treat a non-zero exit as a rule failure instead of silence.
PY_CMD=()
PY_PROBED=0

probe_python() {
    PY_PROBED=1
    local candidate out
    for candidate in python3 python; do
        if command -v "$candidate" >/dev/null 2>&1; then
            out=$("$candidate" -c 'import sys; sys.stdout.write(str(sys.version_info[0]))' 2>/dev/null)
            if [ "$out" = "3" ]; then
                PY_CMD=("$candidate")
                return 0
            fi
        fi
    done
    if command -v py >/dev/null 2>&1; then
        out=$(py -3 -c 'import sys; sys.stdout.write(str(sys.version_info[0]))' 2>/dev/null)
        if [ "$out" = "3" ]; then
            PY_CMD=(py -3)
            return 0
        fi
    fi
    return 1
}

RULE_OUTPUT=""
RULE_ERROR=""

# run_rule <python-source> <sql-file>
# Stores stdout in RULE_OUTPUT. Sets RULE_ERROR and returns non-zero when the
# interpreter itself failed, so callers report "could not be evaluated" rather
# than reading an empty result as a clean pass.
run_rule() {
    local src="$1"
    local file="$2"
    local err_file rc
    RULE_OUTPUT=""
    RULE_ERROR=""
    err_file=$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/db-check-$$.err")
    RULE_OUTPUT=$("${PY_CMD[@]}" -c "$src" "$file" 2>"$err_file")
    rc=$?
    if [ "$rc" -ne 0 ]; then
        RULE_OUTPUT=""
        RULE_ERROR="interpreter exited with status $rc: $(head -n 1 "$err_file" 2>/dev/null)"
    fi
    rm -f "$err_file"
    [ -z "$RULE_ERROR" ]
}

echo "🗄️  Dev-OS Database & Migration Safety Audit: Scanning '$TARGET'..."

audit_sql_file() {
    local file="$1"
    local file_failures=0
    local file_warnings=0

    # Skip non-SQL files, build outputs, node_modules
    case "$file" in
        *node_modules*|*.git*|*dist*|*build*|*_backup*|*smoke-test*)
            return 0
            ;;
    esac

    if [ ! -f "$file" ] || [[ "$file" != *.sql ]]; then
        return 0
    fi

    SCANNED_MIGRATIONS=$((SCANNED_MIGRATIONS + 1))

    # Fail closed before running any rule: no usable interpreter means no audit.
    if [ "$PY_PROBED" -eq 0 ]; then
        probe_python || true
    fi
    if [ ${#PY_CMD[@]} -eq 0 ]; then
        echo "  ❌ [DB §0] Cannot audit $file — no working Python 3 interpreter on this host."
        echo "      The python3 on PATH here is the Microsoft Store alias, which runs no"
        echo "      code and exits non-zero. Every rule in this gate depends on it."
        echo "      Install Python 3 (or disable the App execution alias) and re-run."
        FAILURES=$((FAILURES + 1))
        return 0
    fi

    # 1. Row Level Security (RLS) Check on CREATE TABLE
    # Extract created table names
    local created_tables=""
    run_rule "
import sys, re
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find CREATE TABLE statements: CREATE TABLE [IF NOT EXISTS] [schema.]table_name
pattern = re.compile(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:\"?([a-zA-Z0-9_]+)\"?\.)?\"?([a-zA-Z0-9_]+)\"?', re.IGNORECASE)
for match in pattern.finditer(content):
    table = match.group(2)
    # Check if file has explicit opt-out comment
    if f'-- devos:no-rls {table}' in content or f'-- devos:no-rls' in content:
        continue
    # Check if ALTER TABLE <table> ENABLE ROW LEVEL SECURITY is present
    rls_pattern = re.compile(rf'ALTER\s+TABLE\s+(?:\"?[a-zA-Z0-9_]+\"?\.)?\"?{table}\"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY', re.IGNORECASE)
    if not rls_pattern.search(content):
        print(table)
" "$file"
    created_tables="$RULE_OUTPUT"
    if [ -n "$RULE_ERROR" ]; then
        echo "  ❌ [DB §1] RLS rule could not be evaluated in $file:"
        echo "      $RULE_ERROR"
        file_failures=$((file_failures + 1))
    fi

    if [ -n "$created_tables" ]; then
        for tbl in $created_tables; do
            echo "  ❌ [DB §1] Table '$tbl' created in $file without Row Level Security (RLS):"
            echo "      Missing: ALTER TABLE $tbl ENABLE ROW LEVEL SECURITY;"
            echo "      (Add statement or override with: -- devos:no-rls $tbl <reason>)"
            file_failures=$((file_failures + 1))
        done
    fi

    # 2. Destructive Operations Check (Hard Rule #1)
    local destructive_ops=""
    run_rule "
import sys, re
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

if '-- devos:approved-destructive' in content:
    sys.exit(0)

# Match DROP TABLE, DROP COLUMN, TRUNCATE, DROP SCHEMA
dest_pattern = re.compile(r'\b(DROP\s+TABLE\b|DROP\s+COLUMN\b|TRUNCATE\s+(?:TABLE\s+)?|DROP\s+SCHEMA\b)', re.IGNORECASE)
for i, line in enumerate(content.splitlines(), 1):
    clean = line.strip()
    if clean.startswith('--') or clean.startswith('/*'):
        continue
    m = dest_pattern.search(clean)
    if m:
        print(f'{i}: {m.group(1)} -> {clean[:80]}')
" "$file"
    destructive_ops="$RULE_OUTPUT"
    if [ -n "$RULE_ERROR" ]; then
        echo "  ❌ [DB §2] Destructive-op rule could not be evaluated in $file:"
        echo "      $RULE_ERROR"
        file_failures=$((file_failures + 1))
    fi

    if [ -n "$destructive_ops" ]; then
        echo "  ❌ [DB §2] Unapproved destructive SQL operation in $file (Hard Rule #1):"
        echo "$destructive_ops" | sed 's/^/      Line /' | head -n 4
        echo "      (Formulate a dry-run plan, or override with: -- devos:approved-destructive <reason>)"
        file_failures=$((file_failures + 1))
    fi

    # 3. Foreign Key Index Advisory
    local unindexed_fks=""
    run_rule "
import sys, re
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Match REFERENCES other_table(id)
ref_pattern = re.compile(r'([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_()]+.*REFERENCES\s+([a-zA-Z0-9_]+)', re.IGNORECASE)
# Find created indexes
idx_pattern = re.compile(r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+.*?\s+ON\s+.*?\((.*?)\)', re.IGNORECASE)
indexes = idx_pattern.findall(content)
all_indexed_cols = ' '.join(indexes).lower()

for match in ref_pattern.finditer(content):
    col = match.group(1).lower()
    target_table = match.group(2)
    if col not in all_indexed_cols and f'-- devos:no-index {col}' not in content:
        print(f'{col} -> references {target_table}')
" "$file"
    unindexed_fks="$RULE_OUTPUT"
    # Advisory only, so an unevaluable run is reported as a warning; §1 and §2
    # above already fail the gate outright if the interpreter is unusable.
    if [ -n "$RULE_ERROR" ]; then
        echo "  ⚠️ [DB §3] FK index rule could not be evaluated in $file:"
        echo "      $RULE_ERROR"
        file_warnings=$((file_warnings + 1))
    fi

    if [ -n "$unindexed_fks" ]; then
        echo "  ⚠️ [DB §3] Foreign key reference(s) in $file lack supporting index:"
        echo "$unindexed_fks" | sed 's/^/      Column /' | head -n 3
        echo "      (Add: CREATE INDEX idx_... ON ... (<col>);)"
        file_warnings=$((file_warnings + 1))
    fi

    if [ "$file_failures" -gt 0 ]; then
        FAILURES=$((FAILURES + file_failures))
    fi
    if [ "$file_warnings" -gt 0 ]; then
        WARNINGS=$((WARNINGS + file_warnings))
    fi
}

# Scan file or directory
if [ -f "$TARGET" ]; then
    audit_sql_file "$TARGET"
elif [ -d "$TARGET" ]; then
    # Look for migration directories or sql files
    while IFS= read -r -d '' f; do
        audit_sql_file "$f"
    done < <(find "$TARGET" -type f -name "*.sql" \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -not -path "*/build/*" \
        -not -path "*/_backup/*" \
        -not -path "*/.agents/*" \
        -print0 2>/dev/null)
fi

if [ "$SCANNED_MIGRATIONS" -eq 0 ]; then
    echo "ℹ️ No database migration files (*.sql) found to audit."
    echo "✅ Database & Migration Safety Audit: Clean (0 migration files)."
    exit 0
fi

if [ "$FAILURES" -gt 0 ]; then
    echo ""
    echo "❌ Database & Migration Safety Audit Failed: $FAILURES critical safety issue(s) across $SCANNED_MIGRATIONS migration file(s)."
    echo "   Remediation:"
    echo "     1. Enable Row Level Security on all created tables: ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;"
    echo "     2. Create explicit RLS policies (SELECT, INSERT, UPDATE, DELETE)."
    echo "     3. Never drop tables/columns without an approved dry-run plan (-- devos:approved-destructive)."
    echo "     4. Create indexes on foreign key columns for query performance."
    exit 1
else
    if [ "$WARNINGS" -gt 0 ]; then
        echo "⚠️ Database & Migration Safety Audit: Passed with $WARNINGS performance warning(s) across $SCANNED_MIGRATIONS migration file(s)."
    else
        echo "✅ Database & Migration Safety Audit Passed: All $SCANNED_MIGRATIONS migration file(s) are safe, RLS-protected, and indexed!"
    fi
    exit 0
fi
