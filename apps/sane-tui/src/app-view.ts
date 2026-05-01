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
  subtitle: "Install, tune, check, and recover Sane in Codex";
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

const FOOTER_STATUS_SPECS = [
  { id: "runtime", label: "local" },
  { id: "codex-config", label: "codex" },
  { id: "user-skills", label: "skills" },
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

  const sectionOverview = sectionOverviewLines(dashboard, {
    home,
    install,
    inspect,
    preferences,
    repair
  });
  const selectedHelp = selectedActionHelpLines(shell, home, inspect, preferences);
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
    experience: buildExperienceView(dashboard, {
      home,
      install,
      inspect,
      preferences,
      repair
    }, sectionOverview, selectedHelp),
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
        "Right now",
        ...models.home.statusLine.split(" | "),
        "",
        "Suggested path",
        "1. Get this repo ready",
        "2. Choose how Codex should work",
        "3. Preview and back up the Codex tune-up",
        "4. Apply the Codex tune-up",
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
      lines.push(`Codex tune-up: ${models.home.codexProfileAudit.status} (${models.home.codexProfileAudit.recommendedChangeCount} change(s))`);
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
        `codex add-ons: ${repair.installBundle}`
      ];
    }
    default:
      return dashboard.activeSection.description;
  }
}

function buildExperienceView(
  dashboard: ReturnType<typeof loadDashboardView>,
  models: {
    home: ReturnType<typeof loadHomeScreenFromStatusBundle>;
    install: ReturnType<typeof loadAddToCodexScreenFromStatusBundle>;
    inspect: () => ReturnType<typeof loadStatusScreenFromStatusBundle>;
    preferences: () => ReturnType<typeof loadSettingsScreen>;
    repair: () => ReturnType<typeof loadRepairScreenFromStatusBundle>;
  },
  sectionOverview: string[],
  selectedHelp: string[]
): ExperienceView {
  const recommended = recommendedAction(dashboard);
  const selectedTitle = cleanActionLabel(dashboard.selectedAction.label);
  const selectedLines = readableSelectedLines(selectedHelp);

  switch (dashboard.activeSection.id) {
    case "home":
      return {
        eyebrow: "Codex readiness",
        title: homeExperienceTitle(models.home),
        body: [
          dashboard.recommendedNextStep,
          "Tune defaults, refresh Codex add-ons, check health, and get back to work."
        ],
        primaryActionLabel: cleanActionLabel(recommended?.label ?? dashboard.selectedAction.label),
        primaryActionHint: primaryActionHint(recommended ?? dashboard.selectedAction),
        panels: [
          {
            title: "Setup now",
            lines: models.home.statusLine.split(" | ").map(sentenceCaseStatus)
          },
          {
            title: "Needs a look",
            lines: dashboard.attentionItems.length > 0
              ? dashboard.attentionItems.slice(0, 4).map(sentenceCaseStatus)
              : ["No urgent setup issues."]
          }
        ],
        actionGroups: actionGroups(dashboard, [
          { title: "Start", ids: ["install_runtime", "open_config_editor", "preview_codex_profile", "backup_codex_config", "apply_codex_profile", "export_all"] },
          { title: "Maintain", ids: ["doctor"] }
        ]),
        selectedTitle,
        selectedLines
      };
    case "settings": {
      const preferences = models.preferences();
      return {
        eyebrow: "Work style",
        title: "Tune Sane around how you want Codex to work.",
        body: [
          "Set the default crew once: main session, explorer, implementation, reviewer, realtime helper.",
          "Keep advanced model details visible, but behind the selected move."
        ],
        primaryActionLabel: cleanActionLabel(recommended?.label ?? dashboard.selectedAction.label),
        primaryActionHint: primaryActionHint(recommended ?? dashboard.selectedAction),
        panels: [
          {
            title: "Agent defaults",
            lines: [
              `Main session: ${preferences.models.coordinator.model}/${preferences.models.coordinator.reasoningEffort}`,
              `Explorer: ${preferences.subagents.explorer.model}/${preferences.subagents.explorer.reasoningEffort}`,
              `Build: ${preferences.subagents.implementation.model}/${preferences.subagents.implementation.reasoningEffort}`,
              `Review: ${preferences.subagents.verifier.model}/${preferences.subagents.verifier.reasoningEffort}`
            ]
          },
          {
            title: "Comfort settings",
            lines: [
              `Packs: ${preferences.enabledPacks.join(", ") || "core only"}`,
              `Telemetry: ${preferences.telemetry}`,
              `Auto updates: ${preferences.autoUpdates ? "on" : "off"}`
            ]
          }
        ],
        actionGroups: actionGroups(dashboard, [
          { title: "Edit", ids: ["open_config_editor", "open_pack_editor", "open_privacy_editor"] },
          { title: "Preview", ids: ["show_config", "show_codex_config", "preview_statusline_profile", "preview_cloudflare_profile"] },
          { title: "Apply", ids: ["apply_statusline_profile", "apply_cloudflare_profile", "toggle_auto_updates"] }
        ]),
        selectedTitle,
        selectedLines
      };
    }
    case "add_to_codex": {
      const install = models.install;
      return {
        eyebrow: "Codex add-ons",
        title: "Choose what Sane adds to Codex.",
        body: [
          "Personal add-ons teach Codex the Sane workflow. Repo add-ons stay explicit.",
          install.missingTargets.length === 0
            ? "Core Codex add-ons are already installed."
            : `${install.missingTargets.length} add-on target(s) still need attention.`
        ],
        primaryActionLabel: cleanActionLabel(recommended?.label ?? dashboard.selectedAction.label),
        primaryActionHint: primaryActionHint(recommended ?? dashboard.selectedAction),
        panels: [
          {
            title: "Personal Codex",
            lines: [
              `Core add-ons: ${install.bundleStatus}`,
              `Optional tools: ${install.integrationsStatus.label}`,
              `Recommended tool changes: ${install.integrationsRecommendedChangeCount}`
            ]
          },
          {
            title: "Project boundary",
            lines: [
              "Repo-level writes are advanced and explicit.",
              "Files changed show before writes.",
              "Unrelated Codex content stays yours."
            ]
          }
        ],
        actionGroups: actionGroups(dashboard, [
          { title: "Personal", ids: ["export_all", "export_user_skills", "export_global_agents", "export_custom_agents", "export_hooks"] },
          { title: "Tools", ids: ["apply_integrations_profile"] },
          { title: "Advanced", ids: ["export_repo_skills", "export_repo_agents", "export_opencode_all"] }
        ]),
        selectedTitle,
        selectedLines
      };
    }
    case "status": {
      const statusLines = sectionOverview.filter((line) => line.length > 0);
      return {
        eyebrow: "Health check",
        title: "Read the setup before touching anything.",
        body: [
          "Status is read-only. It gives you the calm version first, then the full report when selected.",
          firstMatching(statusLines, "Needs attention") ?? "Needs attention: none"
        ],
        primaryActionLabel: cleanActionLabel(recommended?.label ?? dashboard.selectedAction.label),
        primaryActionHint: primaryActionHint(recommended ?? dashboard.selectedAction),
        panels: [
          {
            title: "Health",
            lines: statusLines.slice(1, 8)
          },
          {
            title: "Details live here",
            lines: [
              "Full reports, policy previews, handoff notes, and raw config are one move away.",
              "No agent work starts from Status."
            ]
          }
        ],
        actionGroups: actionGroups(dashboard, [
          { title: "Check", ids: ["show_status", "doctor", "check_updates"] },
          { title: "Read", ids: ["show_runtime_summary", "show_config", "show_codex_config", "preview_policy"] },
          { title: "Optional", ids: ["preview_integrations_profile", "preview_statusline_profile"] }
        ]),
        selectedTitle,
        selectedLines
      };
    }
    case "repair": {
      const repair = models.repair();
      return {
        eyebrow: "Repair",
        title: "Fix broken setup without removing what is yours.",
        body: [
          "Repair keeps recovery tools separate from uninstall.",
          "Backups and confirmations appear before risky moves."
        ],
        primaryActionLabel: cleanActionLabel(recommended?.label ?? dashboard.selectedAction.label),
        primaryActionHint: primaryActionHint(recommended ?? dashboard.selectedAction),
        panels: [
          {
            title: "Recovery",
            lines: [
              `Restore: ${repair.restoreStatus.label}`,
              `Backups: ${repair.backups.backupCount}`,
              `Codex add-ons: ${repair.installBundle}`
            ]
          },
          {
            title: "Local data",
            lines: [
              `Telemetry directory: ${presentFlag(repair.telemetry.dirPresent)}`,
              "Local cleanup stays separate from uninstall."
            ]
          }
        ],
        actionGroups: actionGroups(dashboard, [
          { title: "Restore", ids: ["install_runtime", "backup_codex_config", "restore_codex_config"] },
          { title: "Clean", ids: ["reset_telemetry_data"] }
        ]),
        selectedTitle,
        selectedLines
      };
    }
    case "uninstall":
      return {
        eyebrow: "Remove",
        title: "Remove only Sane-managed pieces.",
        body: [
          "This is intentionally blunt. Every destructive move requires confirmation.",
          "Unrelated Codex files, skills, agents, and plugins should stay."
        ],
        primaryActionLabel: cleanActionLabel(recommended?.label ?? dashboard.selectedAction.label),
        primaryActionHint: primaryActionHint(recommended ?? dashboard.selectedAction),
        panels: [
          {
            title: "Safety",
            lines: [
              "Remove means Sane-managed only.",
              "Repo removal stays marked advanced.",
              "Remove all is last on purpose."
            ]
          }
        ],
        actionGroups: actionGroups(dashboard, [
          { title: "Personal", ids: ["uninstall_user_skills", "uninstall_global_agents", "uninstall_hooks", "uninstall_custom_agents"] },
          { title: "Project", ids: ["uninstall_repo_skills", "uninstall_repo_agents"] },
          { title: "Everything", ids: ["uninstall_all"] }
        ]),
        selectedTitle,
        selectedLines
      };
  }
}

type DashboardAction = ReturnType<typeof loadDashboardView>["actions"][number];

function recommendedAction(dashboard: ReturnType<typeof loadDashboardView>): DashboardAction | null {
  return dashboard.actions.find((action) => action.id === dashboard.recommendedActionId) ?? null;
}

function cleanActionLabel(label: string): string {
  return label.replace(/^\d+\.\s*/, "");
}

function primaryActionHint(action: DashboardAction): string {
  if (action.confirmation?.required) {
    return "Opens confirmation first.";
  }

  if (action.kind === "editor") {
    return "Opens an editor. Save when ready.";
  }

  if (isReadOnlyDashboardAction(action)) {
    return "Opens details. No files change.";
  }

  return action.repoMutation
    ? "Changes this project after preview or confirmation when needed."
    : "Changes your Codex setup after preview or confirmation when needed.";
}

function actionGroups(
  dashboard: ReturnType<typeof loadDashboardView>,
  specs: Array<{ title: string; ids: readonly UiCommandId[] }>
): ExperienceActionGroup[] {
  const seen = new Set<string>();
  const groups = specs.flatMap((spec) => {
    const items = spec.ids
      .map((id) => dashboard.actions.find((action) => action.id === id))
      .filter((action): action is DashboardAction => Boolean(action))
      .map((action) => {
        seen.add(action.id);
        return {
          id: action.id,
          label: cleanActionLabel(action.label),
          selected: action.id === dashboard.selectedAction.id,
          recommended: action.id === dashboard.recommendedActionId
        };
      });

    return items.length > 0 ? [{ title: spec.title, items }] : [];
  });

  const remaining = dashboard.actions
    .filter((action) => !seen.has(action.id))
    .map((action) => ({
      id: action.id,
      label: cleanActionLabel(action.label),
      selected: action.id === dashboard.selectedAction.id,
      recommended: action.id === dashboard.recommendedActionId
    }));

  return remaining.length > 0 ? [...groups, { title: "More", items: remaining }] : groups;
}

function sentenceCaseStatus(line: string): string {
  if (line.length === 0) {
    return line;
  }

  return `${line[0]!.toUpperCase()}${line.slice(1)}`;
}

function readableSelectedLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => (
      line.length > 0
      && !line.startsWith("Files changed:")
      && !line.startsWith("audit:")
      && !line.startsWith("apply readiness:")
      && !line.startsWith("Visibility only")
      && !line.startsWith("Use it when")
    ))
    .slice(0, 6);
}

function firstMatching(lines: string[], prefix: string): string | null {
  return lines.find((line) => line.startsWith(prefix)) ?? null;
}

function homeExperienceTitle(home: ReturnType<typeof loadHomeScreenFromStatusBundle>): string {
  switch (home.recommendedActionId) {
    case "install_runtime":
      return "Give this repo a clean starting point.";
    case "preview_codex_profile":
      return "Review what Sane wants to tune in Codex.";
    case "export_all":
      return "Add Sane's Codex add-ons when ready.";
    case "doctor":
      return "Your setup has a calm checkup screen.";
    default:
      return "Make Codex feel ready before work starts.";
  }
}

function isReadOnlyDashboardAction(action: DashboardAction): boolean {
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
  const filesTouched = action.filesTouched.length === 0 ? "none" : action.filesTouched.join(", ");
  const lines = [
    `What happens: ${impactLine(action)}`,
    `Files changed: ${filesTouched}`,
    "",
    ...action.help
  ];
  return details ? [...lines, "", ...details] : lines;
}

function impactLine(action: SelectedAction): string {
  if (action.kind === "editor") {
    return "changes Sane defaults only after you save.";
  }

  if (isReadOnlyAction(action)) {
    return action.id.startsWith("apply_") || action.id.startsWith("backup_") || action.id.startsWith("restore_")
      ? "changes user-level Codex files, not this repo."
      : "opens details without changing files.";
  }

  return action.repoMutation
    ? "changes this project. Preview or confirmation appears first."
    : "changes your Codex setup. Preview or confirmation appears first.";
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
    ? "Start here"
    : "Tune-up";
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
