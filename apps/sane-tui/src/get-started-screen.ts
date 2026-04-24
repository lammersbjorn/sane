import { detectPlatform, type CodexPaths, type ProjectPaths } from "@sane/platform";

import {
  inspectCodexProfileFamilySnapshot
} from "@sane/control-plane/codex-config.js";
import {
  inspectStatusBundle,
  inspectOnboardingSnapshot,
  inspectOnboardingSnapshotFromStatusBundle,
  type OnboardingAttentionItem,
  type OnboardingReasonId
} from "@sane/control-plane/inventory.js";
import { presentManagedInventoryItem } from "@sane/control-plane/status-presenter.js";
import { listSectionActions } from "@sane/sane-tui/command-registry.js";

export interface GetStartedStep {
  id:
    | "install_runtime"
    | "show_codex_config"
    | "preview_codex_profile"
    | "backup_codex_config"
    | "apply_codex_profile"
    | "export_all";
  title: string;
  impact: string;
  filesTouched: string[];
}

export interface GetStartedScreenModel {
  summary: "Get Started";
  recommendedActionId: GetStartedStep["id"] | null;
  recommendedNextStep: string;
  attentionItems: string[];
  statusLine: string;
  codexProfileAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["core"]["audit"];
  codexProfileApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["core"]["apply"];
  codexProfilePreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["core"]["preview"];
  steps: GetStartedStep[];
}

type CodexProfileFamily = ReturnType<typeof inspectCodexProfileFamilySnapshot>;

export function loadGetStartedScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): GetStartedScreenModel {
  return loadGetStartedScreenFromStatusBundle(
    paths,
    codexPaths,
    inspectStatusBundle(paths, codexPaths),
    inspectCodexProfileFamilySnapshot(codexPaths)
  );
}

export function loadGetStartedScreenFromStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  profiles: CodexProfileFamily = inspectCodexProfileFamilySnapshot(codexPaths)
): GetStartedScreenModel {
  const onboarding = inspectOnboardingSnapshotFromStatusBundle(paths, statusBundle);
  const codexProfile = profiles.core;
  const hostPlatform = detectPlatform();
  const steps = listSectionActions("get_started", hostPlatform).map((action) => ({
    id: action.id as GetStartedStep["id"],
    title: action.label,
    impact: onboardingStepImpact(action.id as GetStartedStep["id"]),
    filesTouched:
      action.id === "export_all"
        ? exportAllFilesTouched(statusBundle)
        : action.filesTouched
  }));

  return {
    summary: "Get Started",
    recommendedActionId: onboarding.recommendedActionId,
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
      return "Create Sane's local project files first.";
    case "show_codex_config":
      return "Inspect Codex config, then preview the core Codex profile.";
    case "export_all":
      return "Install Sane into Codex so Codex can use Sane's guidance.";
    default:
      return "Review configure or inspect sections and change only what you actually want.";
  }
}

function onboardingStepImpact(stepId: GetStartedStep["id"]): string {
  switch (stepId) {
    case "install_runtime":
      return "Create repo-local `.sane/` state and config files.";
    case "show_codex_config":
      return "Read current `~/.codex/config.toml` before changing anything.";
    case "preview_codex_profile":
      return "Preview Sane's recommended Codex defaults and hooks.";
    case "backup_codex_config":
      return "Save a rollback copy of current Codex settings into `.sane/backups`.";
    case "apply_codex_profile":
      return "Write Sane's core Codex defaults into `~/.codex/config.toml`.";
    case "export_all":
      return "Install Sane's user skills, AGENTS block, and custom agents into Codex.";
  }
}

function formatAttentionItem(item: OnboardingAttentionItem): string {
  return `${item.id}: ${item.status}`;
}

function exportAllFilesTouched(
  statusBundle: ReturnType<typeof inspectStatusBundle>
): string[] {
  const hooks = statusBundle.primary.hooks;
  return hooks?.status.asString() === "invalid" && hooks.repairHint?.includes("native Windows")
    ? [
        "~/.agents/skills/sane-router",
        "~/.agents/skills/continue",
        "~/.codex/AGENTS.md",
        "~/.codex/agents/"
      ]
    : [
        "~/.agents/skills/sane-router",
        "~/.agents/skills/continue",
        "~/.codex/AGENTS.md",
        "~/.codex/hooks.json",
        "~/.codex/agents/"
      ];
}

function hookStatusLabel(statusBundle: ReturnType<typeof inspectStatusBundle>): string {
  return presentManagedInventoryItem(statusBundle.primary.hooks).label;
}
