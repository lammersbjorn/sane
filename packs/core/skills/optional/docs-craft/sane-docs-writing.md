---
name: sane-docs-writing
description: Use when writing, rewriting, auditing, or reviewing README files, user guides, package docs, support docs, changelogs, release notes, migration notes, or other product documentation that must be accurate, concise, source-verified, and aligned with Sane's Codex framework positioning.
---

# Sane Docs Writing

## Goal

Write docs that help readers act from current truth. Keep claims verified, keep
structure proportional to the surface, and keep instruction context small.

## Use When

- creating or editing README files, package docs, or user guides
- rewriting support, contributing, changelog, release, or migration docs
- auditing docs after product, config, install, or exported-surface changes
- reducing docs bloat while preserving the facts readers need

## Don't Use When

- task is code implementation with no docs change needed
- output is private brainstorming, scratch notes, or a throwaway plan
- request is pure marketing copy with no source-verification requirement
- a narrower repo skill gives more exact docs rules for the target surface

## Inputs

- user outcome or changed behavior
- target docs and neighboring docs for style
- source truth: code, config schemas, tests, package metadata, existing specs,
  decisions, or runnable commands
- verification command that matches the edit size

## How To Run

1. Classify the surface.
   - README: explain what the project is, who it is for, core capabilities,
     install path, first useful run, and where to go next.
   - User guide or package README: explain one reader task with exact commands,
     prerequisites, limits, and links.
   - Changelog or release notes: group user-visible impact. Mention breaking
     changes and migration paths before minor polish.
   - Support, contributing, or security docs: explain responsibility, expected
     process, and exact contact or command paths.
2. Build a minimal source map before editing. List only the files or commands
   needed to verify claims.
3. Discover local conventions. Read nearby docs, any docs style guide, and any
   repo-local documentation skill before inventing structure.
4. Map impact. Decide which docs must change, which docs need a small cross-link
   or sentence, and which docs should stay untouched.
5. Rewrite from reader need to implementation detail. Lead with outcome, then
   commands or behavior, then constraints. Use active voice and concrete nouns.
6. Keep evergreen docs evergreen. Do not say "new", "now", "previously", or
   "as of this release" outside changelogs or migration notes.
7. Match granularity to the page. Do not paste the same feature explanation into
   every doc that mentions it.
8. Preserve Sane product framing. Sane is an agent framework for Codex: routing,
   skills, scoped agents, guidance packs, setup checks, and reversible config.
   The TUI is for install, configure, update, export, status, repair, and
   doctor flows. Do not present the TUI as the normal prompting interface.
9. Remove weak phrasing. Avoid hype, vague superlatives, feature theater, and
   lines that sound better than they explain.

## Verification

- every command, path, flag, package name, and config key exists or is clearly
  marked as future/planned
- behavior claims match source truth or tested output
- headings and links still resolve after edits
- changelog entries are historical; READMEs and guides describe current state
- docs mention the TUI only where install/config/status/repair/update/export
  flows matter
- final response names changed docs and verification run

## Gotchas

- Do not document a plan as if it shipped.
- Do not document self-evident code just to make docs longer.
- Do not hide breaking changes in a generic "improvements" bucket.
- Do not duplicate product policy from root guidance into every doc.
- Do not leave placeholders, invented commands, or untested examples.
