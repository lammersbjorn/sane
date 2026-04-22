export const primaryCtas = [
  {
    label: "View on GitHub",
    href: "https://github.com/lammersbjorn/sane"
  },
  {
    label: "Read what Sane does",
    href: "https://github.com/lammersbjorn/sane/blob/main/docs/what-sane-does.md"
  }
] as const;

export const proofPoints = [
  "Onboarding-first setup and repair",
  "Preview before apply",
  "Backup and restore paths",
  "Typed inspect visibility",
  "Codex-native installs, not wrapper ritual"
] as const;

export const practicalChanges = [
  {
    before: "Hand-edit Codex files and hope you remember the diff.",
    after: "Preview narrow writes, then apply with local backup + restore."
  },
  {
    before: "Integrations drift silently across machines.",
    after: "Inspect managed integrations with explicit recommended vs optional scope."
  },
  {
    before: "Policy/routing intent stays implicit.",
    after: "See typed policy classes and runtime caveats in one place."
  },
  {
    before: "Repair path is ad hoc after breakage.",
    after: "Use setup, inspect, doctor, and uninstall flows with bounded state."
  }
] as const;

export const managedSurfaces = [
  ".sane/config.local.toml",
  ".sane/state/*",
  ".sane/backups/",
  "~/.agents/skills/",
  "~/.codex/config.toml",
  "~/.codex/AGENTS.md",
  "~/.codex/hooks.json",
  "~/.codex/agents/",
  "<repo>/.agents/skills/",
  "<repo>/AGENTS.md (optional overlay)"
] as const;

export const integrations = {
  recommended: ["Context7", "Playwright", "grep.app"],
  optional: ["cloudflare-api profile"]
} as const;

export const policyClasses = [
  "explorer",
  "implementation",
  "verifier",
  "realtime"
] as const;

export const whatSaneDoesNotChange = [
  "Not a replacement for Codex.",
  "Not a mandatory daily wrapper.",
  "No required AGENTS.md.",
  "No forced repo takeover."
] as const;

export const directCompetitors = [
  {
    name: "openagentsbtw",
    summary: "Strong open framework momentum and broad agentic surface.",
    angle: "Sane is narrower: setup, inspect, repair, reversible Codex-native installs."
  },
  {
    name: "Superpowers",
    summary: "Method-heavy engineering workflows and quality rails.",
    angle: "Sane focuses on control-plane trust before process depth."
  },
  {
    name: "gstack",
    summary: "Stacked orchestration patterns for broader execution flows.",
    angle: "Sane keeps runtime thin and keeps Codex interaction normal."
  },
  {
    name: "cc-thingz",
    summary: "Codex-adjacent utilities and community add-on patterns.",
    angle: "Sane emphasizes typed managed surfaces with uninstall symmetry."
  },
  {
    name: "Arc",
    summary: "Adjacent agent-runtime framing with broader operating posture.",
    angle: "Sane avoids becoming a second daily operating system."
  },
  {
    name: "Everything Claude Code",
    summary: "High-volume guidance and workflow content for Claude Code users.",
    angle: "Sane sticks to executable setup-repair boundaries for Codex."
  }
] as const;

export const saneWedges = [
  {
    title: "Control plane, not daily wrapper",
    body: "Sane handles setup, install, inspect, and repair. Prompting stays in Codex."
  },
  {
    title: "Typed truth over vibes",
    body: "Integrations audit, policy classes, and bounded runtime state stay visible."
  },
  {
    title: "Reversible by default",
    body: "Preview, backup, restore, and scoped uninstall keep changes auditable."
  }
] as const;

export const installCommand = `git clone https://github.com/lammersbjorn/sane.git
cd sane
cargo run -p sane`;
