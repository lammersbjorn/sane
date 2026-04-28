# Bootstrap Research Policy

Date: 2026-04-25

## Purpose

Sane should stop agents from starting new projects with stale default stacks, while avoiding heavy research for tiny repo-local edits.

## Use Current Research

Use `sane-bootstrap-research` when:

- starting a new app, website, library, plugin, game, TUI, automation, or repo
- choosing a major stack, package manager, framework, UI system, deployment target, database, test runner, or toolchain
- the user asks for "latest", "best", "modern", "new", "experimental", or "current" options
- current package maturity, active maintenance, or ecosystem support materially affects the result
- helper tools could change the agent flow, such as browser tooling, MCP servers, plugins, eval tools, design tools, deploy CLIs, or debugging tools

Prefer official docs, source repositories, release notes, package registries, and primary vendor docs.

## Stay Repo-Local

Do not run broad current research when:

- the task is a small edit inside an existing project
- the repo already has a clear stack and the task does not challenge it
- the user explicitly chose a reasonable stack
- the user asked not to browse
- current research would be larger than the actual change

For existing repos, inspect repo files first. Use current research only when a dependency, tool, framework version, or integration is unknown or likely stale.

## User Stack Choice

If the user chooses a stack:

1. Use it when it is reasonable.
2. If it is clearly bad for the requested product, correct once with evidence and name the better path.
3. After one correction, continue with the user's choice unless it is unsafe, impossible, or conflicts with hard repo constraints.

## Experimental Tools

Experimental tools are allowed when:

- they have real adoption, recent maintenance, or credible primary docs
- failure modes are clear
- fallback is simple
- the user benefits from the new capability enough to justify the risk

Mark them as experimental in the plan instead of silently treating them as boring defaults.

## Policy Coverage

The B12 policy fixtures pin two boundaries:

- new architectural design work gets `bootstrap_research`
- small local edits keep only light verification and skip bootstrap research
