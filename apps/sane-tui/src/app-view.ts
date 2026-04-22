import { type TuiShell, currentAction } from "@/shell.js";
import { loadDashboardView } from "@/dashboard.js";
import { loadGetStartedScreen } from "@/get-started-screen.js";
import { loadInstallScreen } from "@/install-screen.js";
import {
  formatLatestPolicyPreviewInputLines,
  formatLatestPolicyPreviewLine,
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
  const dashboard = loadDashboardView(shell);
  const getStarted = loadGetStartedScreen(shell.paths, shell.codexPaths);
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
    selectedHelpLines: selectedActionHelpLines(shell, inspect),
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
      return lines;
    }
    case "inspect": {
      return inspectOverviewLines(models.inspect());
    }
    case "install": {
      const install = models.install;
      const integrationsAction = install.actions.find(
        (action) => action.id === "apply_integrations_profile"
      );
      return [
        "Current install bundle:",
        ...dashboard.activeSection.description,
        "",
        `install bundle state: ${install.bundleStatus}`,
        install.missingTargets.length === 0
          ? "bundle targets: all onboarding targets installed"
          : `bundle targets missing: ${install.missingTargets.join(", ")}`,
        `optional Codex tools: ${integrationsAction?.status ?? "missing"} (${models.inspect().integrationsAudit.recommendedChangeCount} recommended changes)`
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
        `telemetry: ${preferences.telemetry}`,
        `enabled packs: ${preferences.enabledPacks.join(", ")}`
      ];
    }
    case "repair": {
      const repair = models.repair();
      const removable = repair.actions
        .filter((action) => action.id.startsWith("uninstall_") && action.status === "installed")
        .map((action) => action.id.replace("uninstall_", ""));
      return [
        ...dashboard.activeSection.description,
        "",
        `restore backup: ${repair.actions.find((action) => action.id === "restore_codex_config")?.status ?? "missing"}`,
        `local telemetry data: ${repair.actions.find((action) => action.id === "reset_telemetry_data")?.status ?? "missing"}`,
        removable.length === 0
          ? "removable installs: none currently installed"
          : `removable installs: ${removable.join(", ")}`,
        `install bundle: ${repair.installBundle}`
      ];
    }
    default:
      return dashboard.activeSection.description;
  }
}

function selectedActionHelpLines(
  shell: TuiShell,
  inspect: () => ReturnType<typeof loadInspectScreen>
): string[] {
  const action = currentAction(shell);
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

  if (action.id === "preview_policy") {
    const model = inspect();
    return [
      `Selected action: ${action.label}`,
      "",
      ...action.help,
      "",
      formatLatestPolicyPreviewLine(model.latestPolicyPreview).replace(
        "latest policy snapshot:",
        "latest snapshot:"
      ),
      ...formatLatestPolicyPreviewInputLines(model.latestPolicyPreview, "latest snapshot input"),
      ...model.policyPreview.details
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

function lazy<T>(load: () => T): () => T {
  let cached: T | null = null;
  return () => {
    if (cached === null) {
      cached = load();
    }
    return cached;
  };
}
