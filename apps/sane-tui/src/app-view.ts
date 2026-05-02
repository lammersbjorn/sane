import { type TuiShell } from "@sane/sane-tui/shell.js";
import { loadDashboardView } from "@sane/sane-tui/dashboard.js";
import { loadHomeScreenFromStatusBundle } from "@sane/sane-tui/home-screen.js";
import { loadAddToCodexScreenFromStatusBundle } from "@sane/sane-tui/add-to-codex-screen.js";
import {
  statusOverviewLines,
  loadStatusScreenFromStatusBundle
} from "@sane/sane-tui/status-screen.js";
import { loadOverlayModel, type OverlayModel } from "@sane/sane-tui/overlay-models.js";
import { loadSettingsScreen } from "@sane/sane-tui/settings-screen.js";
import { loadRepairScreenFromStatusBundle } from "@sane/sane-tui/repair-screen.js";
import {
  buildExperienceView,
  footerLine,
  footerStatusMap,
  presentFlag,
  selectedActionHelpLines,
  type AppViewModels
} from "./app-view-helpers.js";

export interface ExperienceActionItem {
  id: string;
  label: string;
  selected: boolean;
  recommended: boolean;
}

export interface ExperienceActionGroup {
  title: string;
  items: ExperienceActionItem[];
}

export interface ExperiencePanel {
  title: string;
  lines: string[];
}

export interface ExperienceView {
  eyebrow: string;
  title: string;
  body: string[];
  primaryActionLabel: string;
  primaryActionHint: string;
  panels: ExperiencePanel[];
  actionGroups: ExperienceActionGroup[];
  selectedTitle: string;
  selectedLines: string[];
}

export interface SaneTuiAppView {
  title: "Sane";
  subtitle: "Install, configure, check, and recover Sane in Codex";
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
  experience: ExperienceView;
  overlay: OverlayModel;
}

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
  const models: AppViewModels = { home, install, inspect, preferences, repair };

  const sectionOverview = sectionOverviewLines(dashboard, models);
  const selectedHelp = selectedActionHelpLines(
    dashboard.selectedAction,
    home,
    inspect,
    preferences
  );
  const mode = currentMode(shell);

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
    sectionOverviewLines: sectionOverview,
    selectedHelpTitle: "Selected Step Details",
    selectedHelpLines: selectedHelp,
    latestStatusTitle: dashboard.lastResult.title,
    latestStatusLines: dashboard.lastResult.lines,
    mode,
    footerTitle: "Now",
    footerLines: [footerLine(dashboard.chips, mode)],
    footer: {
      navHint: mode.hint,
      status: footerStatusMap(dashboard.chips)
    },
    experience: buildExperienceView(dashboard, models, sectionOverview, selectedHelp),
    overlay: loadOverlayModel(shell)
  };
}

function sectionOverviewLines(
  dashboard: ReturnType<typeof loadDashboardView>,
  models: AppViewModels
): string[] {

  switch (dashboard.activeSection.id) {
    case "home": {
      const lines = [
        homeOverviewTitle(models.home),
        `Next step: ${dashboard.recommendedNextStep}`,
        "",
        "Right now",
        ...models.home.statusLine.split(" | "),
        "",
        "Suggested path",
        "1. Set up local Sane files",
        "2. Choose how Codex should work",
        "3. Preview and back up the Codex settings changes",
        "4. Apply the Codex settings changes",
        "5. Teach Codex the Sane workflow",
        "6. Check health whenever something feels off",
        "",
        "Normal `sane` opens Check after setup."
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
      lines.push(`Codex settings changes: ${models.home.codexProfileAudit.status} (${models.home.codexProfileAudit.recommendedChangeCount} change(s))`);
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
        `codex add-ons state: ${install.bundleStatus}`,
        install.missingTargets.length === 0
          ? "setup targets: all onboarding targets installed"
          : `setup targets missing: ${install.missingTargets.join(", ")}`,
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
        `default model: ${preferences.models.coordinator.model}/${preferences.models.coordinator.reasoningEffort}`,
        `explore model: ${preferences.subagents.explorer.model}/${preferences.subagents.explorer.reasoningEffort}`,
        `build model: ${preferences.subagents.implementation.model}/${preferences.subagents.implementation.reasoningEffort}`,
        `review model: ${preferences.subagents.verifier.model}/${preferences.subagents.verifier.reasoningEffort}`,
        ...preferences.modelCapabilities.details,
        `quick helper model: ${preferences.subagents.realtime.model}/${preferences.subagents.realtime.reasoningEffort}`,
        `frontend helper model: ${preferences.subagents.frontendCraft.model}/${preferences.subagents.frontendCraft.reasoningEffort}`,
        `telemetry: ${preferences.telemetry}`,
        `auto updates: ${preferences.autoUpdates ? "enabled" : "disabled"}`,
        `local telemetry data: ${presentFlag(preferences.telemetryFiles.dirPresent)}`,
        `telemetry files: summary ${presentFlag(preferences.telemetryFiles.summaryPresent)}, events ${presentFlag(preferences.telemetryFiles.eventsPresent)}, queue ${presentFlag(preferences.telemetryFiles.queuePresent)}`,
        `enabled guidance options: ${preferences.enabledPacks.join(", ")}`,
        `status line settings: ${preferences.statuslineAudit.status} (${preferences.statuslineAudit.recommendedChangeCount} recommended changes; apply ${preferences.statuslineApply.status})`,
        `Cloudflare settings: ${preferences.cloudflareAudit.status} (${preferences.cloudflareAudit.recommendedChangeCount} recommended changes; apply ${preferences.cloudflareApply.status})`
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
        `codex add-ons: ${repair.installBundle}`
      ];
    }
    default:
      return dashboard.activeSection.description;
  }
}

function homeOverviewTitle(home: ReturnType<typeof loadHomeScreenFromStatusBundle>): string {
  return home.recommendedActionId === "install_runtime"
    ? "Start here"
    : "Codex settings";
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
      label: "Edit Guidance",
      hint: "up/down picks option  |  space toggles  |  enter saves  |  r resets  |  esc backs out"
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
