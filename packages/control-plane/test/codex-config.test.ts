import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createProjectPaths, createCodexPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  applyCloudflareProfile,
  applyCodexProfile,
  applyIntegrationsProfile,
  applyOpencodeProfile,
  backupCodexConfig,
  inspectCodexConfigBackupSnapshot,
  inspectIntegrationsProfileAudit,
  inspectIntegrationsProfileStatus,
  previewCloudflareProfile,
  previewCodexProfile,
  previewIntegrationsProfile,
  previewOpencodeProfile,
  restoreCodexConfig,
  showCodexConfig
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
      restoreAvailable: true
    });
    expect(restore.summary).toContain("codex-config restore: restored from");
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
});
