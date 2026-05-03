import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createProjectPaths, createCodexPaths } from "@sane/platform";
import { InventoryStatus } from "@sane/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyCloudflareProfile,
  applyCodexProfile,
  applyIntegrationsProfile,
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
  inspectStatuslineProfileAudit,
  inspectStatuslineProfileApplyResult,
  inspectStatuslineProfileSnapshot,
  inspectStatuslineProfileStatus,
  previewCloudflareProfile,
  previewCodexProfile,
  previewIntegrationsProfile,
  previewStatuslineProfile,
  restoreCodexConfig,
  showCodexConfig,
  applyStatuslineProfile
} from "../src/codex-config.js";
import { inspectStatusBundle } from "../src/inventory.js";

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

    expect(result.summary).toBe("codex-profile preview: 4 recommended change(s)");
    expect(result.details).toContain("model: <missing> -> gpt-5.5");
    expect(result.details).toContain("reasoning: <missing> -> low");
    expect(result.details).toContain("compact prompt: <missing> -> Sane continuity prompt");
    expect(result.details).toContain("codex hooks: <missing> -> enabled");
    expect(result.details).toContain("note: this writes the single-session Codex baseline only");
    expect(result.details).toContain(
      "note: broader execution and realtime routing stays derived outside config.toml"
    );
    expect(result.details).toContain("note: Codex native memories stay outside Sane's default continuity path");
    expect(result.details).toContain("note: Codex tool settings stay outside the core Codex settings");
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

  it("shows native memories and statusline state from existing codex config", () => {
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
    expect(result.details).toContain("tui theme: zenburn (display-only, not Sane-managed)");
  });

  it("classifies compatibility-only codex config keys without managing them", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        "[features]",
        "memories = true",
        "",
        "[tui]",
        'theme = "zenburn"',
        "",
        "[plugins.local_lab]",
        "enabled = true",
        "",
        "[mcp_servers.experimental_sidecar]",
        'command = "experimental"'
      ].join("\n"),
      "utf8"
    );

    const family = inspectCodexProfileFamilySnapshot(codexPaths);
    const bundle = inspectStatusBundle(projectPaths, codexPaths);

    expect(family.codexConfig.details).toContain("codex memories: enabled");
    expect(family.codexConfig.details).toContain("enabled plugins: 1");
    expect(family.codexConfig.details).toContain("mcp server names: experimental_sidecar");
    expect(family.codexConfig.details).toContain("tui theme: zenburn (display-only, not Sane-managed)");
    expect(bundle.conflictWarnings.map((warning) => warning.kind)).toEqual([
      "unmanaged_mcp_server",
      "codex_native_memories_enabled",
      "unsupported_tui_theme",
      "unmanaged_plugin"
    ]);
    expect(bundle.conflictWarnings.find((warning) => warning.target === "tui.theme")).toEqual({
      kind: "unsupported_tui_theme",
      target: "tui.theme",
      path: codexPaths.configToml,
      message:
        "Codex TUI theme 'zenburn' is display-only in Sane; warning-only, no auto-apply or auto-remove"
    });
  });

  it("shows invalid codex config without pretending the config is ok", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, 'model = "gpt-5.4"\ninvalid = [\n', "utf8");

    const result = showCodexConfig(codexPaths);

    expect(result.summary).toBe(`codex-config: invalid at ${codexPaths.configToml}`);
    expect(result.details).toContain(
      "cannot read Codex config until ~/.codex/config.toml parses cleanly"
    );
    expect(result.details).toContain("repair ~/.codex/config.toml first");
  });

  it("applies core codex profile into a new config file", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const result = applyCodexProfile(projectPaths, codexPaths);
    const body = readFileSync(codexPaths.configToml, "utf8");

    expect(result.summary).toBe("codex-profile apply: wrote recommended core profile");
    expect(result.details).toContain("applied keys: model, model_reasoning_effort, compact_prompt, features.codex_hooks");
    expect(result.details).toContain("note: this writes the single-session Codex baseline only");
    expect(result.details).toContain("backup: skipped (no prior config existed)");
    expect(body).toContain('model = "gpt-5.5"');
    expect(body).toContain('model_reasoning_effort = "low"');
    expect(body).toContain("compact_prompt =");
    expect(body).toContain("Fresh Rules");
    expect(body).toContain("Do not add generated repo overviews");
    expect(body).toContain("[features]");
    expect(body).toContain("codex_hooks = true");
  });

  it("applies integrations profile additively", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const result = applyIntegrationsProfile(projectPaths, codexPaths);
    const body = readFileSync(codexPaths.configToml, "utf8");

    expect(result.summary).toBe("integrations-profile apply: wrote recommended integrations");
    expect(body).toContain("[mcp_servers.context7]");
    expect(body).toContain('url = "https://mcp.context7.com/mcp"');
    expect(body).toContain("[mcp_servers.playwright]");
    expect(body).toContain('command = "npx"');
    expect(body).toContain('"@playwright/mcp@latest"');
    expect(body).toContain("[mcp_servers.grep_app]");
    expect(body).toContain('url = "https://mcp.grep.app"');
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
        'model = "gpt-5.2"',
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
    expect(body).toContain('model = "gpt-5.2"');
    expect(body).toContain('model_reasoning_effort = "medium"');
  });

  it("does not overwrite codex config backups created in the same second", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, 'model = "gpt-5.2"\n', "utf8");
    const first = backupCodexConfig(projectPaths, codexPaths);
    writeFileSync(codexPaths.configToml, 'model = "gpt-5.4"\n', "utf8");
    const second = backupCodexConfig(projectPaths, codexPaths);

    expect(first.pathsTouched[1]).not.toBe(second.pathsTouched[1]);
    expect(inspectCodexConfigBackupSnapshot(projectPaths)).toMatchObject({
      restoreAvailable: true,
      backupCount: 2,
      latestBackupPath: second.pathsTouched[1]
    });
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
        'model = "gpt-5.2"',
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
    expect(body).toContain('model = "gpt-5.2"');
    expect(body).toContain('model_reasoning_effort = "medium"');
  });

  it("reports actual inventory after restoring invalid backup content", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(projectPaths.codexConfigBackupsDir, { recursive: true });
    writeFileSync(join(projectPaths.codexConfigBackupsDir, "config-1.toml"), "model = [\n", "utf8");

    const restore = restoreCodexConfig(projectPaths, codexPaths);

    expect(restore.summary).toContain("codex-config restore: restored from");
    expect(restore.inventory).toEqual([
      expect.objectContaining({
        name: "codex-config",
        status: InventoryStatus.Invalid
      })
    ]);
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
      optionalTargets: []
    });

    applyIntegrationsProfile(projectPaths, codexPaths);

    expect(inspectIntegrationsProfileAudit(codexPaths)).toMatchObject({
      status: "installed",
      recommendedChangeCount: 0,
      recommendedTargets: [],
      optionalTargets: []
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
      audit: expect.objectContaining({ status: "missing", recommendedChangeCount: 4 }),
      apply: expect.objectContaining({ status: "ready", recommendedChangeCount: 4 }),
      preview: expect.objectContaining({
        summary: "codex-profile preview: 4 recommended change(s)"
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
    expect(missingFamily.codexConfig).toEqual(showCodexConfig(codexPaths));
    expect(missingFamily.core).toEqual(inspectCodexProfileSnapshot(codexPaths));
    expect(missingFamily.integrations).toEqual(inspectIntegrationsProfileSnapshot(codexPaths));
    expect(missingFamily.cloudflare).toEqual(inspectCloudflareProfileSnapshot(codexPaths));
    expect(missingFamily.statusline).toEqual(inspectStatuslineProfileSnapshot(codexPaths));

    applyCodexProfile(projectPaths, codexPaths);
    applyIntegrationsProfile(projectPaths, codexPaths);
    applyCloudflareProfile(projectPaths, codexPaths);
    applyStatuslineProfile(projectPaths, codexPaths);

    const installedFamily = inspectCodexProfileFamilySnapshot(codexPaths);
    expect(installedFamily.codexConfig).toEqual(showCodexConfig(codexPaths));
    expect(installedFamily.core).toEqual(inspectCodexProfileSnapshot(codexPaths));
    expect(installedFamily.integrations).toEqual(inspectIntegrationsProfileSnapshot(codexPaths));
    expect(installedFamily.cloudflare).toEqual(inspectCloudflareProfileSnapshot(codexPaths));
    expect(installedFamily.statusline).toEqual(inspectStatuslineProfileSnapshot(codexPaths));
  });

  it("reports invalid family snapshot members consistently from one broken config", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, 'model = "gpt-5.4"\ninvalid = [\n', "utf8");

    const family = inspectCodexProfileFamilySnapshot(codexPaths);

    expect(family).toMatchObject({
      codexConfig: {
        summary: `codex-config: invalid at ${codexPaths.configToml}`
      },
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
      recommendedChangeCount: 4,
      changes: [
        { key: "model", current: null, recommended: "gpt-5.5" },
        { key: "model_reasoning_effort", current: null, recommended: "low" },
        { key: "compact_prompt", current: null, recommended: "Sane continuity prompt" },
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
      recommendedChangeCount: 4,
      appliedKeys: ["model", "model_reasoning_effort", "compact_prompt", "features.codex_hooks"]
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
      recommendedChangeCount: 2,
      changes: [
        { key: "model", current: "gpt-5.4", recommended: "gpt-5.5" },
        { key: "compact_prompt", current: null, recommended: "Sane continuity prompt" }
      ]
    });
    expect(preview.summary).toBe("codex-profile preview: 2 recommended change(s)");
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
