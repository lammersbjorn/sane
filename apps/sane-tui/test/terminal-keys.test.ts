import { describe, expect, it } from "vitest";

import { parseTerminalKey } from "@/terminal-keys.js";

describe("terminal keys", () => {
  it("maps escape sequences and control keys onto TUI input keys", () => {
    expect(parseTerminalKey("\u001b[A")).toBe("up");
    expect(parseTerminalKey("\u001b[B")).toBe("down");
    expect(parseTerminalKey("\u001b[C")).toBe("right");
    expect(parseTerminalKey("\u001b[D")).toBe("left");
    expect(parseTerminalKey("\u001b")).toBe("escape");
    expect(parseTerminalKey("\r")).toBe("enter");
    expect(parseTerminalKey(" ")).toBe("space");
  });

  it("maps single-character action keys and ignores unknown input", () => {
    expect(parseTerminalKey("r")).toBe("r");
    expect(parseTerminalKey("d")).toBe("d");
    expect(parseTerminalKey("y")).toBe("y");
    expect(parseTerminalKey("n")).toBe("n");
    expect(parseTerminalKey("q")).toBeNull();
  });
});
