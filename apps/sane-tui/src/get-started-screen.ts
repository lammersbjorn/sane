import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import {
  inspectCodexProfileSnapshot
} from "@sane/control-plane/codex-config.js";
import {
  inspectOnboardingSnapshot,
  type OnboardingAttentionItem,
  type OnboardingReasonId
} from "@sane/control-plane/inventory.js";
import { listSectionActions } from "@/command-registry.js";

export interface GetStartedStep {
  id:
    | "install_runtime"
    | "show_codex_config"
    | "preview_codex_profile"
    | "backup_codex_config"
    | "apply_codex_profile"
    | "export_all";
  title: string;
  filesTouched: string[];
}

export interface GetStartedScreenModel {
  summary: "Get Started";
  recommendedActionId: GetStartedStep["id"] | null;
  recommendedNextStep: string;
  attentionItems: string[];
  statusLine: string;
  codexProfileAudit: ReturnType<typeof inspectCodexProfileSnapshot>["audit"];
  codexProfileApply: ReturnType<typeof inspectCodexProfileSnapshot>["apply"];
  codexProfilePreview: ReturnType<typeof inspectCodexProfileSnapshot>["preview"];
  steps: GetStartedStep[];
}

export function loadGetStartedScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): GetStartedScreenModel {
  const onboarding = inspectOnboardingSnapshot(paths, codexPaths);
  const codexProfile = inspectCodexProfileSnapshot(codexPaths);
  const steps = listSectionActions("get_started").map((action) => ({
    id: action.id as GetStartedStep["id"],
    title: action.label,
    filesTouched: action.filesTouched
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
      `hooks ${onboarding.primaryStatuses.hooks}`,
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

function formatAttentionItem(item: OnboardingAttentionItem): string {
  return `${item.id}: ${item.status}`;
}
