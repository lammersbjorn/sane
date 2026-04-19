#!/usr/bin/env sh
set -eu

git config core.hooksPath .githooks
printf 'Configured git hooks path: %s\n' "$(git config core.hooksPath)"
