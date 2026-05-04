# Codex Instruction Surface Rules

Date: April 23, 2026

This research note defines the rules Sane should follow for root `AGENTS.md`, repo-local skills, and exported instruction templates.

## Sources

Official Codex / OpenAI:

- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/learn/best-practices
- https://developers.openai.com/codex/skills
- https://developers.openai.com/api/docs/guides/prompt-engineering#coding
- https://developers.openai.com/api/docs/guides/reasoning-best-practices#how-to-prompt-reasoning-models-effectively
- https://developers.openai.com/api/docs/guides/prompt-guidance#keep-outputs-compact-and-structured
- https://developers.openai.com/cookbook/examples/skills_in_api
- https://developers.openai.com/cookbook/examples/prompt_caching101
- https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide
- https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_troubleshooting_guide

Adjacent standards and competitors:

- https://agentskills.io/specification
- https://agentskills.io/skill-creation/best-practices
- https://agentskills.io/skill-creation/optimizing-descriptions
- https://agentskills.io/skill-creation/using-scripts
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
- https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/sub-agents

Research and video context:

- https://www.sri.inf.ethz.ch/publications/gloaguen2026agentsmd
- https://arxiv.org/abs/2602.11988
- https://arxiv.org/abs/2603.00822
- https://research.ibm.com/publications/measuring-agents-in-production
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/learn/best-practices
- https://www.youtube.com/watch?v=GcNu6wrLTJc
- https://github.com/obra/superpowers
- https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md
- https://docs.openagents.com/
- https://docs.openagents.com/guidance-modules

## Main Findings

1. Startup-visible context must stay minimal.
   ETH Zurich (arXiv:2602.11988) reports no aggregate success gain from context-file usage and a clear cost increase from longer prompts. Keep always-on surfaces small and static.

2. `AGENTS.md` should hold durable repo truth only.
   Keep it to product frame, startup rules, exact verify commands, and hard boundaries. Move procedures and task detail into skills or docs.

3. Repo-local skills must each do one job.
   Good triggering comes from a sharp description plus clear `Use when` and `Don't use when` guidance, not from giant bodies.

4. Progressive disclosure is required.
   Keep the main `SKILL.md` lean. Move bulky detail into repo docs, `references/`, scripts, or other exact artifacts loaded only when triggered.

5. Prompt hardening belongs in structure, not just prose.
   Prefer validators, scripts, permissions, hooks, and exact output contracts over broad natural-language rulebooks.

6. Duplicate policy across multiple files is an anti-pattern.
   If the same rule appears in root `AGENTS.md`, repo-local skills, overlays, and agent templates, it will drift and waste context.

7. Generated or broad repo summaries are weak default context.
   ETH research found no overall success gain from context files and higher inference cost. Do not auto-generate or auto-inject repo overviews as always-on context.

8. Task-specific skills beat vague pack umbrellas.
   Router or pack glue should point to the exact concrete skill or agent. It should not try to become a second system prompt.

9. Positive capability framing is the default.
   Agents tend to follow context-file instructions, including incidental constraints. Phrase guidance as the desired action, path, output, and verification. Reserve negative wording for true safety boundaries and risky operations.

10. Natural-language guardrails need executable support.
   ContextCov (arXiv:2603.00822) frames AGENTS.md-style files as passive text and argues for deriving executable constraints from instruction files. Prompt surfaces should point to hooks, validators, tests, and output contracts rather than repeating safety prose.

11. Production agent reliability is systems work.
   IBM MAP research reports reliability as the top production-agent challenge and shows practitioners addressing it with systems-level design. Treat prompt wording as one layer beside scoped tools, checks, observability, and repair paths.

12. Skills use progressive disclosure.
   OpenAI Codex skills docs state that Codex initially sees skill names, descriptions, and paths, then reads full `SKILL.md` only after selecting a skill. Skill descriptions must be concise, trigger-oriented, and scoped because they are the always-visible matching surface.

## Hard Rules For Sane

### Rewrite Rules (ETH-aligned)

1. Minimal always-on context.
   Keep root/repo overlays to durable constraints only. Move execution detail out of always-on surfaces.

2. No generated repo overviews.
   Ban synthesized "repo summary" blocks in always-on prompts. Load concrete files on demand.

3. Exact task-relevant requirements only.
   Require concrete paths, commands, boundaries, and outputs tied to current task. Remove generic doctrine.

4. Progressive disclosure by default.
   Discovery text small; detailed guidance lives in skill-local docs/scripts/references and is opened only when needed.

5. Role/surface-specific prompt contracts.
   Each surface (router, lane, concrete skill, overlay) must define role, authority, tool/write scope, required output shape, and stop conditions.

6. Verification is mandatory and explicit.
   Every editing surface must declare verification command(s) and completion criteria before done is claimed.

7. Capability-first language.
   Prefer "use X for Y", "surface blocker Z", and "verify with command C" over repeated "do not" lists. Keep hard prohibitions close to destructive or security-sensitive actions.

8. Executable checks over repeated prose.
   Put recurring enforcement in hooks, validators, tests, or typed contracts when possible. Instruction text should name the check and when to run it.

9. Description-first skill design.
   Since skill descriptions are the initial discovery surface, write them as compact trigger contracts. Put workflow detail in the skill body and bulky references under `references/` or scripts.

### Root `AGENTS.md`

- Keep it short.
- Include only:
  - product frame
  - startup rules
  - exact verify commands
  - hard repo boundaries
  - done criteria
- Keep long workflow prose in triggered skills or docs.
- Keep generated repository overviews out of always-on context.

### Repo-local skills in `.agents/skills`

- Keep only Sane-specific repo truth here.
- Use explicit sections:
  - `Goal`
  - `Use when`
  - `Don't use when`
  - `Inputs`
  - `Outputs`
  - `How to run`
  - `Verification`
  - `Gotchas / Safety`
  - `Examples`
- Keep descriptions concrete and trigger-oriented.
- Include only exact task-relevant requirements for that skill.
- If the body grows large, split detail into repo docs or `references/`.

### Exported Sane-managed skills and overlays

- Keep router/overlay content small and role-specific.
- Router skills should:
  - tell Codex when to use Sane-managed surfaces
  - point to concrete pack skills or agents
  - stay scoped to routing rather than daily-wrapper behavior
- Every surface must define its prompt contract:
  - role and non-goals
  - authority and edit boundary
  - tools allowed and disallowed
  - required output format
  - verification and done condition
- Global overlays and repo overlays must not be duplicates.
- Agent templates should define:
  - exact role
  - exact tool/write boundary
  - expected output shape
  - verification expectation

### Hardening and token rules

- Prefer one job per skill or agent.
- Prefer exact validators and exact paths over broad advice.
- Prefer small static instruction surfaces and dynamic task state later.
- Keep unverified marketing-style claims out of skills.
- Keep vendor skill doctrine out of repo-local always-on surfaces.
- Prefer changing Sane-owned routing/export layers before editing vendored upstream mirrors.

## Current Local Fixes Required

- Root `AGENTS.md` needed verify commands and done criteria.
- `.agents/skills/sane-self-hosting` needed sharper routing, less duplication, and explicit outputs/verification.
- `.agents/skills/continue` needed stronger continuation rules without forcing status chatter or mega-plans.
- `packs/core/overlays/global-agents.md.tmpl` and `repo-agents.md.tmpl` needed to stop duplicating each other.
- `packs/core/skills/sane-router.md.tmpl` needed a tighter contract and clearer non-goals.
- `packs/core/skills/optional/sane-caveman.md` needed a smaller, safer contract without unverifiable token claims.
