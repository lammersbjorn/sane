import { describe, expect, it } from "vitest";

import {
  focusHelpLines,
  focusSnapshotLines,
  inkInputToTuiKey,
  inkRenderOptions,
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
        "Use this before applying profiles."
      ]
    } as Parameters<typeof focusHelpLines>[0];

    expect(focusHelpLines(action as never, 5)).toEqual([
      "Opens details. No files change.",
      "Read your current `~/.codex/config.toml` without changing it.",
      "Use this before applying profiles."
    ]);
  });

  it("does not show overflow markers in the main snapshot pane", () => {
    expect(focusSnapshotLines([
      "Recommended now: Install Sane into Codex",
      "Status now: runtime installed | hooks missing",
      "runtime history: events 71",
      "... 37 more line(s)",
      "Guided flow",
      "1. Set up Sane files",
      "2. View your current Codex settings"
    ], 6)).toEqual([
      "Recommended now: Install Sane into Codex",
      "Status now: runtime installed | hooks missing",
      "",
      "Guided flow",
      "",
      "1. Set up Sane files",
      "2. View your current Codex settings"
    ]);
  });

  it("truncates action labels before Ink can wrap them", () => {
    expect(truncateEnd("> Preview optional recommended Codex tools", 18)).toBe("> Preview optio...");
  });
});
