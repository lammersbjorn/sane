# Sane MCP / Default Tool Audit

Last updated: 2026-04-19

Purpose:
- verify the current `recommended-integrations` direction with primary sources
- decide whether to keep, add, or drop MCP/default-tool candidates
- separate broad default recommendations from provider-specific optional profiles

## Audit Rule

A broadly recommended MCP/default tool for `Sane` should satisfy most of these:
- official or clearly first-party maintained
- broad utility across many coding workflows
- low setup friction
- low privilege / low blast radius by default
- useful in plain-language Codex workflows without forcing ceremony
- compatible with Sane's token/speed philosophy

If a tool is powerful but high-privilege or provider-specific, it should move to a separate optional profile instead of the broad default recommendation set.

## Primary Sources

- Context7:
  - [upstash/context7](https://github.com/upstash/context7)
  - [Context7 CLI docs](https://context7.com/docs/clients/cli)
- Playwright MCP:
  - [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- Grep MCP:
  - [Vercel Grep MCP announcement](https://vercel.com/blog/grep-a-million-github-repositories-via-mcp)
- GitHub MCP:
  - [github/github-mcp-server](https://github.com/github/github-mcp-server)
- Vercel MCP:
  - [Vercel MCP docs](https://vercel.com/docs/agent-resources/vercel-mcp)
- Supabase MCP:
  - [Supabase MCP docs](https://supabase.com/docs/guides/getting-started/mcp)
- Cloudflare MCP:
  - [cloudflare/mcp](https://github.com/cloudflare/mcp)
  - [Cloudflare MCP server docs](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)
- OpenSRC:
  - [opensrc official site](https://opensrc.sh/)
- Context Mode:
  - [mksglu/context-mode](https://github.com/mksglu/context-mode)
  - [Context Mode benchmark doc](https://raw.githubusercontent.com/mksglu/context-mode/main/BENCHMARK.md)
- Code Review Graph:
  - [tirth8205/code-review-graph](https://github.com/tirth8205/code-review-graph)
- MCP security research:
  - [Beyond the Protocol: Unveiling Attack Vectors in the MCP Ecosystem](https://arxiv.org/abs/2506.02040)
  - [Security and Safety in the MCP Ecosystem](https://arxiv.org/abs/2512.08290)
  - [Defending LLMs Against Tool Poisoning and Adversarial Attacks](https://arxiv.org/abs/2512.06556)

## Verified Findings

### 1. Context7

Verdict:
- keep in broad recommended profile

Why:
- first-party maintained by Upstash
- broad utility across many stacks
- optimized for current docs/examples rather than raw web search
- supports direct MCP configuration and CLI/skills setup

Notes:
- API key is recommended for better rate limits
- still acceptable as an optional recommendation rather than mandatory default

### 2. Playwright MCP

Verdict:
- keep in broad recommended profile

Why:
- official Microsoft server
- broad utility for browser QA, verification, scraping, and UX validation
- deterministic structured interaction is a strong fit for agent workflows

Risk note:
- browser automation is inherently higher impact than docs lookup
- still acceptable in recommended profile because it is broadly useful and first-party
- Sane should prefer safer defaults when configuring it later:
  - isolated profiles when appropriate
  - explicit host restrictions if exposed in TUI/config

### 3. Grep MCP

Verdict:
- add to broad recommended profile

Why:
- official Vercel-backed MCP endpoint
- broad utility for public code-pattern research
- read-only public-code search keeps risk lower than repo-write servers
- complements Context7:
  - Context7 = docs/examples for libraries
  - Grep = public implementation pattern search across repos

Why it fits Sane:
- strong plain-language research value
- fast payoff
- low auth friction
- useful for many users, not only one provider ecosystem

### 4. OpenSRC

Verdict:
- drop from broad recommended profile
- keep experimental / advanced optional only

Why:
- official `opensrc` product exists, but I did not find first-party MCP docs comparable to Context7 / Playwright / GitHub / Vercel / Supabase
- public evidence for `opensrc-mcp` is mostly ecosystem/marketplace/community packaging rather than clear first-party official docs
- broad default recommendation bar is higher than "interesting and useful"

Interpretation:
- official CLI/tooling appears real and useful
- official MCP status is not clear enough for broad default recommendation
- this is exactly the kind of server the security research suggests treating cautiously

### 5. GitHub MCP

Verdict:
- not broad default
- add as separate optional provider/power profile later

Why:
- official and powerful
- but it can be high privilege and auth heavy
- better for users who explicitly want GitHub repo / issue / PR / CI automation

Good future shape:
- `github-power` optional profile
- read-only and limited-toolset variants should be first-class choices

### 6. Vercel MCP

Verdict:
- not broad default
- add as provider-specific optional profile later

Why:
- official
- useful only for Vercel users
- OAuth/client approval requirements make it less universal

Good future shape:
- `vercel` optional provider profile

### 7. Supabase MCP

Verdict:
- not broad default
- add as provider-specific optional profile later

Why:
- official
- useful only for Supabase users
- Supabase docs explicitly warn it is designed for development/testing and not production data

Good future shape:
- `supabase-dev` optional provider profile with strong warning text

### 8. Cloudflare MCP

Verdict:
- not broad default
- add as provider-specific optional profile later

Why:
- official and well-documented
- strong token-efficiency story through Cloudflare code mode
- broad Cloudflare product coverage
- still provider-specific and permissioned
- belongs with other cloud/provider profiles, not the “almost everyone” baseline

Good future shape:
- `cloudflare` optional provider profile
- preview permissions clearly before install
- keep it out of the broad recommended profile unless the user explicitly wants Cloudflare tooling

### 9. Context Mode

Verdict:
- not broad default
- do not treat as a core Sane pack
- keep as experimental optional integration only, if at all

Why:
- the project is real and ambitious:
  - claims 96% overall context savings across 21 scenarios in its own benchmark doc
  - uses sandbox tools, local SQLite + FTS5/BM25, and hook-driven session continuity
  - ships Codex-specific config, hooks, and `AGENTS.md` templates
- but for Codex specifically it is still blocked on upstream hook dispatch:
  - the repo's Codex instructions say hook scripts are ready but dispatch is still waiting on upstream wiring
  - it falls back to copying routing instructions into `AGENTS.md` for model awareness
- licensing is a direct blocker for core import:
  - `context-mode` uses `Elastic-2.0`
  - Sane is `MIT OR Apache-2.0`
- that collides with Sane's product boundary:
  - Sane should not require a giant routing layer or turn itself into a context-owning wrapper
  - Sane treats `AGENTS.md` as optional, not as mandatory glue for normal operation

Useful ideas to steal:
- sandbox large-output tools before they flood context
- keep session continuity in thin local state with retrieval, not raw dumps
- prefer executable analysis over pasting giant outputs into the model

Why not default in Sane:
- too much ceremony and routing ownership
- too dependent on hooks that are not ready enough on Codex
- upstream Codex hook support still looks unsettled / contradictory in their own docs and adapters
- too close to becoming an alternate operating layer instead of a narrow optional integration

Good future shape:
- experimental `context-efficiency` integration profile later
- or selective inspiration inside Sane internals:
  - better compaction retrieval
  - better large-output summarization
  - better local indexing

### 10. Code Review Graph

Verdict:
- not broad default
- stronger candidate than Context Mode for a future optional integration profile
- especially relevant for review / impact / architecture workflows

Why:
- directly supports Codex installation and MCP config
- narrower and more additive than Context Mode
- benchmark claims are more concrete and more obviously aligned with review workflows:
  - 8.2x average token reduction across 6 repos / 13 commits
  - 100% recall on impacted-file detection with 0.54 average F1
  - local SQLite graph, Tree-sitter parsing, incremental updates under 2 seconds on the stated large-repo example
- but the actual surface is already large and moving:
  - current code exposes about 30 tools plus 5 prompts
  - some docs still describe smaller older counts
- its installer mutates many surfaces that Sane should own itself:
  - Codex config
  - hooks
  - `AGENTS.md` / other platform rule files
  - git hooks

Why not broad default:
- review/impact analysis is valuable, but narrower than docs lookup, browser verification, or public-code search
- adds local indexing/watch hooks and nontrivial repo analysis machinery
- payoff is highest on larger repos and multi-file review work, not every Codex session
- direct `code-review-graph install` would conflict with Sane's additive/reversible managed-surface contract

Good future shape:
- optional `review-intel` or `graph-review` profile later
- possible custom Sane MCP inspiration for:
  - blast-radius analysis
  - affected-test discovery
  - architecture / dependency summaries
  - monorepo-aware code review workflows

## Security Implication

The research strongly supports a conservative default posture:
- broad default recommendations should bias toward official and lower-risk servers
- marketplace/community MCPs should not enter default recommendations casually
- preserve explicit opt-in for higher-privilege or less-proven servers

This supports Sane's philosophy:
- low lock-in
- low surprise
- fewer risky defaults
- high-signal opt-in power when wanted

## Recommendation

### Broad recommended profile

Keep this profile intentionally small:
- `Context7`
- `Playwright`
- `grep.app`

### Separate optional profiles later

- `github-power`
- `vercel`
- `supabase-dev`
- `cloudflare`
- `review-intel` / `graph-review`

### Experimental / advanced only

- `OpenSRC`
- `Context Mode`

## Decision

Update the current `recommended-integrations` stance to:
- keep `Context7`
- keep `Playwright`
- add `grep.app`
- remove `OpenSRC` from default recommended profile
- move GitHub/Vercel/Supabase into provider-specific optional profiles later
- move Cloudflare into provider-specific optional profiles later
- keep `Context Mode` experimental only unless Codex-native hook maturity improves and the integration can stay optional/additive
- treat `Code Review Graph` as a promising later optional review/impact profile, not a broad default
