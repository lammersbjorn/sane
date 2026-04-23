# Codex Continuity And Statusline Audit

Last updated: 2026-04-23

Purpose:
- close the open question after dropping `cavemem`
- decide what continuity layer `Sane` should actually rely on
- decide whether `Sane` should build its own statusline/status-bar product surface

Primary sources:
- [Codex config reference](https://developers.openai.com/codex/config-reference)
- [Codex CLI slash commands](https://developers.openai.com/codex/cli/slash-commands)
- [Codex cloud docs](https://developers.openai.com/codex/cloud)
- [Codex config source](https://github.com/openai/codex/blob/main/codex-rs/core/src/config/mod.rs)
- [Codex memory pipeline README](https://github.com/openai/codex/blob/main/codex-rs/core/src/memories/README.md)
- [Codex memory prompts source](https://github.com/openai/codex/blob/main/codex-rs/core/src/memories/prompts.rs)
- [Codex TUI source](https://github.com/openai/codex/blob/main/codex-rs/tui/src/chatwidget.rs)

Issue/discussion evidence:
- [#17496 Memory read path ignores cwd and injects entire global memory_summary.md into initial context for new sessions](https://github.com/openai/codex/issues/17496)
- [#18343 Scoped memory management for Codex](https://github.com/openai/codex/issues/18343)
- [#18738 Memory apparently ignored by Codex until specifically asked to read it](https://github.com/openai/codex/issues/18738)
- [#19105 "Memories" consuming rate limit disproportionately](https://github.com/openai/codex/issues/19105)
- [Discussion #12567 memories discussion / maintainer warning](https://github.com/openai/codex/discussions/12567)
- [#2926 Allow customizing the status line](https://github.com/openai/codex/issues/2926)
- [#13660 Add fast-mode status to the statusline](https://github.com/openai/codex/issues/13660)
- [#18045 `context-remaining` and `context-remaining-percent` render the same thing](https://github.com/openai/codex/issues/18045)

## Continuity Decision

Recommendation:
- `Sane` should use scoped local `.sane` state as its canonical continuity layer.
- `Sane` should not depend on Codex native `memories` for default continuity.
- `Sane` should not replace that gap with another third-party global memory system.

Why:
- Codex native memories exist, but current public/docs/source shape still looks local and experimental rather than a stable project-scoped contract.
- The current memory read path evidence shows global summary injection pressure, not clean repo-scoped recall.
- Open issues show active problems around scope, retrieval reliability, and rate-limit cost.

What Codex currently has:
- a native memories feature under `CODEX_HOME`
- startup extraction/consolidation pipeline
- local memory artifacts and reset/manage surfaces

What that is not:
- a clean project-scoped continuity contract `Sane` can safely make the default
- a guarantee of stable cross-task or cross-repo retrieval quality

Important source-level findings:
- memory startup is a local pipeline under the Codex home, not a Sane-owned state model
- memory read prompt construction currently reads `memory_summary.md` and truncates it to a fixed token budget
- current issue evidence says the read path can inject unrelated global summary content into fresh sessions

Conclusion:
- keep `.sane` state as the durable continuity layer
- treat Codex native memories as optional, secondary, and off the default path
- use explicit repo-local files/handoffs when more continuity is needed

## Statusline Decision

Recommendation:
- do not build a custom `Sane` status-bar/statusline product surface in `v1`
- do allow a narrow config-only helper over Codex native `tui.status_line` / `tui.terminal_title`

Why:
- Codex already has first-class native statusline and terminal-title config
- this is a config-backed built-in surface, not an unmet product gap
- building a Sane-owned HUD now would duplicate Codex instead of improving it

Current Codex support:
- `tui.status_line`
- `tui.terminal_title`
- built-in slash/config UX for statusline/title customization

Important constraint:
- supported items are fixed built-ins, not a general custom widget/render API

Conclusion:
- close the “should Sane invent a status-bar system?” question with `no`
- allow a small additive helper only over native Codex statusline/title config

## Product Implications For Sane

- remove any remaining `cavemem` references from source-of-truth docs
- document that default continuity comes from scoped Codex-native exports plus `.sane`
- keep native `memories` out of the default Codex profile
- inspect native `memories` and native statusline state read-only in Codex config surfaces
- if users want it, manage native Codex statusline/title config additively instead of inventing a Sane-owned status-bar
