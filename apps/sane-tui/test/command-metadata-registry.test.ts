import { describe, expect, it } from "vitest";
import { OperationKind } from "@sane/control-plane/core.js";

import {
  COMMAND_METADATA_REGISTRY,
  type TuiSectionId,
  type UiCommandId,
  getCommandSpec,
  getSectionMetadata,
  listSectionActions,
  listSections
} from "@sane/sane-tui/index.js";

function sectionActionIds(section: TuiSectionId, hostPlatform?: "windows"): UiCommandId[] {
  return listSectionActions(section, hostPlatform).map((action) => action.id);
}

function expectSectionContainsInOrder(section: TuiSectionId, ids: readonly UiCommandId[]): void {
  const actual = sectionActionIds(section);
  const positions = ids.map((id) => actual.indexOf(id));

  expect(positions.every((index) => index >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
}

function expectHelpMentions(commandId: UiCommandId, fragments: readonly string[]): void {
  const help = getCommandSpec(commandId).help.join("\n");
  for (const fragment of fragments) {
    expect(help).toContain(fragment);
  }
}

function expectNoCommandIds(commandIds: Iterable<string>, forbidden: readonly string[]): void {
  expect([...commandIds].sort()).not.toEqual(expect.arrayContaining([...forbidden]));
}

describe("command metadata registry", () => {
  it("requires actionable execution contracts and validation expectations for every descriptor", () => {
    const commandSpecs = Object.values(COMMAND_METADATA_REGISTRY.commands);

    for (const command of commandSpecs) {
      expect(command.help.length).toBeGreaterThan(0);
      expect(command.help[0]?.trim().length ?? 0).toBeGreaterThan(10);
      expect(command.filesTouched.length).toBeGreaterThanOrEqual(0);

      if (command.kind === "backend") {
        expect(command.backendKind).not.toBeNull();
      } else {
        expect(command.backendKind).toBeNull();
      }

      if (command.confirmation?.required) {
        expect(command.confirmation.impactCopy.trim().length).toBeGreaterThan(20);
      }

      const helpText = command.help.join(" ");
      const hasValidationExpectation = /\b(does not|only|when|before|check|checks|required|safety|read-only|nothing changes)\b/i.test(
        helpText
      );

      const contractBackedByMetadata =
        command.confirmation?.required === true || command.filesTouched.length > 0 || command.backendKind !== null;

      expect(contractBackedByMetadata).toBe(true);
      expect(hasValidationExpectation || command.confirmation?.required === true).toBe(true);
    }
  });

  it("does not expose public outcome runner command ids", () => {
    const shippedCommandIds = new Set([
      ...Object.keys(COMMAND_METADATA_REGISTRY.commands),
      ...COMMAND_METADATA_REGISTRY.placements.map((placement) => placement.commandId),
      ...listSections().flatMap((section) => listSectionActions(section.id).map((action) => action.id))
    ]);

    expectNoCommandIds(shippedCommandIds, ["runner", "sane_runner", "outcome_runner", "run_outcome", "start_outcome_runner"]);
  });

  it("keeps public TUI copy free of outcome runner command rituals", () => {
    const publicCommandCopy = [
      ...Object.values(COMMAND_METADATA_REGISTRY.commands)
        .filter((command) => command.id !== "advance_outcome")
        .flatMap((command) => [
          command.id,
          ...command.help,
          command.successNoticeTitle ?? "",
          command.confirmation?.impactCopy ?? "",
          ...command.filesTouched
        ]),
      ...COMMAND_METADATA_REGISTRY.placements.flatMap((placement) => [
        placement.commandId,
        placement.label
      ])
    ].join("\n");

    expect(publicCommandCopy).not.toMatch(/\bsane runner\b|\brun outcome\b|\boutcome runner\b|\bsane outcome step\b/i);
  });

  it("exports normalized command specs, placements, and shortcuts", () => {
    expect(COMMAND_METADATA_REGISTRY).toBeDefined();
    expect(COMMAND_METADATA_REGISTRY.shortcuts.default).toBe("status");
    expect(COMMAND_METADATA_REGISTRY.shortcuts.settings).toBe("settings");
    expect(COMMAND_METADATA_REGISTRY.shortcuts.status).toBe("status");
    expect(COMMAND_METADATA_REGISTRY.shortcuts.repair).toBe("repair");
    expect(COMMAND_METADATA_REGISTRY.shortcuts.uninstall).toBe("uninstall");
    expect(listSections().map((section) => section.id)).toEqual([
      "home",
      "settings",
      "add_to_codex",
      "status",
      "repair",
      "uninstall"
    ]);
    expect(listSections().map((section) => section.tabLabel)).toEqual([
      "Setup",
      "Configure",
      "Install",
      "Check",
      "Recover",
      "Remove"
    ]);
  });

  it("keeps section placement separate from command semantics", () => {
    expectSectionContainsInOrder("home", [
      "install_runtime",
      "preview_codex_profile",
      "backup_codex_config",
      "apply_codex_profile",
      "export_all"
    ]);
    expectSectionContainsInOrder("add_to_codex", [
      "export_all",
      "export_user_skills",
      "export_global_agents",
      "export_custom_agents",
      "export_hooks",
      "export_opencode_all"
    ]);
    expectSectionContainsInOrder("settings", [
      "open_config_editor",
      "open_pack_editor",
      "open_privacy_editor",
      "show_config"
    ]);
    expectSectionContainsInOrder("status", [
      "show_status",
      "doctor",
      "show_runtime_summary",
      "preview_policy",
      "check_updates"
    ]);
    expectSectionContainsInOrder("repair", [
      "install_runtime",
      "backup_codex_config",
      "restore_codex_config",
      "reset_telemetry_data"
    ]);
    expectSectionContainsInOrder("uninstall", [
      "uninstall_user_skills",
      "uninstall_global_agents",
      "uninstall_hooks",
      "uninstall_custom_agents",
      "uninstall_all"
    ]);
    for (const section of listSections()) {
      expect(new Set(sectionActionIds(section.id)).size).toBe(sectionActionIds(section.id).length);
    }
    expect(sectionActionIds("repair").some((id) => id.startsWith("uninstall_"))).toBe(false);
    expect(listSectionActions("home").at(-1)?.label).toBe("Run health check");
    expect(listSectionActions("add_to_codex").at(-1)?.label).toBe("Install OpenCode setup");
    expect(listSectionActions("settings").at(-1)?.label).toBe("Auto updates");
    expectHelpMentions("toggle_auto_updates", ["automatic Sane CLI updates", "Local source installs"]);
    expectHelpMentions("show_runtime_summary", [
      "saved local handoff notes",
      "It does not start agent work",
      "current-run",
      "local history"
    ]);
    expect(getCommandSpec("show_runtime_summary").filesTouched).toEqual(
      expect.arrayContaining([
        ".sane/state/current-run.json",
        ".sane/state/summary.json",
        ".sane/BRIEF.md"
      ])
    );
    expect(getCommandSpec("show_outcome_readiness").backendKind).toBe(
      OperationKind.ShowOutcomeReadiness
    );
    expectHelpMentions("show_outcome_readiness", [
      "saved Sane handoff notes",
      "does not mine raw Codex logs",
      "does not start"
    ]);
    expect(getCommandSpec("advance_outcome").backendKind).toBe(
      OperationKind.AdvanceOutcome
    );
    expect(getCommandSpec("review_issue_draft").backendKind).toBe(
      OperationKind.ReviewIssueDraft
    );
    expectHelpMentions("review_issue_draft", ["local GitHub issue draft", "does not submit"]);
    expect(getCommandSpec("submit_issue_draft").backendKind).toBe(
      OperationKind.SubmitIssueDraft
    );
    expectHelpMentions("submit_issue_draft", ["Submit the latest reviewed", "duplicate", "Telemetry consent"]);
    expect(getCommandSpec("advance_outcome").repoMutation).toBe(true);
    expect(getCommandSpec("preview_policy").filesTouched).toEqual(
      expect.arrayContaining([".sane/config.local.toml", ".sane/state/current-run.json"])
    );
    expectHelpMentions("preview_policy", ["route common Codex work", "does not start agent work"]);
    expectHelpMentions("preview_codex_profile", ["Nothing changes until you apply it"]);
    expectHelpMentions("show_status", ["current Sane setup", "Codex add-ons"]);
    expectHelpMentions("doctor", ["Read-only check"]);
    expectHelpMentions("export_hooks", ["native Windows", "WSL"]);
    expectHelpMentions("export_all", ["personal Sane workflow", "named agents", "native Windows"]);
    expectHelpMentions("export_opencode_all", [
      "Add Sane's workflow to OpenCode",
      "OpenCode's config area",
      "OpenCode support decides what users see"
    ]);
    expect(getCommandSpec("export_opencode_all").filesTouched).toEqual(["~/.config/opencode/"]);
    expect(getCommandSpec("export_all").includes).toEqual(["user-skills", "global-agents", "hooks", "custom-agents"]);
    expectHelpMentions("uninstall_all", ["core Codex bundle"]);
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
    expect(getCommandSpec("preview_statusline_profile").backendKind).toBe(
      OperationKind.PreviewStatuslineProfile
    );
    expect(getCommandSpec("apply_statusline_profile").backendKind).toBe(
      OperationKind.ApplyStatuslineProfile
    );
    expect(getCommandSpec("apply_statusline_profile").confirmation?.impactCopy).toBe(
      "This writes native Codex statusline/title settings into your `~/.codex/config.toml`."
    );
    expect(getCommandSpec("restore_codex_config").confirmation?.impactCopy).toBe(
      "This replaces your current Codex config with the latest backup."
    );
    expect(getCommandSpec("reset_telemetry_data").confirmation?.impactCopy).toBe(
      "This deletes Sane's local telemetry files from this machine."
    );
    expect(getCommandSpec("export_repo_skills").confirmation?.impactCopy).toBe(
      "This writes Sane-managed skills into this repo's `.agents/skills` folder."
    );
    expect(getCommandSpec("export_repo_agents").confirmation?.impactCopy).toBe(
      "This writes the Sane-managed block into this repo's `AGENTS.md`."
    );
    expect(getCommandSpec("uninstall_hooks").confirmation?.impactCopy).toBe(
      "This removes Sane's managed Codex hook entry."
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

  it("adapts install metadata for native Windows", () => {
    expect(getSectionMetadata("add_to_codex", "windows").description.join("\n")).toContain(
      "hooks stay outside personal bundle"
    );
    expect(getCommandSpec("export_hooks", "windows").filesTouched).toEqual([]);
    expect(getCommandSpec("export_all", "windows").filesTouched).not.toContain("~/.codex/hooks.json");
    expect(getCommandSpec("export_all", "windows").filesTouched).toEqual(
      expect.arrayContaining([
        "~/.agents/skills/sane-router",
        "~/.agents/skills/sane-bootstrap-research",
        "~/.agents/skills/sane-agent-lanes",
        "~/.agents/skills/sane-outcome-continuation",
        "~/.agents/skills/continue",
        "~/.codex/AGENTS.md",
        "~/.codex/agents/"
      ])
    );
    expect(getCommandSpec("export_all", "windows").includes).toEqual([
      "user-skills",
      "global-agents",
      "custom-agents"
    ]);
    expect(listSectionActions("add_to_codex", "windows").find((action) => action.id === "export_all")?.filesTouched).toEqual(
      getCommandSpec("export_all", "windows").filesTouched
    );
  });
});
