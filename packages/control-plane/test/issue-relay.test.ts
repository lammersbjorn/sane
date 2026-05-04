import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createProjectPaths } from "../src/platform.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildIssueRelayDraft,
  setIssueRelayGhRunnerForTest,
  submitIssueRelayDraft,
  writeIssueRelayDraft
} from "../src/issue-relay.js";
import { saveConfig } from "../src/preferences.js";
import { inspectTelemetryLedger } from "../src/telemetry.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-issue-relay-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  setIssueRelayGhRunnerForTest(null);
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("issue relay", () => {
  it("builds a sanitized local draft without enabling submit", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.issueRelay.mode = "issue-review";
    config.privacy.telemetry = "local-only";
    const draft = buildIssueRelayDraft(paths, {
      category: "self-repair failure",
      sourceCommand: "doctor",
      summary: `Failed in ${paths.projectRoot} on branch feature/private-branch with token=abc123`,
      saneVersion: "1.0.0-beta.1",
      platform: "linux",
      error: `Error at ${paths.configPath}: response: private answer; function leak() { return "code"; }`,
      reproductionSteps: [
        `Run from ${paths.projectRoot}`,
        "Paste prompt: fix my private repo with ghp_123456789abcdef",
        "import fs from 'node:fs';"
      ]
    }, config);

    expect(draft.mode).toBe("issue-review");
    expect(draft.title).toContain("[self-repair-failure]");
    expect(draft.body).toContain("token=<redacted>");
    expect(draft.body).toContain("<local-path>");
    expect(draft.body).toContain("[details omitted: code-like content]");
    expect(draft.body).toContain("telemetry consent alone is not permission");
    expect(draft.body).not.toContain(projectRoot);
    expect(draft.body).not.toContain(paths.configPath);
    expect(draft.body).not.toContain("function leak");
    expect(draft.body).not.toContain("feature/private-branch");
    expect(draft.body).not.toContain("fix my private repo");
    expect(draft.body).not.toContain("private answer");
    expect(draft.body).not.toContain("ghp_123456789abcdef");
    expect(draft.duplicateSearchTerms).toContain(draft.fingerprint);
  });

  it("sanitizes long untrusted draft tokens without regex backtracking", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.issueRelay.mode = "issue-review";

    const draft = buildIssueRelayDraft(paths, {
      category: `${" ".repeat(1000)}self ${"!".repeat(1000)}repair`,
      sourceCommand: `${" ".repeat(1000)}doctor ${"!".repeat(1000)}run`,
      summary: "Hooks invalid"
    }, config);

    expect(draft.title).toContain("[self-repair]");
    expect(draft.body).toContain("- category: self-repair");
    expect(draft.body).toContain("- source command: doctor-run");
  });

  it("does not write a draft while issue relay is off", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.privacy.telemetry = "product-improvement";
    saveConfig(paths, config);

    const result = writeIssueRelayDraft(paths, {
      category: "doctor",
      sourceCommand: "doctor",
      summary: "Hooks invalid"
    });

    expect(result.summary).toBe("issue relay: disabled");
    expect(result.details).toContain("telemetry consent does not enable GitHub reporting");
    expect(existsSync(join(paths.runtimeRoot, "issue-relay"))).toBe(false);
    expect(inspectTelemetryLedger(paths).summary?.counts["issue-relay.draft.blocked"]).toBe(1);
  });

  it("writes a reviewable local markdown draft when explicitly enabled", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.issueRelay.mode = "draft-local";
    saveConfig(paths, config);

    const result = writeIssueRelayDraft(paths, {
      category: "managed-export-drift",
      sourceCommand: "show_status",
      summary: "Core skill export drifted"
    });
    const draftPath = result.pathsTouched[0]!;
    const body = readFileSync(draftPath, "utf8");

    expect(result.summary).toContain("issue relay: draft written");
    expect(result.details).toContain("submit: not run; review required before GitHub issue submit; PR relay is separate");
    expect(body).toContain("# [managed-export-drift] Core skill export drifted");
    expect(body).toContain("## Duplicate search terms");
    expect(body).toContain("## Privacy boundary");
  });

  it("blocks GitHub submit unless issue relay submit mode is explicitly enabled", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.issueRelay.mode = "draft-local";
    saveConfig(paths, config);
    const draft = writeIssueRelayDraft(paths, {
      category: "doctor",
      sourceCommand: "doctor",
      summary: "Hooks invalid"
    });

    config.issueRelay.mode = "draft-local";
    saveConfig(paths, config);
    const result = submitIssueRelayDraft(paths, {
      draftPath: draft.pathsTouched[0]!
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe("issue relay: submit blocked");
    expect(result.details).toContain("telemetry consent does not enable GitHub reporting");
  });

  it("blocks issue submit in pr-review mode because PR relay is a separate flow", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.issueRelay.mode = "draft-local";
    saveConfig(paths, config);
    const draft = writeIssueRelayDraft(paths, {
      category: "doctor",
      sourceCommand: "doctor",
      summary: "Hooks invalid"
    });

    config.issueRelay.mode = "pr-review";
    saveConfig(paths, config);
    const result = submitIssueRelayDraft(paths, {
      draftPath: draft.pathsTouched[0]!
    });

    expect(result.status).toBe("blocked");
    expect(result.details).toContain("issue submit requires issue-relay mode issue-review");
  });

  it("checks duplicates before creating a GitHub issue", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.issueRelay.mode = "issue-review";
    config.privacy.telemetry = "local-only";
    saveConfig(paths, config);
    const draft = writeIssueRelayDraft(paths, {
      category: "doctor",
      sourceCommand: "doctor",
      summary: "Hooks invalid"
    });
    const gh = vi.fn((args: string[]) => {
      expect(args[0]).toBe("issue");
      if (args[1] === "list") {
        return JSON.stringify([{ number: 42, title: "Hooks invalid already", url: "https://github.test/i/42" }]);
      }
      throw new Error("create should not run");
    });
    setIssueRelayGhRunnerForTest(gh);

    const result = submitIssueRelayDraft(paths, {
      draftPath: draft.pathsTouched[0]!,
      repo: "sane/sane"
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe("issue relay: possible duplicate issues found");
    expect(result.details.join("\n")).toContain("#42: Hooks invalid already");
    expect(gh).not.toHaveBeenCalledWith(expect.arrayContaining(["create"]));
  });

  it("submits a reviewed draft with gh when duplicates are clear", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.issueRelay.mode = "issue-review";
    config.privacy.telemetry = "local-only";
    saveConfig(paths, config);
    const draft = writeIssueRelayDraft(paths, {
      category: "doctor",
      sourceCommand: "doctor",
      summary: "Hooks invalid"
    });
    const gh = vi.fn((args: string[]) => {
      if (args[1] === "list") {
        return "[]";
      }
      expect(args).toEqual([
        "issue",
        "create",
        "--repo",
        "sane/sane",
        "--title",
        "[doctor] Hooks invalid",
        "--body-file",
        realpathSync(draft.pathsTouched[0]!)
      ]);
      return "https://github.test/i/43\n";
    });
    setIssueRelayGhRunnerForTest(gh);

    const result = submitIssueRelayDraft(paths, {
      draftPath: draft.pathsTouched[0]!,
      repo: "sane/sane"
    });

    expect(result.status).toBe("ok");
    expect(result.summary).toBe("issue relay: GitHub issue submitted");
    expect(result.details).toContain("url: https://github.test/i/43");
    expect(inspectTelemetryLedger(paths).summary?.counts["issue-relay.submit.submitted"]).toBe(1);
  });

  it("blocks symlink drafts and edited drafts without duplicate search terms", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.issueRelay.mode = "issue-review";
    saveConfig(paths, config);
    const draft = writeIssueRelayDraft(paths, {
      category: "doctor",
      sourceCommand: "doctor",
      summary: "Hooks invalid"
    });
    const outsideDraft = join(projectRoot, "outside.md");
    const symlinkDraft = join(paths.runtimeRoot, "issue-relay", "linked.md");
    writeFileSync(outsideDraft, readFileSync(draft.pathsTouched[0]!, "utf8"));
    symlinkSync(outsideDraft, symlinkDraft);

    const symlinkResult = submitIssueRelayDraft(paths, {
      draftPath: symlinkDraft
    });

    expect(symlinkResult.status).toBe("blocked");
    expect(symlinkResult.details).toContain("draft file must not be a symlink");

    const editedDraft = draft.pathsTouched[0]!;
    writeFileSync(
      editedDraft,
      readFileSync(editedDraft, "utf8").replace(/## Duplicate search terms\n(?:- .+\n)+/, "## Duplicate search terms\n"),
      "utf8"
    );
    const editedResult = submitIssueRelayDraft(paths, {
      draftPath: editedDraft
    });

    expect(editedResult.status).toBe("blocked");
    expect(editedResult.details).toContain("draft file is not a Sane issue relay draft");
  });
});
