# Support

`Sane` is pre-release, but detailed reports still help us resolve issues faster.

## Before You Open An Issue

Try this order first:

1. Run `status`
2. Run `doctor`
3. If config changed recently, use `backup`, `restore`, or `uninstall`
4. Re-run the exact export or apply step that failed

If that still does not fix it, open an issue.

## Pick The Right Path

- **Bug report**

Use the bug template when `Sane` did the wrong thing, wrote the wrong files, failed to preserve existing config, or left managed state inconsistent.

- **Feature request**

Use the feature request template when you want a new workflow, new profile, better UX, better docs, or a different product default.

- **Security issue**

Do not open a public issue.
Use [SECURITY.md](./SECURITY.md).

- **Docs issue**

Open a normal issue or PR.
Docs fixes are welcome.

## What To Include

Include:

- your OS
- what command or TUI flow you used
- what you expected
- what actually happened
- screenshots or terminal output if relevant
- your current commit hash if you are running from source

It also helps to say which Sane surface failed:

- local `.sane` runtime
- router skill export
- packs
- managed `AGENTS.md` block
- hooks
- custom agents
- Codex config preview, apply, restore, or uninstall

## Common Recovery Paths

| Problem | First thing to try |
| --- | --- |
| Local runtime missing or half-created | `install`, then `doctor` |
| Exported assets look stale | re-export the relevant asset or `export all` |
| Codex config looks wrong after apply | `restore codex-config` |
| You want to back out completely | `uninstall all` |
| You are not sure what changed | `status`, then `doctor` |
