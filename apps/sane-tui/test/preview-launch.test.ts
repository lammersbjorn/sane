import { describe, expect, it } from "vitest";

import { planPreviewLaunch } from "@sane/sane-tui/preview-launch.js";

describe("preview launch planning", () => {
  it("uses the live terminal path for launch commands on a tty", () => {
    expect(
      planPreviewLaunch([], {
        stdinIsTty: true,
        stdoutIsTty: true
      })
    ).toEqual({
      kind: "terminal",
      launchShortcut: "default"
    });

    expect(
      planPreviewLaunch(["settings"], {
        stdinIsTty: true,
        stdoutIsTty: true
      })
    ).toEqual({
      kind: "terminal",
      launchShortcut: "settings"
    });
  });

  it("falls back to text rendering when tty is unavailable", () => {
    expect(
      planPreviewLaunch(["settings"], {
        stdinIsTty: false,
        stdoutIsTty: true
      })
    ).toEqual({
      kind: "text",
      args: ["settings"]
    });
  });

  it("keeps backend commands on the text path even on a tty", () => {
    expect(
      planPreviewLaunch(["install"], {
        stdinIsTty: true,
        stdoutIsTty: true
      })
    ).toEqual({
      kind: "text",
      args: ["install"]
    });
  });
});
