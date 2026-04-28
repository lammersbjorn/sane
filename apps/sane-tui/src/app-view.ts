import { type TuiShell, currentAction } from "@sane/sane-tui/shell.js";
import { loadDashboardView } from "@sane/sane-tui/dashboard.js";
import { loadHomeScreenFromStatusBundle } from "@sane/sane-tui/home-screen.js";
import { loadAddToCodexScreenFromStatusBundle } from "@sane/sane-tui/add-to-codex-screen.js";
import {
  formatStatusPolicyPreviewLines,
  statusOverviewLines,
  loadStatusScreenFromStatusBundle
} from "@sane/sane-tui/status-screen.js";
import { loadOverlayModel, type OverlayModel } from "@sane/sane-tui/overlay-models.js";
import { loadSettingsScreen } from "@sane/sane-tui/settings-screen.js";
import { loadRepairScreenFromStatusBundle } from "@sane/sane-tui/repair-screen.js";
import { type UiCommandId } from "@sane/sane-tui/command-registry.js";

export interface SaneTuiAppView {
  title: "Sane";
  subtitle: "Codex-native onboarding and setup";
  projectLabel: string;
  recommendedNextStep: string;
  recommendedActionId: ReturnType<typeof loadDashboardView>["recommendedActionId"];
  attentionItems: ReturnType<typeof loadDashboardView>["attentionItems"];
  tabs: {
    title: "Sections";
    selected: string;
    items: Array<{ id: string; label: string }>;
  };
  sections: ReturnType<typeof loadDashboardView>["sections"];
  activeSection: ReturnType<typeof loadDashboardView>["activeSection"];
  actions: ReturnType<typeof loadDashboardView>["actions"];
  selectedAction: ReturnType<typeof loadDashboardView>["selectedAction"];
  chips: ReturnType<typeof loadDashboardView>["chips"];
  sectionOverviewTitle: "Section Overview";
  sectionOverviewLines: string[];
  selectedHelpTitle: "Selected Step Details";
  selectedHelpLines: string[];
  latestStatusTitle: string;
  latestStatusLines: string[];
  mode: {
    id: "browse" | "confirm" | "notice" | "config" | "packs" | "privacy";
    label: string;
    hint: string;
  };
  footerTitle: "Now";
  footerLines: string[];
  footer: {
    navHint: string;
    status: Record<"runtime" | "codex" | "user" | "hooks", string>;
  };
  overlay: OverlayModel;
}

const FOOTER_STATUS_SPECS = [
  { id: "runtime", label: "runtime" },
  { id: "codex-config", label: "codex" },
  { id: "user-skills", label: "user" },
  { id: "hooks", label: "hooks" }
] as const;

export function loadAppView(shell: TuiShell): SaneTuiAppView {
  const codexProfiles = shell.statusSnapshot.codexProfiles;
  const home = loadHomeScreenFromStatusBundle(
    shell.paths,
    shell.codexPaths,
    shell.statusSnapshot.statusBundle,
    codexProfiles,
    shell.hostPlatform
  );
  const dashboard = loadDashboardView(shell, home);
  const install = loadAddToCodexScreenFromStatusBundle(
    shell.paths,
    shell.codexPaths,
    shell.statusSnapshot.statusBundle,
    codexProfiles
  );
  const inspect = lazy(() =>
    loadStatusScreenFromStatusBundle(
      shell.paths,
      shell.codexPaths,
      shell.statusSnapshot.statusBundle,
      codexProfiles,
      shell.statusSnapshot.preferences,
      shell.hostPlatform
    )
  );
  const preferences = lazy(() =>
    loadSettingsScreen(
      shell.paths,
      shell.codexPaths,
      codexProfiles,
      shell.statusSnapshot.preferences,
      shell.hostPlatform
    )
  );
  const repair = lazy(() =>
    loadRepairScreenFromStatusBundle(
      shell.paths,
      shell.codexPaths,
      shell.statusSnapshot.statusBundle,
      shell.hostPlatform
    )
  );

  return {
    ...dashboard,
    tabs: {
      title: "Sections",
      selected: dashboard.activeSection.id,
      items: dashboard.sections.map((section) => ({
        id: section.id,
        label: section.tabLabel
      }))
    },
    sectionOverviewTitle: "Section Overview",
    sectionOverviewLines: sectionOverviewLines(dashboard, {
      home,
      install,
      inspect,
      preferences,
      repair
    }),
    selectedHelpTitle: "Selected Step Details",
    selectedHelpLines: selectedActionHelpLines(shell, home, inspect, preferences),
    latestStatusTitle: dashboard.lastResult.title,
    latestStatusLines: dashboard.lastResult.lines,
    mode: currentMode(shell),
    footerTitle: "Now",
    footerLines: [footerLine(dashboard.chips, currentMode(shell))],
    footer: {
      navHint: currentMode(shell).hint,
      status: footerStatusMap(dashboard.chips)
    },
    overlay: loadOverlayModel(shell)
  };
}

function sectionOverviewLines(
  dashboard: ReturnType<typeof loadDashboardView>,
  models: {
    home: ReturnType<typeof loadHomeScreenFromStatusBundle>;
    install: ReturnType<typeof loadAddToCodexScreenFromStatusBundle>;
    inspect: () => ReturnType<typeof loadStatusScreenFromStatusBundle>;
    preferences: () => ReturnType<typeof loadSettingsScreen>;
    repair: () => ReturnType<typeof loadRepairScreenFromStatusBundle>;
  }
): string[] {

  switch (dashboard.activeSection.id) {
    case "home": {
      const lines = [
        homeOverviewTitle(models.home),
        `Next step: ${dashboard.recommendedNextStep}`,
        "",
        "Current setup",
        ...models.home.statusLine.split(" | "),
        "",
        "Setup path",
        "1. Set up local Sane files",
        "2. Choose defaults",
        "3. Review and back up Codex settings",
        "4. Apply Codex defaults",
        "5. Add or refresh Sane in Codex",
        "",
        "Normal `sane` opens Status after setup."
      ];
      if (dashboard.recommendedActionId) {
        const action = dashboard.actions.find((item) => item.id === dashboard.recommendedActionId);
        if (action) {
          lines.push("");
          lines.push(`Recommended action: ${action.label}`);
        }
      }
      if (dashboard.attentionItems.length > 0) {
        lines.push("");
        lines.push("Attention items found in current setup.");
        lines.push(...dashboard.attentionItems);
      }
      lines.push("");
      lines.push(`Codex defaults: ${models.home.codexProfileAudit.status} (${models.home.codexProfileAudit.recommendedChangeCount} change(s))`);
      return lines;
    }
    case "status": {
      return statusOverviewLines(models.inspect());
    }
    case "add_to_codex": {
      const install = models.install;
      const lines = [
        ...dashboard.activeSection.description,
        "",
        `install bundle state: ${install.bundleStatus}`,
        install.missingTargets.length === 0
          ? "bundle targets: all onboarding targets installed"
          : `bundle targets missing: ${install.missingTargets.join(", ")}`,
        `optional Codex tools: ${install.integrationsStatus.label} (${install.integrationsRecommendedChangeCount} recommended changes)`
      ];
      const hooksInventory = install.inventory.find((item) => item.name === "hooks");
      if (hooksInventory?.status.asString() === "invalid" && hooksInventory.repairHint?.includes("native Windows")) {
        lines.push("hooks note: native Windows cannot use Codex hooks; use WSL for hook-enabled flows");
      }
      return lines;
    }
    case "settings": {
      const preferences = models.preferences();
      return [
        ...dashboard.activeSection.description,
        "",
        `defaults source: ${preferences.source}`,
        `main session: ${preferences.models.coordinator.model}/${preferences.models.coordinator.reasoningEffort}`,
        `explorer agent: ${preferences.subagents.explorer.model}/${preferences.subagents.explorer.reasoningEffort}`,
        `implementation agent: ${preferences.subagents.implementation.model}/${preferences.subagents.implementation.reasoningEffort}`,
        `verifier agent: ${preferences.subagents.verifier.model}/${preferences.subagents.verifier.reasoningEffort}`,
        ...preferences.modelCapabilities.details,
        `realtime helper: ${preferences.subagents.realtime.model}/${preferences.subagents.realtime.reasoningEffort}`,
        `frontend craft agent: ${preferences.subagents.frontendCraft.model}/${preferences.subagents.frontendCraft.reasoningEffort}`,
        `telemetry: ${preferences.telemetry}`,
        `local telemetry data: ${presentFlag(preferences.telemetryFiles.dirPresent)}`,
        `telemetry files: summary ${presentFlag(preferences.telemetryFiles.summaryPresent)}, events ${presentFlag(preferences.telemetryFiles.eventsPresent)}, queue ${presentFlag(preferences.telemetryFiles.queuePresent)}`,
        `enabled packs: ${preferences.enabledPacks.join(", ")}`,
        `statusline profile: ${preferences.statuslineAudit.status} (${preferences.statuslineAudit.recommendedChangeCount} recommended changes; apply ${preferences.statuslineApply.status})`,
        `cloudflare profile: ${preferences.cloudflareAudit.status} (${preferences.cloudflareAudit.recommendedChangeCount} recommended changes; apply ${preferences.cloudflareApply.status})`
      ];
    }
    case "repair": {
      const repair = models.repair();
      return [
        ...dashboard.activeSection.description,
        "",
        `restore backup: ${repair.restoreStatus.label}`,
        `latest backup: ${repair.backups.latestBackupPath ?? "none"} (${repair.backups.backupCount} total)`,
        `local telemetry data: ${presentFlag(repair.telemetry.dirPresent)}`,
        `telemetry files: summary ${presentFlag(repair.telemetry.summaryPresent)}, events ${presentFlag(repair.telemetry.eventsPresent)}, queue ${presentFlag(repair.telemetry.queuePresent)}`,
        repair.removableInstalls.length === 0
          ? "removable installs: none currently installed"
          : `removable installs: ${repair.removableInstalls.join(", ")}`,
        `install bundle: ${repair.installBundle}`
      ];
    }
    default:
      return dashboard.activeSection.description;
  }
}

function selectedActionHelpLines(
  shell: TuiShell,
  home: ReturnType<typeof loadHomeScreenFromStatusBundle>,
  inspect: () => ReturnType<typeof loadStatusScreenFromStatusBundle>,
  preferences: () => ReturnType<typeof loadSettingsScreen>
): string[] {
  const action = currentAction(shell);
  return (
    selectedActionHelpBuilders(home, inspect, preferences)[action.id]?.(action) ??
    baseSelectedActionHelp(action)
  );
}

function formatProfileActionHelp(
  action: SelectedAction,
  profile: {
    auditStatus: string;
    recommendedChangeCount: number;
    applyStatus: string;
    appliedKeyCount: number;
    appliedKeyLabel: "changes" | "keys";
    details: string[];
  }
): string[] {
  return [
    ...selectedActionHelp(action),
    "",
    `audit: ${profile.auditStatus} (${profile.recommendedChangeCount} recommended changes)`,
    `apply readiness: ${profile.applyStatus} (${profile.appliedKeyCount} ${profile.appliedKeyLabel})`,
    ...profile.details
  ];
}

type SelectedAction = ReturnType<typeof currentAction>;
type SelectedActionHelpBuilder = (action: SelectedAction) => string[];
type ProfileActionHelpModel = Parameters<typeof formatProfileActionHelp>[1];

function selectedActionHelpBuilders(
  home: ReturnType<typeof loadHomeScreenFromStatusBundle>,
  inspect: () => ReturnType<typeof loadStatusScreenFromStatusBundle>,
  preferences: () => ReturnType<typeof loadSettingsScreen>
): Partial<Record<UiCommandId, SelectedActionHelpBuilder>> {
  return {
    ...profileActionHelpBuilders(["preview_codex_profile", "apply_codex_profile"], () => ({
      auditStatus: home.codexProfileAudit.status,
      recommendedChangeCount: home.codexProfileAudit.recommendedChangeCount,
      applyStatus: home.codexProfileApply.status,
      appliedKeyCount: home.codexProfileApply.appliedKeys.length,
      appliedKeyLabel: "changes",
      details: home.codexProfilePreview.details
    })),
    ...profileActionHelpBuilders(["preview_integrations_profile", "apply_integrations_profile"], () => {
      const model = inspect();
      return {
        auditStatus: model.integrationsAudit.status,
        recommendedChangeCount: model.integrationsAudit.recommendedChangeCount,
        applyStatus: model.integrationsApply.status,
        appliedKeyCount: model.integrationsApply.appliedKeys.length,
        appliedKeyLabel: "keys",
        details: model.integrationsPreview.details
      };
    }),
    ...profileActionHelpBuilders(["preview_statusline_profile", "apply_statusline_profile"], () => {
      const model = preferences();
      return {
        auditStatus: model.statuslineAudit.status,
        recommendedChangeCount: model.statuslineAudit.recommendedChangeCount,
        applyStatus: model.statuslineApply.status,
        appliedKeyCount: model.statuslineApply.appliedKeys.length,
        appliedKeyLabel: "keys",
        details: model.statuslinePreview.details
      };
    }),
    show_runtime_summary: (action) => {
      const model = inspect();
      return detailSelectedActionHelp(action, [
        "Opens saved `.sane` handoff notes.",
        ...model.runtimeSummary.details
      ]);
    },
    show_config: (action) => detailSelectedActionHelp(action, inspect().localConfig.details),
    show_codex_config: (action) => detailSelectedActionHelp(action, inspect().codexConfig.details),
    preview_policy: (action) =>
      detailSelectedActionHelp(
        action,
        formatStatusPolicyPreviewLines(inspect(), {
          mode: "action",
          snapshot: "latest snapshot",
          input: "latest snapshot input",
          current: "current preview"
        })
      ),
    ...profileActionHelpBuilders(["preview_cloudflare_profile", "apply_cloudflare_profile"], () => {
      const model = preferences();
      return {
        auditStatus: model.cloudflareAudit.status,
        recommendedChangeCount: model.cloudflareAudit.recommendedChangeCount,
        applyStatus: model.cloudflareApply.status,
        appliedKeyCount: model.cloudflareApply.appliedKeys.length,
        appliedKeyLabel: "keys",
        details: model.cloudflarePreview.details
      };
    })
  };
}

function profileActionHelpBuilders<const T extends UiCommandId[]>(
  ids: T,
  loadProfile: () => ProfileActionHelpModel
): Partial<Record<T[number], SelectedActionHelpBuilder>> {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      (action: SelectedAction) => formatProfileActionHelp(action, loadProfile())
    ])
  ) as Partial<Record<T[number], SelectedActionHelpBuilder>>;
}

function baseSelectedActionHelp(action: SelectedAction): string[] {
  return selectedActionHelp(action);
}

function detailSelectedActionHelp(action: SelectedAction, details: string[]): string[] {
  return selectedActionHelp(action, details);
}

function selectedActionHelp(action: SelectedAction, details?: string[]): string[] {
  const lines = [
    `Selected action: ${action.label}`,
    impactLine(action),
    `Files touched: ${action.filesTouched.join(", ")}`,
    "",
    ...action.help
  ];
  return details ? [...lines, "", ...details] : lines;
}

function impactLine(action: SelectedAction): string {
  if (action.kind === "editor") {
    return "Impact: changes Sane defaults only after you save.";
  }

  if (isReadOnlyAction(action)) {
    return action.id.startsWith("apply_") || action.id.startsWith("backup_") || action.id.startsWith("restore_")
      ? "Impact: changes user-level Codex files, not this repo."
      : "Impact: opens details without changing files.";
  }

  return action.repoMutation
    ? "Impact: changes this repo or Sane project files."
    : "Impact: changes your Codex setup.";
}

function isReadOnlyAction(action: SelectedAction): boolean {
  return (
    action.id === "show_status"
    || action.id === "doctor"
    || action.id === "show_runtime_summary"
    || action.id === "show_config"
    || action.id === "show_codex_config"
    || action.id === "show_outcome_readiness"
    || action.id.startsWith("preview_")
  );
}

function footerLine(
  chips: ReturnType<typeof loadDashboardView>["chips"],
  mode: SaneTuiAppView["mode"]
): string {
  return `mode ${mode.label.toLowerCase()}  |  ${compactStatusLine(chips)}`;
}

function compactStatusLine(chips: ReturnType<typeof loadDashboardView>["chips"]): string {
  const drift = chipValue(chips, "drift") === "none" ? "ok" : chipValue(chips, "drift");

  return [
    ...FOOTER_STATUS_SPECS.map(
      ({ id, label }) => `${label} ${compactStatus(chipValue(chips, id))}`
    ),
    `drift ${drift}`
  ].join("  ");
}

function footerStatusMap(chips: ReturnType<typeof loadDashboardView>["chips"]): SaneTuiAppView["footer"]["status"] {
  return {
    runtime: compactStatus(chipValue(chips, "runtime")),
    codex: compactStatus(chipValue(chips, "codex-config")),
    user: compactStatus(chipValue(chips, "user-skills")),
    hooks: compactStatus(chipValue(chips, "hooks"))
  };
}

function chipValue(chips: ReturnType<typeof loadDashboardView>["chips"], id: string): string {
  return chips.find((chip) => chip.id === id)?.value ?? "missing";
}

function compactStatus(value: string): string {
  return value === "installed" ? "ok" : value;
}

function presentFlag(value: boolean): string {
  return value ? "present" : "missing";
}

function homeOverviewTitle(home: ReturnType<typeof loadHomeScreenFromStatusBundle>): string {
  return home.recommendedActionId === "install_runtime"
    ? "Guided setup"
    : "Setup tune-up";
}

function currentMode(shell: TuiShell): SaneTuiAppView["mode"] {
  if (shell.notice) {
    return {
      id: "notice",
      label: "Notice",
      hint: "enter, space, or esc closes this message"
    };
  }

  if (shell.pendingConfirmation) {
    return {
      id: "confirm",
      label: "Confirm",
      hint: "enter or y runs it  |  esc or n cancels"
    };
  }

  if (shell.activeEditor?.kind === "config") {
    return {
      id: "config",
      label: "Edit Models",
      hint: "up/down picks field  |  left/right changes value  |  enter saves  |  r resets  |  esc backs out"
    };
  }

  if (shell.activeEditor?.kind === "packs") {
    return {
      id: "packs",
      label: "Edit Packs",
      hint: "up/down picks pack  |  space toggles  |  enter saves  |  r resets  |  esc backs out"
    };
  }

  if (shell.activeEditor?.kind === "privacy") {
    return {
      id: "privacy",
      label: "Edit Privacy",
      hint: "left/right changes consent  |  enter saves  |  d deletes telemetry data  |  esc backs out"
    };
  }

  return {
    id: "browse",
    label: "Browse",
    hint: "left/right or tab change section  |  up/down or j/k change option  |  enter runs  |  q quits"
  };
}

function lazy<T>(load: () => T): () => T {
  let cached: T | null = null;
  return () => {
    if (cached === null) {
      cached = load();
    }
    return cached;
  };
}
