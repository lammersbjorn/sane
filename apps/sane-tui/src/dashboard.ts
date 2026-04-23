import { presentManagedStatus, type ManagedStatusKind } from "@sane/control-plane/status-presenter.js";
import * as getStartedScreen from "@sane/sane-tui/get-started-screen.js";
import { currentAction, currentActions, currentSection, projectLabel, type TuiShell } from "@sane/sane-tui/shell.js";

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

const PRIMARY_STATUS_CHIP_SPECS = [
  {
    id: "runtime",
    label: "Runtime",
    pick: (status: TuiShell["statusSnapshot"]["statusBundle"]["primary"]["status"]) => status.runtime
  },
  {
    id: "codex-config",
    label: "Codex config",
    pick: (status: TuiShell["statusSnapshot"]["statusBundle"]["primary"]["status"]) => status.codexConfig
  },
  {
    id: "user-skills",
    label: "User skills",
    pick: (status: TuiShell["statusSnapshot"]["statusBundle"]["primary"]["status"]) => status.userSkills
  },
  {
    id: "hooks",
    label: "Hooks",
    pick: (status: TuiShell["statusSnapshot"]["statusBundle"]["primary"]["status"]) => status.hooks
  }
] as const;

const VALUE_TONE_OVERRIDES: Partial<Record<string, DashboardChip["tone"]>> = {
  installed: "ok",
  ok: "ok",
  none: "ok",
  missing: "warn",
  invalid: "warn",
  failed: "warn",
  "present without Sane block": "warn"
};

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
  const { statusBundle } = statusSnapshot;
  const runtimeState = statusBundle.runtimeState;
  const chips: DashboardChip[] = PRIMARY_STATUS_CHIP_SPECS.map((chip) => {
    const presentation = presentManagedStatus(
      chip.pick(statusBundle.primary.status) as ManagedStatusKind
    );
    return {
      id: chip.id,
      label: chip.label,
      value: presentation.label,
      tone: presentation.tone
    };
  });

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

  if (runtimeState.current) {
    if (runtimeState.current.phase !== "unknown") {
      chips.push({
        id: "phase",
        label: "Phase",
        value: runtimeState.current.phase,
        tone: toneForValue(runtimeState.current.phase)
      });
    }

    if (runtimeState.current.verification.status !== "unknown") {
      chips.push({
        id: "verification",
        label: "Verification",
        value: runtimeState.current.verification.status,
        tone: toneForValue(runtimeState.current.verification.status)
      });
    }
  }

  return chips;
}

function toneForValue(value: string): DashboardChip["tone"] {
  return VALUE_TONE_OVERRIDES[value] ?? "muted";
}
