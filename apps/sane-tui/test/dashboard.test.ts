import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import * as controlPlane from "@sane/control-plane";
import * as inventory from "@sane/control-plane/inventory.js";

import { installRuntime } from "@sane/control-plane";
import { loadDashboardView } from "@/dashboard.js";
import * as getStarted from "@/get-started-screen.js";
import { createTuiShell } from "@/shell.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-dashboard-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("dashboard view", () => {
  it("aggregates shell state into welcome-shell data", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const shell = createTuiShell(createProjectPaths(projectRoot), createCodexPaths(homeDir));

    const view = loadDashboardView(shell);

    expect(view.title).toBe("Sane");
    expect(view.projectLabel).toBe(projectRoot.split("/").at(-1));
    expect(view.recommendedNextStep).toBe("Create Sane's local project files first.");
    expect(view.activeSection.docLabel).toBe("Get Started");
    expect(view.actions.map((action) => action.id)).toEqual([
      "install_runtime",
      "show_codex_config",
      "preview_codex_profile",
      "backup_codex_config",
      "apply_codex_profile",
      "export_all"
    ]);
    expect(view.selectedAction.id).toBe("install_runtime");
    expect(view.chips.some((chip) => chip.id === "runtime")).toBe(true);
    expect(view.chips.find((chip) => chip.id === "install_bundle")).toEqual({
      id: "install_bundle",
      label: "Install bundle",
      value: "missing",
      tone: "warn"
    });
    expect(view.chips.find((chip) => chip.id === "drift")).toEqual({
      id: "drift",
      label: "Drift",
      value: "1 issue(s)",
      tone: "warn"
    });
  });

  it("names the concrete install bundle in the install section summary", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const shell = createTuiShell(createProjectPaths(projectRoot), createCodexPaths(homeDir));

    const view = loadDashboardView(shell);
    const installSection = view.sections.find((section) => section.id === "install");

    expect(installSection?.description.join("\n")).toContain("Current install bundle:");
    expect(installSection?.description.join("\n")).toContain("user skill");
    expect(installSection?.description.join("\n")).toContain("global AGENTS.md block");
    expect(installSection?.description.join("\n")).toContain("hooks");
    expect(installSection?.description.join("\n")).toContain("sane-agent");
    expect(installSection?.description.join("\n")).toContain("sane-reviewer");
    expect(installSection?.description.join("\n")).toContain("sane-explorer");
  });

  it("surfaces phase and verification chips from control-plane runtime progress", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    const shell = createTuiShell(paths, codexPaths);
    const view = loadDashboardView(shell);

    expect(view.chips.find((chip) => chip.id === "phase")).toEqual({
      id: "phase",
      label: "Phase",
      value: "setup",
      tone: "muted"
    });
    expect(view.chips.find((chip) => chip.id === "verification")).toEqual({
      id: "verification",
      label: "Verification",
      value: "pending",
      tone: "muted"
    });
  });

  it("derives runtime progress chips from runtime summary details", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths);

    const summarySpy = vi
      .spyOn(controlPlane, "showRuntimeSummary")
      .mockReturnValue({
        details: ["phase: setup", "verification: failed (waiting for input)"]
      } as ReturnType<typeof controlPlane.showRuntimeSummary>);

    const view = loadDashboardView(shell);

    expect(summarySpy).toHaveBeenCalledWith(paths);
    expect(view.chips.find((chip) => chip.id === "phase")).toEqual({
      id: "phase",
      label: "Phase",
      value: "setup",
      tone: "muted"
    });
    expect(view.chips.find((chip) => chip.id === "verification")).toEqual({
      id: "verification",
      label: "Verification",
      value: "failed",
      tone: "warn"
    });
  });

  it("prefers onboarding snapshot status line over status bundle primary shape for core chips", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const shell = createTuiShell(createProjectPaths(projectRoot), createCodexPaths(homeDir));

    vi.spyOn(getStarted, "loadGetStartedScreen").mockReturnValue({
      summary: "Get Started",
      recommendedActionId: "install_runtime",
      recommendedNextStep: "Create Sane's local project files first.",
      attentionItems: [],
      statusLine:
        "runtime missing | codex-config missing | user-skills missing | hooks missing | install bundle missing",
      steps: []
    });
    vi.spyOn(inventory, "inspectStatusBundle").mockReturnValue({
      inventory: [
        {
          name: "custom-agents",
          status: { displayString: () => "installed" }
        }
      ],
      localRuntime: [],
      codexNative: [],
      driftItems: [],
      counts: {
        installed: 0,
        configured: 0,
        disabled: 0,
        missing: 0,
        invalid: 0,
        present_without_sane_block: 0,
        removed: 0
      },
      primary: {
        runtime: { status: { displayString: () => "installed" } },
        codexConfig: { status: { displayString: () => "installed" } },
        userSkills: { status: { displayString: () => "installed" } },
        hooks: { status: { displayString: () => "installed" } },
        customAgents: { status: { displayString: () => "installed" } },
        installBundle: "installed"
      }
    } as unknown as ReturnType<typeof inventory.inspectStatusBundle>);

    const view = loadDashboardView(shell);

    expect(view.chips.find((chip) => chip.id === "runtime")?.value).toBe("missing");
    expect(view.chips.find((chip) => chip.id === "codex-config")?.value).toBe("missing");
    expect(view.chips.find((chip) => chip.id === "user-skills")?.value).toBe("missing");
    expect(view.chips.find((chip) => chip.id === "hooks")?.value).toBe("missing");
    expect(view.chips.find((chip) => chip.id === "install_bundle")?.value).toBe("missing");
  });
});
