import { type OperationResult } from "@sane/core";

import { parseTerminalKey } from "@/terminal-keys.js";
import { type TextTuiRuntime } from "@/text-driver.js";

export interface TerminalStepResult {
  key: ReturnType<typeof parseTerminalKey>;
  result: OperationResult | null;
  frame: string;
}

export function stepTerminalDriver(runtime: TextTuiRuntime, input: string): TerminalStepResult {
  const key = parseTerminalKey(input);
  const result = key ? runtime.handleInput(key) : null;
  return {
    key,
    result,
    frame: runtime.render()
  };
}
