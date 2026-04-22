import { OperationKind } from "@sane/core";

export type TuiSectionId = "get_started" | "preferences" | "install" | "inspect" | "repair";
export type RustSectionId = "StartHere" | "Configure" | "Exports" | "Inspect" | "Repair";

export type BackendCommandId =
  | "install_runtime"
  | "show_config"
  | "show_codex_config"
  | "show_runtime_summary"
  | "reset_telemetry_data"
  | "preview_policy"
  | "backup_codex_config"
  | "preview_codex_profile"
  | "preview_integrations_profile"
  | "preview_cloudflare_profile"
  | "preview_opencode_profile"
  | "apply_codex_profile"
  | "apply_integrations_profile"
  | "apply_cloudflare_profile"
  | "apply_opencode_profile"
  | "restore_codex_config"
  | "export_user_skills"
  | "export_repo_skills"
  | "export_repo_agents"
  | "export_global_agents"
  | "export_hooks"
  | "export_custom_agents"
  | "export_opencode_agents"
  | "export_all"
  | "uninstall_user_skills"
  | "uninstall_repo_skills"
  | "uninstall_repo_agents"
  | "uninstall_global_agents"
  | "uninstall_hooks"
  | "uninstall_custom_agents"
  | "uninstall_opencode_agents"
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
  rustSection: RustSectionId;
  tabLabel: string;
  docLabel: string;
  description: string[];
  launchShortcut?: "default" | "settings";
}

export interface SectionActionMetadata extends CommandSpec {
  label: string;
  order: number;
  section: TuiSectionId;
}

export const COMMAND_METADATA_REGISTRY = {
  shortcuts: {
    default: "get_started",
    settings: "preferences"
  } as const,
  sections: [
    {
      id: "get_started",
      rustSection: "StartHere",
      tabLabel: "Start here",
      docLabel: "Get Started",
      launchShortcut: "default",
      description: [
        "Recommended now: follow the ordered setup flow.",
        "Suggested flow",
        "1. Create Sane's local project files",
        "2. Review and back up Codex settings",
        "3. Apply Sane's recommended Codex settings",
        "4. Install Sane into Codex",
        "More options live in Set up preferences and Install to Codex."
      ]
    },
    {
      id: "preferences",
      rustSection: "Configure",
      tabLabel: "Set up preferences",
      docLabel: "Preferences",
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
      id: "install",
      rustSection: "Exports",
      tabLabel: "Install to Codex",
      docLabel: "Install",
      description: [
        "Install Sane into Codex on purpose.",
        "Current install bundle:",
        "user skill, global AGENTS.md block, hooks, sane-agent, sane-reviewer, sane-explorer",
        "User-level install changes your own Codex setup.",
        "Repo-level install is explicit and optional.",
        "Nothing here should silently take over a repo."
      ]
    },
    {
      id: "inspect",
      rustSection: "Inspect",
      tabLabel: "Inspect",
      docLabel: "Inspect",
      description: [
        "Inspect is read-only visibility before you change anything.",
        "Inspect includes status summary, doctor result, current-run-derived handoff visibility, local config view, Codex config view, and export drift view.",
        "Use status and doctor to see what is installed, stale, disabled, or broken.",
        "View Sane config and Codex settings before applying changes.",
        "Inspect does not orchestrate runtime work."
      ]
    },
    {
      id: "repair",
      rustSection: "Repair",
      tabLabel: "Repair or remove",
      docLabel: "Repair",
      description: [
        "Repair, restore, and uninstall tools.",
        "Use backup and restore when settings changes went wrong.",
        "Use uninstall when you want Sane removed cleanly."
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
      filesTouched: [".sane/config.toml"]
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
        "Show a read-only summary of local current-run-derived handoff state.",
        "",
        "Visibility only for managed surfaces. No runtime orchestration runs.",
        "This reads current-run, summary, brief, and local runtime history counts.",
        "Use it when you want a compact view of what Sane has recorded locally."
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
        "Show Sane's current-run-derived adaptive routing policy preview.",
        "",
        "Visibility only for managed surfaces. No runtime orchestration runs.",
        "This is a read-only preview over current-run and local config state.",
        "It shows per-scenario obligations plus routing defaults.",
        "Editable coordinator/sidecar/verifier defaults are shown alongside derived execution and realtime-iteration classes."
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
        "Preview only for managed surfaces.",
        "This shows the single-session Codex baseline Sane would write plus hook settings.",
        "That baseline is coordinator-shaped; broader execution and realtime routing stays derived outside config.toml."
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
        "Preview only for managed surfaces.",
        "Today this is where recommended MCP and integration defaults are inspected before apply."
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
        "Preview only for managed surfaces.",
        "Use this only if you want Cloudflare-specific tooling added to Codex config."
      ],
      confirmation: null,
      successNoticeTitle: null,
      repoMutation: false,
      filesTouched: ["~/.codex/config.toml"]
    },
    preview_opencode_profile: {
      id: "preview_opencode_profile",
      kind: "backend",
      backendKind: OperationKind.PreviewOpencodeProfile,
      help: [
        "Show the optional Opencode compatibility profile.",
        "",
        "Preview only for managed surfaces.",
        "Today this adds the optional opensrc MCP entry only.",
        "Broader Opencode-native config stays separate on purpose."
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
        "Use preview first if you want to inspect exactly what will be added.",
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
    apply_opencode_profile: {
      id: "apply_opencode_profile",
      kind: "backend",
      backendKind: OperationKind.ApplyOpencodeProfile,
      help: [
        "Write the optional Opencode compatibility profile into `~/.codex/config.toml`.",
        "",
        "Today this adds the optional opensrc MCP entry only.",
        "Broader Opencode-native config stays separate on purpose.",
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
    export_opencode_agents: {
      id: "export_opencode_agents",
      kind: "backend",
      backendKind: OperationKind.ExportOpencodeAgents,
      help: [
        "Install the optional Sane OpenCode agents into `~/.config/opencode/agents/`.",
        "",
        "This stays outside Sane's default Codex install bundle.",
        "Use it only if you also want the same Sane agent roles available in OpenCode."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.config/opencode/agents/"]
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
        "Install the Sane user skill into your personal Codex skills folder.",
        "",
        "This lets Codex load Sane guidance as a user-level skill."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.agents/skills/sane-router"]
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
      confirmation: null,
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
      confirmation: null,
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
        "These files support editable role defaults plus derived execution/realtime-iteration routing classes."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: ["~/.codex/agents/"]
    },
    export_all: {
      id: "export_all",
      kind: "backend",
      backendKind: OperationKind.ExportAll,
      help: [
        "Add or refresh everything Sane manages in Codex.",
        "",
        "This installs the Sane user skill, global AGENTS block, hooks, and custom agents.",
        "Use this after changing packs or defaults so Codex matches current Sane config."
      ],
      confirmation: null,
      successNoticeTitle: "Installed",
      repoMutation: false,
      filesTouched: [
        "~/.agents/skills/sane-router",
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
        "Remove Sane's user skill from your personal Codex skills folder.",
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
      filesTouched: ["~/.agents/skills/sane-router"]
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
    uninstall_opencode_agents: {
      id: "uninstall_opencode_agents",
      kind: "backend",
      backendKind: OperationKind.UninstallOpencodeAgents,
      help: [
        "Remove the optional Sane OpenCode agents from `~/.config/opencode/agents/`.",
        "",
        "This does not touch the main Codex install bundle.",
        "",
        "Safety",
        "Confirmation required before this action runs."
      ],
      confirmation: {
        required: true,
        impactCopy: "This removes Sane's optional OpenCode-agent export.",
        remindPreviewOrBackup: false
      },
      successNoticeTitle: "Uninstalled",
      repoMutation: false,
      filesTouched: ["~/.config/opencode/agents/"]
    },
    uninstall_all: {
      id: "uninstall_all",
      kind: "backend",
      backendKind: OperationKind.UninstallAll,
      help: [
        "Remove everything Sane manages in Codex.",
        "",
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
      filesTouched: ["~/.agents/skills/sane-router", "~/.codex/AGENTS.md", "~/.codex/hooks.json", "~/.codex/agents/"]
    },
    show_status: {
      id: "show_status",
      kind: "backend",
      backendKind: OperationKind.ShowStatus,
      help: [
        "Show everything Sane currently manages.",
        "",
        "Visibility only for managed surfaces.",
        "Use status and doctor to see what is installed, stale, disabled, or broken."
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
        "Doctor points at missing, invalid, or drifted Sane-managed pieces."
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
        "Change the default model and reasoning roles Sane works from.",
        "",
        "Coordinator = main high-context worker.",
        "Sidecar = cheaper bounded helper.",
        "Verifier = review and checking role.",
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
    { commandId: "install_runtime", section: "get_started", order: 1, label: "1. Create Sane's local project files" },
    { commandId: "show_codex_config", section: "get_started", order: 2, label: "2. View your current Codex settings" },
    { commandId: "preview_codex_profile", section: "get_started", order: 3, label: "3. Preview Sane's recommended Codex settings" },
    { commandId: "backup_codex_config", section: "get_started", order: 4, label: "4. Back up your Codex settings" },
    { commandId: "apply_codex_profile", section: "get_started", order: 5, label: "5. Apply Sane's recommended Codex settings" },
    { commandId: "export_all", section: "get_started", order: 6, label: "6. Install Sane into Codex" },
    { commandId: "open_config_editor", section: "preferences", order: 1, label: "Edit default model and reasoning settings" },
    { commandId: "open_pack_editor", section: "preferences", order: 2, label: "Enable or disable built-in guidance packs" },
    { commandId: "open_privacy_editor", section: "preferences", order: 3, label: "Choose your telemetry and privacy level" },
    { commandId: "show_config", section: "preferences", order: 4, label: "View your current Sane config" },
    { commandId: "show_codex_config", section: "preferences", order: 5, label: "View your current Codex settings" },
    { commandId: "preview_cloudflare_profile", section: "preferences", order: 6, label: "Preview optional Cloudflare Codex settings" },
    { commandId: "apply_cloudflare_profile", section: "preferences", order: 7, label: "Apply optional Cloudflare Codex settings" },
    { commandId: "preview_opencode_profile", section: "preferences", order: 8, label: "Preview optional Opencode compatibility settings" },
    { commandId: "apply_opencode_profile", section: "preferences", order: 9, label: "Apply optional Opencode compatibility settings" },
    { commandId: "export_user_skills", section: "install", order: 1, label: "Install Sane user skills for your account" },
    { commandId: "export_repo_skills", section: "install", order: 2, label: "Install Sane repo skills for this project" },
    { commandId: "export_repo_agents", section: "install", order: 3, label: "Install Sane guidance block in this repo's AGENTS.md" },
    { commandId: "export_global_agents", section: "install", order: 4, label: "Install Sane guidance block in global AGENTS.md" },
    { commandId: "apply_integrations_profile", section: "install", order: 5, label: "Apply recommended Codex tool integrations" },
    { commandId: "export_hooks", section: "install", order: 6, label: "Install Sane Codex hooks" },
    { commandId: "export_custom_agents", section: "install", order: 7, label: "Install Sane custom agents for Codex" },
    { commandId: "export_all", section: "install", order: 8, label: "Install everything Sane manages in Codex" },
    { commandId: "export_opencode_agents", section: "install", order: 9, label: "Install optional Sane agents for OpenCode" },
    { commandId: "show_status", section: "inspect", order: 1, label: "Show everything Sane currently manages" },
    { commandId: "doctor", section: "inspect", order: 2, label: "Run Sane doctor checks for problems" },
    { commandId: "show_runtime_summary", section: "inspect", order: 3, label: "View current Sane runtime handoff state" },
    { commandId: "show_config", section: "inspect", order: 4, label: "View your current Sane config" },
    { commandId: "show_codex_config", section: "inspect", order: 5, label: "View your current Codex settings" },
    { commandId: "preview_integrations_profile", section: "inspect", order: 6, label: "Preview optional recommended Codex tools" },
    { commandId: "preview_policy", section: "inspect", order: 7, label: "Explain Sane's routing policy" },
    { commandId: "install_runtime", section: "repair", order: 1, label: "Repair Sane's local project files" },
    { commandId: "backup_codex_config", section: "repair", order: 2, label: "Back up your Codex settings" },
    { commandId: "restore_codex_config", section: "repair", order: 3, label: "Restore your last Codex backup" },
    { commandId: "reset_telemetry_data", section: "repair", order: 4, label: "Delete Sane's local telemetry data" },
    { commandId: "uninstall_user_skills", section: "repair", order: 5, label: "Uninstall Sane user skills from your account" },
    { commandId: "uninstall_repo_skills", section: "repair", order: 6, label: "Uninstall Sane repo skills from this project" },
    { commandId: "uninstall_global_agents", section: "repair", order: 7, label: "Remove Sane block from global AGENTS.md" },
    { commandId: "uninstall_repo_agents", section: "repair", order: 8, label: "Remove Sane block from this repo's AGENTS.md" },
    { commandId: "uninstall_hooks", section: "repair", order: 9, label: "Remove Sane Codex hooks" },
    { commandId: "uninstall_custom_agents", section: "repair", order: 10, label: "Remove Sane custom agents from Codex" },
    { commandId: "uninstall_opencode_agents", section: "repair", order: 11, label: "Remove optional Sane agents from OpenCode" },
    { commandId: "uninstall_all", section: "repair", order: 12, label: "Remove everything Sane manages from Codex" }
  ] satisfies CommandPlacement[]
} as const;

export function listSections(): TuiSectionMetadata[] {
  return [...COMMAND_METADATA_REGISTRY.sections];
}

export function getSectionMetadata(sectionId: TuiSectionId): TuiSectionMetadata {
  return COMMAND_METADATA_REGISTRY.sections.find((section) => section.id === sectionId)!;
}

export function getCommandSpec(commandId: UiCommandId): CommandSpec {
  return COMMAND_METADATA_REGISTRY.commands[commandId];
}

export function listSectionActions(sectionId: TuiSectionId): SectionActionMetadata[] {
  return COMMAND_METADATA_REGISTRY.placements
    .filter((placement) => placement.section === sectionId)
    .sort((left, right) => left.order - right.order)
    .map((placement) => ({
      ...getCommandSpec(placement.commandId),
      label: placement.label,
      order: placement.order,
      section: placement.section
    }));
}
