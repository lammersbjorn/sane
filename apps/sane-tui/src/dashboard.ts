import { presentManagedStatus, type ManagedStatusKind } from "@sane/control-plane/status-presenter.js";
import * as getStartedScreen from "@/get-started-screen.js";
import { currentAction, currentActions, currentSection, projectLabel, type TuiShell } from "@/shell.js";

export interface DashboardChip {
  id: string;
  label: string;
  value: string;
  tone: "ok" | "warn" | "muted";
}

export interface DashboardView {
  title: "Sane";
  subtitle: "Codex-native onboarding and setup";
  projectLabel: string;
  recommendedNextStep: string;
  recommendedActionId: ReturnType<typeof getStartedScreen.loadGetStartedScreen>["recommendedActionId"];
  attentionItems: string[];
  sections: TuiShell["sections"];
  activeSection: ReturnType<typeof currentSection>;
  actions: ReturnType<typeof currentActions>;
  selectedAction: ReturnType<typeof currentAction>;
  lastResult: TuiShell["lastResult"];
  chips: DashboardChip[];
}

export function loadDashboardView(
  shell: TuiShell,
  getStarted: ReturnType<typeof getStartedScreen.loadGetStartedScreen> = getStartedScreen.loadGetStartedScreen(
    shell.paths,
    shell.codexPaths
  )
): DashboardView {

  return {
    title: "Sane",
    subtitle: "Codex-native onboarding and setup",
    projectLabel: projectLabel(shell),
    recommendedNextStep: getStarted.recommendedNextStep,
    recommendedActionId: getStarted.recommendedActionId,
    attentionItems: getStarted.attentionItems,
    sections: shell.sections,
    activeSection: currentSection(shell),
    actions: currentActions(shell),
    selectedAction: currentAction(shell),
    lastResult: shell.lastResult,
    chips: buildStatusChips(shell.statusSnapshot)
  };
}

function buildStatusChips(statusSnapshot: TuiShell["statusSnapshot"]): DashboardChip[] {
  const { statusBundle, runtimeProgress } = statusSnapshot;
  const wanted = [
    "runtime",
    "codex-config",
    "user-skills",
    "hooks"
  ] as const;
  const chips: DashboardChip[] = [];

  for (const name of wanted) {
    const presentation = primaryStatusPresentation(statusBundle, name);

    chips.push({
      id: name,
      label: chipLabel(name),
      value: presentation.label,
      tone: presentation.tone
    });
  }

  const customAgents = presentManagedStatus(
    statusBundle.primary.status.customAgents as ManagedStatusKind
  );
  chips.push({
    id: "custom-agents",
    label: "Custom agents",
    value: customAgents.label,
    tone: customAgents.tone
  });

  const installBundleValue = statusBundle.primary.installBundle;

  chips.push({
    id: "install_bundle",
    label: "Install bundle",
    value: installBundleValue,
    tone: toneForValue(installBundleValue)
  });

  chips.push({
    id: "drift",
    label: "Drift",
    value: statusBundle.driftItems.length === 0 ? "none" : `${statusBundle.driftItems.length} issue(s)`,
    tone: statusBundle.driftItems.length === 0 ? "ok" : "warn"
  });

  if (runtimeProgress) {
    chips.push({
      id: "phase",
      label: "Phase",
      value: runtimeProgress.phase,
      tone: toneForValue(runtimeProgress.phase)
    });
    chips.push({
      id: "verification",
      label: "Verification",
      value: runtimeProgress.verificationStatus,
      tone: toneForValue(runtimeProgress.verificationStatus)
    });
  }

  return chips;
}

function primaryStatusPresentation(
  statusBundle: TuiShell["statusSnapshot"]["statusBundle"],
  name: "runtime" | "codex-config" | "user-skills" | "hooks"
): ReturnType<typeof presentManagedStatus> {
  switch (name) {
    case "runtime":
      return presentManagedStatus(statusBundle.primary.status.runtime as ManagedStatusKind);
    case "codex-config":
      return presentManagedStatus(statusBundle.primary.status.codexConfig as ManagedStatusKind);
    case "user-skills":
      return presentManagedStatus(statusBundle.primary.status.userSkills as ManagedStatusKind);
    case "hooks":
      return presentManagedStatus(statusBundle.primary.status.hooks as ManagedStatusKind);
  }
}

function chipLabel(name: string): string {
  switch (name) {
    case "runtime":
      return "Runtime";
    case "codex-config":
      return "Codex config";
    case "user-skills":
      return "User skills";
    case "hooks":
      return "Hooks";
    case "custom-agents":
      return "Custom agents";
    default:
      return name;
  }
}

function toneForValue(value: string): DashboardChip["tone"] {
  if (value === "installed" || value === "ok" || value === "none") {
    return "ok";
  }
  if (
    value === "missing" ||
    value === "invalid" ||
    value === "failed" ||
    value === "present without Sane block"
  ) {
    return "warn";
  }
  return "muted";
}
