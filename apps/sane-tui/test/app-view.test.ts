import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { appendJsonlRecord, createDecisionRecord, stringifyDecisionRecord } from "@sane/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCodexProfile, installRuntime } from "@sane/control-plane";
import { createDefaultLocalConfig } from "@sane/config";
import { saveConfig } from "@sane/control-plane/preferences.js";

import { loadAppView } from "@sane/sane-tui/app-view.js";
import { createTuiShell, currentAction, moveSelection, runSelectedAction, selectSection } from "@sane/sane-tui/shell.js";

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
    expect(view.mode.id).toBe("browse");
    expect(view.mode.label).toBe("Browse");
    expect(view.footerTitle).toBe("Now");
    expect(view.footer.navHint).toContain("left/right or tab");
    expect(view.footer.navHint).toContain("q quits");
    expect(view.footer.status.runtime).toBe("missing");
    expect(view.footer.status.codex).toBe("missing");
    expect(view.footerLines[0]).toContain("left/right or tab change section");
    expect(view.footerLines[0]).toContain("mode browse");
    expect(view.footerLines[0]).toContain("q quits");
    expect(view.footerLines[0]).toContain("runtime");
    expect(view.footerLines[0]).toContain("drift");
  });

  it("loads Get Started once even when dashboard and section overview both need it", async () => {
    vi.resetModules();
    vi.doMock("@sane/sane-tui/get-started-screen.js", async () => {
      const actual = await vi.importActual<typeof import("@sane/sane-tui/get-started-screen.js")>("@sane/sane-tui/get-started-screen.js");
      return {
        ...actual,
        loadGetStartedScreenFromStatusBundle: vi.fn(actual.loadGetStartedScreenFromStatusBundle)
      };
    });
    vi.doMock("@sane/sane-tui/install-screen.js", async () => {
      const actual = await vi.importActual<typeof import("@sane/sane-tui/install-screen.js")>("@sane/sane-tui/install-screen.js");
      return {
        ...actual,
        loadInstallScreenFromStatusBundle: vi.fn(actual.loadInstallScreenFromStatusBundle)
      };
    });

    const { loadAppView: loadAppViewWithSpy } = await import("@sane/sane-tui/app-view.js");
    const getStartedScreen = await import("@sane/sane-tui/get-started-screen.js");
    const installScreen = await import("@sane/sane-tui/install-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    loadAppViewWithSpy(shell);

    expect(vi.mocked(getStartedScreen.loadGetStartedScreenFromStatusBundle)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getStartedScreen.loadGetStartedScreenFromStatusBundle).mock.calls[0]?.[2]).toBe(
      shell.statusSnapshot.statusBundle
    );
    expect(vi.mocked(getStartedScreen.loadGetStartedScreenFromStatusBundle).mock.calls[0]?.[3]).toBeDefined();
    expect(vi.mocked(installScreen.loadInstallScreenFromStatusBundle)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(installScreen.loadInstallScreenFromStatusBundle).mock.calls[0]?.[2]).toBe(
      shell.statusSnapshot.statusBundle
    );
    expect(vi.mocked(installScreen.loadInstallScreenFromStatusBundle).mock.calls[0]?.[3]).toBeDefined();
    vi.doUnmock("@sane/sane-tui/get-started-screen.js");
    vi.doUnmock("@sane/sane-tui/install-screen.js");
    vi.resetModules();
  });

  it("reuses one codex profile family snapshot per app-view render", async () => {
    vi.resetModules();
    vi.doMock("@sane/control-plane/codex-config.js", async () => {
      const actual = await vi.importActual<typeof import("@sane/control-plane/codex-config.js")>("@sane/control-plane/codex-config.js");
      return {
        ...actual,
        inspectCodexProfileFamilySnapshot: vi.fn(actual.inspectCodexProfileFamilySnapshot)
      };
    });
    vi.doMock("@sane/sane-tui/get-started-screen.js", async () => {
      const actual = await vi.importActual<typeof import("@sane/sane-tui/get-started-screen.js")>("@sane/sane-tui/get-started-screen.js");
      return {
        ...actual,
        loadGetStartedScreenFromStatusBundle: vi.fn(actual.loadGetStartedScreenFromStatusBundle)
      };
    });
    vi.doMock("@sane/sane-tui/preferences-screen.js", async () => {
      const actual = await vi.importActual<typeof import("@sane/sane-tui/preferences-screen.js")>("@sane/sane-tui/preferences-screen.js");
      return {
        ...actual,
        loadPreferencesScreen: vi.fn(actual.loadPreferencesScreen)
      };
    });

    const { loadAppView: loadAppViewWithSpy } = await import("@sane/sane-tui/app-view.js");
    const codexConfig = await import("@sane/control-plane/codex-config.js");
    const getStartedScreen = await import("@sane/sane-tui/get-started-screen.js");
    const preferencesScreen = await import("@sane/sane-tui/preferences-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "preferences");

    loadAppViewWithSpy(shell);

    expect(vi.mocked(codexConfig.inspectCodexProfileFamilySnapshot)).toHaveBeenCalledTimes(1);
    const profileSnapshot = vi.mocked(codexConfig.inspectCodexProfileFamilySnapshot).mock.results[0]?.value;
    expect(vi.mocked(getStartedScreen.loadGetStartedScreenFromStatusBundle).mock.calls[0]?.[3]).toBe(
      profileSnapshot
    );
    expect(vi.mocked(preferencesScreen.loadPreferencesScreen).mock.calls[0]?.[2]).toBe(profileSnapshot);
    vi.doUnmock("@sane/control-plane/codex-config.js");
    vi.doUnmock("@sane/sane-tui/get-started-screen.js");
    vi.doUnmock("@sane/sane-tui/preferences-screen.js");
    vi.resetModules();
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
    expect(view.sectionOverviewLines.join("\n")).toContain("core codex profile: missing");
  });

  it("surfaces typed codex profile readiness in Get Started guidance", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    for (let index = 0; index < 2; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("preview_codex_profile");
    expect(view.selectedHelpLines.join("\n")).toContain("audit: missing");
    expect(view.selectedHelpLines.join("\n")).toContain("apply readiness: ready (3 changes)");
    expect(view.selectedHelpLines.join("\n")).toContain("model: <missing> -> gpt-5.4");
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
    expect(view.sectionOverviewLines.join("\n")).toContain("latest event");
    expect(view.sectionOverviewLines.join("\n")).toContain("latest decision");
    expect(view.sectionOverviewLines.join("\n")).toContain("latest artifact");
    expect(view.sectionOverviewLines.join("\n")).toContain("latest policy snapshot");
    expect(view.sectionOverviewLines.join("\n")).toContain("local config view");
    expect(view.sectionOverviewLines.join("\n")).toContain("Codex config view");
    expect(view.sectionOverviewLines.join("\n")).toContain("integrations audit");
    expect(view.sectionOverviewLines.join("\n")).toContain("install bundle");
    expect(view.sectionOverviewLines.join("\n")).toContain("export drift view");
  });

  it("uses inspect overview selector instead of unpacking inspect status bundle in app-view", async () => {
    vi.resetModules();
    vi.doMock("@sane/sane-tui/inspect-screen.js", () => {
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
        loadInspectScreenFromStatusBundle: vi.fn(() => inspectModel),
        inspectOverviewLines: vi.fn(() => ["from-inspect-overview-selector"]),
        formatInspectPolicyPreviewLines: vi.fn(() => ["from-inspect-policy-preview-selector"])
      };
    });

    const { loadAppView: loadAppViewWithMock } = await import("@sane/sane-tui/app-view.js");
    const inspectScreen = await import("@sane/sane-tui/inspect-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");

    const view = loadAppViewWithMock(shell);

    expect(view.sectionOverviewLines).toEqual(["from-inspect-overview-selector"]);
    expect(vi.mocked(inspectScreen.inspectOverviewLines)).toHaveBeenCalledTimes(1);
    vi.doUnmock("@sane/sane-tui/inspect-screen.js");
    vi.resetModules();
  });

  it("surfaces editor mode when a preferences editor is open", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");
    runSelectedAction(shell);

    const view = loadAppView(shell);

    expect(view.mode.id).toBe("config");
    expect(view.mode.label).toBe("Edit Models");
    expect(view.footer.navHint).toContain("enter saves");
  });

  it("threads shell status bundle into inspect when the inspect section is opened", async () => {
    vi.resetModules();
    vi.doMock("@sane/sane-tui/inspect-screen.js", async () => {
      const actual = await vi.importActual<typeof import("@sane/sane-tui/inspect-screen.js")>("@sane/sane-tui/inspect-screen.js");
      return {
        ...actual,
        loadInspectScreenFromStatusBundle: vi.fn(actual.loadInspectScreenFromStatusBundle)
      };
    });

    const { loadAppView: loadAppViewWithSpy } = await import("@sane/sane-tui/app-view.js");
    const inspectScreen = await import("@sane/sane-tui/inspect-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");

    loadAppViewWithSpy(shell);

    expect(vi.mocked(inspectScreen.loadInspectScreenFromStatusBundle)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(inspectScreen.loadInspectScreenFromStatusBundle).mock.calls[0]?.[2]).toBe(
      shell.statusSnapshot.statusBundle
    );
    vi.doUnmock("@sane/sane-tui/inspect-screen.js");
    vi.resetModules();
  });

  it("threads shell status bundle into repair when the repair section is opened", async () => {
    vi.resetModules();
    vi.doMock("@sane/sane-tui/repair-screen.js", async () => {
      const actual = await vi.importActual<typeof import("@sane/sane-tui/repair-screen.js")>("@sane/sane-tui/repair-screen.js");
      return {
        ...actual,
        loadRepairScreenFromStatusBundle: vi.fn(actual.loadRepairScreenFromStatusBundle)
      };
    });

    const { loadAppView: loadAppViewWithSpy } = await import("@sane/sane-tui/app-view.js");
    const repairScreen = await import("@sane/sane-tui/repair-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "repair");

    loadAppViewWithSpy(shell);

    expect(vi.mocked(repairScreen.loadRepairScreenFromStatusBundle)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repairScreen.loadRepairScreenFromStatusBundle).mock.calls[0]?.[2]).toBe(
      shell.statusSnapshot.statusBundle
    );
    vi.doUnmock("@sane/sane-tui/repair-screen.js");
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
    expect(view.selectedHelpLines.join("\n")).toContain("apply readiness: ready (3 keys)");
    expect(view.selectedHelpLines.join("\n")).toContain("context7: missing -> recommended");
    expect(view.selectedHelpLines.join("\n")).toContain("playwright: missing -> recommended");
    expect(view.selectedHelpLines.join("\n")).toContain("grep.app: missing -> recommended");
  });

  it("surfaces typed cloudflare profile readiness in Preferences guidance", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "preferences");
    for (let index = 0; index < 7; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("preview_cloudflare_profile");
    expect(view.sectionOverviewLines.join("\n")).toContain("statusline profile: missing");
    expect(view.sectionOverviewLines.join("\n")).toContain("cloudflare profile: missing");
    expect(view.sectionOverviewLines.join("\n")).toContain("explorer: gpt-5.4-mini/low");
    expect(view.sectionOverviewLines.join("\n")).toContain("execution: gpt-5.3-codex/medium");
    expect(view.sectionOverviewLines.join("\n")).toContain("realtime: gpt-5.3-codex-spark/low");
    expect(view.selectedHelpLines.join("\n")).toContain("audit: missing");
    expect(view.selectedHelpLines.join("\n")).toContain("apply readiness: ready (1 keys)");
    expect(view.selectedHelpLines.join("\n")).toContain(
      "cloudflare-api: missing -> optional provider profile"
    );
  });

  it("surfaces typed opencode profile readiness in Preferences guidance", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "preferences");
    for (let index = 0; index < 10; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("apply_opencode_profile");
    expect(view.sectionOverviewLines.join("\n")).toContain("statusline profile: missing");
    expect(view.sectionOverviewLines.join("\n")).toContain("opencode profile: missing");
    expect(view.sectionOverviewLines.join("\n")).toContain("explorer: gpt-5.4-mini/low");
    expect(view.sectionOverviewLines.join("\n")).toContain("execution: gpt-5.3-codex/medium");
    expect(view.sectionOverviewLines.join("\n")).toContain("realtime: gpt-5.3-codex-spark/low");
    expect(view.selectedHelpLines.join("\n")).toContain("audit: missing");
    expect(view.selectedHelpLines.join("\n")).toContain("apply readiness: ready (1 keys)");
    expect(view.selectedHelpLines.join("\n")).toContain(
      "opensrc: missing -> optional Opencode compatibility profile"
    );
  });

  it("surfaces runtime-summary payload in Inspect guidance", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");
    for (let index = 0; index < 2; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("show_runtime_summary");
    expect(view.selectedHelpLines.join("\n")).toContain(
      "Runtime handoff visibility is read-only and current-run-derived."
    );
    expect(view.selectedHelpLines.join("\n")).toContain("current-run:");
    expect(view.selectedHelpLines.join("\n")).toContain("summary:");
    expect(view.selectedHelpLines.join("\n")).toContain("brief:");
    expect(view.selectedHelpLines.join("\n")).toContain("latest event (read-only local visibility):");
    expect(view.selectedHelpLines.join("\n")).toContain("latest decision (read-only local visibility):");
    expect(view.selectedHelpLines.join("\n")).toContain("latest artifact (read-only local visibility):");
  });

  it("surfaces enriched local config payload in Preferences guidance", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    saveConfig(paths, createDefaultLocalConfig());

    const shell = createTuiShell(paths, codexPaths);
    selectSection(shell, "preferences");
    for (let index = 0; index < 3; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("show_config");
    expect(view.selectedHelpLines.join("\n")).toContain("version: 1");
    expect(view.selectedHelpLines.join("\n")).toContain("explorer: gpt-5.4-mini (low) (derived)");
    expect(view.selectedHelpLines.join("\n")).toContain("execution: gpt-5.3-codex (medium) (derived)");
    expect(view.selectedHelpLines.join("\n")).toContain("realtime: gpt-5.3-codex-spark (low) (derived)");
  });

  it("surfaces codex config payload in Preferences guidance", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    saveConfig(paths, createDefaultLocalConfig());
    applyCodexProfile(paths, codexPaths);

    const shell = createTuiShell(paths, codexPaths);
    selectSection(shell, "preferences");
    for (let index = 0; index < 4; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("show_codex_config");
    expect(view.selectedHelpLines.join("\n")).toContain("model:");
    expect(view.selectedHelpLines.join("\n")).toContain("reasoning:");
  });

  it("surfaces the latest typed policy snapshot in Inspect guidance", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const decision = createDecisionRecord(
      "policy preview: rendered adaptive obligation scenarios",
      "simple-question: direct_answer | coordinator=gpt-5.4/high",
      [],
      {
        kind: "policy_preview",
        scenarios: [{ id: "simple-question" }, { id: "multi-file-feature" }]
      }
    );
    decision.tsUnix = 1_700_000_005;
    appendJsonlRecord(paths.decisionsPath, decision, stringifyDecisionRecord);

    const shell = createTuiShell(paths, codexPaths);
    selectSection(shell, "inspect");

    const view = loadAppView(shell);

    expect(view.sectionOverviewLines.join("\n")).toContain(
      "latest policy snapshot: present (current-run-derived read-only view; ts 1700000005; summary policy preview: rendered adaptive obligation scenarios; 2 scenarios: simple-question, multi-file-feature)"
    );
    expect(view.sectionOverviewLines.join("\n")).toContain(
      "latest policy scenario simple-question: obligations 0, traces 0"
    );
  });

  it("surfaces policy preview payload for the inspect policy action", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");
    for (let index = 0; index < 7; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedAction.id).toBe("preview_policy");
    expect(view.selectedHelpLines.join("\n")).toContain(
      "latest snapshot: missing (current-run-derived read-only view)"
    );
    expect(view.selectedHelpLines.join("\n")).toContain(
      "current preview: policy preview: rendered adaptive obligation scenarios;"
    );
    expect(view.selectedHelpLines.join("\n")).toContain(
      "current preview scenario simple-question: obligations 1, traces 1"
    );
    expect(view.selectedHelpLines.join("\n")).toContain("simple-question:");
    expect(view.selectedHelpLines.join("\n")).toContain("direct_answer");
    expect(view.selectedHelpLines.join("\n")).toContain("explorer=");
  });

  it("uses inspect policy presenter selector instead of manual policy line stitching", async () => {
    vi.resetModules();
    vi.doMock("@sane/sane-tui/inspect-screen.js", () => {
      const inspectModel = {
        summary: "Inspect",
        actions: [],
        overviewLines: ["inspect-overview"],
        latestPolicyPreview: { status: "missing" },
        policyPreview: {
          summary: "policy preview: rendered adaptive obligation scenarios",
          details: ["should-not-appear"],
          policyPreview: {
            scenarios: [{ id: "simple-question" }]
          }
        }
      };

      return {
        loadInspectScreenFromStatusBundle: vi.fn(() => inspectModel),
        inspectOverviewLines: vi.fn(() => ["inspect-overview"]),
        formatInspectPolicyPreviewLines: vi.fn(() => ["from-policy-presenter"])
      };
    });

    const { loadAppView: loadAppViewWithMock } = await import("@sane/sane-tui/app-view.js");
    const inspectScreen = await import("@sane/sane-tui/inspect-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "inspect");
    for (let index = 0; index < 7; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppViewWithMock(shell);

    expect(view.selectedAction.id).toBe("preview_policy");
    expect(view.selectedHelpLines).toContain("from-policy-presenter");
    expect(view.selectedHelpLines).not.toContain("should-not-appear");
    expect(vi.mocked(inspectScreen.formatInspectPolicyPreviewLines)).toHaveBeenCalledTimes(1);
    vi.doUnmock("@sane/sane-tui/inspect-screen.js");
    vi.resetModules();
  });

  it("surfaces latest persisted policy input lines in the inspect policy action", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    const decision = createDecisionRecord(
      "policy preview: rendered adaptive obligation scenarios",
      "simple-question: direct_answer | coordinator=gpt-5.4/high",
      [],
      {
        kind: "policy_preview",
        scenarios: [
          {
            id: "simple-question",
            input: {
              intent: "question",
              taskShape: "trivial",
              risk: "low",
              ambiguity: "low",
              parallelism: "none",
              contextPressure: "low",
              runState: "exploring"
            }
          }
        ]
      }
    );
    decision.tsUnix = 1_700_000_005;
    appendJsonlRecord(paths.decisionsPath, decision, stringifyDecisionRecord);

    const shell = createTuiShell(paths, codexPaths);
    selectSection(shell, "inspect");
    for (let index = 0; index < 7; index += 1) {
      moveSelection(shell, "action", 1);
    }

    const view = loadAppView(shell);

    expect(view.selectedHelpLines.join("\n")).toContain(
      "latest snapshot input simple-question: intent question, task trivial, risk low, ambiguity low, parallelism none, context low, run exploring"
    );
  });

  it("surfaces integrations preview payload for the install apply action too", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "install");
    for (let index = 0; index < 12 && currentAction(shell).id !== "apply_integrations_profile"; index += 1) {
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
    const overview = view.sectionOverviewLines.join("\n");

    expect(overview).toContain("Current install bundle:");
    expect(overview.match(/Current install bundle:/g)).toHaveLength(1);
    expect(overview).toContain("install bundle state:");
    expect(overview).toContain("bundle targets missing:");
    expect(overview).toContain("optional Codex tools: missing (3 recommended changes)");
  });

  it("loads inspect snapshot once when install overview and selected help both need it", async () => {
    vi.resetModules();
    vi.doMock("@sane/sane-tui/inspect-screen.js", async () => {
      const actual = await vi.importActual<typeof import("@sane/sane-tui/inspect-screen.js")>("@sane/sane-tui/inspect-screen.js");
      return {
        ...actual,
        loadInspectScreenFromStatusBundle: vi.fn(actual.loadInspectScreenFromStatusBundle)
      };
    });

    const { loadAppView: loadAppViewWithSpy } = await import("@sane/sane-tui/app-view.js");
    const inspectScreen = await import("@sane/sane-tui/inspect-screen.js");
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "install");
    for (let index = 0; index < 12 && currentAction(shell).id !== "apply_integrations_profile"; index += 1) {
      moveSelection(shell, "action", 1);
    }

    loadAppViewWithSpy(shell);

    expect(vi.mocked(inspectScreen.loadInspectScreenFromStatusBundle)).toHaveBeenCalledTimes(1);
    vi.doUnmock("@sane/sane-tui/inspect-screen.js");
    vi.resetModules();
  });

  it("surfaces preference defaults and enabled packs in the preferences overview", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");

    const view = loadAppView(shell);

    expect(view.sectionOverviewLines.join("\n")).toContain("defaults source:");
    expect(view.sectionOverviewLines.join("\n")).toContain("coordinator:");
    expect(view.sectionOverviewLines.join("\n")).toContain("local telemetry data:");
    expect(view.sectionOverviewLines.join("\n")).toContain("telemetry files:");
    expect(view.sectionOverviewLines.join("\n")).toContain("enabled packs:");
  });

  it("surfaces capability-aware routing context in the preferences overview", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    mkdirSync(codexPaths.codexHome, { recursive: true });
    writeFileSync(
      codexPaths.modelsCacheJson,
      JSON.stringify({
        models: [
          { slug: "gpt-5.5", supported_reasoning_levels: ["medium", "high", "xhigh"] },
          { slug: "gpt-5.4-mini", supported_reasoning_levels: ["low", "medium"] },
          { slug: "gpt-5.3-codex", supported_reasoning_levels: ["medium", "high"] }
        ]
      }),
      "utf8"
    );
    const shell = createTuiShell(paths, codexPaths, "settings");

    const view = loadAppView(shell);
    const overview = view.sectionOverviewLines.join("\n");

    expect(overview).toContain("model availability: detected 3 model(s) from Codex cache");
    expect(overview).toContain("coordinator capability: gpt-5.5 supports medium/high/xhigh; selected medium");
    expect(overview).toContain("implementation capability: gpt-5.3-codex supports medium/high; selected medium");
  });

  it("surfaces rollback availability and removable installs in the repair overview", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    selectSection(shell, "repair");

    const view = loadAppView(shell);

    expect(view.sectionOverviewLines.join("\n")).toContain("restore backup:");
    expect(view.sectionOverviewLines.join("\n")).toContain("latest backup:");
    expect(view.sectionOverviewLines.join("\n")).toContain("local telemetry data:");
    expect(view.sectionOverviewLines.join("\n")).toContain("telemetry files:");
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
