import { type TuiInputKey } from "@sane/sane-tui/input-driver.js";

export type TerminalInputKey = TuiInputKey | "quit";

const TERMINAL_KEY_MAP: Record<string, TerminalInputKey> = {
  "\u001b[A": "up",
  "\u001b[B": "down",
  "\u001b[C": "right",
  "\u001b[D": "left",
  "\u001b[Z": "backtab",
  "\u001b": "escape",
  "\t": "tab",
  "\r": "enter",
  "\n": "enter",
  " ": "space",
  h: "left",
  j: "down",
  k: "up",
  l: "right",
  q: "quit",
  r: "r",
  d: "d",
  y: "y",
  n: "n"
};

export function parseTerminalKey(input: string): TerminalInputKey | null {
  return TERMINAL_KEY_MAP[input] ?? null;
}

export function parseTerminalInput(input: string): TerminalInputKey[] {
  if (input.length === 0) {
    return [];
  }

  const exactMatch = parseTerminalKey(input);
  if (exactMatch) {
    return [exactMatch];
  }

  const keys: TerminalInputKey[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const escapeSequence = input[index] === "\u001b" ? input.slice(index, index + 3) : null;
    if (escapeSequence) {
      const escapeKey = parseTerminalKey(escapeSequence);
      if (escapeKey) {
        keys.push(escapeKey);
        index += escapeSequence.length - 1;
        continue;
      }
    }

    const key = parseTerminalKey(input[index]!);
    if (key) {
      keys.push(key);
    }
  }

  return keys;
}
