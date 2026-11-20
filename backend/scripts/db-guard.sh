#!/bin/bash
# O14 test-database guard (M1-ARCHITECTURE.md §16.4, M1-SECURITY-AND-TEST-STRATEGY).
#
# Tests and the migration runner must refuse to touch a database that is not a
# test database. Two checks, in this order:
#
#   1. The database name in the connection URL must end in `_test`.
#      The authoritative guard for automated runs is tests/dbGuard.ts, which
#      additionally verifies the EXACT host and database name (TEST_DB_HOST /
#      TEST_DB_NAME) and refuses the development host, so neither a matching
#      host nor a `_test` suffix is trusted on its own.
#   2. The test URL must not name the development host (DEV_DB_HOST). This
#      shell guard keeps the check available for humans and CI.
#
# Usage:
#   source backend/scripts/db-guard.sh
#   db_guard_assert_test "$TEST_DATABASE_URL"        # name + dev-host check
#   db_guard_assert_test_host "$TEST_DATABASE_URL"   # name + host check (destructive reset)
#
# Or directly:
#   bash backend/scripts/db-guard.sh assert-test <url>
#   bash backend/scripts/db-guard.sh assert-host <url>
#
# Fake data only. Real employee data is never copied into the test database.

set -euo pipefail

_db_guard_extract() {
    # Prints the URL's database path component (last path segment), or nothing.
    # Handles postgres:// and postgresql://, strips query strings.
    local url="${1%%\?*}"
    local db="${url##*/}"
    # A URL with no path yields the whole URL back; reject anything with a colon
    # (it means there was no path segment).
    case "$db" in
        *:*) echo "" ;;
        *) echo "$db" ;;
    esac
}

_db_guard_extract_host() {
    # Prints the host segment: after the last '@', before the first ':' or '/'.
    local url="${1%%\?*}"
    local authority="${url#*://}"
    authority="${authority%%/*}"
    local host="${authority##*@}"
    host="${host%%:*}"
    echo "$host"
}

db_guard_assert_test() {
    local url="${1:-}"
    if [ -z "$url" ]; then
        echo "[ DB-GUARD ] FAIL: no connection URL given (set TEST_DATABASE_URL)." >&2
        return 1
    fi
    local db
    db="$(_db_guard_extract "$url")"
    if [ -z "$db" ]; then
        echo "[ DB-GUARD ] FAIL: could not read a database name from the URL." >&2
        return 1
    fi
    # Positive rejection of the development target, before any suffix logic.
    local host
    host="$(_db_guard_extract_host "$url")"
    if [ -n "${DEV_DB_HOST:-}" ] && [ "$host" = "$DEV_DB_HOST" ]; then
        echo "[ DB-GUARD ] REFUSED: host '$host' is the development host (DEV_DB_HOST)." >&2
        return 1
    fi
    case "$db" in
        *_test) echo "[ DB-GUARD ] OK: database '$db' is a test database." ;;
        *)
            echo "[ DB-GUARD ] REFUSED: database '$db' does not end in '_test'." >&2
            echo "             Tests and migrations never run against a non-test database." >&2
            return 1
            ;;
    esac
}

db_guard_assert_test_host() {
    db_guard_assert_test "$1" || return 1

    local expected_host="${TEST_DB_HOST:-}"
    if [ -z "$expected_host" ]; then
        echo "[ DB-GUARD ] REFUSED: TEST_DB_HOST is not set." >&2
        echo "             A destructive reset needs the expected test host, not just the suffix." >&2
        return 1
    fi

    # Host is the segment after the last '@' before the first '/' or ':'.
    local authority="${1#*://}"
    authority="${authority%%/*}"
    local host="${authority##*@}"
    host="${host%%:*}"

    if [ "$host" != "$expected_host" ]; then
        echo "[ DB-GUARD ] REFUSED: host '$host' does not match TEST_DB_HOST '$expected_host'." >&2
        return 1
    fi
    echo "[ DB-GUARD ] OK: host '$host' matches TEST_DB_HOST."
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    cmd="${1:-}"
    url="${2:-}"
    case "$cmd" in
        assert-test) db_guard_assert_test "$url" ;;
        assert-host) db_guard_assert_test_host "$url" ;;
        *)
            echo "usage: $0 assert-test|assert-host <postgres-url>" >&2
            exit 2
            ;;
    esac
fi
