export const pageLinks = [
  { href: "/", label: "Home" },
  { href: "/philosophy/", label: "Philosophy" },
  { href: "/how-it-works/", label: "How It Works" }
] as const;

export const primaryCtas = [
  {
    label: "Install from source",
    href: "#install"
  },
  {
    label: "View on GitHub",
    href: "https://github.com/lammersbjorn/sane"
  }
] as const;

export const heroProofs = [
  "Onboarding-first setup and repair",
  "Preview before apply",
  "Codex-native installs only",
  "Backup, restore, and scoped uninstall",
  "No required daily wrapper"
] as const;

export const practicalChanges = [
  {
    before: "You hand-edit Codex settings and hope you remember what changed.",
    after: "You preview narrow writes, keep local backups, and restore cleanly when needed."
  },
  {
    before: "Skills, hooks, overlays, and custom agents drift across machines.",
    after: "You can inspect managed surfaces and refresh only the pieces Sane owns."
  },
  {
    before: "Model/routing behavior stays implicit and runtime caveats stay hidden.",
    after: "You see typed policy classes and the boundary between documented support and spawnable-here support."
  },
  {
    before: "When setup breaks, repair is manual and usually broader than it needs to be.",
    after: "You get setup, inspect, doctor, restore, and uninstall paths with bounded local state."
  }
] as const;

export const flowSteps = [
  {
    title: "Setup",
    body: "Open the no-args TUI, review plain-language choices, and choose narrow surfaces instead of editing config by hand."
  },
  {
    title: "Inspect",
    body: "Check policy classes, integrations audit, managed targets, touched paths, and runtime history without guessing from vibes."
  },
  {
    title: "Repair",
    body: "Use preview, backup, restore, doctor, and uninstall to get back to a clean state without broad repo mutation."
  }
] as const;

export const philosophyPrinciples = [
  {
    title: "Plain-language first",
    body: "The product should explain itself without ritual commands or giant instruction files."
  },
  {
    title: "Codex-native behavior",
    body: "The real behavior lives in skills, overlays, hooks, custom agents, and narrow config writes, not in a second prompt surface."
  },
  {
    title: "Additive and reversible",
    body: "Preview before apply, preserve unrelated content, and make uninstall and restore first-class paths."
  },
  {
    title: "Thin local state",
    body: "`.sane/` should stay operational and inspectable, not grow into a second product runtime."
  },
  {
    title: "No required AGENTS.md",
    body: "Repo overlays are optional surfaces, not a mandate every repo has to adopt."
  },
  {
    title: "Setup surface, not daily wrapper",
    body: "Use Sane to set up, inspect, and repair. Then go back to using Codex normally."
  }
] as const;

export const antiClaims = [
  "Not another runtime.",
  "Not a mandatory daily wrapper.",
  "Not a repo takeover mechanism.",
  "Not a requirement to add AGENTS.md everywhere.",
  "Not a promise that future orchestration ideas already ship today."
] as const;

export const howItWorksLayers = [
  {
    title: "TUI control surface",
    body: "Onboarding, settings, install, inspect, repair, export, and uninstall live here."
  },
  {
    title: "Thin local runtime",
    body: "`.sane/` keeps local config, summaries, bounded logs, and backups for trust and recovery."
  },
  {
    title: "Codex-native surfaces",
    body: "Skills, overlays, hooks, custom agents, and narrow config writes carry the actual behavior."
  }
] as const;

export const howItWorksSteps = [
  "Open Sane and review onboarding in plain language.",
  "Preview only the changes you want.",
  "Apply a narrow Codex profile and optional integrations.",
  "Export or refresh managed Codex-native surfaces.",
  "Keep using Codex normally until you need inspect or repair."
] as const;

export const managedSurfaces = [
  ".sane/config.local.toml",
  ".sane/state/*",
  ".sane/BRIEF.md",
  ".sane/backups/",
  "~/.agents/skills/sane-router",
  "~/.codex/config.toml",
  "~/.codex/AGENTS.md",
  "~/.codex/hooks.json",
  "~/.codex/agents/",
  "<repo>/.agents/skills/",
  "<repo>/AGENTS.md (optional overlay)"
] as const;

export const runtimeArtifacts = [
  ".sane/config.local.toml",
  ".sane/state/current-run.json",
  ".sane/state/summary.json",
  ".sane/events.jsonl",
  ".sane/decisions.jsonl",
  ".sane/artifacts.jsonl"
] as const;

export const integrations = {
  recommended: ["Context7", "Playwright", "grep.app"],
  optional: ["Separate Cloudflare profile"]
} as const;

export const policyClasses = [
  "explorer",
  "implementation",
  "verifier",
  "realtime"
] as const;

export const packageBoundaries = [
  "@sane/sane-tui",
  "@sane/control-plane",
  "@sane/config",
  "@sane/core",
  "@sane/framework-assets",
  "@sane/platform",
  "@sane/policy",
  "@sane/state"
] as const;

export const closestPeers = [
  {
    name: "Superpowers",
    category: "Methodology + skill framework",
    summary: "A broad development framework for Claude Code, Codex, and OpenCode with planning, specs, TDD, review, and execution flows.",
    angle: "Sane is narrower: setup, inspect, repair, and reversible Codex-native installs.",
    href: "https://github.com/obra/superpowers"
  },
  {
    name: "gstack",
    category: "Skill pack + workflow system",
    summary: "An opinionated layer of skills, roles, and working conventions around Claude Code and Codex-style workflows.",
    angle: "Sane manages the environment and recovery path instead of being the whole behavior doctrine.",
    href: "https://github.com/garrytan/gstack"
  },
  {
    name: "Everything Claude Code",
    category: "Harness OS",
    summary: "A large harness of skills, instincts, memory, rules, commands, and MCP config across Claude Code, Codex, and OpenCode.",
    angle: "Sane stays thinner: explicit ops and trust surface first, not a full harness operating system.",
    href: "https://github.com/affaan-m/everything-claude-code"
  },
  {
    name: "OpenAgentsControl",
    category: "Approval-based execution framework",
    summary: "A plan-first framework focused on approvals, testing, validation, and code review for OpenCode and Claude Code.",
    angle: "Sane is about preparing, inspecting, and repairing Codex behavior, not running the whole execution loop.",
    href: "https://github.com/darrenhinde/OpenAgentsControl"
  }
] as const;

export const adjacentPeers = [
  {
    name: "OpenAgents",
    summary: "Persistent multi-agent workspace and launcher with shared threads, files, and browser state.",
    href: "https://github.com/openagents-org/openagents"
  },
  {
    name: "OpenCastle",
    summary: "Plugin-heavy multi-agent orchestration layer spanning Claude Code, OpenCode, Codex, and others.",
    href: "https://www.opencastle.dev/"
  },
  {
    name: "oh-my-opencode",
    summary: "A batteries-included OpenCode harness with hooks, commands, skills, memory, and TUI helpers.",
    href: "https://github.com/code-yeongyu/oh-my-opencode"
  },
  {
    name: "gitagent",
    summary: "A git-native standard for defining agents, skills, hooks, memory, and runtime state.",
    href: "https://github.com/open-gitagent/gitagent"
  }
] as const;

export const installCommand = `git clone https://github.com/lammersbjorn/sane.git
cd sane
cargo run -p sane`;

export const installNotes = [
  "Pre-release and source-first today.",
  "Packaging and distribution polish come later.",
  "BuildStory stays secondary to the product story."
] as const;

export const buildStoryHref = "https://www.buildstory.com/projects/sane";
