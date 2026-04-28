import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";

import {
  inspectCodexProfileFamilySnapshot
} from "@sane/control-plane/codex-config.js";
import {
  inspectStatusBundle,
  inspectOnboardingSnapshotFromStatusBundle,
  type OnboardingAttentionItem,
  type OnboardingReasonId
} from "@sane/control-plane/inventory.js";
import { presentManagedInventoryItem } from "@sane/control-plane/status-presenter.js";
import { listSectionActions } from "@sane/sane-tui/command-registry.js";

export interface HomeStep {
  id:
    | "install_runtime"
    | "open_config_editor"
    | "preview_codex_profile"
    | "backup_codex_config"
    | "apply_codex_profile"
    | "export_all";
  title: string;
  impact: string;
  filesTouched: string[];
}

export interface HomeScreenModel {
  summary: "Home";
  recommendedActionId: HomeStep["id"] | null;
  recommendedNextStep: string;
  attentionItems: string[];
  statusLine: string;
  codexProfileAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["core"]["audit"];
  codexProfileApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["core"]["apply"];
  codexProfilePreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["core"]["preview"];
  steps: HomeStep[];
}

type CodexProfileFamily = ReturnType<typeof inspectCodexProfileFamilySnapshot>;

export function loadHomeScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): HomeScreenModel {
  return loadHomeScreenFromStatusBundle(
    paths,
    codexPaths,
    inspectStatusBundle(paths, codexPaths, hostPlatform),
    inspectCodexProfileFamilySnapshot(codexPaths),
    hostPlatform
  );
}

export function loadHomeScreenFromStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  profiles: CodexProfileFamily = inspectCodexProfileFamilySnapshot(codexPaths),
  hostPlatform: HostPlatform = detectPlatform()
): HomeScreenModel {
  const onboarding = inspectOnboardingSnapshotFromStatusBundle(paths, statusBundle);
  const codexProfile = profiles.core;
  const steps = listSectionActions("home", hostPlatform).map((action) => ({
    id: action.id as HomeStep["id"],
    title: action.label,
    impact: onboardingStepImpact(action.id as HomeStep["id"]),
    filesTouched: action.filesTouched
  }));

  return {
    summary: "Home",
    recommendedActionId: homeRecommendedActionId(onboarding.recommendedActionId),
    recommendedNextStep: recommendedNextStep(onboarding.recommendedReason),
    attentionItems: onboarding.attentionItems.map(formatAttentionItem),
    statusLine: [
      `runtime ${onboarding.primaryStatuses.runtime}`,
      `codex-config ${onboarding.primaryStatuses.codexConfig}`,
      `user-skills ${onboarding.primaryStatuses.userSkills}`,
      `hooks ${hookStatusLabel(statusBundle)}`,
      `install bundle ${onboarding.primaryStatuses.installBundle}`
    ].join(" | "),
    codexProfileAudit: codexProfile.audit,
    codexProfileApply: codexProfile.apply,
    codexProfilePreview: codexProfile.preview,
    steps
  };
}

function recommendedNextStep(reason: OnboardingReasonId): string {
  switch (reason) {
    case "install_runtime":
      return "Set up Sane's local files first.";
    case "show_codex_config":
      return "Review the Codex changes before applying them.";
    case "export_all":
      return "Add or refresh Sane in Codex.";
    default:
      return "Setup is complete. Choose a tune-up action or open Status.";
  }
}

function onboardingStepImpact(stepId: HomeStep["id"]): string {
  switch (stepId) {
    case "install_runtime":
      return "Create or repair repo-local `.sane/` files.";
    case "open_config_editor":
      return "Choose model, reasoning, packs, and privacy defaults.";
    case "preview_codex_profile":
      return "See what Sane would change in Codex settings.";
    case "backup_codex_config":
      return "Save a rollback copy before writing settings.";
    case "apply_codex_profile":
      return "Write Sane's recommended Codex defaults.";
    case "export_all":
      return "Add Sane skills, guidance, hooks, and agents to Codex.";
  }
}

function homeRecommendedActionId(
  actionId: ReturnType<typeof inspectOnboardingSnapshotFromStatusBundle>["recommendedActionId"]
): HomeScreenModel["recommendedActionId"] {
  if (actionId === "show_codex_config") {
    return "preview_codex_profile";
  }

  return actionId;
}

function formatAttentionItem(item: OnboardingAttentionItem): string {
  return `${item.id}: ${item.status}`;
}

function hookStatusLabel(statusBundle: ReturnType<typeof inspectStatusBundle>): string {
  return presentManagedInventoryItem(statusBundle.primary.hooks).label;
}
