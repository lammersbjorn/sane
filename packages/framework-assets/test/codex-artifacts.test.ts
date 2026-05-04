import { describe, expect, it } from "vitest";

import {
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_AGENT_NAME,
  SANE_BLOCKED_RESPONSE_GUARD_HOOK_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CLOUDFLARE_PROFILE_FRAGMENT_ID,
  SANE_CODEX_PROFILE_FRAGMENT_ID,
  SANE_COMMAND_SAFETY_GUARD_HOOK_NAME,
  SANE_CONTINUE_SKILL_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_GENERATED_SURFACE_GUARD_HOOK_NAME,
  SANE_GLOBAL_AGENTS_BEGIN,
  SANE_GLOBAL_AGENTS_END,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_INTEGRATIONS_PROFILE_FRAGMENT_ID,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REPO_AGENTS_BEGIN,
  SANE_REPO_AGENTS_END,
  SANE_REVIEWER_AGENT_NAME,
  SANE_ROUTER_SKILL_NAME,
  SANE_SESSION_START_HOOK_NAME,
  SANE_STATUSLINE_PROFILE_FRAGMENT_ID,
  createFrameworkSourceRecords,
  renderCodexArtifacts,
  sourceRecordHash,
  sourceRecordSourceId
} from "./framework-assets-helpers.js";

describe("framework asset Codex artifact rendering", () => {
  it("renders Codex artifact objects from framework source records", () => {
    const records = createFrameworkSourceRecords();
    const artifacts = renderCodexArtifacts();

    expect(artifacts).toHaveLength(18);
    expect(artifacts.map((artifact) => artifact.path)).toEqual(records.map((record) => record.targetPath));
    expect(artifacts.map((artifact) => artifact.sourceId)).toEqual(
      records.map((record) => sourceRecordSourceId(record))
    );

    for (const [index, artifact] of artifacts.entries()) {
      const record = records[index]!;
      const hash = sourceRecordHash(record.content);
      expect(artifact).toMatchObject({
        provider: "codex",
        path: record.targetPath,
        mode: record.kind === "hook" || record.kind === "config-fragment"
          ? "config"
          : record.kind === "agents-block"
            ? "block"
            : "file",
        ownershipMode: record.mode,
        hash,
        sourceId: sourceRecordSourceId(record),
        executable: record.executable,
        content: record.content
      });
      expect(artifact.structuredKeys).toEqual(record.structuredKeys);
      expect(artifact.blockMarkers).toEqual(record.blockMarkers);
      expect(artifact.provenance).toEqual(record.provenance);
      expect(artifact.sourceId).toBe(`codex:${record.id}:${artifact.hash}`);
    }

    expect(artifacts.filter((artifact) => artifact.mode === "block").map((artifact) => artifact.path)).toEqual([
      "global/AGENTS.md",
      "repo/AGENTS.md"
    ]);
    expect(artifacts.find((artifact) => artifact.path === "global/AGENTS.md")).toMatchObject({
      blockMarkers: {
        begin: SANE_GLOBAL_AGENTS_BEGIN,
        end: SANE_GLOBAL_AGENTS_END
      }
    });
    expect(artifacts.find((artifact) => artifact.path === "repo/AGENTS.md")).toMatchObject({
      blockMarkers: {
        begin: SANE_REPO_AGENTS_BEGIN,
        end: SANE_REPO_AGENTS_END
      }
    });

    expect(artifacts.filter((artifact) => artifact.path.endsWith("SKILL.md")).map((artifact) => artifact.path)).toEqual([
      `skills/${SANE_ROUTER_SKILL_NAME}/SKILL.md`,
      `skills/${SANE_BOOTSTRAP_RESEARCH_SKILL_NAME}/SKILL.md`,
      `skills/${SANE_AGENT_LANES_SKILL_NAME}/SKILL.md`,
      `skills/${SANE_OUTCOME_CONTINUATION_SKILL_NAME}/SKILL.md`,
      `skills/${SANE_CONTINUE_SKILL_NAME}/SKILL.md`
    ]);
    expect(artifacts.find((artifact) => artifact.path === `skills/${SANE_ROUTER_SKILL_NAME}/SKILL.md`)?.content).toContain(
      "Choose the next Sane surface"
    );
    expect(
      artifacts.find((artifact) => artifact.path === `skills/${SANE_BOOTSTRAP_RESEARCH_SKILL_NAME}/SKILL.md`)?.content
    ).toContain("Choose a current, defensible project stack");
    expect(artifacts.find((artifact) => artifact.path === `skills/${SANE_AGENT_LANES_SKILL_NAME}/SKILL.md`)?.content).toContain(
      "owned lanes"
    );
    expect(
      artifacts.find((artifact) => artifact.path === `skills/${SANE_OUTCOME_CONTINUATION_SKILL_NAME}/SKILL.md`)?.content
    ).toContain("plain-language outcome");
    expect(artifacts.find((artifact) => artifact.path === `skills/${SANE_CONTINUE_SKILL_NAME}/SKILL.md`)?.content).toContain(
      "Keep the current mainline moving"
    );
    expect(artifacts.find((artifact) => artifact.path.endsWith(".toml"))?.content).toContain(
      "route with `sane-router`"
    );
    expect(artifacts.filter((artifact) => artifact.path.startsWith("agents/")).map((artifact) => artifact.path)).toEqual([
      `agents/${SANE_AGENT_NAME}.toml`,
      `agents/${SANE_REVIEWER_AGENT_NAME}.toml`,
      `agents/${SANE_EXPLORER_AGENT_NAME}.toml`,
      `agents/${SANE_IMPLEMENTATION_AGENT_NAME}.toml`,
      `agents/${SANE_REALTIME_AGENT_NAME}.toml`
    ]);
    expect(artifacts.find((artifact) => artifact.path === "hooks.json")?.content).toContain(
      "\"hookEventName\": \"SessionStart\""
    );
    expect(artifacts.filter((artifact) => artifact.mode === "config").map((artifact) => artifact.sourceId)).toEqual([
      sourceRecordSourceId(records.find((record) => record.id === SANE_CODEX_PROFILE_FRAGMENT_ID)!),
      sourceRecordSourceId(records.find((record) => record.id === SANE_INTEGRATIONS_PROFILE_FRAGMENT_ID)!),
      sourceRecordSourceId(records.find((record) => record.id === SANE_SESSION_START_HOOK_NAME)!),
      sourceRecordSourceId(records.find((record) => record.id === SANE_COMMAND_SAFETY_GUARD_HOOK_NAME)!),
      sourceRecordSourceId(records.find((record) => record.id === SANE_GENERATED_SURFACE_GUARD_HOOK_NAME)!),
      sourceRecordSourceId(records.find((record) => record.id === SANE_BLOCKED_RESPONSE_GUARD_HOOK_NAME)!)
    ]);
    expect(artifacts.find((artifact) => artifact.sourceId.includes(SANE_CODEX_PROFILE_FRAGMENT_ID))).toMatchObject({
      path: "config.toml",
      mode: "config",
      ownershipMode: "config-managed",
      structuredKeys: ["model", "model_reasoning_effort", "compact_prompt", "features.codex_hooks"]
    });
    expect(artifacts.find((artifact) => artifact.sourceId.includes(SANE_INTEGRATIONS_PROFILE_FRAGMENT_ID))).toMatchObject({
      path: "config.toml",
      mode: "config",
      ownershipMode: "config-managed",
      structuredKeys: ["mcp_servers.playwright"]
    });
    const optionalConfigArtifacts = renderCodexArtifacts({
      configFragments: {
        cloudflare: true,
        statusline: true
      }
    });
    expect(optionalConfigArtifacts.find((artifact) => artifact.sourceId.includes(SANE_CLOUDFLARE_PROFILE_FRAGMENT_ID))).toMatchObject({
      path: "config.toml",
      mode: "config",
      ownershipMode: "config-managed",
      structuredKeys: ["mcp_servers.cloudflare-api"]
    });
    expect(optionalConfigArtifacts.find((artifact) => artifact.sourceId.includes(SANE_STATUSLINE_PROFILE_FRAGMENT_ID))).toMatchObject({
      path: "config.toml",
      mode: "config",
      ownershipMode: "config-managed",
      structuredKeys: ["tui.notification_condition", "tui.status_line", "tui.terminal_title"]
    });
    expect(() => renderCodexArtifacts({ provider: "opencode" as "codex" })).toThrow(
      "unsupported artifact provider: opencode"
    );
  });

});
