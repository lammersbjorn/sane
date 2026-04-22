import { showRuntimeSummary } from "@sane/control-plane";
import { inspectStatusBundle } from "@sane/control-plane/inventory.js";
import { loadGetStartedScreen } from "@/get-started-screen.js";
import { currentAction, currentActions, currentSection, projectLabel, recommendedNextStep, type TuiShell } from "@/shell.js";

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
  recommendedActionId: ReturnType<typeof loadGetStartedScreen>["recommendedActionId"];
  attentionItems: string[];
  sections: TuiShell["sections"];
  activeSection: ReturnType<typeof currentSection>;
  actions: ReturnType<typeof currentActions>;
  selectedAction: ReturnType<typeof currentAction>;
  lastResult: TuiShell["lastResult"];
  chips: DashboardChip[];
}

export function loadDashboardView(shell: TuiShell): DashboardView {
  const getStarted = loadGetStartedScreen(shell.paths, shell.codexPaths);
  const statusBundle = inspectStatusBundle(shell.paths, shell.codexPaths);

  return {
    title: "Sane",
    subtitle: "Codex-native onboarding and setup",
    projectLabel: projectLabel(shell),
    recommendedNextStep: recommendedNextStep(shell),
    recommendedActionId: getStarted.recommendedActionId,
    attentionItems: getStarted.attentionItems,
    sections: shell.sections,
    activeSection: currentSection(shell),
    actions: currentActions(shell),
    selectedAction: currentAction(shell),
    lastResult: shell.lastResult,
    chips: buildStatusChips(shell, statusBundle)
  };
}

function buildStatusChips(shell: TuiShell, statusBundle: ReturnType<typeof inspectStatusBundle>): DashboardChip[] {
  const wanted = [
    ["runtime", statusBundle.primary.runtime],
    ["codex-config", statusBundle.primary.codexConfig],
    ["user-skills", statusBundle.primary.userSkills],
    ["hooks", statusBundle.primary.hooks],
    ["custom-agents", statusBundle.primary.customAgents]
  ] as const;
  const chips: DashboardChip[] = [];

  for (const [name, item] of wanted) {
    if (!item) {
      continue;
    }

    const value = item.status.displayString();
    chips.push({
      id: name,
      label: chipLabel(name),
      value,
      tone: toneForValue(value)
    });
  }

  chips.push({
    id: "install_bundle",
    label: "Install bundle",
    value: statusBundle.primary.installBundle,
    tone: toneForValue(statusBundle.primary.installBundle)
  });

  chips.push({
    id: "drift",
    label: "Drift",
    value: statusBundle.driftItems.length === 0 ? "none" : `${statusBundle.driftItems.length} issue(s)`,
    tone: statusBundle.driftItems.length === 0 ? "ok" : "warn"
  });

  const runtimeProgress = runtimeProgressFromSummary(shell.paths);
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

function runtimeProgressFromSummary(
  paths: TuiShell["paths"]
): { phase: string; verificationStatus: string } | null {
  const summary = showRuntimeSummary(paths);
  let phase: string | null = null;
  let verificationStatus: string | null = null;

  for (const detail of summary.details) {
    if (detail.startsWith("phase: ")) {
      phase = detail.slice("phase: ".length).trim();
      continue;
    }
    if (detail.startsWith("verification: ")) {
      const raw = detail.slice("verification: ".length).trim();
      const withOptionalSummary = raw.split(" (", 1)[0];
      verificationStatus = withOptionalSummary;
    }
  }

  if (!phase || !verificationStatus) {
    return null;
  }

  return { phase, verificationStatus };
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
