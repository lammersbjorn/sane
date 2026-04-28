# Sane Model / Subagent Preset Matrix

Last updated: 2026-04-28

Purpose:
- keep model routing aligned with official OpenAI guidance and explicit non-OpenAI provider research
- keep Sane task-shaped routing (not one static fallback chain)
- separate documented facts from Sane inference and local runtime findings

OpenAI sources:
- [Introducing GPT-5.5](https://openai.com/index/introducing-gpt-5-5/)
- [Models overview](https://developers.openai.com/api/docs/models)
- [Codex models](https://developers.openai.com/codex/models)
- [API pricing](https://openai.com/api/pricing/)
- [GPT-5.4 model page](https://developers.openai.com/api/docs/models/gpt-5.4)
- [GPT-5.4 mini model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [GPT-5.3-Codex model page](https://developers.openai.com/api/docs/models/gpt-5.3-codex)
- [Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide)
- [Subagents docs](https://developers.openai.com/codex/subagents)
- [Introducing GPT-5.3-Codex-Spark](https://openai.com/index/introducing-gpt-5-3-codex-spark/)

Non-OpenAI sources:
- [Kimi API Platform](https://platform.moonshot.ai/)
- [Kimi K2.6 quickstart](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart)
- [Moonshot K2 Vendor Verifier](https://github.com/MoonshotAI/K2-Vendor-Verifier)
- [Artificial Analysis GLM-5.1](https://artificialanalysis.ai/models/glm-5-1)
- [Artificial Analysis Qwen3.6 Plus](https://artificialanalysis.ai/models/qwen3-6-plus)
- [Artificial Analysis Kimi K2.6](https://artificialanalysis.ai/models/kimi-k2-6)
- [Artificial Analysis MiMo-V2-Omni](https://artificialanalysis.ai/models/mimo-v2-omni)
- [Z.AI GLM-5.1](https://docs.z.ai/guides/llm/glm-5.1)
- [Z.AI GLM-5](https://docs.z.ai/guides/llm/glm-5)
- [Qwen3.6-Plus announcement](https://www.alibabacloud.com/blog/603005)
- [DeepSeek V4 release](https://api-docs.deepseek.com/news/news260424)
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [DeepSeek V4 model card](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash)
- [Kimi K2.6 tech blog](https://www.kimi.com/blog/kimi-k2-6)
- [Kimi K2.6 pricing](https://platform.kimi.com/docs/pricing/chat-k26)

## Documented Facts (OpenAI)

Documented model-positioning facts:
- OpenAI announced `gpt-5.5` on 2026-04-23 and says it is rolling out in ChatGPT and Codex.
- Current API model docs say: if you are not sure where to start, use `gpt-5.5` for complex reasoning and coding.
- OpenAI model docs list `gpt-5.5` at $5 input / $30 output per 1M tokens, double `gpt-5.4` standard token pricing.
- `gpt-5.4-mini` is documented as the strongest mini model for coding, computer use, and subagents.
- `gpt-5.3-codex` is documented as the most capable agentic coding model to date.
- `gpt-5.2` remains available in the current Pro Codex picker reported on 2026-04-23.
- `gpt-5.3-codex-spark` is documented as a research-preview, real-time coding model tuned for near-instant iteration.

Documented Codex prompting and subagent facts:
- OpenAI says `gpt-5.5` is strongest for complex coding, computer use, knowledge work, and research workflows, and that it matches `gpt-5.4` per-token latency while often using fewer tokens on Codex tasks.
- OpenAI's published `gpt-5.5` launch evals put it above `gpt-5.4` on Terminal-Bench 2.0, SWE-Bench Pro, Expert-SWE, OSWorld-Verified, MCP Atlas, Toolathlon, and long-context Graphwalks.
- OpenAI's Codex app update makes in-app browser, computer use, screenshots, and image generation part of the frontend/game iteration loop.
- Codex Prompting Guide says `gpt-5.3-codex` is faster and more token efficient than earlier Codex generations, with higher autonomy.
- The same guide says the starter prompt was optimized against internal evals for correctness, completeness, quality, correct tool usage, and parallelism (plus bias for action).
- Subagents docs say Codex only spawns subagents when explicitly asked.
- Subagents docs say subagent workflows consume more tokens than comparable single-agent runs.
- Subagents docs say omitted custom-agent fields (including `model` and `model_reasoning_effort`) inherit from the parent session.

## Documented Facts (Other Providers)

As of April 23, 2026, Moonshot’s public Kimi platform pages say:
- `kimi-k2.6` is its latest and most intelligent model.
- Moonshot positions `kimi-k2.6` as stronger and more stable for long-term code writing and agent execution than earlier Kimi variants.
- Moonshot documents `kimi-k2.6` with 256K context, text/image/video input, thinking and non-thinking modes, and multi-step tool calling.
- Moonshot documents OpenAI SDK/API-format compatibility through the Moonshot API base URL.
- Moonshot exposes official tools around web search, memory, code execution, and other agent workflows on its own platform.

What those sources do not yet give us cleanly enough for Sane defaults:
- no stable, vendor-neutral cross-provider benchmark table accessible from the official K2.6 docs
- no proof that K2.6 is available inside the current Codex subagent/runtime surface
- no evidence that a K2.6 route should outrank OpenAI-native defaults inside a Codex-first framework by default

## Documented Facts (OpenCode Go Providers)

OpenCode Go research on 2026-04-28 used independent Artificial Analysis pages where available, then provider benchmark reports, then public engineering takes as lower-confidence context. It is not one neutral, unified agent benchmark.

Observed evidence:
- `glm-5.1`: Artificial Analysis reports Intelligence Index 51. Z.AI positions it for long-horizon coding agents, 200K context, 128K output, and reports SWE-Bench Pro 58.4 plus up to 8-hour autonomous task execution. Z.AI pricing is $1.4 / 1M input and $4.4 / 1M output.
- `glm-5`: Z.AI positions it as an Agentic Engineering model with 200K context, 128K output, and coding / agent capability near Claude Opus 4.5. It is cheaper than GLM-5.1, but GLM-5.1 has the stronger current long-horizon positioning.
- `qwen3.6-plus`: Artificial Analysis reports Intelligence Index 50, 1M context, and $0.50 / 1M input, $3.00 / 1M output on Alibaba's API. Alibaba says Qwen3.6-Plus improves agentic coding, terminal operations, tool usage, multimodal reasoning, and OpenCode-style integrations.
- `deepseek-v4-pro`: DeepSeek reports 1.6T total / 49B active parameters, 1M context, tool calls, and strong agentic coding. Its model card reports V4-Pro Max at Terminal Bench 2.0 67.9, SWE Verified 80.6, SWE Pro 55.4, and LiveCodeBench 93.5.
- `deepseek-v4-flash`: DeepSeek positions it as the fast economical route, with 284B total / 13B active parameters, 1M context, and simple-agent performance close to Pro. The model card reports V4-Flash Max at Terminal Bench 2.0 56.9, SWE Verified 79.0, SWE Pro 52.6, and LiveCodeBench 91.6. Current pricing is $0.14 / 1M cache-miss input and $0.28 / 1M output.
- `kimi-k2.6`: Artificial Analysis reports Intelligence Index 54, above the other OpenCode Go candidates surveyed here. Kimi reports SWE-Bench Verified 80.2, SWE-Bench Pro 58.6, Terminal-Bench 2.0 66.7, LiveCodeBench 89.6, 256K context, multimodal input, and tool / agent support. It stays out of Sane's default OpenCode Go map while current OpenCode Go usage is 3x.
- `mimo-v2-omni`: Artificial Analysis reports Intelligence Index 43 and 256K context, but the public trail is weaker and more multimodal-focused. Treat it as a possible multimodal candidate, not a coding-agent default.

OpenCode Go routing inference:
- coordinator: `opencode-go/glm-5.1`, because long-horizon planning and agent stability matter most
- implementation: `opencode-go/glm-5.1`, because the current evidence favors it over GLM-5 for sustained coding work
- explorer / sidecar: `opencode-go/qwen3.6-plus`, because 1M context and low input price fit read-heavy discovery
- verifier: `opencode-go/deepseek-v4-pro`, because its Terminal Bench, SWE, and LiveCodeBench profile is strong for review and hard checks
- realtime: `opencode-go/deepseek-v4-flash`, because it has the best cost / latency story while retaining strong coding scores

Kimi K2.6 note:
- Kimi is a quality escalation candidate when the user explicitly accepts higher usage or cost.
- It is not the default while OpenCode Go usage is reported at 3x.

## Local Runtime Findings (This Environment)

Observed in this ChatGPT-backed Codex environment on 2026-04-22:
- picker currently shows `GPT-5.4`, `GPT-5.4-Mini`, `GPT-5.3-Codex`, `GPT-5.3-Codex-Spark`, `GPT-5.2`, `GPT-5.2-Codex`, `GPT-5.1-Codex-Max`, `GPT-5.1-Codex-Mini`
- reasoning picker currently shows `Low`, `Medium`, `High`, `Extra High`
- important local finding: spawning a worker with `gpt-5.2-codex` failed before it was removed from the active Sane model set:
  - `"model is not supported when using Codex with a ChatGPT account"`

Runtime implication:
- keep a strict distinction between:
  - model documented by OpenAI
  - model visible in picker
  - model actually spawnable-here for worker sessions

Observed from current local Pro Codex model cache and user-reported picker on 2026-04-23:
- available: `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.3-codex-spark`, `gpt-5.2`
- not currently available in that picker: `gpt-5.2-codex`

Runtime implication:
- remove `gpt-5.2-codex` from Sane's active ChatGPT-subscription model set
- keep `gpt-5.2` as a detected/runtime-gated fallback below `gpt-5.4`
- do not claim `gpt-5.2` availability for every subscription tier unless OpenAI publishes a current tier matrix or Sane detects it locally

## What Providers Do Not Publish (Current Docs)

Current provider docs still do not publish:
- one hard benchmark table directly ranking `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2`, and `gpt-5.3-codex-spark` across Codex workflow classes
- one universal official ranking for coordinator vs sidecar vs verifier roles across all Codex surfaces and auth plans
- one neutral cross-provider benchmark table we can use to hard-rank OpenAI and non-OpenAI models together for `explorer` / `implementation` / `verifier` / `realtime`
- one official frontend/UI benchmark proving which model has best visual taste

So class ordering below is Sane inference, not published benchmark truth.

## Sane Routing Policy

Sane should not lock one fixed model and should not use one static fallback chain.

Sane should:
- detect available models and runtime support first
- map work to capability class
- choose the cheapest model that safely fits the class
- escalate only when task shape or risk justifies it
- reserve `gpt-5.5` for high-value coordination, verification, complex synthesis, and fallback implementation when Codex-specialized execution models are missing or insufficient
- default `gpt-5.5` coordinator routing to `medium` reasoning unless the task explicitly needs extra depth; OpenAI's launch evals used `xhigh` in a research environment, but Sane should not make every parent session pay that cost by default
- skip models that are known spawn-unsupported in the current auth/runtime surface
- treat cross-provider additions as capability candidates, not universal rank overrides

## Capability Classes

Task-shaped preset classes for spawned work:
- `explorer`
- `implementation`
- `verifier`
- `realtime`
- `frontend-ui`

Coordinator is still the parent/session-level role for synthesis and final authority. It is not a spawned preset class.

Important:
- candidate order inside each class is a Sane routing heuristic
- these orders are not an OpenAI-published benchmark ranking
- cross-provider candidate additions must stay runtime/auth gated and benchmark-caveated

### Coordinator

Use for:
- parent-session synthesis
- task decomposition
- final authority across subagent outputs
- high-ambiguity decisions

Working order (heuristic):
1. `gpt-5.5` when detected in the current Codex picker
2. `gpt-5.4`
3. `gpt-5.3-codex`
4. `gpt-5.2`

Reasoning default:
- `medium` for `gpt-5.5`
- `high` for `gpt-5.4` fallback
- escalate to `high` or `xhigh` only for unusually risky, broad, or under-specified coordination

### Explorer

Use for:
- codebase exploration
- isolated read-heavy tasks
- narrow scoped discovery questions

Working order (heuristic):
1. `gpt-5.4-mini`
2. `gpt-5.3-codex-spark`
3. `gpt-5.1-codex-mini`
4. fallback to coordinator model only if no lighter viable option exists, including `gpt-5.5` only as a last-resort expensive sidecar

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
2. `gpt-5.5` for ambiguous, high-risk, multi-system implementation or when `gpt-5.3-codex` is unavailable
3. `gpt-5.4`
4. `gpt-5.2`

Reasoning default:
- `medium` for straightforward execution
- `high` when task is risky or under-specified

### Frontend UI

Use for:
- UI generation, redesign, and visual polish
- screenshot-to-code and Figma-to-code work
- game, canvas, WebGL, and animation-heavy surfaces
- final visual QA and product-taste approval

Working order (heuristic):
1. `gpt-5.5`
2. `gpt-5.4`
3. `gpt-5.3-codex`
4. `gpt-5.4-mini` only for tiny non-visual source discovery or mechanical fixes

Reasoning default:
- `high` for normal UI subagent work
- `xhigh` for first-pass visual systems, high-polish redesigns, ambiguous product taste work, complex responsive layouts, screenshot/Figma parity, game/canvas surfaces, and final visual approval loops

Rationale:
- UI work is not only code execution. It depends on visual context, assets, browser/computer use, and iterative critique.
- `gpt-5.5` is the best current fit because OpenAI positions it strongest on complex coding, computer use, tool use, vision-capable workflows, and long-context work.
- Generic implementation/realtime defaults stay cheaper for non-visual work, but frontend visual approval should not silently fall back to mini models when `gpt-5.5` is available.

### Verifier

Use for:
- patch review
- test/readiness verification
- regression scanning

Working order (heuristic):
1. `gpt-5.5`
2. `gpt-5.4`
3. `gpt-5.3-codex`
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
4. `gpt-5.5` only when realtime routes have no cheaper viable option

Reasoning default:
- `low` or `medium` depending on risk and ambiguity

## Spawn Rules

Default:
- subagent-first for all non-tiny work
- broad work needs a lane plan and successful subagent handoff before deep work
- broad review needs explorer/reviewer lanes
- broad edits need a lane plan and implementation-lane handoff before overlapping main edits

Stay single-agent only when either is true:
- task is a tiny direct answer
- higher-priority tool rules require explicit subagent authorization and the user declines it
- current harness/runtime blocks subagent spawn after one retry; report broad-work blocker instead of doing a tiny solo pass

When spawning:
- keep each lane bounded and independently owned
- keep one coordinator lane as the merge and verification authority
- keep review authority centralized

Preferred subagent mapping:
- explorer/read-heavy -> `explorer`
- narrow implementation sidecar -> `implementation`
- dedicated reviewer -> `verifier`
- latency-first iterative sidecar -> `realtime`
- UI generation/redesign/visual QA -> `frontend-ui` (`gpt-5.5` high or xhigh, with concrete frontend skills loaded)

Avoid:
- recursive fan-out
- peer-to-peer subagent chatter
- expensive coordinator models for trivial sidecars
- forcing models already known to be spawn-unsupported in current ChatGPT-backed worker flows

## Legacy Compatibility

`gpt-5.1-codex-max` should not be an active detected model or recommended default in `Sane`.

That means:
- ignore it when reading active Codex model caches
- keep it out of the normal picker/default story
- keep parser compatibility only if a future migration specifically needs it
- do not rank it above `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, or `gpt-5.2`

Popular-but-unverified rule:
- do not promote a newly popular external model into the default routing matrix unless we have all three:
  - source quality better than pure marketing copy
  - runtime/auth support story for the actual Sane surface
  - evidence strong enough to stay explicitly labeled as heuristic or benchmark-backed
- Kimi K2.6 currently stays a documented external candidate, not an active preset, because it is not exposed in the Codex picker/runtime surface that Sane targets today

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
- OpenCode Go full-pack export uses benchmark-reviewed defaults: `glm-5.1` for coordinator and implementation, `qwen3.6-plus` for explorer, `deepseek-v4-pro` for verifier, and `deepseek-v4-flash` for realtime
