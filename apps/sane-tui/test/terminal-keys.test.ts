import { describe, expect, it } from "vitest";

import { parseTerminalInput, parseTerminalKey } from "@sane/sane-tui/terminal-keys.js";

describe("terminal keys", () => {
  it("maps escape sequences and control keys onto TUI input keys", () => {
    expect(parseTerminalKey("\u001b[A")).toBe("up");
    expect(parseTerminalKey("\u001b[B")).toBe("down");
    expect(parseTerminalKey("\u001b[C")).toBe("right");
    expect(parseTerminalKey("\u001b[D")).toBe("left");
    expect(parseTerminalKey("\u001b[Z")).toBe("backtab");
    expect(parseTerminalKey("\u001b")).toBe("escape");
    expect(parseTerminalKey("\t")).toBe("tab");
    expect(parseTerminalKey("\r")).toBe("enter");
    expect(parseTerminalKey(" ")).toBe("space");
  });

  it("maps single-character action keys, vim nav keys, and quit", () => {
    expect(parseTerminalKey("h")).toBe("left");
    expect(parseTerminalKey("j")).toBe("down");
    expect(parseTerminalKey("k")).toBe("up");
    expect(parseTerminalKey("l")).toBe("right");
    expect(parseTerminalKey("r")).toBe("r");
    expect(parseTerminalKey("d")).toBe("d");
    expect(parseTerminalKey("y")).toBe("y");
    expect(parseTerminalKey("n")).toBe("n");
    expect(parseTerminalKey("q")).toBe("quit");
    expect(parseTerminalKey("x")).toBeNull();
  });

  it("splits batched terminal chunks into ordered keys", () => {
    expect(parseTerminalInput("\tq")).toEqual(["tab", "quit"]);
    expect(parseTerminalInput("jk")).toEqual(["down", "up"]);
    expect(parseTerminalInput("\u001b[Aq")).toEqual(["up", "quit"]);
  });
});
