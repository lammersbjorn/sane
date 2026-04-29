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
  | "reset_telemetry_data"
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
    default: "home",
    install: "home",
    settings: "settings",
    status: "status",
    repair: "repair",
    uninstall: "uninstall"
  } as const,
  sections: [
    {
      id: "home",
      tabLabel: "Home",
      docLabel: "Home",
      launchShortcut: "default",
      description: [
        "Guided setup and tune-up.",
        "Use this when setting up Sane for the first time or refreshing an existing install.",
        "Choose defaults, review changes, back up Codex settings, then add or refresh Sane in Codex.",
        "After setup, normal `sane` opens Status."
      ]
    },
    {
      id: "settings",
      tabLabel: "Settings",
      docLabel: "Settings",
      launchShortcut: "settings",
      description: [
        "Change how Sane behaves before installing it into Codex.",
        "Choose model and reasoning defaults.",
        "Turn built-in packs on or off.",
        "Choose telemetry and privacy level.",
        "Open with `sane settings` if you want to land here directly."
      ]
    },
    {
      id: "add_to_codex",
      tabLabel: "Add to Codex",
      docLabel: "Add to Codex",
      description: [
        "Install Sane into Codex on purpose.",
        "Current install bundle:",
        "core user skills (sane-router, sane-bootstrap-research, sane-agent-lanes, sane-outcome-continuation, continue), global AGENTS.md block, and custom agents (sane-agent, sane-reviewer, sane-explorer, sane-implementation, sane-realtime)",
        "On macOS/Linux, hooks can join that bundle. On native Windows, use WSL for hook-enabled flows.",
        "User-level install changes your own Codex setup.",
        "Repo-level install is explicit and optional.",
        "Nothing here should silently take over a repo."
      ]
    },
    {
      id: "status",
      tabLabel: "Status",
      docLabel: "Status",
      launchShortcut: "status",
      description: [
        "Status shows what is installed before you change anything.",
        "Status includes setup health, saved handoff notes, local config, Codex config, and drift warnings.",
        "Use Status and setup checks to see what is installed, stale, disabled, or broken.",
        "View Sane config and Codex settings before applying changes.",
        "Status does not run agent work."
      ]
    },
    {
      id: "repair",
      tabLabel: "Repair",
      docLabel: "Repair",
      launchShortcut: "repair",
      description: [
        "Repair and restore tools.",
        "Use backup and restore when settings changes went wrong.",
        "Use repair when Sane-managed files are missing, stale, or invalid."
      ]
    },
    {
      id: "uninstall",
      tabLabel: "Uninstall",
      docLabel: "Uninstall",
      launchShortcut: "uninstall",
      description: [
        "Remove Sane-managed installs cleanly.",
        "Only Sane-managed content should be removed.",
        "Unrelated Codex settings, skills, agents, and plugins should stay."
      ]
    }
  ] satisfies TuiSectionMetadata[],
  commands: {
    install_runtime: {
      id: "install_runtime",
      kind: "backend",
      backendKind: OperationKind.InstallRuntime,
      help: [
        "Create or repair Sane's local project files in this repo.",
        "",
        "This creates Sane's local config and state files in `.sane/`.",
        "Use this first in a new repo or if Sane's local files are missing."
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
        "Show the current local Sane config.",
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
        "It checks local handoff layers, unresolved blockers, verification posture, latest policy preview state, and the B8 policy preflight suite.",
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
        "Show the Codex settings Sane recommends by default.",
        "",
        "This shows the single-session Codex baseline Sane would write plus hook settings.",
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
        "Write Sane's recommended core Codex profile into `~/.codex/config.toml`.",
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
        "Install Sane's core user skills into your personal Codex skills folder.",
        "",
        "This lets Codex load Sane guidance as user-level skills."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.agents/skills/sane-router", "~/.agents/skills/sane-bootstrap-research", "~/.agents/skills/sane-agent-lanes", "~/.agents/skills/sane-outcome-continuation", "~/.agents/skills/continue"]
    },
    export_repo_skills: {
      id: "export_repo_skills",
      kind: "backend",
      backendKind: OperationKind.ExportRepoSkills,
      help: [
        "Install Sane repo skills into this repo's `.agents/skills` folder.",
        "",
        "Use this when you want repo-local shared skills instead of user-only install.",
        "This changes the repo on purpose and is not part of `Install Sane into Codex`."
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
        "Add a Sane block to this repo's root `AGENTS.md`.",
        "",
        "Use this only when you want repo-local shared AGENTS guidance.",
        "This changes the repo on purpose and is not part of `Install Sane into Codex`."
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
        "Add or refresh the Sane block in global `AGENTS.md`.",
        "",
        "This is additive: Sane touches only its own marked block."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.codex/AGENTS.md"]
    },
    export_hooks: {
      id: "export_hooks",
      kind: "backend",
      backendKind: OperationKind.ExportHooks,
      help: [
        "Add or refresh Sane's entries in `~/.codex/hooks.json`.",
        "",
        "Use this if you want Sane's optional Codex hook behavior enabled.",
        "On native Windows, Codex hooks are unavailable; use WSL for hook-enabled flows."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.codex/hooks.json"]
    },
    export_custom_agents: {
      id: "export_custom_agents",
      kind: "backend",
      backendKind: OperationKind.ExportCustomAgents,
      help: [
        "Add or refresh Sane's custom agent files.",
        "",
        "These files give Codex named Sane agents for coordination, discovery, implementation, review, and quick follow-ups."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.codex/agents/"]
    },
    export_opencode_all: {
      id: "export_opencode_all",
      kind: "backend",
      backendKind: OperationKind.ExportAll,
      help: [
        "Install the full Sane bundle into OpenCode.",
        "",
        "This writes Sane skills, guidance, and agents into `~/.config/opencode/`.",
        "OpenCode agents use OpenCode Go model IDs with cost-aware task routing."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.config/opencode/"]
    },
    export_all: {
      id: "export_all",
      kind: "backend",
      backendKind: OperationKind.ExportAll,
      help: [
        "Add or refresh Sane's core Codex bundle.",
        "",
        "This installs Sane's core user skills, global AGENTS block, and custom agents.",
        "On macOS/Linux, it also installs hooks. On native Windows, use WSL for hook-enabled flows.",
        "Use this after changing packs or defaults so Codex matches current Sane config."
      ],
      confirmation: null,
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
    show_status: {
      id: "show_status",
      kind: "backend",
      backendKind: OperationKind.ShowStatus,
      help: [
        "Show everything Sane currently manages.",
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
        "Check Sane's local project files and Codex installs.",
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
    { commandId: "install_runtime", section: "home", order: 1, label: "1. Set up Sane files" },
    { commandId: "open_config_editor", section: "home", order: 2, label: "2. Choose defaults" },
    { commandId: "preview_codex_profile", section: "home", order: 3, label: "3. Review Codex changes" },
    { commandId: "backup_codex_config", section: "home", order: 4, label: "4. Back up Codex settings" },
    { commandId: "apply_codex_profile", section: "home", order: 5, label: "5. Apply Codex defaults" },
    { commandId: "export_all", section: "home", order: 6, label: "6. Refresh Codex setup" },
    { commandId: "open_config_editor", section: "settings", order: 1, label: "Edit model and agent defaults" },
    { commandId: "open_pack_editor", section: "settings", order: 2, label: "Enable or disable built-in guidance packs" },
    { commandId: "open_privacy_editor", section: "settings", order: 3, label: "Choose your telemetry and privacy level" },
    { commandId: "show_config", section: "settings", order: 4, label: "View your current Sane config" },
    { commandId: "show_codex_config", section: "settings", order: 5, label: "View your current Codex settings" },
    { commandId: "preview_statusline_profile", section: "settings", order: 6, label: "Preview optional native Codex statusline settings" },
    { commandId: "apply_statusline_profile", section: "settings", order: 7, label: "Apply optional native Codex statusline settings" },
    { commandId: "preview_cloudflare_profile", section: "settings", order: 8, label: "Preview optional Cloudflare Codex settings" },
    { commandId: "apply_cloudflare_profile", section: "settings", order: 9, label: "Apply optional Cloudflare Codex settings" },
    { commandId: "export_user_skills", section: "add_to_codex", order: 1, label: "Install Sane user skills for your account" },
    { commandId: "export_global_agents", section: "add_to_codex", order: 2, label: "Install Sane guidance block in global AGENTS.md" },
    { commandId: "export_repo_skills", section: "add_to_codex", order: 3, label: "Advanced repo mutation: install Sane repo skills for this project" },
    { commandId: "export_repo_agents", section: "add_to_codex", order: 4, label: "Advanced repo mutation: install Sane block in this repo's AGENTS.md" },
    { commandId: "apply_integrations_profile", section: "add_to_codex", order: 5, label: "Apply recommended Codex tool integrations" },
    { commandId: "export_hooks", section: "add_to_codex", order: 6, label: "Install Sane Codex hooks" },
    { commandId: "export_custom_agents", section: "add_to_codex", order: 7, label: "Install Sane custom agents for Codex" },
    { commandId: "export_all", section: "add_to_codex", order: 8, label: "Install Sane core Codex bundle" },
    { commandId: "export_opencode_all", section: "add_to_codex", order: 9, label: "Install full Sane bundle into OpenCode" },
    { commandId: "show_status", section: "status", order: 1, label: "Show everything Sane currently manages" },
    { commandId: "doctor", section: "status", order: 2, label: "Check Sane-managed setup for problems" },
    { commandId: "show_runtime_summary", section: "status", order: 3, label: "View saved Sane handoff notes" },
    { commandId: "show_config", section: "status", order: 4, label: "View your current Sane config" },
    { commandId: "show_codex_config", section: "status", order: 5, label: "View your current Codex settings" },
    { commandId: "preview_integrations_profile", section: "status", order: 6, label: "Preview optional recommended Codex tools" },
    { commandId: "preview_statusline_profile", section: "status", order: 7, label: "Preview optional native Codex statusline settings" },
    { commandId: "preview_policy", section: "status", order: 8, label: "Explain Codex routing choices" },
    { commandId: "show_outcome_readiness", section: "status", order: 9, label: "Check long-run readiness" },
    { commandId: "install_runtime", section: "repair", order: 1, label: "Repair Sane's local project files" },
    { commandId: "backup_codex_config", section: "repair", order: 2, label: "Back up your Codex settings" },
    { commandId: "restore_codex_config", section: "repair", order: 3, label: "Restore your last Codex backup" },
    { commandId: "reset_telemetry_data", section: "repair", order: 4, label: "Delete Sane's local telemetry data" },
    { commandId: "uninstall_user_skills", section: "uninstall", order: 1, label: "Remove Sane user skills from your account" },
    { commandId: "uninstall_global_agents", section: "uninstall", order: 2, label: "Remove Sane block from global AGENTS.md" },
    { commandId: "uninstall_hooks", section: "uninstall", order: 3, label: "Remove Sane Codex hooks" },
    { commandId: "uninstall_custom_agents", section: "uninstall", order: 4, label: "Remove Sane custom agents from Codex" },
    { commandId: "uninstall_repo_skills", section: "uninstall", order: 5, label: "Advanced repo mutation: remove Sane repo skills from this project" },
    { commandId: "uninstall_repo_agents", section: "uninstall", order: 6, label: "Advanced repo mutation: remove Sane block from this repo's AGENTS.md" },
    { commandId: "uninstall_all", section: "uninstall", order: 7, label: "Remove all Sane-managed Codex installs" }
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
      "Install Sane into Codex on purpose.",
      "Current install bundle:",
      "core user skills (sane-router, sane-bootstrap-research, sane-agent-lanes, sane-outcome-continuation, continue), global AGENTS.md block, and custom agents (sane-agent, sane-reviewer, sane-explorer, sane-implementation, sane-realtime)",
      "On native Windows, hooks stay outside the default bundle. Use WSL for hook-enabled flows.",
      "User-level install changes your own Codex setup.",
      "Repo-level install is explicit and optional.",
      "Nothing here should silently take over a repo."
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
