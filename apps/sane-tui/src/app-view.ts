import { type TuiShell, currentAction } from "@/shell.js";
import { loadDashboardView } from "@/dashboard.js";
import { loadGetStartedScreenFromStatusBundle } from "@/get-started-screen.js";
import { loadInstallScreenFromStatusBundle } from "@/install-screen.js";
import {
  formatInspectPolicyPreviewLines,
  inspectOverviewLines,
  loadInspectScreenFromStatusBundle
} from "@/inspect-screen.js";
import { loadOverlayModel, type OverlayModel } from "@/overlay-models.js";
import { loadPreferencesScreen } from "@/preferences-screen.js";
import { loadRepairScreenFromStatusBundle } from "@/repair-screen.js";
import { type UiCommandId } from "@/command-registry.js";

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

const FOOTER_STATUS_SPECS = [
  { id: "runtime", label: "runtime" },
  { id: "codex-config", label: "codex" },
  { id: "user-skills", label: "user" },
  { id: "hooks", label: "hooks" }
] as const;

export function loadAppView(shell: TuiShell): SaneTuiAppView {
  const getStarted = loadGetStartedScreenFromStatusBundle(
    shell.paths,
    shell.codexPaths,
    shell.statusSnapshot.statusBundle
  );
  const dashboard = loadDashboardView(shell, getStarted);
  const install = loadInstallScreenFromStatusBundle(shell.paths, shell.codexPaths, shell.statusSnapshot.statusBundle);
  const inspect = lazy(() =>
    loadInspectScreenFromStatusBundle(shell.paths, shell.codexPaths, shell.statusSnapshot.statusBundle)
  );
  const preferences = lazy(() => loadPreferencesScreen(shell.paths, shell.codexPaths));
  const repair = lazy(() =>
    loadRepairScreenFromStatusBundle(shell.paths, shell.codexPaths, shell.statusSnapshot.statusBundle)
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
      status: footerStatusMap(dashboard.chips)
    },
    overlay: loadOverlayModel(shell)
  };
}

function sectionOverviewLines(
  dashboard: ReturnType<typeof loadDashboardView>,
  models: {
    getStarted: ReturnType<typeof loadGetStartedScreenFromStatusBundle>;
    install: ReturnType<typeof loadInstallScreenFromStatusBundle>;
    inspect: () => ReturnType<typeof loadInspectScreenFromStatusBundle>;
    preferences: () => ReturnType<typeof loadPreferencesScreen>;
    repair: () => ReturnType<typeof loadRepairScreenFromStatusBundle>;
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
  getStarted: ReturnType<typeof loadGetStartedScreenFromStatusBundle>,
  inspect: () => ReturnType<typeof loadInspectScreenFromStatusBundle>,
  preferences: () => ReturnType<typeof loadPreferencesScreen>
): string[] {
  const action = currentAction(shell);
  return (
    selectedActionHelpBuilders(getStarted, inspect, preferences)[action.id]?.(action) ??
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
  getStarted: ReturnType<typeof loadGetStartedScreenFromStatusBundle>,
  inspect: () => ReturnType<typeof loadInspectScreenFromStatusBundle>,
  preferences: () => ReturnType<typeof loadPreferencesScreen>
): Partial<Record<UiCommandId, SelectedActionHelpBuilder>> {
  return {
    ...profileActionHelpBuilders(["preview_codex_profile", "apply_codex_profile"], () => ({
      auditStatus: getStarted.codexProfileAudit.status,
      recommendedChangeCount: getStarted.codexProfileAudit.recommendedChangeCount,
      applyStatus: getStarted.codexProfileApply.status,
      appliedKeyCount: getStarted.codexProfileApply.appliedKeys.length,
      appliedKeyLabel: "changes",
      details: getStarted.codexProfilePreview.details
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
        "Runtime handoff visibility is read-only and current-run-derived.",
        ...model.runtimeSummary.details
      ]);
    },
    show_config: (action) => detailSelectedActionHelp(action, inspect().localConfig.details),
    show_codex_config: (action) => detailSelectedActionHelp(action, inspect().codexConfig.details),
    preview_policy: (action) =>
      detailSelectedActionHelp(
        action,
        formatInspectPolicyPreviewLines(inspect(), {
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
    }),
    ...profileActionHelpBuilders(["preview_opencode_profile", "apply_opencode_profile"], () => {
      const model = preferences();
      return {
        auditStatus: model.opencodeAudit.status,
        recommendedChangeCount: model.opencodeAudit.recommendedChangeCount,
        applyStatus: model.opencodeApply.status,
        appliedKeyCount: model.opencodeApply.appliedKeys.length,
        appliedKeyLabel: "keys",
        details: model.opencodePreview.details
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
  const lines = [`Selected action: ${action.label}`, "", ...action.help];
  return details ? [...lines, "", ...details] : lines;
}

function footerLine(chips: ReturnType<typeof loadDashboardView>["chips"]): string {
  return `left/right change section  |  up/down change option  |  enter runs  |  ${compactStatusLine(chips)}`;
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

function lazy<T>(load: () => T): () => T {
  let cached: T | null = null;
  return () => {
    if (cached === null) {
      cached = load();
    }
    return cached;
  };
}
