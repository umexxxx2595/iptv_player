#!/usr/bin/env sh

set -eu

if [ -z "${PROJECT_ROOT:-}" ]; then
    printf '%s\n' "husky: PROJECT_ROOT is not set." >&2
    exit 1
fi

print_step() {
    printf '%s\n' "husky: $*"
}

print_error() {
    printf '%s\n' "husky: $*" >&2
}

ensure_file_exists() {
    path="$1"

    if [ ! -f "$path" ]; then
        print_error "missing required file: $path"
        exit 1
    fi
}

check_js_syntax() {
    file_path="$1"
    ensure_file_exists "$file_path"
    node --check "$file_path"
}

check_required_files() {
    for path in "$@"; do
        ensure_file_exists "$path"
    done
}

run_core_syntax_checks() {
    check_js_syntax "$PROJECT_ROOT/src/app.js"
    check_js_syntax "$PROJECT_ROOT/src/bootstrap.js"
    check_js_syntax "$PROJECT_ROOT/src/boot-loader.js"
}

validate_commit_message() {
    commit_message_file="$1"
    ensure_file_exists "$commit_message_file"

    first_line="$(sed -n '1p' "$commit_message_file" | tr -d '\r')"
    trimmed_line="$(printf '%s' "$first_line" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"

    if [ -z "$trimmed_line" ]; then
        print_error "commit message cannot be empty."
        exit 1
    fi

    case "$trimmed_line" in
        Merge\ *|Revert\ *)
            return 0
            ;;
    esac

    line_length="$(printf '%s' "$trimmed_line" | wc -c | tr -d ' ')"

    if [ "$line_length" -lt 8 ]; then
        print_error "commit title is too short. Use at least 8 characters."
        exit 1
    fi

    if [ "$line_length" -gt 72 ]; then
        print_error "commit title is too long. Keep it within 72 characters."
        exit 1
    fi

    case "$trimmed_line" in
        *.)
            print_error "commit title should not end with a period."
            exit 1
            ;;
    esac
}
