import { describe, expect, it } from "vitest";

import type { SectionActionMetadata } from "@sane/sane-tui/command-registry.js";
import {
  buildAddToCodexActionRows,
  buildRepairActionRows
} from "@sane/sane-tui/section-action-rows.js";

function sectionAction(overrides: Partial<SectionActionMetadata>): SectionActionMetadata {
  return {
    id: "export_user_skills",
    kind: "backend",
    backendKind: null,
    help: [],
    confirmation: null,
    successNoticeTitle: null,
    repoMutation: false,
    filesTouched: [],
    label: "stub",
    order: 0,
    section: "install",
    ...overrides
  } as SectionActionMetadata;
}

describe("section action rows", () => {
  it("builds install rows in registry order and preserves typed status metadata", () => {
    const actions = [
      sectionAction({
        id: "export_user_skills",
        label: "Install user skills",
        order: 1,
        repoMutation: false
      }),
      sectionAction({
        id: "export_all",
        label: "Install all",
        order: 2,
        repoMutation: false,
        includes: ["user-skills", "hooks"]
      })
    ];

    expect(
      buildAddToCodexActionRows(actions, {
        export_user_skills: { kind: "installed", label: "installed" },
        export_repo_skills: { kind: "missing", label: "missing" },
        export_repo_agents: { kind: "missing", label: "missing" },
        export_global_agents: { kind: "missing", label: "missing" },
        apply_integrations_profile: { kind: "missing", label: "missing" },
        export_hooks: { kind: "missing", label: "missing" },
        export_custom_agents: { kind: "missing", label: "missing" },
        export_plugin: { kind: "missing", label: "missing" },
        export_all: { kind: "missing", label: "missing" }
      })
    ).toEqual([
      {
        id: "export_user_skills",
        title: "Install user skills",
        status: { kind: "installed", label: "installed" },
        repoMutation: false,
        includes: undefined
      },
      {
        id: "export_all",
        title: "Install all",
        status: { kind: "missing", label: "missing" },
        repoMutation: false,
        includes: ["user-skills", "hooks"]
      }
    ]);
  });

  it("builds repair rows and preserves confirmation copy", () => {
    const actions = [
      sectionAction({
        id: "restore_codex_config",
        label: "Restore Codex config",
        section: "repair",
        confirmation: {
          required: true,
          impactCopy: "Restore current config from backup.",
          remindPreviewOrBackup: false
        }
      }),
      sectionAction({
        id: "reset_telemetry_data",
        label: "Reset telemetry",
        section: "repair",
        confirmation: {
          required: true,
          impactCopy: "Delete local telemetry files.",
          remindPreviewOrBackup: false
        }
      })
    ];

    expect(
      buildRepairActionRows(actions, {
        install_runtime: { kind: "missing", label: "missing" },
        backup_codex_config: { kind: "missing", label: "missing" },
        restore_codex_config: { kind: "available", label: "available" },
        reset_telemetry_data: { kind: "present", label: "present" },
        uninstall_user_skills: { kind: "missing", label: "missing" },
        uninstall_repo_skills: { kind: "missing", label: "missing" },
        uninstall_global_agents: { kind: "missing", label: "missing" },
        uninstall_repo_agents: { kind: "missing", label: "missing" },
        uninstall_hooks: { kind: "missing", label: "missing" },
        uninstall_custom_agents: { kind: "missing", label: "missing" },
        uninstall_all: { kind: "missing", label: "missing" }
      })
    ).toEqual([
      {
        id: "restore_codex_config",
        title: "Restore Codex config",
        status: { kind: "available", label: "available" },
        confirmation: "Restore current config from backup."
      },
      {
        id: "reset_telemetry_data",
        title: "Reset telemetry",
        status: { kind: "present", label: "present" },
        confirmation: "Delete local telemetry files."
      }
    ]);
  });
});
