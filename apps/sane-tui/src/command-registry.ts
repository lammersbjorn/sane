import { OperationKind } from "@sane/core";
import { type HostPlatform } from "@sane/platform";

export type TuiSectionId = "home" | "settings" | "add_to_codex" | "status" | "repair" | "uninstall";
export type LaunchShortcut = "default" | "install" | "settings" | "status" | "repair" | "uninstall";

export type BackendCommandId =
  | "install_runtime"
  | "show_config"
  | "export_portable_settings"
  | "import_portable_settings"
  | "install_from_portable_settings"
  | "show_codex_config"
  | "show_runtime_summary"
  | "show_outcome_readiness"
  | "advance_outcome"
  | "review_issue_draft"
  | "submit_issue_draft"
  | "reset_telemetry_data"
  | "toggle_auto_updates"
  | "preview_policy"
  | "backup_codex_config"
  | "preview_codex_profile"
  | "preview_integrations_profile"
  | "preview_cloudflare_profile"
  | "preview_statusline_profile"
  | "apply_codex_profile"
  | "apply_integrations_profile"
  | "apply_cloudflare_profile"
  | "apply_statusline_profile"
  | "restore_codex_config"
  | "export_user_skills"
  | "export_repo_skills"
  | "export_repo_agents"
  | "export_global_agents"
  | "export_hooks"
  | "export_custom_agents"
  | "export_opencode_all"
  | "export_all"
  | "uninstall_user_skills"
  | "uninstall_repo_skills"
  | "uninstall_repo_agents"
  | "uninstall_global_agents"
  | "uninstall_hooks"
  | "uninstall_custom_agents"
  | "uninstall_all"
  | "check_updates"
  | "show_status"
  | "doctor";

export type UiCommandId =
  | BackendCommandId
  | "open_config_editor"
  | "open_pack_editor"
  | "open_privacy_editor";

export interface CommandConfirmationSpec {
  required: boolean;
  impactCopy: string;
  remindPreviewOrBackup: boolean;
}

export interface CommandSpec {
  id: UiCommandId;
  kind: "backend" | "editor";
  backendKind: OperationKind | null;
  help: string[];
  confirmation: CommandConfirmationSpec | null;
  successNoticeTitle:
    | "Saved"
    | "Installed"
    | "Backed Up"
    | "Applied"
    | "Reset"
    | "Restored"
    | "Uninstalled"
    | null;
  repoMutation: boolean;
  filesTouched: string[];
  includes?: string[];
}

export interface CommandPlacement {
  commandId: UiCommandId;
  section: TuiSectionId;
  order: number;
  label: string;
}

export interface TuiSectionMetadata {
  id: TuiSectionId;
  tabLabel: string;
  docLabel: string;
  description: string[];
  launchShortcut?: LaunchShortcut;
}

export interface SectionActionMetadata extends CommandSpec {
  label: string;
  order: number;
  section: TuiSectionId;
}

const WINDOWS_EXPORT_ALL_FILES_TOUCHED = [
  "~/.agents/skills/sane-router",
  "~/.agents/skills/sane-bootstrap-research",
  "~/.agents/skills/sane-agent-lanes",
  "~/.agents/skills/sane-outcome-continuation",
  "~/.agents/skills/continue",
  "~/.codex/AGENTS.md",
  "~/.codex/agents/"
] as const;

const WINDOWS_EXPORT_ALL_INCLUDES = ["user-skills", "global-agents", "custom-agents"] as const;

export const COMMAND_METADATA_REGISTRY = {
  shortcuts: {
    default: "status",
    install: "home",
    settings: "settings",
    status: "status",
    repair: "repair",
    uninstall: "uninstall"
  } as const,
  sections: [
    {
      id: "home",
      tabLabel: "Setup",
      docLabel: "Setup",
      launchShortcut: "default",
      description: [
        "Finish first-time setup in one pass.",
        "Prepare local files, pick defaults, review Codex changes, keep rollback point, then install Sane add-ons.",
        "After setup completes, normal `sane` should open Check."
      ]
    },
    {
      id: "settings",
      tabLabel: "Tune",
      docLabel: "Tune",
      launchShortcut: "settings",
      description: [
        "Tune how Sane behaves before exports or recovery.",
        "Adjust model crew, guidance packs, privacy, and optional Codex polish.",
        "Open with `sane settings` when you want behavior changes first."
      ]
    },
    {
      id: "add_to_codex",
      tabLabel: "Install",
      docLabel: "Install",
      description: [
        "Install or refresh Sane-managed Codex add-ons.",
        "Personal add-ons update your Codex setup. Repo writes stay explicit and optional.",
        "Use this when you want Codex to learn Sane workflow."
      ]
    },
    {
      id: "status",
      tabLabel: "Check",
      docLabel: "Check",
      launchShortcut: "status",
      description: [
        "Check setup health before changing anything.",
        "Spot missing, stale, disabled, or broken pieces without starting agent work.",
        "This should be normal landing screen after setup is complete."
      ]
    },
    {
      id: "repair",
      tabLabel: "Recover",
      docLabel: "Recover",
      launchShortcut: "repair",
      description: [
        "Recover from bad setup state without touching unrelated Codex files.",
        "Use backup and restore when tune-up did not feel right.",
        "Use this when Sane-managed files are missing, stale, or invalid."
      ]
    },
    {
      id: "uninstall",
      tabLabel: "Remove",
      docLabel: "Remove",
      launchShortcut: "uninstall",
      description: [
        "Remove only Sane-managed pieces.",
        "Every broad removal stays explicit. Unrelated Codex settings, skills, agents, and plugins should stay."
      ]
    }
  ] satisfies TuiSectionMetadata[],
  commands: {
    install_runtime: {
      id: "install_runtime",
      kind: "backend",
      backendKind: OperationKind.InstallRuntime,
      help: [
        "Get this repo ready for Sane.",
        "",
        "This creates the small local base Sane needs before it can help Codex understand the repo.",
        "Use this first in a new repo or when the local base is missing."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: true,
      filesTouched: [".sane/"]
    },
    show_config: {
      id: "show_config",
      kind: "backend",
      backendKind: OperationKind.ShowConfig,
      help: [
        "Show the current local Sane setup.",
        "",
        "Use this if you want a plain text readout of model defaults, pack choices, and privacy settings."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: [".sane/config.local.toml"]
    },
    export_portable_settings: {
      id: "export_portable_settings",
      kind: "backend",
      backendKind: OperationKind.ShowConfig,
      help: [
        "Export Sane settings to a portable file.",
        "",
        "This writes `.sane/settings.portable.json` from your current local config when present.",
        "If local config is missing, Sane exports recommended defaults."
      ],
      confirmation: null,
      successNoticeTitle: "Saved",
      repoMutation: false,
      filesTouched: [".sane/settings.portable.json"]
    },
    import_portable_settings: {
      id: "import_portable_settings",
      kind: "backend",
      backendKind: OperationKind.ShowConfig,
      help: [
        "Import Sane settings from the portable file.",
        "",
        "This reads `.sane/settings.portable.json` and saves values into `.sane/config.local.toml`."
      ],
      confirmation: {
        required: true,
        impactCopy: "This overwrites your local Sane config with values from `.sane/settings.portable.json`.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Saved",
      repoMutation: false,
      filesTouched: [".sane/settings.portable.json", ".sane/config.local.toml"]
    },
    install_from_portable_settings: {
      id: "install_from_portable_settings",
      kind: "backend",
      backendKind: OperationKind.InstallRuntime,
      help: [
        "Install runtime files, then import portable settings.",
        "",
        "This is a bootstrap path for moving Sane settings into a fresh repo.",
        "It reads `.sane/settings.portable.json` and applies it after runtime setup."
      ],
      confirmation: {
        required: true,
        impactCopy: "This installs/repairs `.sane` runtime files and overwrites local config from portable settings.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Installed",
      repoMutation: true,
      filesTouched: [".sane/", ".sane/settings.portable.json"]
    },
    show_codex_config: {
      id: "show_codex_config",
      kind: "backend",
      backendKind: OperationKind.ShowCodexConfig,
      help: [
        "Read your current `~/.codex/config.toml` without changing it.",
        "",
        "Use this before previewing or applying profiles so you can see the starting point."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    show_runtime_summary: {
      id: "show_runtime_summary",
      kind: "backend",
      backendKind: OperationKind.ShowRuntimeSummary,
      help: [
        "Show saved local handoff notes from `.sane`.",
        "",
        "This opens current-run, summary, brief, and local history counts.",
        "Use it when you want a compact view of what Sane has recorded locally.",
        "It does not start agent work."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: [
        ".sane/state/current-run.json",
        ".sane/state/summary.json",
        ".sane/BRIEF.md",
        ".sane/state/events.jsonl",
        ".sane/state/decisions.jsonl",
        ".sane/state/artifacts.jsonl"
      ]
    },
    show_outcome_readiness: {
      id: "show_outcome_readiness",
      kind: "backend",
      backendKind: OperationKind.ShowOutcomeReadiness,
      help: [
        "Check whether saved Sane handoff notes are ready for a long-running outcome flow.",
        "",
        "It checks local handoff layers, unresolved recent blockers in Sane-owned state, verification posture, latest policy preview state, and the B8 policy preflight suite.",
        "This uses `.sane` state only and does not mine raw Codex logs.",
        "It does not start an autonomous loop or turn Sane into the normal prompting interface."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: [
        ".sane/state/current-run.json",
        ".sane/state/summary.json",
        ".sane/BRIEF.md",
        ".sane/state/events.jsonl",
        ".sane/state/decisions.jsonl",
        ".sane/state/artifacts.jsonl"
      ]
    },
    advance_outcome: {
      id: "advance_outcome",
      kind: "backend",
      backendKind: OperationKind.AdvanceOutcome,
      help: [
        "Internal: advance the current Sane outcome state inside `.sane`.",
        "",
        "This is framework state plumbing for future Codex-native long-running work.",
        "It records the current objective, phase, active tasks, blockers, verification posture, and brief.",
        "It is not a public full-auto runner and is not shown in the TUI."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: true,
      filesTouched: [
        ".sane/state/current-run.json",
        ".sane/state/summary.json",
        ".sane/BRIEF.md",
        ".sane/state/events.jsonl",
        ".sane/state/decisions.jsonl",
        ".sane/state/artifacts.jsonl"
      ]
    },
    review_issue_draft: {
      id: "review_issue_draft",
      kind: "backend",
      backendKind: OperationKind.ReviewIssueDraft,
      help: [
        "Create a local GitHub issue draft from Sane status signals.",
        "",
        "This writes reviewable markdown under `.sane/issue-relay/` only when issue relay is enabled.",
        "It does not submit to GitHub, create a PR, or use telemetry consent as permission.",
        "Prompts, responses, source code, repo paths, branch names, and secrets are omitted."
      ],
      confirmation: null,
      successNoticeTitle: "Saved",
      repoMutation: false,
      filesTouched: [".sane/issue-relay/"]
    },
    submit_issue_draft: {
      id: "submit_issue_draft",
      kind: "backend",
      backendKind: OperationKind.SubmitIssueDraft,
      help: [
        "Submit the latest reviewed local issue draft to GitHub.",
        "",
        "This runs only when issue relay mode is `issue-review`.",
        "It checks likely duplicate GitHub issues first and blocks when candidates are found.",
        "Telemetry consent does not grant permission to submit."
      ],
      confirmation: {
        required: true,
        impactCopy: "This may create a GitHub issue from the latest `.sane/issue-relay/` draft after duplicate search passes.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Saved",
      repoMutation: false,
      filesTouched: [".sane/issue-relay/"]
    },
    reset_telemetry_data: {
      id: "reset_telemetry_data",
      kind: "backend",
      backendKind: OperationKind.ResetTelemetryData,
      help: [
        "Delete Sane's local telemetry files from this machine.",
        "",
        "This removes `.sane/telemetry/` contents only.",
        "Use this when you want to clear local telemetry state without changing the rest of your config.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This deletes Sane's local telemetry files from this machine.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Reset",
      repoMutation: false,
      filesTouched: [".sane/telemetry/"]
    },
    toggle_auto_updates: {
      id: "toggle_auto_updates",
      kind: "backend",
      backendKind: OperationKind.ShowConfig,
      help: [
        "Enable or disable automatic Sane CLI updates.",
        "",
        "When enabled, update checks can apply newer supported package-manager installs automatically.",
        "Local source installs are detected and left manual."
      ],
      confirmation: null,
      successNoticeTitle: "Saved",
      repoMutation: false,
      filesTouched: [".sane/config.local.toml"]
    },
    preview_policy: {
      id: "preview_policy",
      kind: "backend",
      backendKind: OperationKind.PreviewPolicy,
      help: [
        "Explain how Sane would route common Codex work.",
        "",
        "This uses saved handoff notes and local config state.",
        "It shows per-scenario obligations plus routing defaults.",
        "It does not start agent work."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: [
        ".sane/config.local.toml",
        ".sane/state/current-run.json",
      ]
    },
    backup_codex_config: {
      id: "backup_codex_config",
      kind: "backend",
      backendKind: OperationKind.BackupCodexConfig,
      help: [
        "Save a timestamped backup of `~/.codex/config.toml` into `.sane/backups`.",
        "",
        "Use this before applying profile changes if you want an easy rollback point."
      ],
      confirmation: null,
      successNoticeTitle: "Backed Up",
      repoMutation: false,
      filesTouched: [".sane/backups/codex-config/", "~/.codex/config.toml"]
    },
    preview_codex_profile: {
      id: "preview_codex_profile",
      kind: "backend",
      backendKind: OperationKind.PreviewCodexProfile,
      help: [
        "Preview the Codex tune-up before anything changes.",
        "",
        "This shows the single-session Codex baseline Sane would write, including hook settings when supported.",
        "Nothing changes until you apply it."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    preview_integrations_profile: {
      id: "preview_integrations_profile",
      kind: "backend",
      backendKind: OperationKind.PreviewIntegrationsProfile,
      help: [
        "Show the optional integrations profile Sane recommends.",
        "",
        "Today this is where recommended MCP and integration defaults are reviewed before apply.",
        "Nothing changes until you apply it."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    preview_cloudflare_profile: {
      id: "preview_cloudflare_profile",
      kind: "backend",
      backendKind: OperationKind.PreviewCloudflareProfile,
      help: [
        "Show the optional Cloudflare provider profile.",
        "",
        "Use this only if you want Cloudflare-specific tooling added to Codex config.",
        "Nothing changes until you apply it."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    preview_statusline_profile: {
      id: "preview_statusline_profile",
      kind: "backend",
      backendKind: OperationKind.PreviewStatuslineProfile,
      help: [
        "Show Sane's optional native Codex statusline and terminal-title profile.",
        "",
        "This targets Codex's built-in `tui.status_line`, `tui.terminal_title`, and `tui.notification_condition` settings.",
        "Nothing changes until you apply it."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    apply_codex_profile: {
      id: "apply_codex_profile",
      kind: "backend",
      backendKind: OperationKind.ApplyCodexProfile,
      help: [
        "Apply the Codex tune-up you previewed.",
        "",
        "This is a real config mutation.",
        "Use preview and backup first if you want to compare before writing.",
        "This writes the single-session Codex baseline, not the whole routing matrix.",
        "Broader execution and realtime-iteration routing still stays derived from detected model availability.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This writes changes into your `~/.codex/config.toml`.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Applied",
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    apply_integrations_profile: {
      id: "apply_integrations_profile",
      kind: "backend",
      backendKind: OperationKind.ApplyIntegrationsProfile,
      help: [
        "Write Sane's recommended Codex tools into `~/.codex/config.toml`.",
        "",
        "Today this adds Context7, Playwright, and grep.app.",
        "Use preview first if you want to review exactly what will be added.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This writes recommended Codex tool integrations into your `~/.codex/config.toml`.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Applied",
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    apply_cloudflare_profile: {
      id: "apply_cloudflare_profile",
      kind: "backend",
      backendKind: OperationKind.ApplyCloudflareProfile,
      help: [
        "Write the optional Cloudflare provider profile into `~/.codex/config.toml`.",
        "",
        "This is provider-specific and not part of the bare default profile.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This writes changes into your `~/.codex/config.toml`.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Applied",
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    apply_statusline_profile: {
      id: "apply_statusline_profile",
      kind: "backend",
      backendKind: OperationKind.ApplyStatuslineProfile,
      help: [
        "Write Sane's optional native Codex statusline and terminal-title profile into `~/.codex/config.toml`.",
        "",
        "This is native Codex TUI config, not a Sane-owned custom statusline system.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This writes native Codex statusline/title settings into your `~/.codex/config.toml`.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Applied",
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    restore_codex_config: {
      id: "restore_codex_config",
      kind: "backend",
      backendKind: OperationKind.RestoreCodexConfig,
      help: [
        "Restore the latest saved backup of your Codex config.",
        "",
        "Use this if a profile apply did not give you the result you wanted.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This replaces your current Codex config with the latest backup.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Restored",
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml", ".sane/backups/codex-config/"]
    },
    export_user_skills: {
      id: "export_user_skills",
      kind: "backend",
      backendKind: OperationKind.ExportUserSkills,
      help: [
        "Teach your personal Codex setup the Sane workflow.",
        "",
        "Use this when you want Codex to recognize Sane guidance during normal work."
      ],
      confirmation: {
        required: true,
        impactCopy: "This installs Sane's personal skills into `~/.agents/skills` for your Codex setup.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.agents/skills/sane-router", "~/.agents/skills/sane-bootstrap-research", "~/.agents/skills/sane-agent-lanes", "~/.agents/skills/sane-outcome-continuation", "~/.agents/skills/continue"]
    },
    export_repo_skills: {
      id: "export_repo_skills",
      kind: "backend",
      backendKind: OperationKind.ExportRepoSkills,
      help: [
        "Share Sane guidance through this repo.",
        "",
        "Use this only when the repo itself should carry the shared guidance.",
        "This changes the repo on purpose and is not part of the personal Sane bundle."
      ],
      confirmation: {
        required: true,
        impactCopy: "This writes Sane-managed skills into this repo's `.agents/skills` folder.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Installed",
      repoMutation: true,
      filesTouched: [".agents/skills/"]
    },
    export_repo_agents: {
      id: "export_repo_agents",
      kind: "backend",
      backendKind: OperationKind.ExportRepoAgents,
      help: [
        "Add repo-level Sane guidance.",
        "",
        "Use this only when collaborators should see the same repo guidance.",
        "This changes the repo on purpose and is not part of the personal Sane bundle."
      ],
      confirmation: {
        required: true,
        impactCopy: "This writes the Sane-managed block into this repo's `AGENTS.md`.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Installed",
      repoMutation: true,
      filesTouched: ["AGENTS.md"]
    },
    export_global_agents: {
      id: "export_global_agents",
      kind: "backend",
      backendKind: OperationKind.ExportGlobalAgents,
      help: [
        "Add global guidance so Codex knows how Sane wants to work.",
        "",
        "This is additive: Sane touches only its own marked block."
      ],
      confirmation: {
        required: true,
        impactCopy: "This updates the Sane-managed block inside `~/.codex/AGENTS.md`.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.codex/AGENTS.md"]
    },
    export_hooks: {
      id: "export_hooks",
      kind: "backend",
      backendKind: OperationKind.ExportHooks,
      help: [
        "Enable Sane's optional Codex hooks.",
        "",
        "Use this if you want setup-aware hook behavior during Codex sessions.",
        "On native Windows, Codex hooks are unavailable; use WSL for hook-enabled flows."
      ],
      confirmation: {
        required: true,
        impactCopy: "This writes Sane-managed hook settings into `~/.codex/hooks.json`.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.codex/hooks.json"]
    },
    export_custom_agents: {
      id: "export_custom_agents",
      kind: "backend",
      backendKind: OperationKind.ExportCustomAgents,
      help: [
        "Add named Sane agents to Codex.",
        "",
        "This makes coordination, discovery, implementation, review, and quick follow-up roles available by name."
      ],
      confirmation: {
        required: true,
        impactCopy: "This installs Sane's named agents into `~/.codex/agents/`.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.codex/agents/"]
    },
    export_opencode_all: {
      id: "export_opencode_all",
      kind: "backend",
      backendKind: OperationKind.ExportAll,
      help: [
        "Add Sane's workflow to OpenCode.",
        "",
        "This writes Sane skills, guidance, and agents into OpenCode's config area.",
        "Plugin and config entries are exported as managed files; host OpenCode visibility/load support decides runtime effect."
      ],
      confirmation: {
        required: true,
        impactCopy: "This installs Sane-managed skills, guidance, and agents into OpenCode's config area.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.config/opencode/"]
    },
    export_all: {
      id: "export_all",
      kind: "backend",
      backendKind: OperationKind.ExportAll,
      help: [
        "Teach Codex the whole personal Sane workflow.",
        "",
        "This refreshes the personal guidance, global Sane block, and named agents.",
        "On macOS/Linux, it also installs hooks. On native Windows, use WSL for hook-enabled flows.",
        "Use this after changing packs or defaults so Codex matches current Sane config."
      ],
      confirmation: {
        required: true,
        impactCopy: "This refreshes Sane's personal skills, global guidance, named agents, and hooks in your Codex setup.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: [
        "~/.agents/skills/sane-router",
        "~/.agents/skills/sane-bootstrap-research",
        "~/.agents/skills/sane-agent-lanes",
        "~/.agents/skills/sane-outcome-continuation",
        "~/.agents/skills/continue",
        "~/.codex/AGENTS.md",
        "~/.codex/hooks.json",
        "~/.codex/agents/"
      ],
      includes: ["user-skills", "global-agents", "hooks", "custom-agents"]
    },
    uninstall_user_skills: {
      id: "uninstall_user_skills",
      kind: "backend",
      backendKind: OperationKind.UninstallUserSkills,
      help: [
        "Remove Sane's core user skills from your personal Codex skills folder.",
        "",
        "Only Sane-managed user skill directories should be removed.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This removes Sane's user-level Codex skill install.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Uninstalled",
      repoMutation: false,
      filesTouched: ["~/.agents/skills/sane-router", "~/.agents/skills/sane-bootstrap-research", "~/.agents/skills/sane-agent-lanes", "~/.agents/skills/sane-outcome-continuation", "~/.agents/skills/continue"]
    },
    uninstall_repo_skills: {
      id: "uninstall_repo_skills",
      kind: "backend",
      backendKind: OperationKind.UninstallRepoSkills,
      help: [
        "Remove Sane repo skills from this repo's `.agents/skills` folder.",
        "",
        "Only Sane-managed repo skill directories should be removed.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This removes Sane repo skills from this project's `.agents/skills` folder.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Uninstalled",
      repoMutation: true,
      filesTouched: [".agents/skills/"]
    },
    uninstall_repo_agents: {
      id: "uninstall_repo_agents",
      kind: "backend",
      backendKind: OperationKind.UninstallRepoAgents,
      help: [
        "Remove the Sane block from this repo's root `AGENTS.md`.",
        "",
        "Only the Sane-managed block should be removed.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This removes the Sane-managed block from this project's `AGENTS.md`.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Uninstalled",
      repoMutation: true,
      filesTouched: ["AGENTS.md"]
    },
    uninstall_global_agents: {
      id: "uninstall_global_agents",
      kind: "backend",
      backendKind: OperationKind.UninstallGlobalAgents,
      help: [
        "Remove Sane's managed block from global `AGENTS.md`.",
        "",
        "Only the Sane-managed block should be removed.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This removes Sane's managed block from your global `~/.codex/AGENTS.md`.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Uninstalled",
      repoMutation: false,
      filesTouched: ["~/.codex/AGENTS.md"]
    },
    uninstall_hooks: {
      id: "uninstall_hooks",
      kind: "backend",
      backendKind: OperationKind.UninstallHooks,
      help: [
        "Remove Sane's managed hook entry from `~/.codex/hooks.json`.",
        "",
        "Only Sane's managed SessionStart hook should be removed.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This removes Sane's managed Codex hook entry.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Uninstalled",
      repoMutation: false,
      filesTouched: ["~/.codex/hooks.json"]
    },
    uninstall_custom_agents: {
      id: "uninstall_custom_agents",
      kind: "backend",
      backendKind: OperationKind.UninstallCustomAgents,
      help: [
        "Remove Sane's custom agent files from Codex.",
        "",
        "Only Sane-managed custom agent files should be removed.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This removes Sane's managed custom agent files from Codex.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Uninstalled",
      repoMutation: false,
      filesTouched: ["~/.codex/agents/"]
    },
    uninstall_all: {
      id: "uninstall_all",
      kind: "backend",
      backendKind: OperationKind.UninstallAll,
      help: [
        "Remove everything Sane manages in Codex.",
        "",
        "This removes the core Codex bundle.",
        "Only Sane-managed content should be removed; unrelated user content should stay.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This removes all Sane-managed Codex pieces.",
        remindPreviewOrBackup: true
      },
      successNoticeTitle: "Uninstalled",
      repoMutation: false,
      filesTouched: ["~/.agents/skills/sane-router", "~/.agents/skills/sane-bootstrap-research", "~/.agents/skills/sane-agent-lanes", "~/.agents/skills/sane-outcome-continuation", "~/.agents/skills/continue", "~/.codex/AGENTS.md", "~/.codex/hooks.json", "~/.codex/agents/"]
    },
    check_updates: {
      id: "check_updates",
      kind: "backend",
      backendKind: OperationKind.CheckUpdates,
      help: [
        "Check the package registry for a newer Sane CLI release.",
        "",
        "This reads the published `sane-codex` version with pnpm and prints an update command when a newer release exists.",
        "It does not change your install."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: []
    },
    show_status: {
      id: "show_status",
      kind: "backend",
      backendKind: OperationKind.ShowStatus,
      help: [
        "Show current Sane setup across local files and Codex add-ons.",
        "",
        "Use Status and setup checks to see what is installed, stale, disabled, or broken."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: [".sane/", "~/.codex/", "~/.agents/skills/"]
    },
    doctor: {
      id: "doctor",
      kind: "backend",
      backendKind: OperationKind.Doctor,
      help: [
        "Check local Sane files and Codex setup for issues.",
        "",
        "Visibility only for managed surfaces.",
        "Use this when something feels broken, stale, or only partly installed.",
        "This points at missing, invalid, or drifted Sane-managed pieces."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: [".sane/", "~/.codex/", "~/.agents/skills/"]
    },
    open_config_editor: {
      id: "open_config_editor",
      kind: "editor",
      backendKind: null,
      help: [
        "Change the default models and reasoning levels Sane uses.",
        "",
        "Main session = the top-level Codex session.",
        "Explorer agent = codebase discovery without edits.",
        "Implementation agent = bounded code changes.",
        "Reviewer agent = review and checking.",
        "Realtime helper = fast iteration.",
        "",
        "Saving here can make managed exports stale until you re-export them."
      ],
      confirmation: null,
      successNoticeTitle: "Saved",
      repoMutation: false,
      filesTouched: [".sane/config.toml"]
    },
    open_pack_editor: {
      id: "open_pack_editor",
      kind: "editor",
      backendKind: null,
      help: [
        "Enable or disable built-in guidance packs.",
        "",
        "Packs change local config first.",
        "Some exports will need rerunning after save.",
        "Core stays enabled because it is the base Sane guidance layer."
      ],
      confirmation: null,
      successNoticeTitle: "Saved",
      repoMutation: false,
      filesTouched: [".sane/config.toml"]
    },
    open_privacy_editor: {
      id: "open_privacy_editor",
      kind: "editor",
      backendKind: null,
      help: [
        "Choose how much telemetry state Sane may keep locally.",
        "",
        "off = no optional telemetry files",
        "local-only = keep local product-improvement data on this machine only",
        "product-improvement = opt in to future product-improvement reporting",
        "issue relay = separate opt-in for reviewable GitHub issue drafts and explicit issue submit",
        "",
        "This does not change issue reporting; that stays separate."
      ],
      confirmation: null,
      successNoticeTitle: "Saved",
      repoMutation: false,
      filesTouched: [".sane/config.toml"]
    }
  } satisfies Record<UiCommandId, CommandSpec>,
  placements: [
    { commandId: "install_runtime", section: "home", order: 1, label: "Prepare repo" },
    { commandId: "open_config_editor", section: "home", order: 2, label: "Choose defaults" },
    { commandId: "preview_codex_profile", section: "home", order: 3, label: "Preview Codex tune-up" },
    { commandId: "backup_codex_config", section: "home", order: 4, label: "Save rollback point" },
    { commandId: "apply_codex_profile", section: "home", order: 5, label: "Apply Codex tune-up" },
    { commandId: "export_all", section: "home", order: 6, label: "Install Codex add-ons" },
    { commandId: "doctor", section: "home", order: 7, label: "Run doctor" },
    { commandId: "open_config_editor", section: "settings", order: 1, label: "Model defaults" },
    { commandId: "open_pack_editor", section: "settings", order: 2, label: "Guidance packs" },
    { commandId: "open_privacy_editor", section: "settings", order: 3, label: "Privacy" },
    { commandId: "show_config", section: "settings", order: 4, label: "Local Sane config" },
    { commandId: "show_codex_config", section: "settings", order: 5, label: "Codex config" },
    { commandId: "preview_statusline_profile", section: "settings", order: 6, label: "Statusline preview" },
    { commandId: "apply_statusline_profile", section: "settings", order: 7, label: "Apply statusline" },
    { commandId: "preview_cloudflare_profile", section: "settings", order: 8, label: "Cloudflare preview" },
    { commandId: "apply_cloudflare_profile", section: "settings", order: 9, label: "Apply Cloudflare" },
    { commandId: "toggle_auto_updates", section: "settings", order: 10, label: "Auto updates" },
    { commandId: "export_all", section: "add_to_codex", order: 1, label: "Personal bundle" },
    { commandId: "export_user_skills", section: "add_to_codex", order: 2, label: "Skills" },
    { commandId: "export_global_agents", section: "add_to_codex", order: 3, label: "Global guidance" },
    { commandId: "export_custom_agents", section: "add_to_codex", order: 4, label: "Named agents" },
    { commandId: "export_hooks", section: "add_to_codex", order: 5, label: "Hooks" },
    { commandId: "apply_integrations_profile", section: "add_to_codex", order: 6, label: "Tool setup" },
    { commandId: "export_repo_skills", section: "add_to_codex", order: 7, label: "Repo skills" },
    { commandId: "export_repo_agents", section: "add_to_codex", order: 8, label: "Repo guidance" },
    { commandId: "export_opencode_all", section: "add_to_codex", order: 9, label: "OpenCode bundle" },
    { commandId: "show_status", section: "status", order: 1, label: "Overall health" },
    { commandId: "doctor", section: "status", order: 2, label: "Doctor checks" },
    { commandId: "show_runtime_summary", section: "status", order: 3, label: "Handoff notes" },
    { commandId: "show_config", section: "status", order: 4, label: "Local Sane config" },
    { commandId: "show_codex_config", section: "status", order: 5, label: "Codex config" },
    { commandId: "preview_integrations_profile", section: "status", order: 6, label: "Tool setup preview" },
    { commandId: "preview_statusline_profile", section: "status", order: 7, label: "Statusline preview" },
    { commandId: "preview_policy", section: "status", order: 8, label: "Routing preview" },
    { commandId: "check_updates", section: "status", order: 9, label: "Check for updates" },
    { commandId: "install_runtime", section: "repair", order: 1, label: "Repair local Sane" },
    { commandId: "backup_codex_config", section: "repair", order: 2, label: "Back up Codex config" },
    { commandId: "restore_codex_config", section: "repair", order: 3, label: "Restore Codex backup" },
    { commandId: "reset_telemetry_data", section: "repair", order: 4, label: "Clear telemetry" },
    { commandId: "uninstall_user_skills", section: "uninstall", order: 1, label: "Remove user skills" },
    { commandId: "uninstall_global_agents", section: "uninstall", order: 2, label: "Remove global guidance" },
    { commandId: "uninstall_hooks", section: "uninstall", order: 3, label: "Remove hooks" },
    { commandId: "uninstall_custom_agents", section: "uninstall", order: 4, label: "Remove named agents" },
    { commandId: "uninstall_repo_skills", section: "uninstall", order: 5, label: "Remove repo skills" },
    { commandId: "uninstall_repo_agents", section: "uninstall", order: 6, label: "Remove repo guidance" },
    { commandId: "uninstall_all", section: "uninstall", order: 7, label: "Remove all Sane add-ons" }
  ] satisfies CommandPlacement[]
} as const;

export function listSections(hostPlatform?: HostPlatform): TuiSectionMetadata[] {
  return COMMAND_METADATA_REGISTRY.sections.map((section) => getSectionMetadata(section.id, hostPlatform));
}

export function getSectionMetadata(
  sectionId: TuiSectionId,
  hostPlatform?: HostPlatform
): TuiSectionMetadata {
  const section = COMMAND_METADATA_REGISTRY.sections.find((entry) => entry.id === sectionId)!;

  if (sectionId !== "add_to_codex" || hostPlatform !== "windows") {
    return { ...section, description: [...section.description] };
  }

  return {
    ...section,
    description: [
      "Install or refresh Sane-managed Codex add-ons.",
      "Personal add-ons update your Codex setup. Repo writes stay explicit and optional.",
      "On native Windows, hooks stay outside personal bundle. Use WSL for hook-enabled flows."
    ]
  };
}

export function getCommandSpec(commandId: UiCommandId, hostPlatform?: HostPlatform): CommandSpec {
  const spec = COMMAND_METADATA_REGISTRY.commands[commandId] as CommandSpec;

  if (hostPlatform !== "windows") {
    return {
      ...spec,
      help: [...spec.help],
      filesTouched: [...spec.filesTouched],
      includes: spec.includes ? [...spec.includes] : undefined
    };
  }

  if (commandId === "export_hooks") {
    return {
      ...spec,
      help: [...spec.help],
      filesTouched: []
    };
  }

  if (commandId === "export_all") {
    return {
      ...spec,
      help: [...spec.help],
      filesTouched: [...WINDOWS_EXPORT_ALL_FILES_TOUCHED],
      includes: [...WINDOWS_EXPORT_ALL_INCLUDES]
    };
  }

  return {
    ...spec,
    help: [...spec.help],
    filesTouched: [...spec.filesTouched],
    includes: spec.includes ? [...spec.includes] : undefined
  };
}

export function listSectionActions(
  sectionId: TuiSectionId,
  hostPlatform?: HostPlatform
): SectionActionMetadata[] {
  return COMMAND_METADATA_REGISTRY.placements
    .filter((placement) => placement.section === sectionId)
    .sort((left, right) => left.order - right.order)
    .map((placement) => ({
      ...getCommandSpec(placement.commandId, hostPlatform),
      label: placement.label,
      order: placement.order,
      section: placement.section
    }));
}
