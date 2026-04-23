import { type LaunchShortcut } from "@sane/sane-tui/command-registry.js";
import { parseCliArgs } from "@sane/sane-tui/cli.js";

export interface PreviewIoState {
  stdinIsTty: boolean;
  stdoutIsTty: boolean;
}

export type PreviewLaunchPlan =
  | {
      kind: "terminal";
      launchShortcut: LaunchShortcut;
    }
  | {
      kind: "text";
      args: readonly string[];
    };

export function planPreviewLaunch(
  args: readonly string[],
  io: PreviewIoState
): PreviewLaunchPlan {
  const parsed = parseCliArgs(args);

  if (parsed.kind === "launch" && io.stdinIsTty && io.stdoutIsTty) {
    return {
      kind: "terminal",
      launchShortcut: parsed.launchShortcut
    };
  }

  return {
    kind: "text",
    args
  };
}
