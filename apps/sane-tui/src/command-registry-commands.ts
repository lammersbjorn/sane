import { OperationKind } from "@sane/control-plane/core.js";

import type { CommandSpec, UiCommandId } from "./command-registry-types.js";

export const COMMAND_SPECS = {
    install_runtime: {
      id: "install_runtime",
      kind: "backend",
      backendKind: OperationKind.InstallRuntime,
      help: [
        "Set up the local Sane files this repo needs.",
        "",
        "This creates or repairs `.sane/` so Sane can help Codex understand this repo.",
        "Use this first in a new repo or when local Sane files are missing."
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
        "Use this if you want a plain text summary of model settings, enabled guidance options, and privacy settings.",
        "Read-only check; this command does not write files."
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
        "Save your current Sane settings to a file you can reuse elsewhere.",
        "",
        "This writes `.sane/settings.portable.json` from your current local config when present.",
        "If local config is missing, Sane saves recommended defaults."
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
        "Load saved settings into your local Sane config.",
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
        "Set up local Sane files, then load saved settings.",
        "",
        "This is a bootstrap path for moving Sane settings into a fresh repo.",
        "It reads `.sane/settings.portable.json` and applies it after local setup."
      ],
      confirmation: {
        required: true,
        impactCopy: "This installs or repairs local `.sane` files and overwrites local config from portable settings.",
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
        "Use this before previewing or applying settings so you can see the starting point."
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
        "It is not a public full-auto runner and is not shown in the TUI.",
        "Internal-only path; use public outcome checks before any state-advance operation."
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
        "Use this before applying Codex config changes if you want an easy rollback point."
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
        "Preview the Codex config changes Sane recommends before anything is written.",
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
        "Show the optional Codex tools Sane recommends.",
        "",
        "Today this is where recommended MCP and integration defaults are reviewed before you apply them.",
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
        "Show optional Cloudflare provider settings.",
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
        "Show optional native Codex status line and terminal title settings.",
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
        "Apply the Codex config changes you previewed.",
        "",
        "This is a real config mutation.",
        "Use preview and backup first if you want to compare before writing.",
        "This writes the single-session Codex defaults, not every routing rule.",
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
        "Add Sane's recommended Codex tool settings to `~/.codex/config.toml`.",
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
        "Write optional Cloudflare provider settings into `~/.codex/config.toml`.",
        "",
        "This is provider-specific and not part of the default Codex settings.",
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
        "Write optional Codex status line and terminal title settings into `~/.codex/config.toml`.",
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
        "Use this if Codex config changes did not give you the result you wanted.",
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
        "Plugin and config entries are installed as managed files; OpenCode support decides what users see in OpenCode."
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
        "Use this after changing guidance options or defaults so Codex matches current Sane config."
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
        "Scan local Sane files and Codex setup for missing or broken pieces.",
        "",
        "Read-only check for Sane-managed files and settings.",
        "Use this when something feels broken, stale, or only partly installed.",
        "This points at missing, invalid, or out-of-sync Sane-managed pieces."
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
        "Saving here can make managed exports stale until you re-export them.",
        "Validation expectation: review values before save; changes apply only after save."
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
        "Enable or disable built-in guidance options.",
        "",
        "Guidance options change local config first.",
        "Some installed add-ons will need refreshing after save.",
        "Core stays enabled because it is the base Sane guidance layer.",
        "Validation expectation: confirm pack toggles before save; refresh add-ons when prompted."
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
  } satisfies Record<UiCommandId, CommandSpec>;
