# Docs Writing Skill Audit

Date: April 29, 2026

This note records the research behind Sane's optional `docs-craft` pack. The
goal is not to vendor a generic documentation skill. The goal is a small
Sane-owned skill that helps Codex write source-verified user docs without
inflating startup context.

## Sources

Official Codex and skill guidance:

- https://developers.openai.com/codex/skills
- https://academy.openai.com/public/resources/skills
- /Users/bjorn/.codex/skills/.system/skill-creator/SKILL.md

Instruction-surface research:

- https://arxiv.org/abs/2602.11988
- docs/research/2026-04-23-codex-instruction-surface-rules.md

Docs-writing skill references:

- https://raw.githubusercontent.com/google-gemini/gemini-cli/main/.gemini/skills/docs-writer/SKILL.md
- https://skills.sh/google-gemini/gemini-cli/docs-writer
- https://agentskill.sh/aiskillstore/writing-docs
- https://agentskill.sh/api/agent/skills/aiskillstore%2Fwriting-docs/install
- https://agentskills.so/skills/inkeep-team-skills-docs
- https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md

## What To Reuse

- Codex skills use progressive disclosure. The startup-visible `description`
  must be trigger-oriented because Codex only loads the body after the skill is
  selected.
- Good docs skills require source investigation before edits. Gemini's
  docs-writer is strong on code/docs audit, link checks, heading checks, and
  plain language.
- Inkeep's docs skill is strong on documentation scope: build a model of what
  changed, trace downstream docs surfaces, document shipped reality, and avoid
  making one new feature dominate every page.
- The aiskillstore writing-docs skill is useful as a generic checklist for
  clarity, examples, audience, and scannability.
- Obra's writing-plans skill is useful for exactness: concrete paths, commands,
  expected output, and no placeholders.

## What Not To Copy

- Do not vendor broad templates for every language and docstring style. Sane
  needs product/user docs guidance, not a 9 KB generic docs compendium.
- Do not copy project-specific Gemini rules such as sidebar checks, formatter
  commands, quota terminology, or naming rules.
- Do not make docs writing an always-on overlay. ETH-aligned Sane guidance says
  long context files can increase cost and reduce task success when they add
  unnecessary requirements.
- Do not put Sane product doctrine in several surfaces. The skill should point
  agents to source truth and local conventions, not duplicate all repo docs.

## Sane-Specific Rules

- The skill is optional, under `docs-craft`, and Sane-owned.
- It should trigger for README, user guides, changelogs, release notes,
  package READMEs, support docs, and docs audits.
- It should keep the body compact and procedural: classify the doc surface,
  build a source map, map impacted docs, rewrite proportionally, and verify.
- It should explicitly keep the TUI in scope: install, configure, update,
  export, status, repair, and doctor flows. It must not present the TUI as the
  normal prompting interface.
- It should distinguish evergreen docs from release narration. Changelogs can
  describe change over time; READMEs and guides should describe current
  behavior.

## Recommendation

Ship `sane-docs-writing` as a Sane-owned optional upstream-informed pack, not as
a default core skill and not as an unmodified third-party skill.

This follows the ETH-aligned model:

1. Keep root and overlay context small.
2. Put repeatable documentation procedure behind a task-specific skill.
3. Require source facts, impact mapping, and verification before claiming docs
   are correct.
4. Keep provenance in the pack manifest so upstream influences are visible
   without importing their full instructions into user prompts.
