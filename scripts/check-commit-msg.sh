#!/usr/bin/env sh
set -eu

msg_file=${1:?expected commit message file path}
first_line=$(sed -n '1p' "$msg_file")

case "$first_line" in
  Merge\ *|Revert\ *)
    exit 0
    ;;
esac

pattern='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?(!)?: .+$'

if printf '%s\n' "$first_line" | grep -Eq "$pattern"; then
  exit 0
fi

cat <<'EOF' >&2
Invalid commit message.

Expected Conventional Commit format:
  type(scope): summary

Examples:
  feat(tui): add install command
  fix(config): persist local config to disk
  chore: initialize workspace

Allowed types:
  feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
EOF

exit 1
