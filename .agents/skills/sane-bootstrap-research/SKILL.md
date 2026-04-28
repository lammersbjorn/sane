---
name: sane-bootstrap-research
description: Use when starting a new project, greenfield app, major stack choice, or fresh repo setup where current packages, frameworks, tools, plugins, or deployment options should be researched before implementation.
---

# Sane Bootstrap Research

## Goal

Choose a current, defensible project stack before code gets built around stale defaults.

## Use When

- user asks to start a new app, website, tool, game, library, plugin, or repo
- a major stack, package, framework, deployment, or tool choice is still open
- the task depends on current ecosystem state
- experimental tools may be useful if they are proven enough for semi-production use

## Don't Use When

- the user already chose the stack and it is reasonable
- the work is a small change inside an existing project
- current research would be disproportionate to the task
- the user explicitly forbids browsing or external research

## Inputs

- target product/domain and user constraints
- user-chosen stack, if any
- existing repo files if this is not fully greenfield
- current package/framework/tool evidence from official docs, repos, release notes, or package registries

## Outputs

- recommended stack and alternatives
- helper tools worth installing or enabling
- risks, maturity notes, and why rejected options lost
- one correction if the user's chosen stack is clearly a bad fit

## How To Run

1. Classify the project surface: web app, mobile, CLI/TUI, library, game, automation, plugin, data tool, or infra.
2. If the user chose a stack, check whether it is reasonable.
   - If reasonable, use it.
   - If clearly bad, correct once with evidence and a better option.
   - After one correction, continue with the user's decision unless it is unsafe or impossible.
3. Research current options proportionally.
   - Prefer official docs, source repos, release notes, and package registries.
   - Include stable choices and credible new tools.
   - Include helper tools: test runners, linters, UI libraries, browser tools, MCPs, plugins, deploy targets, and eval/debug tools.
4. Pick the smallest stack that can ship the requested product.
5. Record durable decisions in plan/TODO docs when the choice should survive the session.

## Gotchas

- Do not research every new package for tiny edits.
- Do not chase novelty when a boring stable choice fits better.
- Do not ignore a user-selected stack unless it is clearly wrong for the task.
- Do not cite trend claims without current evidence.
