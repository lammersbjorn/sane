import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { appendJsonlRecord, createDecisionRecord, stringifyDecisionRecord } from "@sane/state";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { loadAppView } from "@/app-view.js";
import { createTuiShell, moveSelection, runSelectedAction, selectSection } from "@/shell.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-app-view-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("app view", () => {
  it("combines dashboard, help, latest status, and footer", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const view = loadAppView(shell);

    expect(view.activeSection.id).toBe("get_started");
    expect(view.tabs.title).toBe("Sections");
    expect(view.tabs.selected).toBe("get_started");
    expect(view.tabs.items[0]).toEqual({ id: "get_started", label: "Start here" });
    expect(view.sectionOverviewLines[0]).toContain("Recommended now:");
    expect(view.selectedHelpLines[0]).toContain("Selected action:");
    expect(view.latestStatusTitle).toBe("Latest Status");
    expect(view.footerTitle).toBe("Now");
    expect(view.footer.navHint).toContain("left/right");
    expect(view.footer.status.runtime).toBe("missing");
    expect(view.footerLines[0]).toContain("left/right change section");
    expect(view.footerLines[0]).toContain("runtime");
    expect(view.footerLines[0]).toContain("drift");
  });

  it("surfaces attention items and the next step in Start Here guidance", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const view = loadAppView(shell);

    expect(view.recommendedNextStep).toBe("Create Sane's local project files first.");
    expect(view.sectionOverviewLines.join("\n")).toContain("Status now:");
    expect(view.sectionOverviewLines.join("\n")).toContain("runtime: missing");
    expect(view.sectionOverviewLines.join("\n")).toContain("config: missing");
    expect(view.sectionOverviewLines.join("\n")).toContain("codex-config: missing");
    expect(view.sectionOverviewLines.join("\n")).toContain("user-skills: missing");
  });

  it("expands inspect into read-only status, doctor, config, and drift guidance", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");

    const view = loadAppView(shell);

    expect(view.sectionOverviewLines.join("\n")).toContain("status counts");
    expect(view.sectionOverviewLines.join("\n")).toContain("primary surfaces");
    expect(view.sectionOverviewLines.join("\n")).toContain("doctor result");
    expect(view.sectionOverviewLines.join("\n")).toContain("runtime summary");
    expect(view.sectionOverviewLines.join("\n")).toContain("runtime history");
    expect(view.sectionOverviewLines.join("\n")).toContain("latest policy snapshot");
    expect(view.sectionOverviewLines.join("\n")).toContain("local config view");
    expect(view.sectionOverviewLines.join("\n")).toContain("Codex config view");
    expect(view.sectionOverviewLines.join("\n")).toContain("integrations audit");
    expect(view.sectionOverviewLines.join("\n")).toContain("install bundle");
    expect(view.sectionOverviewLines.join("\n")).toContain("export drift view");
  });

  it("uses inspect overview selector instead of unpacking inspect status bundle in app-view", async () => {
    vi.resetModules();
    vi.doMock("@/inspect-screen.js", () => {
      const inspectModel: Record<string, unknown> = {
        summary: "Inspect",
        actions: [],
        overviewLines: ["from-model-overview-lines"]
      };
      Object.defineProperty(inspectModel, "statusBundle", {
        get() {
          throw new Error("app-view read inspect.statusBundle directly");
        }
      });

      return {
        loadInspectScreen: vi.fn(() => inspectModel),
        inspectOverviewLines: vi.fn(() => ["from-inspect-overview-selector"])
      };
    });

    const { loadAppView: loadAppViewWithMock } = await import("@/app-view.js");
    const inspectScreen = await import("@/inspect-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");

    const view = loadAppViewWithMock(shell);

    expect(view.sectionOverviewLines).toEqual(["from-inspect-overview-selector"]);
    expect(vi.mocked(inspectScreen.inspectOverviewLines)).toHaveBeenCalledTimes(1);
    vi.doUnmock("@/inspect-screen.js");
    vi.resetModules();
  });

  it("surfaces invalid install drift in Inspect guidance", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, "{", "utf8");

    const shell = createTuiShell(paths, codexPaths);
    selectSection(shell, "inspect");
    for (let index = 0; index < 5; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("preview_integrations_profile");
    expect(view.sectionOverviewLines.join("\n")).toContain("hooks: invalid");
  });

  it("surfaces integrations preview payload in Inspect guidance", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");
    for (let index = 0; index < 5; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("preview_integrations_profile");
    expect(view.selectedHelpLines.join("\n")).toContain("audit: missing");
    expect(view.selectedHelpLines.join("\n")).toContain("context7: missing -> recommended");
    expect(view.selectedHelpLines.join("\n")).toContain("playwright: missing -> recommended");
    expect(view.selectedHelpLines.join("\n")).toContain("grep.app: missing -> recommended");
  });

  it("surfaces runtime-summary payload in Inspect guidance", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");
    for (let index = 0; index < 2; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("show_runtime_summary");
    expect(view.selectedHelpLines.join("\n")).toContain("current-run:");
    expect(view.selectedHelpLines.join("\n")).toContain("summary:");
    expect(view.selectedHelpLines.join("\n")).toContain("brief:");
  });

  it("surfaces the latest typed policy snapshot in Inspect guidance", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    appendJsonlRecord(
      paths.decisionsPath,
      createDecisionRecord(
        "policy preview: rendered adaptive obligation scenarios",
        "simple-question: direct_answer | coordinator=gpt-5.4/high",
        [],
        {
          kind: "policy_preview",
          scenarios: [{ id: "simple-question" }, { id: "multi-file-feature" }]
        }
      ),
      stringifyDecisionRecord
    );

    const shell = createTuiShell(paths, codexPaths);
    selectSection(shell, "inspect");

    const view = loadAppView(shell);

    expect(view.sectionOverviewLines.join("\n")).toContain(
      "latest policy snapshot: present (2 scenarios: simple-question, multi-file-feature)"
    );
  });

  it("surfaces policy preview payload for the inspect policy action", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");
    for (let index = 0; index < 6; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("preview_policy");
    expect(view.selectedHelpLines.join("\n")).toContain("latest snapshot: missing");
    expect(view.selectedHelpLines.join("\n")).toContain("simple-question:");
    expect(view.selectedHelpLines.join("\n")).toContain("direct_answer");
    expect(view.selectedHelpLines.join("\n")).toContain("explorer=");
  });

  it("surfaces integrations preview payload for the install apply action too", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "install");
    for (let index = 0; index < 4; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("apply_integrations_profile");
    expect(view.selectedHelpLines.join("\n")).toContain("audit: missing");
    expect(view.selectedHelpLines.join("\n")).toContain("context7: missing -> recommended");
    expect(view.selectedHelpLines.join("\n")).toContain("playwright: missing -> recommended");
    expect(view.selectedHelpLines.join("\n")).toContain("grep.app: missing -> recommended");
  });

  it("surfaces live install-state guidance in the install section overview", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "install");

    const view = loadAppView(shell);

    expect(view.sectionOverviewLines.join("\n")).toContain("Current install bundle:");
    expect(view.sectionOverviewLines.join("\n")).toContain("install bundle state:");
    expect(view.sectionOverviewLines.join("\n")).toContain("bundle targets missing:");
    expect(view.sectionOverviewLines.join("\n")).toContain("optional Codex tools: missing (3 recommended changes)");
  });

  it("loads inspect snapshot once when install overview and selected help both need it", async () => {
    vi.resetModules();
    vi.doMock("@/inspect-screen.js", async () => {
      const actual = await vi.importActual<typeof import("@/inspect-screen.js")>("@/inspect-screen.js");
      return {
        ...actual,
        loadInspectScreen: vi.fn(actual.loadInspectScreen)
      };
    });

    const { loadAppView: loadAppViewWithSpy } = await import("@/app-view.js");
    const inspectScreen = await import("@/inspect-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "install");
    for (let index = 0; index < 4; index += 1) {
      moveSelection(shell, "action", 1);
    }

    loadAppViewWithSpy(shell);

    expect(vi.mocked(inspectScreen.loadInspectScreen)).toHaveBeenCalledTimes(1);
    vi.doUnmock("@/inspect-screen.js");
    vi.resetModules();
  });

  it("surfaces preference defaults and enabled packs in the preferences overview", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");

    const view = loadAppView(shell);

    expect(view.sectionOverviewLines.join("\n")).toContain("defaults source:");
    expect(view.sectionOverviewLines.join("\n")).toContain("coordinator:");
    expect(view.sectionOverviewLines.join("\n")).toContain("enabled packs:");
  });

  it("surfaces rollback availability and removable installs in the repair overview", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "repair");

    const view = loadAppView(shell);

    expect(view.sectionOverviewLines.join("\n")).toContain("restore backup:");
    expect(view.sectionOverviewLines.join("\n")).toContain("local telemetry data:");
    expect(view.sectionOverviewLines.join("\n")).toContain("removable installs:");
  });

  it("threads the active overlay into the top-level view", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");

    runSelectedAction(shell);
    let view = loadAppView(shell);
    expect(view.overlay?.kind).toBe("config");

    shell.activeEditor = null;
    moveSelection(shell, "section", -1);
    for (let index = 0; index < 4; index += 1) {
      moveSelection(shell, "action", 1);
    }
    runSelectedAction(shell);
    view = loadAppView(shell);
    expect(view.overlay?.kind).toBe("confirm");
  });

  it("keeps successful install notices compact instead of dumping the full backend text", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    runSelectedAction(shell);
    const view = loadAppView(shell);

    expect(view.overlay?.kind).toBe("notice");
    expect(view.overlay && "bodyLines" in view.overlay ? view.overlay.bodyLines : []).toEqual(
      view.latestStatusLines
    );
  });
});
