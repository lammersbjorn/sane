import { type OperationResult } from "@sane/control-plane/core.js";

import {
  parseTerminalInput,
  parseTerminalKey,
  type TerminalInputKey
} from "@sane/sane-tui/terminal-keys.js";
import { type TextTuiRuntime } from "@sane/sane-tui/text-driver.js";

export interface TerminalStepResult {
  key: TerminalInputKey | null;
  keys: TerminalInputKey[];
  result: OperationResult | null;
  frame: string;
  shouldExit: boolean;
}

export function stepTerminalDriver(runtime: TextTuiRuntime, input: string): TerminalStepResult {
  const keys = parseTerminalInput(input);
  let result: OperationResult | null = null;
  let shouldExit = false;

  for (const key of keys) {
    if (key === "quit") {
      shouldExit = true;
      break;
    }

    result = runtime.handleInput(key);
  }

  return {
    key: keys.at(-1) ?? parseTerminalKey(input),
    keys,
    result,
    frame: runtime.render(),
    shouldExit
  };
}
