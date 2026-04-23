import { type TuiInputKey } from "@sane/sane-tui/input-driver.js";

const TERMINAL_KEY_MAP: Record<string, TuiInputKey> = {
  "\u001b[A": "up",
  "\u001b[B": "down",
  "\u001b[C": "right",
  "\u001b[D": "left",
  "\u001b": "escape",
  "\r": "enter",
  "\n": "enter",
  " ": "space",
  r: "r",
  d: "d",
  y: "y",
  n: "n"
};

export function parseTerminalKey(input: string): TuiInputKey | null {
  return TERMINAL_KEY_MAP[input] ?? null;
}
