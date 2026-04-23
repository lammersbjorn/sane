import { stepTerminalDriver } from "@sane/sane-tui/terminal-driver.js";
import { type TextTuiRuntime } from "@sane/sane-tui/text-driver.js";
import { type TextViewport } from "@sane/sane-tui/text-renderer.js";

const ENTER_ALT_SCREEN = "\u001b[?1049h\u001b[?25l";
const EXIT_ALT_SCREEN = "\u001b[?25h\u001b[?1049l";
const RESET_VIEWPORT = "\u001b[2J\u001b[H";
const CTRL_C = "\u0003";

export interface TerminalLoopReadable {
  setRawMode?: (enabled: boolean) => void;
  resume: () => void;
  pause: () => void;
  on: (event: "data", listener: (chunk: Buffer | string) => void) => void;
  off: (event: "data", listener: (chunk: Buffer | string) => void) => void;
}

export interface TerminalLoopWritable {
  write: (chunk: string) => void;
  columns?: number;
  rows?: number;
  on?: (event: "resize", listener: () => void) => void;
  off?: (event: "resize", listener: () => void) => void;
}

export interface TerminalLoopIo {
  stdin: TerminalLoopReadable;
  stdout: TerminalLoopWritable;
}

export interface TerminalLoopController {
  stop: () => void;
}

export function startTerminalLoop(
  runtime: TextTuiRuntime,
  io: TerminalLoopIo
): TerminalLoopController {
  let stopped = false;

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    io.stdin.off("data", onData);
    io.stdout.off?.("resize", onResize);
    io.stdin.setRawMode?.(false);
    io.stdin.pause();
    io.stdout.write(EXIT_ALT_SCREEN);
  };

  const onData = (chunk: Buffer | string) => {
    const input = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    if (input === CTRL_C) {
      stop();
      return;
    }

    const step = stepTerminalDriver(runtime, input);
    if (step.shouldExit) {
      stop();
      return;
    }

    io.stdout.write(renderTerminalFrame(runtime.render(currentViewport(io.stdout))));
  };

  const onResize = () => {
    io.stdout.write(renderTerminalFrame(runtime.render(currentViewport(io.stdout))));
  };

  io.stdin.setRawMode?.(true);
  io.stdin.resume();
  io.stdin.on("data", onData);
  io.stdout.on?.("resize", onResize);
  io.stdout.write(ENTER_ALT_SCREEN);
  io.stdout.write(renderTerminalFrame(runtime.render(currentViewport(io.stdout))));

  return { stop };
}

function renderTerminalFrame(frame: string): string {
  return `${RESET_VIEWPORT}${frame}`;
}

function currentViewport(stdout: TerminalLoopWritable): TextViewport {
  return {
    width: stdout.columns,
    height: stdout.rows
  };
}
