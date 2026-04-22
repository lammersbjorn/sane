import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import { inspectOnboardingSnapshot } from "@sane/control-plane/inventory.js";
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
  steps: GetStartedStep[];
}

export function loadGetStartedScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): GetStartedScreenModel {
  const onboarding = inspectOnboardingSnapshot(paths, codexPaths);
  const steps = listSectionActions("get_started").map((action) => ({
    id: action.id as GetStartedStep["id"],
    title: action.label,
    filesTouched: action.filesTouched
  }));

  return {
    summary: "Get Started",
    recommendedActionId: onboarding.recommendedActionId,
    recommendedNextStep: onboarding.recommendedNextStep,
    attentionItems: onboarding.attentionItems,
    statusLine: onboarding.statusLine,
    steps
  };
}
