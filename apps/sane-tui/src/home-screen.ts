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
import { listSectionActions, type TuiSectionId } from "@sane/sane-tui/command-registry.js";

export interface HomeStep {
  id:
    | "install_runtime"
    | "open_config_editor"
    | "preview_codex_profile"
    | "backup_codex_config"
    | "apply_codex_profile"
    | "export_all"
    | "doctor";
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
      `repo setup ${onboarding.primaryStatuses.runtime}`,
      `codex setup ${onboarding.primaryStatuses.codexConfig}`,
      `sane skills ${onboarding.primaryStatuses.userSkills}`,
      `codex hooks ${hookStatusLabel(statusBundle)}`,
      `sane add-ons ${onboarding.primaryStatuses.installBundle}`
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
      return "Get this repo ready for Sane first.";
    case "show_codex_config":
      return "Review Codex changes before you apply them.";
    case "export_all":
      return "Add Sane to Codex when the setup path looks right.";
    default:
      return "Setup looks complete. Start on Check, then tune behavior or add-ons only when needed.";
  }
}

function onboardingStepImpact(stepId: HomeStep["id"]): string {
  switch (stepId) {
    case "install_runtime":
      return "Create or repair the repo setup Sane needs.";
    case "open_config_editor":
      return "Choose model, guidance, and privacy defaults.";
    case "preview_codex_profile":
      return "Review Codex changes before writing anything.";
    case "backup_codex_config":
      return "Save a rollback point before changing Codex.";
    case "apply_codex_profile":
      return "Write the reviewed Codex changes.";
    case "export_all":
      return "Add the full personal Sane setup to Codex.";
    case "doctor":
      return "Run deeper checks when setup feels stale or broken.";
  }
}

export function homeRecommendedActionId(
  actionId: ReturnType<typeof inspectOnboardingSnapshotFromStatusBundle>["recommendedActionId"]
): HomeScreenModel["recommendedActionId"] {
  if (actionId === "show_codex_config") {
    return "preview_codex_profile";
  }

  return actionId ?? "doctor";
}

export function defaultLandingSectionId(
  actionId: ReturnType<typeof inspectOnboardingSnapshotFromStatusBundle>["recommendedActionId"]
): TuiSectionId {
  return actionId === null ? "status" : "home";
}

function formatAttentionItem(item: OnboardingAttentionItem): string {
  return `${attentionLabel(item.id)} ${item.status}`;
}

function attentionLabel(id: string): string {
  switch (id) {
    case "config":
      return "saved defaults";
    case "runtime":
      return "repo setup";
    case "codexConfig":
    case "codex-config":
      return "Codex setup";
    case "userSkills":
    case "user-skills":
      return "Sane skills";
    case "hooks":
      return "Codex hooks";
    case "customAgents":
    case "custom-agents":
      return "named agents";
    case "installBundle":
    case "install-bundle":
      return "Sane add-ons";
    default:
      return id;
  }
}

function hookStatusLabel(statusBundle: ReturnType<typeof inspectStatusBundle>): string {
  return presentManagedInventoryItem(statusBundle.primary.hooks).label;
}
