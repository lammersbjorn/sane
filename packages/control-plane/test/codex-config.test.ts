import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createProjectPaths, createCodexPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyCloudflareProfile,
  applyCodexProfile,
  applyIntegrationsProfile,
  applyOpencodeProfile,
  backupCodexConfig,
  inspectCloudflareProfileAudit,
  inspectCloudflareProfileApplyResult,
  inspectCloudflareProfileSnapshot,
  inspectCloudflareProfileStatus,
  inspectCodexConfigBackupSnapshot,
  inspectCodexProfileFamilySnapshot,
  inspectCodexProfileApplyResult,
  inspectCodexProfileAudit,
  inspectCodexProfileSnapshot,
  inspectCodexProfileStatus,
  inspectIntegrationsProfileAudit,
  inspectIntegrationsProfileApplyResult,
  inspectIntegrationsProfileSnapshot,
  inspectIntegrationsProfileStatus,
  inspectOpencodeProfileAudit,
  inspectOpencodeProfileApplyResult,
  inspectOpencodeProfileSnapshot,
  inspectOpencodeProfileStatus,
  inspectStatuslineProfileAudit,
  inspectStatuslineProfileApplyResult,
  inspectStatuslineProfileSnapshot,
  inspectStatuslineProfileStatus,
  previewCloudflareProfile,
  previewCodexProfile,
  previewIntegrationsProfile,
  previewOpencodeProfile,
  previewStatuslineProfile,
  restoreCodexConfig,
  showCodexConfig,
  applyStatuslineProfile
} from "../src/codex-config.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-codex-config-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("codex config control plane", () => {
  it("previews missing codex config and reports recommended core changes", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    const result = previewCodexProfile(codexPaths);

    expect(result.summary).toBe("codex-profile preview: 3 recommended change(s)");
    expect(result.details).toContain("model: <missing> -> gpt-5.4");
    expect(result.details).toContain("reasoning: <missing> -> high");
    expect(result.details).toContain("codex hooks: <missing> -> enabled");
    expect(result.details).toContain("note: this writes the single-session Codex baseline only");
    expect(result.details).toContain(
      "note: broader execution and realtime routing stays derived outside config.toml"
    );
    expect(result.details).toContain("note: Codex native memories stay outside Sane's default continuity path");
    expect(result.details).toContain("note: integrations stay outside bare core profile");
    expect(result.inventory[0]?.path).toBe(codexPaths.configToml);
    expect(result.pathsTouched).toEqual([codexPaths.configToml]);
    expect(projectRoot).not.toBe("");
  });

  it("shows missing codex config with create hint", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    const result = showCodexConfig(codexPaths);

    expect(result.summary).toBe(`codex-config: missing at ${codexPaths.configToml}`);
    expect(result.details).toContain("no user Codex config exists yet");
    expect(result.details).toContain(
      "use `apply codex-profile` or `apply integrations-profile` to create one"
    );
  });

  it("shows native memories and tui footer state from existing codex config", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        'model = "gpt-5.4"',
        'model_reasoning_effort = "high"',
        "",
        "[features]",
        "codex_hooks = true",
        "memories = true",
        "",
        "[tui]",
        'notification_condition = "always"',
        'status_line = ["model-with-reasoning", "project-root"]',
        'terminal_title = ["project", "spinner"]',
        'theme = "zenburn"',
        ""
      ].join("\n"),
      "utf8"
    );

    const result = showCodexConfig(codexPaths);

    expect(result.summary).toBe(`codex-config: ok at ${codexPaths.configToml}`);
    expect(result.details).toContain("codex memories: enabled");
    expect(result.details).toContain("tui status line: model-with-reasoning, project-root");
    expect(result.details).toContain("tui terminal title: project, spinner");
    expect(result.details).toContain("tui notifications: always");
    expect(result.details).toContain("tui theme: zenburn");
  });

  it("applies core codex profile into a new config file", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const result = applyCodexProfile(projectPaths, codexPaths);
    const body = readFileSync(codexPaths.configToml, "utf8");

    expect(result.summary).toBe("codex-profile apply: wrote recommended core profile");
    expect(result.details).toContain("applied keys: model, model_reasoning_effort, features.codex_hooks");
    expect(result.details).toContain("note: this writes the single-session Codex baseline only");
    expect(result.details).toContain("backup: skipped (no prior config existed)");
    expect(body).toContain('model = "gpt-5.4"');
    expect(body).toContain('model_reasoning_effort = "high"');
    expect(body).toContain("[features]");
    expect(body).toContain("codex_hooks = true");
  });

  it("applies integrations profile additively and keeps opensrc untouched", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        '[mcp_servers.opensrc]',
        'url = "https://mcp.opensrc.dev"',
        ""
      ].join("\n"),
      "utf8"
    );

    const result = applyIntegrationsProfile(projectPaths, codexPaths);
    const body = readFileSync(codexPaths.configToml, "utf8");

    expect(result.summary).toBe("integrations-profile apply: wrote recommended integrations");
    expect(result.details).toContain("opensrc left untouched");
    expect(body).toContain("[mcp_servers.context7]");
    expect(body).toContain('url = "https://mcp.context7.com/mcp"');
    expect(body).toContain("[mcp_servers.playwright]");
    expect(body).toContain('command = "npx"');
    expect(body).toContain('"@playwright/mcp@latest"');
    expect(body).toContain("[mcp_servers.grep_app]");
    expect(body).toContain('url = "https://mcp.grep.app"');
    expect(body).toContain("[mcp_servers.opensrc]");
    expect(result.pathsTouched.some((path) => path.startsWith(projectPaths.codexConfigBackupsDir))).toBe(true);
  });

  it("applies cloudflare profile once and reports already satisfied on repeat", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(previewCloudflareProfile(codexPaths).details).toContain(
      "cloudflare-api: missing -> optional provider profile"
    );

    const first = applyCloudflareProfile(projectPaths, codexPaths);
    const second = applyCloudflareProfile(projectPaths, codexPaths);
    const body = readFileSync(codexPaths.configToml, "utf8");

    expect(first.summary).toBe("cloudflare-profile apply: wrote optional provider profile");
    expect(second.summary).toBe("cloudflare-profile apply: already satisfied");
    expect(body).toContain("[mcp_servers.cloudflare-api]");
    expect(body).toContain('url = "https://mcp.cloudflare.com/mcp"');
  });

  it("applies optional opencode compatibility profile once and reports already satisfied on repeat", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(previewOpencodeProfile(codexPaths).details).toContain(
      "opensrc: missing -> optional Opencode compatibility profile"
    );

    const first = applyOpencodeProfile(projectPaths, codexPaths);
    const second = applyOpencodeProfile(projectPaths, codexPaths);
    const body = readFileSync(codexPaths.configToml, "utf8");

    expect(first.summary).toBe("opencode-profile apply: wrote optional compatibility profile");
    expect(second.summary).toBe("opencode-profile apply: already satisfied");
    expect(body).toContain("[mcp_servers.opensrc]");
    expect(body).toContain('url = "https://mcp.opensrc.dev"');
  });

  it("backs up and restores the latest codex config snapshot", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        'model = "gpt-5.2-codex"',
        'model_reasoning_effort = "medium"',
        ""
      ].join("\n"),
      "utf8"
    );

    const backup = backupCodexConfig(projectPaths, codexPaths);
    writeFileSync(
      codexPaths.configToml,
      [
        'model = "gpt-5.4"',
        'model_reasoning_effort = "high"',
        ""
      ].join("\n"),
      "utf8"
    );
    const restore = restoreCodexConfig(projectPaths, codexPaths);
    const body = readFileSync(codexPaths.configToml, "utf8");

    expect(backup.summary).toContain("codex-config backup: wrote");
    expect(previewIntegrationsProfile(codexPaths).summary).toBe(
      "integrations-profile preview: 3 recommended change(s)"
    );
    expect(inspectCodexConfigBackupSnapshot(projectPaths)).toEqual({
      restoreAvailable: true,
      backupCount: 1,
      latestBackupPath: expect.stringContaining(projectPaths.codexConfigBackupsDir)
    });
    expect(restore.summary).toContain("codex-config restore: restored from");
    expect(body).toContain('model = "gpt-5.2-codex"');
    expect(body).toContain('model_reasoning_effort = "medium"');
  });

  it("ignores stray backup-dir entries when reporting and restoring backups", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        'model = "gpt-5.2-codex"',
        'model_reasoning_effort = "medium"',
        ""
      ].join("\n"),
      "utf8"
    );

    backupCodexConfig(projectPaths, codexPaths);
    mkdirSync(projectPaths.codexConfigBackupsDir, { recursive: true });
    writeFileSync(join(projectPaths.codexConfigBackupsDir, "notes.txt"), "ignore me\n", "utf8");
    mkdirSync(join(projectPaths.codexConfigBackupsDir, "config-9999999999.toml"));
    writeFileSync(
      codexPaths.configToml,
      [
        'model = "gpt-5.4"',
        'model_reasoning_effort = "high"',
        ""
      ].join("\n"),
      "utf8"
    );

    const snapshot = inspectCodexConfigBackupSnapshot(projectPaths);
    const restore = restoreCodexConfig(projectPaths, codexPaths);
    const body = readFileSync(codexPaths.configToml, "utf8");

    expect(snapshot).toEqual({
      restoreAvailable: true,
      backupCount: 1,
      latestBackupPath: expect.stringContaining(projectPaths.codexConfigBackupsDir)
    });
    expect(restore.summary).toContain("codex-config restore: restored from");
    expect(restore.summary).not.toContain("notes.txt");
    expect(body).toContain('model = "gpt-5.2-codex"');
    expect(body).toContain('model_reasoning_effort = "medium"');
  });

  it("reports structured integrations audit state without scraping preview strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectIntegrationsProfileAudit(codexPaths)).toMatchObject({
      status: "missing",
      recommendedChangeCount: 3,
      recommendedTargets: ["context7", "playwright", "grep.app"],
      optionalTargets: ["opensrc"]
    });

    applyIntegrationsProfile(projectPaths, codexPaths);

    expect(inspectIntegrationsProfileAudit(codexPaths)).toMatchObject({
      status: "installed",
      recommendedChangeCount: 0,
      recommendedTargets: [],
      optionalTargets: ["opensrc"]
    });
  });

  it("reports integrations-profile status through a narrow helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectIntegrationsProfileStatus(codexPaths)).toBe("missing");

    applyIntegrationsProfile(projectPaths, codexPaths);

    expect(inspectIntegrationsProfileStatus(codexPaths)).toBe("installed");
  });

  it("reports typed profile snapshot helpers from one read path", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectCodexProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "missing", recommendedChangeCount: 3 }),
      apply: expect.objectContaining({ status: "ready", recommendedChangeCount: 3 }),
      preview: expect.objectContaining({
        summary: "codex-profile preview: 3 recommended change(s)"
      })
    });
    expect(inspectIntegrationsProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "missing", recommendedChangeCount: 3 }),
      apply: expect.objectContaining({ status: "ready", recommendedChangeCount: 3 }),
      preview: expect.objectContaining({
        summary: "integrations-profile preview: 3 recommended change(s)"
      })
    });
    expect(inspectCloudflareProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "missing", recommendedChangeCount: 1 }),
      apply: expect.objectContaining({ status: "ready", recommendedChangeCount: 1 }),
      preview: expect.objectContaining({
        summary: "cloudflare-profile preview: 1 recommended change(s)"
      })
    });
    expect(inspectOpencodeProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "missing", recommendedChangeCount: 1 }),
      apply: expect.objectContaining({ status: "ready", recommendedChangeCount: 1 }),
      preview: expect.objectContaining({
        summary: "opencode-profile preview: 1 recommended change(s)"
      })
    });
    expect(inspectStatuslineProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "missing", recommendedChangeCount: 3 }),
      apply: expect.objectContaining({ status: "ready", recommendedChangeCount: 3 }),
      preview: expect.objectContaining({
        summary: "statusline-profile preview: 3 recommended change(s)"
      })
    });

    applyCodexProfile(projectPaths, codexPaths);
    applyIntegrationsProfile(projectPaths, codexPaths);
    applyCloudflareProfile(projectPaths, codexPaths);
    applyOpencodeProfile(projectPaths, codexPaths);
    applyStatuslineProfile(projectPaths, codexPaths);

    expect(inspectCodexProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "installed", recommendedChangeCount: 0 }),
      apply: expect.objectContaining({ status: "already_satisfied", recommendedChangeCount: 0 })
    });
    expect(inspectIntegrationsProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "installed", recommendedChangeCount: 0 }),
      apply: expect.objectContaining({ status: "already_satisfied", recommendedChangeCount: 0 })
    });
    expect(inspectCloudflareProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "installed", recommendedChangeCount: 0 }),
      apply: expect.objectContaining({ status: "already_satisfied", recommendedChangeCount: 0 })
    });
    expect(inspectOpencodeProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "installed", recommendedChangeCount: 0 }),
      apply: expect.objectContaining({ status: "already_satisfied", recommendedChangeCount: 0 })
    });
    expect(inspectStatuslineProfileSnapshot(codexPaths)).toMatchObject({
      audit: expect.objectContaining({ status: "installed", recommendedChangeCount: 0 }),
      apply: expect.objectContaining({ status: "already_satisfied", recommendedChangeCount: 0 })
    });
  });

  it("keeps family snapshot aligned with per-profile snapshot helpers", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const missingFamily = inspectCodexProfileFamilySnapshot(codexPaths);
    expect(missingFamily.core).toEqual(inspectCodexProfileSnapshot(codexPaths));
    expect(missingFamily.integrations).toEqual(inspectIntegrationsProfileSnapshot(codexPaths));
    expect(missingFamily.cloudflare).toEqual(inspectCloudflareProfileSnapshot(codexPaths));
    expect(missingFamily.opencode).toEqual(inspectOpencodeProfileSnapshot(codexPaths));
    expect(missingFamily.statusline).toEqual(inspectStatuslineProfileSnapshot(codexPaths));

    applyCodexProfile(projectPaths, codexPaths);
    applyIntegrationsProfile(projectPaths, codexPaths);
    applyCloudflareProfile(projectPaths, codexPaths);
    applyOpencodeProfile(projectPaths, codexPaths);
    applyStatuslineProfile(projectPaths, codexPaths);

    const installedFamily = inspectCodexProfileFamilySnapshot(codexPaths);
    expect(installedFamily.core).toEqual(inspectCodexProfileSnapshot(codexPaths));
    expect(installedFamily.integrations).toEqual(inspectIntegrationsProfileSnapshot(codexPaths));
    expect(installedFamily.cloudflare).toEqual(inspectCloudflareProfileSnapshot(codexPaths));
    expect(installedFamily.opencode).toEqual(inspectOpencodeProfileSnapshot(codexPaths));
    expect(installedFamily.statusline).toEqual(inspectStatuslineProfileSnapshot(codexPaths));
  });

  it("reports invalid family snapshot members consistently from one broken config", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, 'model = "gpt-5.4"\ninvalid = [\n', "utf8");

    const family = inspectCodexProfileFamilySnapshot(codexPaths);

    expect(family).toMatchObject({
      core: {
        audit: { status: "invalid", recommendedChangeCount: 0 },
        apply: { status: "blocked_invalid", recommendedChangeCount: 0 },
        preview: { summary: "codex-profile preview: blocked by invalid config" }
      },
      integrations: {
        audit: { status: "invalid", recommendedChangeCount: 0 },
        apply: { status: "blocked_invalid", recommendedChangeCount: 0 },
        preview: { summary: "integrations-profile preview: blocked by invalid config" }
      },
      cloudflare: {
        audit: { status: "invalid", recommendedChangeCount: 0 },
        apply: { status: "blocked_invalid", recommendedChangeCount: 0 },
        preview: { summary: "cloudflare-profile preview: blocked by invalid config" }
      },
      opencode: {
        audit: { status: "invalid", recommendedChangeCount: 0 },
        apply: { status: "blocked_invalid", recommendedChangeCount: 0 },
        preview: { summary: "opencode-profile preview: blocked by invalid config" }
      },
      statusline: {
        audit: { status: "invalid", recommendedChangeCount: 0 },
        apply: { status: "blocked_invalid", recommendedChangeCount: 0 },
        preview: { summary: "statusline-profile preview: blocked by invalid config" }
      }
    });
  });

  it("reports typed integrations-profile apply result without scraping apply summary strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectIntegrationsProfileApplyResult(codexPaths)).toMatchObject({
      status: "ready",
      recommendedChangeCount: 3,
      appliedKeys: ["mcp_servers.context7", "mcp_servers.playwright", "mcp_servers.grep_app"]
    });

    applyIntegrationsProfile(projectPaths, codexPaths);

    expect(inspectIntegrationsProfileApplyResult(codexPaths)).toMatchObject({
      status: "already_satisfied",
      recommendedChangeCount: 0,
      appliedKeys: []
    });
  });

  it("reports structured cloudflare-profile audit state without scraping preview strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectCloudflareProfileAudit(codexPaths)).toMatchObject({
      status: "missing",
      recommendedChangeCount: 1,
      target: "cloudflare-api"
    });

    applyCloudflareProfile(projectPaths, codexPaths);

    expect(inspectCloudflareProfileAudit(codexPaths)).toMatchObject({
      status: "installed",
      recommendedChangeCount: 0,
      target: "cloudflare-api"
    });
  });

  it("reports cloudflare-profile status through a narrow helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectCloudflareProfileStatus(codexPaths)).toBe("missing");

    applyCloudflareProfile(projectPaths, codexPaths);

    expect(inspectCloudflareProfileStatus(codexPaths)).toBe("installed");
  });

  it("reports typed cloudflare-profile apply result without scraping apply summary strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectCloudflareProfileApplyResult(codexPaths)).toMatchObject({
      status: "ready",
      recommendedChangeCount: 1,
      appliedKeys: ["mcp_servers.cloudflare-api"]
    });

    applyCloudflareProfile(projectPaths, codexPaths);

    expect(inspectCloudflareProfileApplyResult(codexPaths)).toMatchObject({
      status: "already_satisfied",
      recommendedChangeCount: 0,
      appliedKeys: []
    });
  });

  it("reports structured opencode-profile audit state without scraping preview strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectOpencodeProfileAudit(codexPaths)).toMatchObject({
      status: "missing",
      recommendedChangeCount: 1,
      target: "opensrc"
    });

    applyOpencodeProfile(projectPaths, codexPaths);

    expect(inspectOpencodeProfileAudit(codexPaths)).toMatchObject({
      status: "installed",
      recommendedChangeCount: 0,
      target: "opensrc"
    });
  });

  it("reports opencode-profile status through a narrow helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectOpencodeProfileStatus(codexPaths)).toBe("missing");

    applyOpencodeProfile(projectPaths, codexPaths);

    expect(inspectOpencodeProfileStatus(codexPaths)).toBe("installed");
  });

  it("reports typed opencode-profile apply result without scraping apply summary strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectOpencodeProfileApplyResult(codexPaths)).toMatchObject({
      status: "ready",
      recommendedChangeCount: 1,
      appliedKeys: ["mcp_servers.opensrc"]
    });

    applyOpencodeProfile(projectPaths, codexPaths);

    expect(inspectOpencodeProfileApplyResult(codexPaths)).toMatchObject({
      status: "already_satisfied",
      recommendedChangeCount: 0,
      appliedKeys: []
    });
  });

  it("reports structured statusline-profile audit state without scraping preview strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectStatuslineProfileAudit(codexPaths)).toMatchObject({
      status: "missing",
      recommendedChangeCount: 3
    });

    applyStatuslineProfile(projectPaths, codexPaths);

    expect(inspectStatuslineProfileAudit(codexPaths)).toMatchObject({
      status: "installed",
      recommendedChangeCount: 0
    });
  });

  it("reports statusline-profile status through a narrow helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectStatuslineProfileStatus(codexPaths)).toBe("missing");

    applyStatuslineProfile(projectPaths, codexPaths);

    expect(inspectStatuslineProfileStatus(codexPaths)).toBe("installed");
  });

  it("reports typed statusline-profile apply result without scraping apply summary strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectStatuslineProfileApplyResult(codexPaths)).toMatchObject({
      status: "ready",
      recommendedChangeCount: 3,
      appliedKeys: [
        "tui.notification_condition",
        "tui.status_line",
        "tui.terminal_title"
      ]
    });

    applyStatuslineProfile(projectPaths, codexPaths);

    expect(inspectStatuslineProfileApplyResult(codexPaths)).toMatchObject({
      status: "already_satisfied",
      recommendedChangeCount: 0,
      appliedKeys: []
    });
  });

  it("reports structured codex-profile audit state without scraping preview strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectCodexProfileAudit(codexPaths)).toMatchObject({
      status: "missing",
      recommendedChangeCount: 3,
      changes: [
        { key: "model", current: null, recommended: "gpt-5.4" },
        { key: "model_reasoning_effort", current: null, recommended: "high" },
        { key: "features.codex_hooks", current: null, recommended: "enabled" }
      ]
    });

    applyCodexProfile(projectPaths, codexPaths);

    expect(inspectCodexProfileAudit(codexPaths)).toMatchObject({
      status: "installed",
      recommendedChangeCount: 0,
      changes: []
    });
  });

  it("reports codex-profile status through a narrow helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectCodexProfileStatus(codexPaths)).toBe("missing");

    applyCodexProfile(projectPaths, codexPaths);

    expect(inspectCodexProfileStatus(codexPaths)).toBe("installed");
  });

  it("reports typed codex-profile apply result without scraping apply summary strings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectCodexProfileApplyResult(codexPaths)).toMatchObject({
      status: "ready",
      recommendedChangeCount: 3,
      appliedKeys: ["model", "model_reasoning_effort", "features.codex_hooks"]
    });

    applyCodexProfile(projectPaths, codexPaths);

    expect(inspectCodexProfileApplyResult(codexPaths)).toMatchObject({
      status: "already_satisfied",
      recommendedChangeCount: 0,
      appliedKeys: []
    });
  });

  it("keeps codex-profile preview summary count aligned with structured audit", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      ['model = "gpt-5.4"', 'model_reasoning_effort = "low"', "[features]", "codex_hooks = true", ""].join(
        "\n"
      ),
      "utf8"
    );

    const audit = inspectCodexProfileAudit(codexPaths);
    const preview = previewCodexProfile(codexPaths);

    expect(audit).toMatchObject({
      status: "missing",
      recommendedChangeCount: 1,
      changes: [{ key: "model_reasoning_effort", current: "low", recommended: "high" }]
    });
    expect(preview.summary).toBe("codex-profile preview: 1 recommended change(s)");
  });

  it("keeps cloudflare-profile preview summary count aligned with structured audit", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);
    const audit = inspectCloudflareProfileAudit(codexPaths);
    const preview = previewCloudflareProfile(codexPaths);

    expect(audit).toMatchObject({
      status: "missing",
      recommendedChangeCount: 1
    });
    expect(preview.summary).toBe("cloudflare-profile preview: 1 recommended change(s)");
  });

  it("keeps opencode-profile preview summary count aligned with structured audit", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);
    const audit = inspectOpencodeProfileAudit(codexPaths);
    const preview = previewOpencodeProfile(codexPaths);

    expect(audit).toMatchObject({
      status: "missing",
      recommendedChangeCount: 1
    });
    expect(preview.summary).toBe("opencode-profile preview: 1 recommended change(s)");
  });

  it("keeps statusline-profile preview summary count aligned with structured audit", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);
    const audit = inspectStatuslineProfileAudit(codexPaths);
    const preview = previewStatuslineProfile(codexPaths);

    expect(audit).toMatchObject({
      status: "missing",
      recommendedChangeCount: 3
    });
    expect(preview.summary).toBe("statusline-profile preview: 3 recommended change(s)");
  });
});
