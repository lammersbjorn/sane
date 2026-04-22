import { type TuiShell, currentAction } from "@/shell.js";
import { loadDashboardView } from "@/dashboard.js";
import { loadGetStartedScreen } from "@/get-started-screen.js";
import { loadInstallScreen } from "@/install-screen.js";
import {
  formatInspectPolicyPreviewLines,
  inspectOverviewLines,
  loadInspectScreen
} from "@/inspect-screen.js";
import { loadOverlayModel, type OverlayModel } from "@/overlay-models.js";
import { loadPreferencesScreen } from "@/preferences-screen.js";
import { loadRepairScreen } from "@/repair-screen.js";

export interface SaneTuiAppView {
  title: "Sane";
  subtitle: "Codex-native onboarding and setup";
  projectLabel: string;
  recommendedNextStep: string;
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
  footerTitle: "Now";
  footerLines: string[];
  footer: {
    navHint: "left/right change section  |  up/down change option  |  enter runs";
    status: Record<"runtime" | "codex" | "user" | "hooks", string>;
  };
  overlay: OverlayModel;
}

export function loadAppView(shell: TuiShell): SaneTuiAppView {
  const getStarted = loadGetStartedScreen(shell.paths, shell.codexPaths);
  const dashboard = loadDashboardView(shell, getStarted);
  const install = loadInstallScreen(shell.paths, shell.codexPaths);
  const inspect = lazy(() => loadInspectScreen(shell.paths, shell.codexPaths));
  const preferences = lazy(() => loadPreferencesScreen(shell.paths, shell.codexPaths));
  const repair = lazy(() => loadRepairScreen(shell.paths, shell.codexPaths));

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
      getStarted,
      install,
      inspect,
      preferences,
      repair
    }),
    selectedHelpTitle: "Selected Step Details",
    selectedHelpLines: selectedActionHelpLines(shell, getStarted, inspect, preferences),
    latestStatusTitle: dashboard.lastResult.title,
    latestStatusLines: dashboard.lastResult.lines,
    footerTitle: "Now",
    footerLines: [footerLine(dashboard.chips)],
    footer: {
      navHint: "left/right change section  |  up/down change option  |  enter runs",
      status: {
        runtime: footerStatus(dashboard.chips, "runtime"),
        codex: footerStatus(dashboard.chips, "codex-config"),
        user: footerStatus(dashboard.chips, "user-skills"),
        hooks: footerStatus(dashboard.chips, "hooks")
      }
    },
    overlay: loadOverlayModel(shell)
  };
}

function sectionOverviewLines(
  dashboard: ReturnType<typeof loadDashboardView>,
  models: {
    getStarted: ReturnType<typeof loadGetStartedScreen>;
    install: ReturnType<typeof loadInstallScreen>;
    inspect: () => ReturnType<typeof loadInspectScreen>;
    preferences: () => ReturnType<typeof loadPreferencesScreen>;
    repair: () => ReturnType<typeof loadRepairScreen>;
  }
): string[] {

  switch (dashboard.activeSection.id) {
    case "get_started": {
      const lines = [
        `Recommended now: ${dashboard.recommendedNextStep}`,
        `Status now: ${models.getStarted.statusLine}`
      ];
      if (dashboard.recommendedActionId) {
        const action = dashboard.actions.find((item) => item.id === dashboard.recommendedActionId);
        if (action) {
          lines.push(`Primary action: ${action.label}`);
        }
      }
      if (dashboard.attentionItems.length > 0) {
        lines.push("");
        lines.push("Attention items found in current setup.");
        lines.push(...dashboard.attentionItems);
      }
      lines.push(
        `core codex profile: ${models.getStarted.codexProfileAudit.status} (${models.getStarted.codexProfileAudit.recommendedChangeCount} recommended changes; apply ${models.getStarted.codexProfileApply.status})`
      );
      return lines;
    }
    case "inspect": {
      return inspectOverviewLines(models.inspect());
    }
    case "install": {
      const install = models.install;
      return [
        "Current install bundle:",
        ...dashboard.activeSection.description,
        "",
        `install bundle state: ${install.bundleStatus}`,
        install.missingTargets.length === 0
          ? "bundle targets: all onboarding targets installed"
          : `bundle targets missing: ${install.missingTargets.join(", ")}`,
        `optional Codex tools: ${install.integrationsStatus.label} (${install.integrationsRecommendedChangeCount} recommended changes)`
      ];
    }
    case "preferences": {
      const preferences = models.preferences();
      return [
        ...dashboard.activeSection.description,
        "",
        `defaults source: ${preferences.source}`,
        `coordinator: ${preferences.models.coordinator.model}/${preferences.models.coordinator.reasoningEffort}`,
        `sidecar: ${preferences.models.sidecar.model}/${preferences.models.sidecar.reasoningEffort}`,
        `verifier: ${preferences.models.verifier.model}/${preferences.models.verifier.reasoningEffort}`,
        `explorer: ${preferences.subagents.explorer.model}/${preferences.subagents.explorer.reasoningEffort}`,
        `execution: ${preferences.derivedRouting.execution.model}/${preferences.derivedRouting.execution.reasoningEffort}`,
        `realtime: ${preferences.derivedRouting.realtime.model}/${preferences.derivedRouting.realtime.reasoningEffort}`,
        `telemetry: ${preferences.telemetry}`,
        `local telemetry data: ${presentFlag(preferences.telemetryFiles.dirPresent)}`,
        `telemetry files: summary ${presentFlag(preferences.telemetryFiles.summaryPresent)}, events ${presentFlag(preferences.telemetryFiles.eventsPresent)}, queue ${presentFlag(preferences.telemetryFiles.queuePresent)}`,
        `enabled packs: ${preferences.enabledPacks.join(", ")}`,
        `cloudflare profile: ${preferences.cloudflareAudit.status} (${preferences.cloudflareAudit.recommendedChangeCount} recommended changes; apply ${preferences.cloudflareApply.status})`,
        `opencode profile: ${preferences.opencodeAudit.status} (${preferences.opencodeAudit.recommendedChangeCount} recommended changes; apply ${preferences.opencodeApply.status})`
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
  getStarted: ReturnType<typeof loadGetStartedScreen>,
  inspect: () => ReturnType<typeof loadInspectScreen>,
  preferences: () => ReturnType<typeof loadPreferencesScreen>
): string[] {
  const action = currentAction(shell);
  if (action.id === "preview_codex_profile" || action.id === "apply_codex_profile") {
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      `audit: ${getStarted.codexProfileAudit.status} (${getStarted.codexProfileAudit.recommendedChangeCount} recommended changes)`,
      `apply readiness: ${getStarted.codexProfileApply.status} (${getStarted.codexProfileApply.appliedKeys.length} changes)`,
      ...getStarted.codexProfilePreview.details
    ];
  }

  if (
    action.id === "preview_integrations_profile" ||
    action.id === "apply_integrations_profile"
  ) {
    const model = inspect();
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      `audit: ${model.integrationsAudit.status} (${model.integrationsAudit.recommendedChangeCount} recommended changes)`,
      `apply readiness: ${model.integrationsApply.status} (${model.integrationsApply.appliedKeys.length} keys)`,
      ...model.integrationsPreview.details
    ];
  }

  if (action.id === "show_runtime_summary") {
    const model = inspect();
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      "Runtime handoff visibility is read-only and current-run-derived.",
      ...model.runtimeSummary.details
    ];
  }

  if (action.id === "show_config") {
    const model = inspect();
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      ...model.localConfig.details
    ];
  }

  if (action.id === "show_codex_config") {
    const model = inspect();
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      ...model.codexConfig.details
    ];
  }

  if (action.id === "preview_policy") {
    const model = inspect();
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      ...formatInspectPolicyPreviewLines(model, {
        mode: "action",
        snapshot: "latest snapshot",
        input: "latest snapshot input",
        current: "current preview"
      })
    ];
  }

  if (action.id === "preview_cloudflare_profile" || action.id === "apply_cloudflare_profile") {
    const model = preferences();
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      `audit: ${model.cloudflareAudit.status} (${model.cloudflareAudit.recommendedChangeCount} recommended changes)`,
      `apply readiness: ${model.cloudflareApply.status} (${model.cloudflareApply.appliedKeys.length} keys)`,
      ...model.cloudflarePreview.details
    ];
  }

  if (action.id === "preview_opencode_profile" || action.id === "apply_opencode_profile") {
    const model = preferences();
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      `audit: ${model.opencodeAudit.status} (${model.opencodeAudit.recommendedChangeCount} recommended changes)`,
      `apply readiness: ${model.opencodeApply.status} (${model.opencodeApply.appliedKeys.length} keys)`,
      ...model.opencodePreview.details
    ];
  }

  return [`Selected action: ${action.label}`, "", ...action.help];
}

function footerLine(chips: ReturnType<typeof loadDashboardView>["chips"]): string {
  return `left/right change section  |  up/down change option  |  enter runs  |  ${compactStatusLine(chips)}`;
}

function compactStatusLine(chips: ReturnType<typeof loadDashboardView>["chips"]): string {
  const runtime = footerStatus(chips, "runtime");
  const codex = footerStatus(chips, "codex-config");
  const user = footerStatus(chips, "user-skills");
  const hooks = footerStatus(chips, "hooks");
  const drift = chipValue(chips, "drift") === "none" ? "ok" : chipValue(chips, "drift");

  return `runtime ${runtime}  codex ${codex}  user ${user}  hooks ${hooks}  drift ${drift}`;
}

function footerStatus(
  chips: ReturnType<typeof loadDashboardView>["chips"],
  name: "runtime" | "codex-config" | "user-skills" | "hooks"
): string {
  return compactStatus(chipValue(chips, name));
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

function lazy<T>(load: () => T): () => T {
  let cached: T | null = null;
  return () => {
    if (cached === null) {
      cached = load();
    }
    return cached;
  };
}
