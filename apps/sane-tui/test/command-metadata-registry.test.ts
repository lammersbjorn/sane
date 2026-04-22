import { describe, expect, it } from "vite-plus/test";
import { OperationKind } from "@sane/core";

import {
  COMMAND_METADATA_REGISTRY,
  getCommandSpec,
  listSectionActions,
  listSections
} from "@/index.js";

describe("command metadata registry", () => {
  it("exports normalized command specs, placements, and shortcuts", () => {
    expect(COMMAND_METADATA_REGISTRY).toBeDefined();
    expect(COMMAND_METADATA_REGISTRY.shortcuts.default).toBe("get_started");
    expect(COMMAND_METADATA_REGISTRY.shortcuts.settings).toBe("preferences");
    expect(listSections().map((section) => section.id)).toEqual([
      "get_started",
      "preferences",
      "install",
      "inspect",
      "repair"
    ]);
  });

  it("keeps section placement separate from command semantics", () => {
    expect(listSectionActions("get_started").map((action) => action.id)).toEqual([
      "install_runtime",
      "show_codex_config",
      "preview_codex_profile",
      "backup_codex_config",
      "apply_codex_profile",
      "export_all"
    ]);
    expect(listSectionActions("install").map((action) => action.id)).toEqual([
      "export_user_skills",
      "export_repo_skills",
      "export_repo_agents",
      "export_global_agents",
      "apply_integrations_profile",
      "export_hooks",
      "export_custom_agents",
      "export_all",
      "export_opencode_agents"
    ]);
    expect(listSectionActions("preferences").map((action) => action.id)).toEqual([
      "open_config_editor",
      "open_pack_editor",
      "open_privacy_editor",
      "show_config",
      "show_codex_config",
      "preview_cloudflare_profile",
      "apply_cloudflare_profile",
      "preview_opencode_profile",
      "apply_opencode_profile"
    ]);
    expect(listSectionActions("inspect").map((action) => action.id)).toEqual([
      "show_status",
      "doctor",
      "show_runtime_summary",
      "show_config",
      "show_codex_config",
      "preview_integrations_profile",
      "preview_policy"
    ]);
    expect(listSectionActions("repair").map((action) => action.id)).toEqual([
      "install_runtime",
      "backup_codex_config",
      "restore_codex_config",
      "reset_telemetry_data",
      "uninstall_user_skills",
      "uninstall_repo_skills",
      "uninstall_global_agents",
      "uninstall_repo_agents",
      "uninstall_hooks",
      "uninstall_custom_agents",
      "uninstall_opencode_agents",
      "uninstall_all"
    ]);
    expect(listSectionActions("get_started").at(-1)?.label).toBe("6. Install Sane into Codex");
    expect(listSectionActions("install").at(-1)?.label).toBe("Install optional Sane agents for OpenCode");
    expect(getCommandSpec("show_runtime_summary").help[0]).toBe(
      "Show a read-only summary of local current-run-derived handoff state."
    );
    expect(getCommandSpec("show_runtime_summary").filesTouched).toEqual([
      ".sane/state/current-run.json",
      ".sane/state/summary.json",
      ".sane/BRIEF.md"
    ]);
    expect(getCommandSpec("preview_policy").filesTouched).toEqual([
      ".sane/state/current-run.json",
      ".sane/state/summary.json",
      ".sane/state/decisions.jsonl"
    ]);
  });

  it("tracks risky confirmation copy and notice titles", () => {
    expect(getCommandSpec("apply_codex_profile").confirmation?.impactCopy).toBe(
      "This writes changes into your `~/.codex/config.toml`."
    );
    expect(getCommandSpec("apply_integrations_profile").confirmation?.impactCopy).toBe(
      "This writes recommended Codex tool integrations into your `~/.codex/config.toml`."
    );
    expect(getCommandSpec("apply_integrations_profile").backendKind).toBe(
      OperationKind.ApplyIntegrationsProfile
    );
    expect(getCommandSpec("export_opencode_agents").backendKind).toBe(
      OperationKind.ExportOpencodeAgents
    );
    expect(getCommandSpec("preview_opencode_profile").backendKind).toBe(
      OperationKind.PreviewOpencodeProfile
    );
    expect(getCommandSpec("apply_opencode_profile").backendKind).toBe(
      OperationKind.ApplyOpencodeProfile
    );
    expect(getCommandSpec("restore_codex_config").confirmation?.impactCopy).toBe(
      "This replaces your current Codex config with the latest backup."
    );
    expect(getCommandSpec("reset_telemetry_data").confirmation?.impactCopy).toBe(
      "This deletes Sane's local telemetry files from this machine."
    );
    expect(getCommandSpec("uninstall_hooks").confirmation?.impactCopy).toBe(
      "This removes Sane's managed Codex hook entry."
    );
    expect(getCommandSpec("uninstall_opencode_agents").confirmation?.impactCopy).toBe(
      "This removes Sane's optional OpenCode-agent export."
    );
    expect(getCommandSpec("uninstall_all").confirmation?.impactCopy).toBe(
      "This removes all Sane-managed Codex pieces."
    );
    expect(getCommandSpec("open_config_editor").successNoticeTitle).toBe("Saved");
    expect(getCommandSpec("apply_integrations_profile").successNoticeTitle).toBe("Applied");
    expect(getCommandSpec("reset_telemetry_data").successNoticeTitle).toBe("Reset");
    expect(getCommandSpec("export_all").successNoticeTitle).toBe("Installed");
    expect(getCommandSpec("uninstall_all").successNoticeTitle).toBe("Uninstalled");
  });
});
