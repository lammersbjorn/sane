import { showRuntimeProgress } from "@sane/control-plane";
import { inspectStatusBundle } from "@sane/control-plane/inventory.js";
import * as getStartedScreen from "@/get-started-screen.js";
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
  recommendedActionId: ReturnType<typeof getStartedScreen.loadGetStartedScreen>["recommendedActionId"];
  attentionItems: string[];
  sections: TuiShell["sections"];
  activeSection: ReturnType<typeof currentSection>;
  actions: ReturnType<typeof currentActions>;
  selectedAction: ReturnType<typeof currentAction>;
  lastResult: TuiShell["lastResult"];
  chips: DashboardChip[];
}

export function loadDashboardView(shell: TuiShell): DashboardView {
  const getStarted = getStartedScreen.loadGetStartedScreen(shell.paths, shell.codexPaths);
  const statusBundle = inspectStatusBundle(shell.paths, shell.codexPaths);
  const onboardingStatuses = parseOnboardingStatusLine(getStarted.statusLine);

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
    chips: buildStatusChips(shell, statusBundle, onboardingStatuses)
  };
}

function buildStatusChips(
  shell: TuiShell,
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  onboardingStatuses: Partial<Record<"runtime" | "codex-config" | "user-skills" | "hooks" | "install_bundle", string>>
): DashboardChip[] {
  const wanted = [
    ["runtime", "runtime"],
    ["codex-config", "codex-config"],
    ["user-skills", "user-skills"],
    ["hooks", "hooks"]
  ] as const;
  const chips: DashboardChip[] = [];

  for (const [name, inventoryName] of wanted) {
    const value = onboardingStatuses[name] ?? inventoryStatusValue(statusBundle.inventory, inventoryName);
    if (!value) {
      continue;
    }

    chips.push({
      id: name,
      label: chipLabel(name),
      value,
      tone: toneForValue(value)
    });
  }

  const customAgentsValue = inventoryStatusValue(statusBundle.inventory, "custom-agents");
  if (customAgentsValue) {
    chips.push({
      id: "custom-agents",
      label: "Custom agents",
      value: customAgentsValue,
      tone: toneForValue(customAgentsValue)
    });
  }

  const installBundleValue = onboardingStatuses.install_bundle ?? bundleStatusFromInventory(statusBundle.inventory);

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

  const runtimeProgress = runtimeProgressFromSnapshot(shell.paths);
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

function parseOnboardingStatusLine(
  statusLine: string
): Partial<Record<"runtime" | "codex-config" | "user-skills" | "hooks" | "install_bundle", string>> {
  const parsed: Partial<Record<"runtime" | "codex-config" | "user-skills" | "hooks" | "install_bundle", string>> = {};

  for (const segment of statusLine.split("|")) {
    const part = segment.trim();
    if (part.startsWith("runtime ")) {
      parsed.runtime = part.slice("runtime ".length).trim();
      continue;
    }
    if (part.startsWith("codex-config ")) {
      parsed["codex-config"] = part.slice("codex-config ".length).trim();
      continue;
    }
    if (part.startsWith("user-skills ")) {
      parsed["user-skills"] = part.slice("user-skills ".length).trim();
      continue;
    }
    if (part.startsWith("hooks ")) {
      parsed.hooks = part.slice("hooks ".length).trim();
      continue;
    }
    if (part.startsWith("install bundle ")) {
      parsed.install_bundle = part.slice("install bundle ".length).trim();
    }
  }

  return parsed;
}

function inventoryStatusValue(
  inventory: ReturnType<typeof inspectStatusBundle>["inventory"],
  name: string
): string | null {
  return inventory.find((item) => item.name === name)?.status.displayString() ?? null;
}

function bundleStatusFromInventory(
  inventory: ReturnType<typeof inspectStatusBundle>["inventory"]
): "installed" | "missing" {
  const names = ["user-skills", "global-agents", "hooks", "custom-agents"] as const;
  return names.every((name) => inventoryStatusValue(inventory, name) === "installed")
    ? "installed"
    : "missing";
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

function runtimeProgressFromSnapshot(
  paths: TuiShell["paths"]
): { phase: string; verificationStatus: string } | null {
  return showRuntimeProgress(paths);
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
