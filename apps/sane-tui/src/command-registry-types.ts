import { type OperationKind } from "@sane/core";

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
