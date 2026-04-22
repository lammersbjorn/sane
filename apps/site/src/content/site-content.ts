export const navLinks = [
  { href: "#why", label: "Why Sane" },
  { href: "#how", label: "How it works" },
  { href: "#peers", label: "Peers" },
  { href: "#install", label: "Install" },
  { href: "https://github.com/lammersbjorn/sane", label: "GitHub" }
] as const;

export const heroBadges = [
  "Not another runtime",
  "Preview. Backup. Restore. Uninstall.",
  "Plain-language first"
] as const;

export const heroTitle = "The control plane for Codex.";

export const heroBody =
  "Onboarding-first setup, inspect, and repair for your Codex environment.";

export const heroSubBody =
  "Sane is a Codex-native setup and recovery control plane. It keeps writes narrow, state inspectable, and rollback explicit.";

export const heroActions = [
  { href: "#install", label: "Get started" },
  {
    href: "https://github.com/lammersbjorn/sane/blob/main/docs/what-sane-does.md",
    label: "Read the docs"
  }
] as const;

export const commandPreview = "$ sane --help";

export const setupRail = [
  {
    step: "01",
    title: "Setup",
    body: "Onboard Codex with sane defaults. Generate config, wire integrations, and validate your environment."
  },
  {
    step: "02",
    title: "Inspect",
    body: "Understand your current state. Review diffs, hooks, skills, and impacts in plain language."
  },
  {
    step: "03",
    title: "Repair",
    body: "Apply safe, reversible changes. Preview, backup, restore, or uninstall on your terms."
  }
] as const;

export const diagramInputs = [
  { title: "Files", meta: "scoped writes only" },
  { title: "Diffs", meta: "+12 / -4" },
  { title: "Hooks", meta: "pre / post controls" },
  { title: "Skills", meta: "codex-native helpers" }
] as const;

export const diagramOutputs = [
  { title: "Preview", meta: "see planned changes" },
  { title: "Backup", meta: "point-in-time snapshots" },
  { title: "Restore", meta: "revert with confidence" },
  { title: "Uninstall", meta: "leave nothing behind" }
] as const;

export const lowerCards = [
  {
    title: "Managed surfaces",
    items: [
      { label: "Configuration files", body: "codex.yml, sane.json, .env, and more" },
      { label: "Hooks and integrations", body: "Lifecycle hooks, webhooks, and triggers" },
      { label: "Skills", body: "Local and remote skills, prompts, and templates" },
      { label: "Environment", body: "Paths, permissions, tokens, and toolchains" }
    ]
  },
  {
    title: "Closest peers",
    items: [
      { label: "Superpowers", body: "Workflow and methodology layer" },
      { label: "gstack", body: "Skill-pack and behavior framework" },
      { label: "Everything Claude Code", body: "Harness OS across agents" },
      { label: "OpenAgentsControl", body: "Approval and execution framework" }
    ]
  },
  {
    title: "Install from source",
    items: []
  }
] as const;

export const installCommand = `git clone https://github.com/lammersbjorn/sane.git
cd sane
cargo run -p sane`;

export const installMeta = [
  "Pre-release and source-first today",
  "Packaging comes later",
  "View on GitHub"
] as const;

export const bottomColumns = [
  {
    title: "What changes in practice",
    body: "Sane sits next to Codex and makes every change reversible, every run inspectable, and every environment recoverable.",
    cta: "Explore how"
  },
  {
    title: "Closest peers",
    list: [
      {
        label: "Superpowers",
        body: "Great for workflow doctrine. Not purpose-built for setup, repair, and bounded local recovery."
      },
      {
        label: "gstack",
        body: "Great for skill layering. Not for taking action on config state and restoration."
      },
      {
        label: "Everything Claude Code",
        body: "Great for full harness behavior. Not for a thinner Codex control plane."
      }
    ]
  },
  {
    title: "Why Sane is narrower",
    body: "Sane does not try to be everything. It is not a coding runtime, a task manager, or an agent platform. It is a control plane for Codex so teams can move faster with confidence.",
    cta: "Learn more"
  }
] as const;

export const footerStatement = {
  title: "Built for teams who ship with Codex.",
  body: "Auditable by default. Reversible always. Local first."
} as const;
