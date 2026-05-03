import { describe, expect, it } from "vitest";

import {
  actionIconForCommand,
  computeOverlayWidth,
  focusHelpLines,
  focusSnapshotLines,
  inkInputToTuiKeys,
  inkInputToTuiKey,
  inkRenderOptions,
  planInkEditorOverlay,
  planInkFocusedLayout,
  planSectionTabs,
  truncateEnd
} from "@sane/sane-tui/ink-terminal.js";

const baseKey = {
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  pageDown: false,
  pageUp: false,
  home: false,
  end: false,
  return: false,
  escape: false,
  ctrl: false,
  shift: false,
  tab: false,
  backspace: false,
  delete: false,
  meta: false,
  super: false,
  hyper: false,
  capsLock: false,
  numLock: false
};

describe("ink terminal renderer", () => {
  it("maps Ink keyboard events onto the existing TUI input contract", () => {
    expect(inkInputToTuiKey("", { ...baseKey, upArrow: true })).toBe("up");
    expect(inkInputToTuiKey("", { ...baseKey, downArrow: true })).toBe("down");
    expect(inkInputToTuiKey("", { ...baseKey, leftArrow: true })).toBe("left");
    expect(inkInputToTuiKey("", { ...baseKey, rightArrow: true })).toBe("right");
    expect(inkInputToTuiKey("", { ...baseKey, return: true })).toBe("enter");
    expect(inkInputToTuiKey("", { ...baseKey, escape: true })).toBe("escape");
    expect(inkInputToTuiKey("", { ...baseKey, tab: true })).toBe("tab");
    expect(inkInputToTuiKey("", { ...baseKey, tab: true, shift: true })).toBe("backtab");
    expect(inkInputToTuiKey("j", baseKey)).toBe("down");
    expect(inkInputToTuiKey("k", baseKey)).toBe("up");
    expect(inkInputToTuiKey(" ", baseKey)).toBe("space");
    expect(inkInputToTuiKey("r", baseKey)).toBe("r");
    expect(inkInputToTuiKey("d", baseKey)).toBe("d");
    expect(inkInputToTuiKey("y", baseKey)).toBe("y");
    expect(inkInputToTuiKey("n", baseKey)).toBe("n");
    expect(inkInputToTuiKey("q", baseKey)).toBe("quit");
    expect(inkInputToTuiKey("x", baseKey)).toBeNull();
  });

  it("preserves repeated arrow escape sequences delivered in one Ink input chunk", () => {
    expect(inkInputToTuiKeys("\u001b[B\u001b[B\u001b[B", baseKey)).toEqual(["down", "down", "down"]);
    expect(inkInputToTuiKeys("\u001b[A\u001b[B", baseKey)).toEqual(["up", "down"]);
  });

  it("uses Ink alternate-screen interactive rendering for the live TTY path", () => {
    const options = inkRenderOptions();

    expect(options.alternateScreen).toBe(true);
    expect(options.exitOnCtrlC).toBe(false);
    expect(options.interactive).toBe(true);
  });

  it("keeps the main focus pane task-focused instead of showing command payload dumps", () => {
    const action = {
      id: "show_codex_config",
      kind: "backend",
      repoMutation: false,
      help: [
        "Read your current `~/.codex/config.toml` without changing it.",
        "",
        "Use this before applying settings."
      ]
    } as Parameters<typeof focusHelpLines>[0];

    expect(focusHelpLines(action as never, 5)).toEqual([
      "Opens details. No files change.",
      "Read your current `~/.codex/config.toml` without changing it.",
      "Use this before applying settings."
    ]);
  });

  it("does not show overflow markers in the main snapshot pane", () => {
    const lines = focusSnapshotLines([
      "Recommended now: Install Sane into Codex",
      "Status now: runtime installed | hooks missing",
      "runtime history: events 71",
      "... 37 more line(s)",
      "Guided flow",
      "1. Set up Sane files",
      "2. View your current Codex settings"
    ], 6);

    expect(lines).toHaveLength(6);
    expect(lines).toEqual([
      "Recommended now: Install Sane into Codex",
      "Status now: runtime installed | hooks missing",
      "",
      "Guided flow",
      "",
      "1. Set up Sane files"
    ]);
  });

  it("truncates action labels before Ink can wrap them", () => {
    expect(truncateEnd("> Preview optional recommended Codex tools", 18)).toBe("> Preview optio...");
  });

  it("plans section navigation as real tabs without inventory wording", () => {
    const tabs = [
      { id: "setup", label: "Setup" },
      { id: "configure", label: "Configure" },
      { id: "install", label: "Install" },
      { id: "check", label: "Check" },
      { id: "recover", label: "Recover" },
      { id: "remove", label: "Remove" }
    ];

    const fullPlan = planSectionTabs(tabs, "setup", 64);
    expect(fullPlan.mode).toBe("full");
    expect(fullPlan.mode === "full" ? fullPlan.items[0] : null).toEqual({
      id: "setup",
      label: "Setup",
      active: true
    });
    expect(fullPlan.mode === "full" ? fullPlan.items.map((item) => item.label).join(" ") : "").not.toContain("Jobs");
    expect(planSectionTabs(tabs, "check", 34)).toMatchObject({
      mode: "neighbors",
      previous: { id: "install", label: "Install" },
      current: { id: "check", label: "Check" },
      next: { id: "recover", label: "Recover" }
    });
    expect(planSectionTabs(tabs, "recover", 8)).toEqual({
      mode: "current",
      current: { id: "recover", label: "Recover" }
    });
  });

  it("uses terminal-safe action glyphs to add scan targets", () => {
    expect(actionIconForCommand("show_codex_config")).toBe("◎");
    expect(actionIconForCommand("preview_codex_profile")).toBe("◎");
    expect(actionIconForCommand("open_config_editor")).toBe("⚙");
    expect(actionIconForCommand("install_runtime")).toBe("→");
    expect(actionIconForCommand("export_all")).toBe("→");
    expect(actionIconForCommand("uninstall_all")).toBe("⚠");
  });

  it("uses roomy side-by-side panes only when the viewport can actually breathe", () => {
    expect(planInkFocusedLayout(138, 52)).toMatchObject({
      mode: "wide",
      actionWidth: 48,
      detailWidth: 88
    });
    expect(planInkFocusedLayout(108, 31).mode).toBe("stacked");
    expect(planInkFocusedLayout(94, 24).mode).toBe("stacked");
    expect(planInkFocusedLayout(57, 18)).toEqual({
      mode: "stacked",
      detailHeight: 9,
      actionHeight: 8
    });
    expect(planInkFocusedLayout(56, 8)).toEqual({
      mode: "list-only",
      actionHeight: 8
    });
  });

  it("lets editor overlays use available terminal height instead of floating in dead space", () => {
    expect(planInkEditorOverlay(140, 50)).toMatchObject({
      modalHeight: 50,
      compactEditor: false,
      fieldSlots: 44,
      detailSlots: 44
    });
    expect(planInkEditorOverlay(95, 32)).toMatchObject({
      modalHeight: 32,
      compactEditor: true
    });
    expect(planInkEditorOverlay(56, 6)).toMatchObject({
      modalHeight: 6,
      compactEditor: true,
      fieldSlots: 2,
      detailSlots: 0
    });
  });

  it("bounds overlay width to viewport at compact sizes", () => {
    expect(computeOverlayWidth(40, 70, 6, 120)).toBe(40);
    expect(computeOverlayWidth(56, 50, 6, 96)).toBe(50);
    expect(computeOverlayWidth(120, 70, 6, 120)).toBe(114);
  });
});
