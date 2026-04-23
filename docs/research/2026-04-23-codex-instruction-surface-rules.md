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
- https://opencode.ai/docs/rules
- https://opencode.ai/docs/skills
- https://opencode.ai/docs/agents

Research and video context:

- https://www.sri.inf.ethz.ch/publications/gloaguen2026agentsmd
- https://arxiv.org/abs/2602.11988
- https://www.youtube.com/watch?v=GcNu6wrLTJc
- https://github.com/obra/superpowers
- https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md
- https://docs.openagents.com/
- https://docs.openagents.com/guidance-modules

## Main Findings

1. Startup-visible context must stay small.
   Only `name` and `description` are available for skill discovery in many systems. Large always-on files waste tokens and degrade routing.

2. `AGENTS.md` should hold durable repo truth only.
   Keep it to product frame, startup rules, exact verify commands, and hard boundaries. Move procedures and task detail into skills or docs.

3. Repo-local skills must each do one job.
   Good triggering comes from a sharp description plus clear `Use when` and `Don't use when` guidance, not from giant bodies.

4. Progressive disclosure is required.
   Keep the main `SKILL.md` lean. Move bulky detail into repo docs, `references/`, scripts, or other exact artifacts.

5. Prompt hardening belongs in structure, not just prose.
   Prefer validators, scripts, permissions, hooks, and exact output contracts over broad natural-language rulebooks.

6. Duplicate policy across multiple files is an anti-pattern.
   If the same rule appears in root `AGENTS.md`, repo-local skills, overlays, and agent templates, it will drift and waste context.

7. Generated or broad repo summaries are weak default context.
   ETH research found no overall success gain from context files and higher inference cost. The video reaches the same practical conclusion: repeated restatement of discoverable repo facts is usually the wrong spend.

8. Task-specific skills beat vague pack umbrellas.
   Router or pack glue should point to the exact concrete skill or agent. It should not try to become a second system prompt.

## Hard Rules For Sane

### Root `AGENTS.md`

- Keep it short.
- Include only:
  - product frame
  - startup rules
  - exact verify commands
  - hard repo boundaries
  - done criteria
- Do not put long workflow prose here.

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
- If the body grows large, split detail into repo docs or `references/`.

### Exported Sane-managed skills and overlays

- Keep router/overlay content small and role-specific.
- Router skills should:
  - tell Codex when to use Sane-managed surfaces
  - point to concrete pack skills or agents
  - avoid broad daily-wrapper behavior
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
- Avoid unverified marketing-style claims inside skills.
- Do not copy vendor skill doctrine into repo-local always-on surfaces.
- Prefer changing Sane-owned routing/export layers before editing vendored upstream mirrors.

## Current Local Fixes Required

- Root `AGENTS.md` needed verify commands and done criteria.
- `.agents/skills/sane-self-hosting` needed sharper routing, less duplication, and explicit outputs/verification.
- `.agents/skills/continue` needed stronger continuation rules without forcing status chatter or mega-plans.
- `packs/core/overlays/global-agents.md.tmpl` and `repo-agents.md.tmpl` needed to stop duplicating each other.
- `packs/core/skills/sane-router.md.tmpl` needed a tighter contract and clearer non-goals.
- `packs/core/skills/optional/sane-caveman.md` needed a smaller, safer contract without unverifiable token claims.
