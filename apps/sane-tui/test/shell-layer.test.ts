import { describe, expect, it } from "vitest";

import { listSectionActions, type TuiSectionId, type UiCommandId } from "@/index.js";

interface ShellState {
  sectionId: TuiSectionId;
  actionIndex: number;
  screen: "dashboard" | "confirm" | "notice";
  confirm: { commandId: UiCommandId } | null;
}

interface ShellLayerModule {
  createShellState(input?: { launchShortcut?: "default" | "settings" }): ShellState;
  moveSectionSelection(state: ShellState, step: 1 | -1): ShellState;
  moveActionSelection(state: ShellState, step: 1 | -1): ShellState;
  runSelectedAction(state: ShellState): ShellState;
}

async function loadShellLayer(): Promise<ShellLayerModule> {
  try {
    return (await import("../src/shell-layer.js")) as ShellLayerModule;
  } catch (error) {
    throw new Error("expected ../src/shell-layer.ts to define the shell state layer", {
      cause: error as Error
    });
  }
}

describe("shell layer", () => {
  it("launches into get_started by default", async () => {
    const shell = await loadShellLayer();

    const state = shell.createShellState();

    expect(state.sectionId).toBe("get_started");
    expect(state.actionIndex).toBe(0);
  });

  it("supports the settings shortcut launch into preferences", async () => {
    const shell = await loadShellLayer();

    const state = shell.createShellState({ launchShortcut: "settings" });

    expect(state.sectionId).toBe("preferences");
    expect(state.actionIndex).toBe(0);
  });

  it("keeps section and action selection in bounds by wrapping", async () => {
    const shell = await loadShellLayer();

    let state = shell.createShellState();
    state = shell.moveSectionSelection(state, -1);
    expect(state.sectionId).toBe("repair");
    expect(state.actionIndex).toBe(0);

    state = shell.moveActionSelection(state, -1);
    expect(state.actionIndex).toBe(listSectionActions("repair").length - 1);

    state = shell.moveActionSelection(state, 1);
    expect(state.actionIndex).toBe(0);
  });

  it("routes risky actions through a confirmation gate before execution", async () => {
    const shell = await loadShellLayer();
    const riskyIndex = listSectionActions("get_started").findIndex(
      (action) => action.id === "apply_codex_profile"
    );
    expect(riskyIndex).toBeGreaterThanOrEqual(0);

    let state = shell.createShellState();
    for (let index = 0; index < riskyIndex; index += 1) {
      state = shell.moveActionSelection(state, 1);
    }

    state = shell.runSelectedAction(state);

    expect(state.screen).toBe("confirm");
    expect(state.confirm?.commandId).toBe("apply_codex_profile");
  });
});
