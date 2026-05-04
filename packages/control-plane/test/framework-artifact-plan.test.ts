import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  SANE_AGENT_NAME,
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CLOUDFLARE_PROFILE_FRAGMENT_ID,
  SANE_CONTINUE_SKILL_NAME,
  SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
  SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  SANE_ROUTER_SKILL_NAME,
  SANE_STATUSLINE_PROFILE_FRAGMENT_ID,
  createDefaultGuidancePacks,
  renderCodexArtifacts
} from "@sane/framework-assets";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  createCodexFrameworkArtifactPlan,
  deployCodexFrameworkArtifactPlan,
  frameworkArtifactManifestPath,
  inspectFrameworkArtifactPlanInventory,
  previewCodexFrameworkArtifactPlan,
  readFrameworkArtifactManifest,
  uninstallCodexFrameworkArtifactPlan
} from "../src/framework-artifact-plan.js";

const tempDirs: string[] = [];
const CUSTOM_AGENT_NAMES = [
  SANE_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_REALTIME_AGENT_NAME
];
const CORE_SKILL_NAMES = [
  SANE_ROUTER_SKILL_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_CONTINUE_SKILL_NAME
];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-framework-artifacts-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("framework artifact plan", () => {
  it("previews a manifest-owned Codex artifact plan without writing files", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const plan = createCodexFrameworkArtifactPlan(projectPaths, codexPaths, "preview");
    const result = previewCodexFrameworkArtifactPlan(projectPaths, codexPaths);

    expect(plan.provider).toBe("codex");
    expect(plan.manifestPath).toBe(frameworkArtifactManifestPath(projectPaths));
    expect(plan.artifacts).toHaveLength(18);
    expect(plan.artifacts.map((artifact) => artifact.path)).toEqual([
      codexPaths.globalAgentsMd,
      projectPaths.repoAgentsMd,
      ...CORE_SKILL_NAMES.map((name) => join(codexPaths.userSkillsDir, name, "SKILL.md")),
      ...CUSTOM_AGENT_NAMES.map((name) => join(codexPaths.customAgentsDir, `${name}.toml`)),
      codexPaths.configToml,
      codexPaths.configToml,
      codexPaths.hooksJson,
      codexPaths.hooksJson,
      codexPaths.hooksJson,
      codexPaths.hooksJson
    ]);
    expect(plan.manifest.artifacts.find((entry) => entry.path.endsWith("SKILL.md"))).toMatchObject({
      provider: "codex",
      path: join(codexPaths.userSkillsDir, SANE_ROUTER_SKILL_NAME, "SKILL.md"),
      mode: "file",
      ownershipMode: "generated-managed",
      executable: false,
      structuredKeys: ["name", "description"]
    });
    expect(plan.manifest.artifacts.find((entry) => entry.path.endsWith("SKILL.md"))?.sourceId).toBe(
      renderCodexArtifacts().find((artifact) => artifact.path.endsWith("SKILL.md"))?.sourceId
    );
    expect(result.summary).toBe("preview framework-artifacts: rendered Codex artifact plan");
    expect(existsSync(plan.manifestPath)).toBe(false);
    expect(existsSync(join(codexPaths.userSkillsDir, SANE_ROUTER_SKILL_NAME))).toBe(false);
  });

  it("deploys and uninstalls only manifest-owned source-record artifacts", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const routerPath = join(codexPaths.userSkillsDir, SANE_ROUTER_SKILL_NAME, "SKILL.md");
    const skillPaths = CORE_SKILL_NAMES.map((name) => join(codexPaths.userSkillsDir, name, "SKILL.md"));
    const agentPaths = CUSTOM_AGENT_NAMES.map((name) => join(codexPaths.customAgentsDir, `${name}.toml`));
    const foreignPath = join(codexPaths.userSkillsDir, "user-skill", "SKILL.md");
    const hooksPath = codexPaths.hooksJson;
    mkdirSync(dirname(foreignPath), { recursive: true });
    writeFileSync(foreignPath, "---\nname: user-skill\n---\n", "utf8");
    mkdirSync(dirname(hooksPath), { recursive: true });
    writeFileSync(hooksPath, `${JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: "other",
            hooks: [{ type: "command", command: "echo untouched" }]
          }
        ]
      }
    }, null, 2)}\n`, "utf8");
    writeFileSync(codexPaths.configToml, [
      'user_key = "keep"',
      "",
      "[features]",
      "memories = true",
      "",
      "[mcp_servers.user_owned]",
      'command = "keep"',
      ""
    ].join("\n"), "utf8");
    mkdirSync(dirname(codexPaths.globalAgentsMd), { recursive: true });
    writeFileSync(codexPaths.globalAgentsMd, "# User global notes\n", "utf8");
    writeFileSync(projectPaths.repoAgentsMd, "# User repo notes\n", "utf8");

    const deploy = deployCodexFrameworkArtifactPlan(projectPaths, codexPaths);
    const manifest = readFrameworkArtifactManifest(frameworkArtifactManifestPath(projectPaths));

    expect(deploy.summary).toBe("export framework-artifacts: deployed Codex artifact plan");
    expect(readFileSync(routerPath, "utf8")).toContain("name: sane-router");
    for (const skillPath of skillPaths) {
      expect(readFileSync(skillPath, "utf8")).toContain("name:");
      expect(existsSync(join(dirname(skillPath), ".sane-owned"))).toBe(true);
    }
    for (const [index, agentPath] of agentPaths.entries()) {
      const agentName = CUSTOM_AGENT_NAMES[index]!;
      expect(readFileSync(agentPath, "utf8")).toContain("# managed-by: sane custom-agent");
      expect(readFileSync(agentPath, "utf8")).toContain(`name = "${agentName.replaceAll("-", "_")}"`);
    }
    expect(readFileSync(codexPaths.globalAgentsMd, "utf8")).toContain("<!-- sane:global-agents:start -->");
    expect(readFileSync(codexPaths.globalAgentsMd, "utf8")).toContain("# User global notes");
    expect(readFileSync(projectPaths.repoAgentsMd, "utf8")).toContain("<!-- sane:repo-agents:start -->");
    expect(readFileSync(projectPaths.repoAgentsMd, "utf8")).toContain("# User repo notes");
    expect(manifest.artifacts).toHaveLength(18);
    expect(manifest.artifacts.every((entry) => /^[a-f0-9]{64}$/.test(entry.hash))).toBe(true);
    expect(manifest.artifacts.map((entry) => entry.mode)).toEqual([
      "block",
      "block",
      "file",
      "file",
      "file",
      "file",
      "file",
      "file",
      "file",
      "file",
      "file",
      "file",
      "config",
      "config",
      "config",
      "config",
      "config",
      "config"
    ]);
    expect(manifest.artifacts.find((entry) => entry.sourceId.includes("codex:sane-router:"))?.provenance).toMatchObject({
      owner: "sane",
      sourcePath: "packs/core/skills/sane-router.md.tmpl"
    });
    const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
    const configToml = readFileSync(codexPaths.configToml, "utf8");
    expect(hooks.hooks.SessionStart).toHaveLength(2);
    expect(configToml).toContain('user_key = "keep"');
    expect(configToml).toContain("memories = true");
    expect(configToml).toContain("[mcp_servers.user_owned]");
    expect(configToml).toContain('model = "gpt-5.4"');
    expect(configToml).toContain("codex_hooks = true");
    expect(configToml).toContain("[mcp_servers.playwright]");
    const managedCommand = hooks.hooks.SessionStart.find((entry: any) =>
      Array.isArray(entry.hooks) && entry.hooks.some((hook: any) => String(hook.command).includes("hook session-start"))
    ).hooks[0].command;
    expect(JSON.parse(execSync(managedCommand, { encoding: "utf8", shell: "/bin/sh" })).hookSpecificOutput.hookEventName).toBe(
      "SessionStart"
    );

    const uninstall = uninstallCodexFrameworkArtifactPlan(projectPaths, codexPaths);

    expect(uninstall.summary).toBe("uninstall framework-artifacts: removed manifest-owned Codex artifacts");
    for (const skillPath of skillPaths) {
      expect(existsSync(dirname(skillPath))).toBe(false);
    }
    for (const agentPath of agentPaths) {
      expect(existsSync(agentPath)).toBe(false);
    }
    expect(existsSync(frameworkArtifactManifestPath(projectPaths))).toBe(false);
    expect(readFileSync(foreignPath, "utf8")).toBe("---\nname: user-skill\n---\n");
    expect(JSON.stringify(JSON.parse(readFileSync(hooksPath, "utf8")))).toContain("echo untouched");
    const uninstalledConfigToml = readFileSync(codexPaths.configToml, "utf8");
    expect(uninstalledConfigToml).toContain('user_key = "keep"');
    expect(uninstalledConfigToml).toContain("memories = true");
    expect(uninstalledConfigToml).toContain("[mcp_servers.user_owned]");
    expect(uninstalledConfigToml).not.toContain('model = "gpt-5.4"');
    expect(uninstalledConfigToml).not.toContain("codex_hooks = true");
    expect(uninstalledConfigToml).not.toContain("[mcp_servers.playwright]");
    expect(readFileSync(codexPaths.globalAgentsMd, "utf8")).toBe("# User global notes\n");
    expect(readFileSync(projectPaths.repoAgentsMd, "utf8")).toBe("# User repo notes\n");
  });

  it("blocks deploy over a same-name skill directory without Sane ownership", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const routerPath = join(codexPaths.userSkillsDir, SANE_ROUTER_SKILL_NAME, "SKILL.md");
    mkdirSync(dirname(routerPath), { recursive: true });
    writeFileSync(routerPath, "---\nname: foreign-router\n---\n", "utf8");

    const deploy = deployCodexFrameworkArtifactPlan(projectPaths, codexPaths);

    expect(deploy.summary).toBe("export framework-artifacts: blocked by non-Sane skill directories");
    expect(readFileSync(routerPath, "utf8")).toBe("---\nname: foreign-router\n---\n");
    expect(existsSync(frameworkArtifactManifestPath(projectPaths))).toBe(false);
  });

  it("plans optional pack skills through manifest-owned deploy and uninstall", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const packs = createDefaultGuidancePacks();
    packs.frontendCraft = true;
    const options = { packs };
    const frontendSkillNames = [
      SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
      SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
      SANE_FRONTEND_REVIEW_PACK_SKILL_NAME
    ];

    const plan = createCodexFrameworkArtifactPlan(projectPaths, codexPaths, "preview", options);

    expect(plan.artifacts.map((artifact) => artifact.path)).toEqual([
      codexPaths.globalAgentsMd,
      projectPaths.repoAgentsMd,
      ...CORE_SKILL_NAMES.map((name) => join(codexPaths.userSkillsDir, name, "SKILL.md")),
      ...frontendSkillNames.map((name) => join(codexPaths.userSkillsDir, name, "SKILL.md")),
      ...CUSTOM_AGENT_NAMES.map((name) => join(codexPaths.customAgentsDir, `${name}.toml`)),
      codexPaths.configToml,
      codexPaths.configToml,
      codexPaths.hooksJson,
      codexPaths.hooksJson,
      codexPaths.hooksJson,
      codexPaths.hooksJson
    ]);
    expect(plan.manifest.artifacts.filter((entry) => entry.structuredKeys.includes("optionalPack"))).toHaveLength(3);

    deployCodexFrameworkArtifactPlan(projectPaths, codexPaths, options);

    for (const skillName of frontendSkillNames) {
      const skillPath = join(codexPaths.userSkillsDir, skillName, "SKILL.md");
      expect(readFileSync(skillPath, "utf8")).toContain(`name: ${skillName}`);
      expect(existsSync(join(dirname(skillPath), ".sane-owned"))).toBe(true);
    }

    uninstallCodexFrameworkArtifactPlan(projectPaths, codexPaths, options);

    for (const skillName of frontendSkillNames) {
      expect(existsSync(join(codexPaths.userSkillsDir, skillName))).toBe(false);
    }
  });

  it("plans optional config fragments as manifest-owned structured keys", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const options = { configFragments: { cloudflare: true, statusline: true } };
    mkdirSync(dirname(codexPaths.configToml), { recursive: true });
    writeFileSync(codexPaths.configToml, [
      "[tui]",
      'theme = "zenburn"',
      "",
      "[mcp_servers.user_owned]",
      'command = "keep"',
      ""
    ].join("\n"), "utf8");

    const plan = createCodexFrameworkArtifactPlan(projectPaths, codexPaths, "preview", options);
    expect(plan.manifest.artifacts.find((entry) => entry.sourceId.includes(SANE_CLOUDFLARE_PROFILE_FRAGMENT_ID))).toMatchObject({
      path: codexPaths.configToml,
      mode: "config",
      structuredKeys: ["mcp_servers.cloudflare-api"]
    });
    expect(plan.manifest.artifacts.find((entry) => entry.sourceId.includes(SANE_STATUSLINE_PROFILE_FRAGMENT_ID))).toMatchObject({
      path: codexPaths.configToml,
      mode: "config",
      structuredKeys: ["tui.notification_condition", "tui.status_line", "tui.terminal_title"]
    });

    deployCodexFrameworkArtifactPlan(projectPaths, codexPaths, options);

    const deployed = readFileSync(codexPaths.configToml, "utf8");
    expect(deployed).toContain('theme = "zenburn"');
    expect(deployed).toContain("[mcp_servers.user_owned]");
    expect(deployed).toContain("[mcp_servers.cloudflare-api]");
    expect(deployed).toContain('notification_condition = "always"');
    expect(inspectFrameworkArtifactPlanInventory(projectPaths, codexPaths).status.asString()).toBe("installed");

    uninstallCodexFrameworkArtifactPlan(projectPaths, codexPaths, options);

    const uninstalled = readFileSync(codexPaths.configToml, "utf8");
    expect(uninstalled).toContain('theme = "zenburn"');
    expect(uninstalled).toContain("[mcp_servers.user_owned]");
    expect(uninstalled).not.toContain("[mcp_servers.cloudflare-api]");
    expect(uninstalled).not.toContain("notification_condition");
  });

  it("reports per-artifact drift for changed files, missing hooks, and changed config keys", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const options = { configFragments: { cloudflare: true, statusline: true } };
    const routerPath = join(codexPaths.userSkillsDir, SANE_ROUTER_SKILL_NAME, "SKILL.md");

    deployCodexFrameworkArtifactPlan(projectPaths, codexPaths, options);
    writeFileSync(routerPath, `${readFileSync(routerPath, "utf8")}\n# local drift\n`, "utf8");
    writeFileSync(codexPaths.hooksJson, `${JSON.stringify({ hooks: {} }, null, 2)}\n`, "utf8");
    writeFileSync(codexPaths.configToml, [
      'model = "gpt-5.4"',
      'model_reasoning_effort = "medium"',
      "",
      "[features]",
      "codex_hooks = true",
      "",
      "[tui]",
      'notification_condition = "never"',
      'status_line = ["wrong"]',
      'terminal_title = ["wrong"]',
      "",
      "[mcp_servers.playwright]",
      'command = "npx"',
      'args = ["@playwright/mcp@latest"]',
      "",
      "[mcp_servers.cloudflare-api]",
      'url = "https://mcp.cloudflare.com/mcp"',
      ""
    ].join("\n"), "utf8");

    const inventory = inspectFrameworkArtifactPlanInventory(projectPaths, codexPaths);

    expect(inventory.status.asString()).toBe("invalid");
    expect(inventory.repairHint).toContain(`changed file: ${routerPath}`);
    expect(inventory.repairHint).toContain("missing hook: codex:session-start:");
    expect(inventory.repairHint).toContain("changed config:");
  });

  it("reports planned artifacts missing from an existing manifest", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());

    deployCodexFrameworkArtifactPlan(projectPaths, codexPaths);
    const manifestPath = frameworkArtifactManifestPath(projectPaths);
    const manifest = readFrameworkArtifactManifest(manifestPath);
    const omitted = manifest.artifacts.find((entry) =>
      entry.sourceId.includes(`codex:${SANE_ROUTER_SKILL_NAME}:`)
    )!;
    writeFileSync(manifestPath, `${JSON.stringify({
      ...manifest,
      artifacts: manifest.artifacts.filter((entry) => entry !== omitted)
    }, null, 2)}\n`, "utf8");

    const inventory = inspectFrameworkArtifactPlanInventory(projectPaths, codexPaths);

    expect(inventory.status.asString()).toBe("invalid");
    expect(inventory.repairHint).toContain(`missing manifest: ${omitted.path} ${omitted.sourceId}`);
  });

  it("reports hook drift when managed hook command, matcher, status, or timeout changes", () => {
    for (const mutate of [
      (entry: any) => {
        entry.matcher = "Read";
      },
      (entry: any) => {
        entry.hooks[0].statusMessage = "mutated";
      },
      (entry: any) => {
        entry.hooks[0].timeout = 99;
      },
      (entry: any) => {
        entry.hooks[0].command = `${entry.hooks[0].command} mutated`;
      }
    ]) {
      const projectPaths = createProjectPaths(makeTempDir());
      const codexPaths = createCodexPaths(makeTempDir());
      deployCodexFrameworkArtifactPlan(projectPaths, codexPaths);
      const hooks = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));
      const commandGuard = hooks.hooks.PreToolUse.find((entry: any) =>
        JSON.stringify(entry).includes("hook command-safety-guard")
      );
      mutate(commandGuard);
      writeFileSync(codexPaths.hooksJson, `${JSON.stringify(hooks, null, 2)}\n`, "utf8");

      const inventory = inspectFrameworkArtifactPlanInventory(projectPaths, codexPaths);

      expect(inventory.status.asString()).toBe("invalid");
      expect(inventory.repairHint).toContain("changed hook: codex:command-safety-guard:");
    }
  });

  it("records executable hook source records as config-managed inline commands", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());

    const plan = createCodexFrameworkArtifactPlan(projectPaths, codexPaths, "preview");

    expect(plan.manifest.artifacts.filter((entry) => entry.executable)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: "config",
          path: codexPaths.hooksJson,
          sourceId: expect.stringContaining("codex:session-start:")
        }),
        expect.objectContaining({
          mode: "config",
          path: codexPaths.hooksJson,
          sourceId: expect.stringContaining("codex:command-safety-guard:")
        })
      ])
    );
    expect(plan.manifest.artifacts.filter((entry) => entry.executable && entry.mode === "file")).toEqual([]);
  });

  it("preserves stale artifact entries whose source id no longer matches the manifest-owned plan", () => {
    const projectPaths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const routerPath = join(codexPaths.userSkillsDir, SANE_ROUTER_SKILL_NAME, "SKILL.md");

    deployCodexFrameworkArtifactPlan(projectPaths, codexPaths);
    const manifestPath = frameworkArtifactManifestPath(projectPaths);
    const manifest = readFrameworkArtifactManifest(manifestPath);
    const routerIndex = manifest.artifacts.findIndex((entry) => entry.path.endsWith(`/${SANE_ROUTER_SKILL_NAME}/SKILL.md`));
    manifest.artifacts[routerIndex] = {
      ...manifest.artifacts[routerIndex]!,
      sourceId: "codex:sane-router:stale",
      hash: "0".repeat(64)
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const uninstall = uninstallCodexFrameworkArtifactPlan(projectPaths, codexPaths);

    expect(uninstall.summary).toBe("uninstall framework-artifacts: removed manifest-owned Codex artifacts");
    expect(readFileSync(routerPath, "utf8")).toContain("name: sane-router");
    expect(readFrameworkArtifactManifest(manifestPath).artifacts[0]?.sourceId).toBe("codex:sane-router:stale");
    expect(readFrameworkArtifactManifest(manifestPath).artifacts).toHaveLength(1);
  });
});
