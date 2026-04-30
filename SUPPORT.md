# Support

`Sane` is young. Useful reports name the managed surface that failed and what Sane wrote, skipped, or could not repair.

## Before You Open An Issue

Try this order first:

1. Run `sane status`.
2. Run the setup check in the control surface.
3. If Codex config changed recently, use `sane repair` or `sane restore codex-config`.
4. Re-run the exact export or apply step that failed.

If that does not fix it, open an issue.

## Pick The Right Path

- **Bug report**: Sane wrote the wrong files, failed to preserve existing config, left managed state inconsistent, or reported incorrect status.
- **Feature request**: you want a new managed surface, profile, pack, workflow, UX change, or product default.
- **Security issue**: do not open a public issue; use [SECURITY.md](./SECURITY.md).
- **Docs issue**: open a normal issue or PR.

## What To Include

Include:

- your OS
- whether you ran from source or an installed `sane-codex` package
- what command or control-surface flow you used
- what you expected
- what actually happened
- screenshots or terminal output if relevant
- current commit hash if you are running from source

It helps to name the Sane surface involved:

- local `.sane/` runtime
- user skills
- optional packs
- global or repo `AGENTS.md` block
- hooks
- custom agents
- Codex config profile
- recommended integrations
- Cloudflare profile
- native Codex statusline/title profile
- OpenCode export

## Common Recovery Paths

| Problem | First thing to try |
| --- | --- |
| Local runtime missing or half-created | `sane install`, then run the setup check. |
| Exported files look stale | Re-export the relevant surface or run `sane export all`. |
| Codex config looks wrong after apply | `sane restore codex-config`. |
| You want to back out completely | `sane uninstall all`. |
| You are not sure what changed | `sane status`, then run the setup check. |
