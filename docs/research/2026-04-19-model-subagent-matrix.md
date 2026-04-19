# Sane Model / Subagent Preset Matrix

Last updated: 2026-04-19

Purpose:
- finish `R2`
- define capability classes instead of hardcoding one model forever
- keep model routing aligned with official OpenAI model positioning

Primary sources:
- [GPT-5.4 model page](https://developers.openai.com/api/docs/models/gpt-5.4)
- [GPT-5.4 mini model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [GPT-5.3-Codex model page](https://developers.openai.com/api/docs/models/gpt-5.3-codex)
- [GPT-5.2-Codex model page](https://developers.openai.com/api/docs/models/gpt-5.2-codex)
- [GPT-5.1-Codex-Max model page](https://developers.openai.com/api/docs/models/gpt-5.1-codex-max)
- [GPT-5.1-Codex-mini model page](https://developers.openai.com/api/docs/models/gpt-5.1-codex-mini)
- [Subagents docs](https://developers.openai.com/codex/subagents)
- local Codex app model/reasoning picker screenshots from this session

## Actual Codex App Availability

The current Codex app in this environment shows these model choices:
- `GPT-5.4`
- `GPT-5.2-Codex`
- `GPT-5.1-Codex-Max`
- `GPT-5.4-Mini`
- `GPT-5.3-Codex`
- `GPT-5.3-Codex-Spark`
- `GPT-5.2`
- `GPT-5.1-Codex-Mini`

The current reasoning choices shown in-app are:
- `Low`
- `Medium`
- `High`
- `Extra High`

Implication:
- Sane `v1` config defaults should validate against this actual set first
- do not invent `nano` or `minimal` options in the config UI
- use the official docs name `xhigh` as the canonical config value, even if the picker renders it as `Extra High`
- future availability detection can widen the set later, but `v1` should match what the user can actually pick today

## Official Positioning

Direct doc takeaways:
- `GPT-5.4`: “Best intelligence at scale for agentic, coding, and professional workflows.”
- `GPT-5.4 mini`: “Our strongest mini model yet for coding, computer use, and subagents.”
- `GPT-5.3-Codex`: “The most capable agentic coding model to date.”
- `GPT-5.2-Codex`: “Our most intelligent coding model optimized for long-horizon, agentic coding tasks.”
- `GPT-5.1-Codex-Max`: “A version of GPT-5.1-codex optimized for long running tasks.”
- `GPT-5.1-Codex-mini`: smaller, cheaper, less capable Codex coding model.

Subagent constraint from docs:
- Codex only spawns subagents when explicitly asked.
- subagents cost more tokens than comparable single-agent runs.
- custom agents inherit omitted settings from the parent session.

## Sane Policy

Sane should not lock one fixed model.

Instead:
- detect what the user actually has available
- map each task to a capability class
- choose cheapest model that safely fits the class
- escalate only when task shape or risk justifies it

## Capability Classes

### Class A: coordinator / hard problems

Use for:
- architecture
- high-risk review
- ambiguous debugging
- multi-step planning
- final synthesis across subagents

Preferred order:
1. `gpt-5.4`
2. `gpt-5.3-codex`
3. `gpt-5.2-codex`
4. `gpt-5.1-codex-max`

Reasoning default:
- `high`
- escalate to `xhigh` only for unusually hard architecture/debug/review tasks

Inference:
- docs do not publish one universal “best Codex-in-app coordinator” ranking across all these models
- this order is inferred from official positioning: frontier general intelligence first, then strongest coding-specialized models

### Class B: long-running execution

Use for:
- long code edits
- broad refactors
- sessions expected to keep coding for a while
- bounded worker runs where coding depth matters more than broad synthesis

Preferred order:
1. `gpt-5.3-codex`
2. `gpt-5.2-codex`
3. `gpt-5.1-codex-max`
4. `gpt-5.4`

Reasoning default:
- `medium` for straightforward execution
- `high` when task is risky or under-specified

Inference:
- Codex-specific models are positioned more directly for agentic coding execution
- `gpt-5.1-codex-max` gets special weight for very long-running tasks

### Class C: sidecar / bounded subagent

Use for:
- codebase exploration
- isolated read-heavy tasks
- cheap parallel sidecars
- narrow implementation subtasks

Preferred order:
1. `gpt-5.4-mini`
2. `gpt-5.1-codex-mini`
3. fallback to main coordinator model if no mini exists

Reasoning default:
- `medium`
- drop to `low` for trivial read-only sidecars

Why:
- official docs explicitly position `gpt-5.4 mini` for coding, computer use, and subagents

### Class D: verifier / reviewer

Use for:
- patch review
- test/readiness verification
- regression scanning

Preferred order:
1. `gpt-5.4`
2. `gpt-5.3-codex`
3. `gpt-5.4-mini` for low-risk bounded reviews

Reasoning default:
- `high` for risky changes
- `medium` for local low-risk checks

## Spawn Rules

Default:
- no subagent

Spawn only when all are true:
- task decomposes cleanly
- result can be merged by one coordinator
- token/latency gain beats coordination overhead
- review authority stays centralized

Preferred subagent mapping:
- explorer/read-heavy -> Class C
- narrow implementation sidecar -> Class C or B
- dedicated reviewer -> Class D

Avoid:
- recursive fan-out
- peer-to-peer subagent chatter
- expensive coordinator models for trivial sidecars

## Config Surface Implication

Sane config should store:
- preferred capability class mapping
- available model set
- fallback order
- default reasoning per class
- hard disable/enable flags per model

Sane config should not store:
- one permanently fixed “best model”
- rigid visible modes

## Decision

`R2` answer:
- Sane should route by capability class, not by one hardcoded default model.
- `gpt-5.4` is the safest coordinator default when available.
- `gpt-5.4 mini` is the safest sidecar default when available.
- Codex-specialized models should remain first-class execution options, especially for long coding runs.
