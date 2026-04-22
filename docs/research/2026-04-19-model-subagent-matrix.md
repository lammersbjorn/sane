# Sane Model / Subagent Preset Matrix

Last updated: 2026-04-22

Purpose:
- keep model routing aligned with official OpenAI guidance and explicit non-OpenAI provider research
- keep Sane task-shaped routing (not one static fallback chain)
- separate documented facts from Sane inference and local runtime findings

OpenAI sources:
- [Models overview](https://developers.openai.com/api/docs/models)
- [GPT-5.4 model page](https://developers.openai.com/api/docs/models/gpt-5.4)
- [GPT-5.4 mini model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [GPT-5.3-Codex model page](https://developers.openai.com/api/docs/models/gpt-5.3-codex)
- [GPT-5.2-Codex model page](https://developers.openai.com/api/docs/models/gpt-5.2-codex)
- [Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide)
- [Subagents docs](https://developers.openai.com/codex/subagents)
- [Introducing GPT-5.3-Codex-Spark](https://openai.com/index/introducing-gpt-5-3-codex-spark/)

Non-OpenAI sources:
- [Kimi API Platform](https://platform.moonshot.ai/)
- [Kimi K2.6 quickstart](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart)
- [Moonshot K2 Vendor Verifier](https://github.com/MoonshotAI/K2-Vendor-Verifier)

## Documented Facts (OpenAI)

Documented model-positioning facts:
- OpenAI model docs say: if you are not sure where to start, use `gpt-5.4` for complex reasoning and coding.
- `gpt-5.4-mini` is documented as the strongest mini model for coding, computer use, and subagents.
- `gpt-5.3-codex` is documented as the most capable agentic coding model to date.
- `gpt-5.2-codex` is documented as optimized for long-horizon, agentic coding tasks.
- `gpt-5.3-codex-spark` is documented as a research-preview, real-time coding model tuned for near-instant iteration.

Documented Codex prompting and subagent facts:
- Codex Prompting Guide says `gpt-5.3-codex` is faster and more token efficient than earlier Codex generations, with higher autonomy.
- The same guide says the starter prompt was optimized against internal evals for correctness, completeness, quality, correct tool usage, and parallelism (plus bias for action).
- Subagents docs say Codex only spawns subagents when explicitly asked.
- Subagents docs say subagent workflows consume more tokens than comparable single-agent runs.
- Subagents docs say omitted custom-agent fields (including `model` and `model_reasoning_effort`) inherit from the parent session.

## Documented Facts (Other Providers)

As of April 22, 2026, Moonshot’s public Kimi platform pages say:
- `kimi-k2.6` is its latest and most intelligent model.
- Moonshot positions `kimi-k2.6` as stronger and more stable for long-term code writing and agent execution than earlier Kimi variants.
- Moonshot exposes official tools around web search, memory, code execution, and other agent workflows on its own platform.

What those sources do not yet give us cleanly enough for Sane defaults:
- no stable, vendor-neutral cross-provider benchmark table accessible from the official K2.6 docs
- no proof that K2.6 is available inside the current Codex subagent/runtime surface
- no evidence that a K2.6 route should outrank OpenAI-native defaults inside a Codex-first framework by default

## Local Runtime Findings (This Environment)

Observed in this ChatGPT-backed Codex environment on 2026-04-22:
- picker currently shows `GPT-5.4`, `GPT-5.4-Mini`, `GPT-5.3-Codex`, `GPT-5.3-Codex-Spark`, `GPT-5.2`, `GPT-5.2-Codex`, `GPT-5.1-Codex-Max`, `GPT-5.1-Codex-Mini`
- reasoning picker currently shows `Low`, `Medium`, `High`, `Extra High`
- important local finding: spawning a worker with `gpt-5.2-codex` failed with:
  - `"model is not supported when using Codex with a ChatGPT account"`

Runtime implication:
- keep a strict distinction between:
  - model documented by OpenAI
  - model visible in picker
  - model actually spawnable-here for worker sessions

## What Providers Do Not Publish (Current Docs)

Current provider docs still do not publish:
- one hard benchmark table directly ranking `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2-codex`, and `gpt-5.3-codex-spark` across Codex workflow classes
- one universal official ranking for coordinator vs sidecar vs verifier roles across all Codex surfaces and auth plans
- one neutral cross-provider benchmark table we can use to hard-rank OpenAI and non-OpenAI models together for `explorer` / `implementation` / `verifier` / `realtime`

So class ordering below is Sane inference, not published benchmark truth.

## Sane Routing Policy

Sane should not lock one fixed model and should not use one static fallback chain.

Sane should:
- detect available models and runtime support first
- map work to capability class
- choose the cheapest model that safely fits the class
- escalate only when task shape or risk justifies it
- skip models that are known spawn-unsupported in the current auth/runtime surface
- treat cross-provider additions as capability candidates, not universal rank overrides

## Capability Classes

Task-shaped preset classes for spawned work:
- `explorer`
- `implementation`
- `verifier`
- `realtime`

Coordinator is still the parent/session-level role for synthesis and final authority. It is not a spawned preset class.

Important:
- candidate order inside each class is a Sane routing heuristic
- these orders are not an OpenAI-published benchmark ranking
- cross-provider candidate additions must stay runtime/auth gated and benchmark-caveated

### Explorer

Use for:
- codebase exploration
- isolated read-heavy tasks
- narrow scoped discovery questions

Working order (heuristic):
1. `gpt-5.4-mini`
2. `gpt-5.3-codex-spark`
3. `gpt-5.1-codex-mini`
4. fallback to coordinator model only if no lighter viable option exists

Reasoning default:
- `medium`
- drop to `low` for trivial read-only exploration

### Implementation

Use for:
- long code edits
- broad refactors
- bounded worker runs where coding depth matters more than broad synthesis

Working order (heuristic):
1. `gpt-5.3-codex`
2. `gpt-5.2-codex` when spawn/runtime supports it
3. `gpt-5.4`
4. `gpt-5.2`

Reasoning default:
- `medium` for straightforward execution
- `high` when task is risky or under-specified

### Verifier

Use for:
- patch review
- test/readiness verification
- regression scanning

Working order (heuristic):
1. `gpt-5.4`
2. `gpt-5.3-codex`
3. `gpt-5.2-codex` when spawn/runtime supports it
4. `gpt-5.4-mini` for low-risk bounded reviews
5. `gpt-5.2`

Reasoning default:
- `high` for risky changes
- `medium` for local low-risk checks

### Realtime

Use for:
- near-instant iterative coding loops
- fast probe/fix cycles where latency dominates

Working order (heuristic):
1. `gpt-5.3-codex-spark`
2. `gpt-5.4-mini`
3. `gpt-5.3-codex`

Reasoning default:
- `low` or `medium` depending on risk and ambiguity

## Spawn Rules

Default:
- no subagent

Spawn only when all are true:
- task decomposes cleanly
- result can be merged by one coordinator
- token/latency gain beats coordination overhead
- review authority stays centralized

Preferred subagent mapping:
- explorer/read-heavy -> `explorer`
- narrow implementation sidecar -> `implementation`
- dedicated reviewer -> `verifier`
- latency-first iterative sidecar -> `realtime`

Avoid:
- recursive fan-out
- peer-to-peer subagent chatter
- expensive coordinator models for trivial sidecars
- forcing models already known to be spawn-unsupported in current ChatGPT-backed worker flows

## Legacy Compatibility

`gpt-5.1-codex-max` should not be a recommended default in `Sane`.

Use it only as a legacy compatibility path if:
- an older local config already contains it
- the current environment exposes nothing better

That means:
- keep parser compatibility if needed
- keep it out of the normal picker/default story
- do not rank it above `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, or `gpt-5.2-codex`

Popular-but-unverified rule:
- do not promote a newly popular external model into the default routing matrix unless we have all three:
  - source quality better than pure marketing copy
  - runtime/auth support story for the actual Sane surface
  - evidence strong enough to stay explicitly labeled as heuristic or benchmark-backed

## Config Surface Implication

Sane config should store:
- preferred capability class mapping
- available model set
- class-level candidate order plus runtime gates
- default reasoning per class
- hard disable/enable flags per model

Sane config should not store:
- one permanently fixed "best model"
- one rigid static fallback chain

## Decision

`R2` answer:
- Sane should route by capability class and runtime support, not by one hardcoded default model.
- Sane should expose task-shaped subagent presets: `explorer`, `implementation`, `verifier`, `realtime`.
- Coordinator defaults stay separate from spawned subagent presets.
- Codex-specialized models should remain first-class options where runtime support allows.
- documented model positioning and local spawnable-here support must be tracked separately.
- new popular models can be added as researched candidates without changing the caveat policy.
- class candidate order is implementation inference, not benchmark certainty.

Implementation status note:
- these task-shaped classes are now wired through config + policy-preview surfaces
- legacy role-default fields may remain for compatibility, but they are not the routing truth
