# Agent-Flow Evals

Date: 2026-04-25

## Passmark Read

Passmark is an open-source Playwright library for AI browser regression testing, not a general coding-agent benchmark. It is useful evidence for frontend verification shape because it combines natural-language browser steps, screenshots/accessibility snapshots, caching, auto-healing, and multi-model assertions.

Current public shape:

- repo: https://github.com/bug0inc/passmark
- docs/site: https://passmark.dev/
- requires Playwright and provider keys; multi-model consensus expects Anthropic plus Google or an AI gateway
- optional CUA mode uses direct OpenAI access with `gpt-5.5` and the Responses API computer tool
- Redis caching is part of the normal non-CUA flow

Decision for v1: reference, do not vendor. Sane's immediate eval need is agent-flow policy regression coverage, not browser-regression infrastructure. Reconsider Passmark later for frontend pack verification once Sane has a stable app-under-test fixture.

## B14 Fixture Coverage

`agentFlowReleasePolicyFixtures()` pins release-relevant agent-flow behavior:

- frontend review closes through verifier posture instead of broad autonomous editing
- plugin packaging can use parallel slices when independent work is clear
- lifecycle hooks stay high-risk and review-gated
- blocked long runs self-repair instead of stalling
- trivial questions still end at direct answer
- new project design work gets current research and can use sidecars when decomposition is clear

## Release Checklist

Before v1, policy/prompt changes should not regress:

- bootstrap research for new stacks
- frontend review verification posture
- plugin/package work decomposition
- lifecycle hook privacy/reversibility
- continuation after blocks or compaction
- stop conditions for direct answers, verified work, and closing gates

## B11 Outcome Loop Contract

For v1, the outcome loop is the `sane-outcome-continuation` skill plus B8 runtime state, not a public runner command.

Regression checks should preserve:

- plain-language outcome invocation instead of `sane runner`, `run outcome`, or `sane outcome step`
- coordinator-owned judgment with subagents limited to bounded independent side lanes
- proportional research: repo first, current external research only when the next slice needs it
- durable TODO/plan/runtime state when work spans sessions
- verification before claiming completion, with one focused repair attempt before changing approach
- rate-limit/interruption resume context, without claiming automatic resume until Codex exposes a reliable reset timestamp
