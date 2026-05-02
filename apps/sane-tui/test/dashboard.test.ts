import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as inventory from "@sane/control-plane/inventory.js";

import { installRuntime } from "@sane/control-plane";
import { exportAll } from "@sane/control-plane";
import { loadDashboardView } from "@sane/sane-tui/dashboard.js";
import * as home from "@sane/sane-tui/home-screen.js";
import { createTuiShell } from "@sane/sane-tui/shell.js";

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
    expect(view.recommendedNextStep).toBe("Set up the local Sane files first.");
    expect(view.activeSection.docLabel).toBe("Setup");
    expect(view.actions.map((action) => action.id)).toEqual([
      "install_runtime",
      "open_config_editor",
      "preview_codex_profile",
      "backup_codex_config",
      "apply_codex_profile",
      "export_all",
      "doctor"
    ]);
    expect(view.selectedAction.id).toBe("install_runtime");
    expect(view.chips.some((chip) => chip.id === "runtime")).toBe(true);
    expect(view.chips.find((chip) => chip.id === "install_bundle")).toEqual({
      id: "install_bundle",
      label: "Sane add-ons",
      value: "missing",
      tone: "warn"
    });
    expect(view.chips.find((chip) => chip.id === "drift")).toEqual({
      id: "drift",
      label: "Out-of-sync files",
      value: "1 issue(s)",
      tone: "warn"
    });
  });

  it("explains the Add to Codex section by user outcome", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const shell = createTuiShell(createProjectPaths(projectRoot), createCodexPaths(homeDir));

    const view = loadDashboardView(shell);
    const installSection = view.sections.find((section) => section.id === "add_to_codex");

    expect(installSection?.description.join("\n")).toContain("Use this when you want Codex to learn Sane workflow.");
    expect(installSection?.description.join("\n")).toContain("Personal add-ons update your Codex setup.");
    expect(installSection?.description.join("\n")).toContain("Repo writes stay explicit and optional.");
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
      label: "Current step",
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

  it("hides unknown runtime progress chips until current-run state is meaningful", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const shell = createTuiShell(createProjectPaths(projectRoot), createCodexPaths(homeDir));

    const view = loadDashboardView(shell);

    expect(view.chips.find((chip) => chip.id === "phase")).toBeUndefined();
    expect(view.chips.find((chip) => chip.id === "verification")).toBeUndefined();
  });

  it("does not derive runtime chips from runtime summary detail text", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths);

    vi.spyOn(home, "loadHomeScreen").mockReturnValue({
      summary: "Home",
      recommendedActionId: "install_runtime",
      recommendedNextStep: "Set up the local Sane files first.",
      attentionItems: [],
      statusLine:
        "repo setup missing | codex setup missing | Sane skills missing | codex hooks missing | sane add-ons missing",
      codexProfileAudit: {
        status: "missing",
        recommendedChangeCount: 3,
        changes: [],
        details: []
      },
      codexProfileApply: {
        status: "ready",
        recommendedChangeCount: 3,
        appliedKeys: ["model", "model_reasoning_effort", "features.codex_hooks"],
        details: []
      },
      codexProfilePreview: new OperationResult({
        kind: OperationKind.PreviewCodexProfile,
        summary: "codex-profile preview: 3 recommended change(s)",
        details: [],
        pathsTouched: [],
        inventory: []
      }),
      steps: []
    });
    const statusBundleSpy = vi.spyOn(inventory, "inspectStatusBundle");

    const view = loadDashboardView(shell);

    expect(statusBundleSpy).not.toHaveBeenCalled();
    expect(view.chips.find((chip) => chip.id === "phase")).toBeUndefined();
    expect(view.chips.find((chip) => chip.id === "verification")).toBeUndefined();
  });

  it("uses typed status bundle primary shape for core chips instead of onboarding status line text", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const shell = createTuiShell(createProjectPaths(projectRoot), createCodexPaths(homeDir));

    vi.spyOn(home, "loadHomeScreen").mockReturnValue({
      summary: "Home",
      recommendedActionId: "install_runtime",
      recommendedNextStep: "Set up the local Sane files first.",
      attentionItems: [],
      statusLine:
        "repo setup missing | codex setup missing | Sane skills missing | codex hooks missing | sane add-ons missing",
      codexProfileAudit: {
        status: "missing",
        recommendedChangeCount: 3,
        changes: [],
        details: []
      },
      codexProfileApply: {
        status: "ready",
        recommendedChangeCount: 3,
        appliedKeys: ["model", "model_reasoning_effort", "features.codex_hooks"],
        details: []
      },
      codexProfilePreview: new OperationResult({
        kind: OperationKind.PreviewCodexProfile,
        summary: "codex-profile preview: 3 recommended change(s)",
        details: [],
        pathsTouched: [],
        inventory: []
      }),
      steps: []
    });
    const bundle = shell.statusSnapshot.statusBundle;
    shell.statusSnapshot = {
      ...shell.statusSnapshot,
      statusBundle: {
        ...shell.statusSnapshot.statusBundle,
        driftItems: [],
        primary: {
          ...bundle.primary,
          hooks: bundle.primary.hooks
            ? { ...bundle.primary.hooks, status: InventoryStatus.Installed }
            : {
                name: "hooks",
                path: join(homeDir, ".codex", "hooks.json"),
                scope: InventoryScope.CodexNative,
                status: InventoryStatus.Installed,
                repairHint: null
              },
          installBundle: "installed",
          status: {
            ...bundle.primary.status,
            runtime: "installed",
            codexConfig: "installed",
            userSkills: "installed",
            hooks: "installed",
            customAgents: "installed",
            installBundle: "installed"
          }
        },
        runtimeState: {
          ...shell.statusSnapshot.statusBundle.runtimeState,
          current: {
            version: 2,
            objective: "initialize sane runtime",
            phase: "setup",
            activeTasks: ["install sane runtime"],
            blockingQuestions: [],
            verification: {
              status: "pending",
              summary: "runtime scaffolding created"
            },
            lastCompactionTsUnix: null,
            extra: {}
          }
        }
      }
    };

    const view = loadDashboardView(shell);

    expect(view.chips.find((chip) => chip.id === "runtime")?.value).toBe("installed");
    expect(view.chips.find((chip) => chip.id === "codex-config")?.value).toBe("installed");
    expect(view.chips.find((chip) => chip.id === "user-skills")?.value).toBe("installed");
    expect(view.chips.find((chip) => chip.id === "hooks")?.value).toBe("installed");
    expect(view.chips.find((chip) => chip.id === "install_bundle")?.value).toBe("installed");
    expect(view.chips.find((chip) => chip.id === "phase")?.value).toBe("setup");
    expect(view.chips.find((chip) => chip.id === "verification")?.value).toBe("pending");
  });

  it("shows unsupported hooks chip on native Windows once the rest of the bundle is installed", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    exportAll(paths, codexPaths, "windows");
    const shell = createTuiShell(paths, codexPaths);

    shell.statusSnapshot = {
      ...shell.statusSnapshot,
      statusBundle: inventory.inspectStatusBundle(paths, codexPaths, "windows")
    };

    const view = loadDashboardView(shell);

    expect(view.chips.find((chip) => chip.id === "hooks")).toEqual({
      id: "hooks",
      label: "Hooks",
      value: "unsupported (use WSL)",
      tone: "muted"
    });
  });
});
