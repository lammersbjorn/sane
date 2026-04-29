---
name: sane-rtk
description: Use when a repo requires RTK or shell/search/test/log work should use RTK's compact native commands; prefer RTK subcommands over raw shell and use `rtk run` only as fallback.
---

# Sane RTK

## Goal

Route shell/search/test/log work through RTK with compact, task-relevant output.

## Use When

- the repo or Sane config says RTK is required
- searching, reading, diffing, testing, listing, or checking logs could produce noisy output
- a shell command has a clear RTK-native equivalent

## Command Choice

Prefer RTK-native commands:
- search: `rtk grep ...`
- read files: `rtk read ...`
- list/tree: `rtk ls ...`, `rtk tree ...`
- diffs/history: `rtk diff ...`, `rtk git ...`
- package/test work: `rtk pnpm ...`, `rtk npm ...`, `rtk test ...`, `rtk vitest ...`, `rtk tsc ...`, `rtk lint ...`
- logs/json/counts: `rtk log ...`, `rtk json ...`, `rtk wc ...`

Use `rtk run '<command>'` only when no native RTK command fits, when exact shell semantics matter, or when running a short combined command is safer than splitting it.

## Safety

- do not wrap RTK-native commands in `rtk run`
- keep exact commands, paths, errors, and diffs intact when reporting them
- do not run broad exploratory commands when a targeted RTK command answers the task
- follow normal repo safety rules for destructive commands
