import { describe, expect, it } from "vitest";

import {
  COMMIT_STYLE_RULE,
  FRONTEND_CRAFT_SELECTION_LINES,
  FRONTEND_CRAFT_SKILL_NAMES,
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_AGENT_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CAVEMAN_PACK_SKILL_NAME,
  SANE_CONTINUE_SKILL_NAME,
  SANE_DOCS_WRITING_PACK_SKILL_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
  SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  SANE_ROUTER_SKILL_NAME,
  createCoreSkills,
  createDefaultGuidancePacks,
  createOptionalPackSkill,
  createOptionalPackSkills,
  createSaneAgentLanesSkill,
  createSaneAgentTemplate,
  createSaneAgentTemplateWithPacks,
  createSaneBootstrapResearchSkill,
  createSaneContinueSkill,
  createSaneExplorerAgentTemplate,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneGlobalAgentsOverlay,
  createSaneImplementationAgentTemplate,
  createSaneImplementationAgentTemplateWithPacks,
  createSaneOutcomeContinuationSkill,
  createSaneRealtimeAgentTemplate,
  createSaneRealtimeAgentTemplateWithPacks,
  createSaneRepoAgentsOverlay,
  createSaneReviewerAgentTemplate,
  createSaneReviewerAgentTemplateWithPacks,
  createSaneRouterSkill,
  manifestSkillPath,
  manifestSkills,
  optionalPackConfigKey,
  optionalPackNames,
  optionalPackSkillName,
  optionalPackSkillNames,
  readCoreAsset,
  readCoreManifest,
  renderTemplate,
  roleGuidance,
  type GuidancePacks
} from "./framework-assets-helpers.js";

describe("framework asset manifest and pack contracts", () => {
  it("core pack manifest describes the managed asset files", () => {
    const manifest = readCoreManifest();

    expect(manifest.name).toBe("core");
    expect(manifest.assets.routerSkill).toBe("skills/sane-router.md.tmpl");
    expect(manifest.assets.bootstrapResearchSkill).toBe("skills/sane-bootstrap-research.md");
    expect(manifest.assets.agentLanesSkill).toBe("skills/sane-agent-lanes.md");
    expect(manifest.assets.outcomeContinuationSkill).toBe("skills/sane-outcome-continuation.md");
    expect(manifest.assets.continueSkill).toBe("skills/continue/SKILL.md");
    expect(manifest.assets.globalOverlay).toBe("overlays/global-agents.md.tmpl");
    expect(manifest.assets.repoOverlay).toBe("overlays/repo-agents.md.tmpl");
    expect(manifest.assets.agents.primary).toBe("agents/sane-agent.toml.tmpl");
    expect(manifest.assets.agents.reviewer).toBe("agents/sane-reviewer.toml.tmpl");
    expect(manifest.assets.agents.explorer).toBe("agents/sane-explorer.toml.tmpl");
    expect(manifest.assets.agents.implementation).toBe("agents/sane-implementation.toml.tmpl");
    expect(manifest.assets.agents.realtime).toBe("agents/sane-realtime.toml.tmpl");
    expect(manifestSkills(manifest.optionalPacks.caveman)[0]?.name).toBe(SANE_CAVEMAN_PACK_SKILL_NAME);
    expect(manifestSkills(manifest.optionalPacks["frontend-craft"])[0]?.name).toBe(
      SANE_FRONTEND_CRAFT_PACK_SKILL_NAME
    );
    expect(manifestSkills(manifest.optionalPacks["frontend-craft"]).map((skill) => skill.name)).toEqual(
      FRONTEND_CRAFT_SKILL_NAMES
    );
    expect(manifestSkills(manifest.optionalPacks["frontend-craft"]).at(-1)?.name).toBe(
      SANE_FRONTEND_REVIEW_PACK_SKILL_NAME
    );
    expect(manifestSkills(manifest.optionalPacks["docs-craft"])[0]?.name).toBe(
      SANE_DOCS_WRITING_PACK_SKILL_NAME
    );
    expect(manifest.optionalPacks.caveman.provenance.kind).toBe("derived");
    expect(manifest.optionalPacks["frontend-craft"].provenance.kind).toBe("derived");
    for (const [packName, entry] of Object.entries(manifest.optionalPacks)) {
      expect(entry.policyNote, `${packName} should define canonical policyNote`).toBeTruthy();
      expect(entry.routerNote, `${packName} should not use deprecated routerNote`).toBeUndefined();
      expect(entry.overlayNote, `${packName} should not use deprecated overlayNote`).toBeUndefined();
    }
  });


  it("exposes one shared optional-pack roster and config-key mapping", () => {
    const manifest = readCoreManifest();
    expect(optionalPackNames()).toEqual(Object.keys(manifest.optionalPacks));
    expect(optionalPackConfigKey("caveman")).toBe("caveman");
    expect(optionalPackConfigKey("rtk")).toBe("rtk");
    expect(optionalPackConfigKey("frontend-craft")).toBe("frontendCraft");
    expect(optionalPackConfigKey("docs-craft")).toBe("docsCraft");
    for (const [packName, entry] of Object.entries(manifest.optionalPacks)) {
      expect(entry.configKey, `${packName} should define configKey`).toBeTruthy();
      expect(optionalPackConfigKey(packName)).toBe(entry.configKey);
    }
  });


  it("router skill renders from the checked-in core template", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: true,
      frontendCraft: false,
      docsCraft: false
    };
    const manifest = readCoreManifest();
    const template = readCoreAsset(manifest.assets.routerSkill);
    const body = createSaneRouterSkill(packs, roles);
    const expected = renderTemplate(template, {
      COORDINATOR_MODEL: roles.coordinatorModel,
      COORDINATOR_REASONING: roles.coordinatorReasoning,
      EXECUTION_MODEL: roles.executionModel,
      EXECUTION_REASONING: roles.executionReasoning,
      SIDECAR_MODEL: roles.sidecarModel,
      SIDECAR_REASONING: roles.sidecarReasoning,
      VERIFIER_MODEL: roles.verifierModel,
      VERIFIER_REASONING: roles.verifierReasoning,
      REALTIME_MODEL: roles.realtimeModel,
      REALTIME_REASONING: roles.realtimeReasoning,
      ENABLED_PACK_ROUTER_NOTES: [
        "- Caveman pack active: use `sane-caveman` prose rules; read the skill body before normal narrative when available",
        "- RTK pack active: load `sane-rtk` for shell/search/test/log routing"
      ].join("\n"),
      ENABLED_PACK_SKILL_SELECTIONS: [
        "- caveman task picks: communication-style, caveman-prose, brevity -> sane-caveman",
        "- rtk task picks: shell, search, test, logs -> sane-rtk"
      ].join("\n")
    });

    expect(body).toBe(expected);
    expect(body).toContain("Choose the next Sane surface with minimal context");
    expect(body).toContain("Load `sane-agent-lanes`; it owns lane planning");
    expect(body).toContain("keep broad work in `sane-agent-lanes`");
    expect(body).toContain("Load skills by trigger only:");
    expect(body).not.toContain("Broad read-only review still needs explorer");
    expect(body).not.toContain("{{");
  });


  it("core always-on skills resolve directly from checked-in files", () => {
    const manifest = readCoreManifest();

    expect(createSaneBootstrapResearchSkill()).toBe(readCoreAsset(manifest.assets.bootstrapResearchSkill));
    expect(createSaneAgentLanesSkill()).toBe(readCoreAsset(manifest.assets.agentLanesSkill));
    expect(createSaneOutcomeContinuationSkill()).toBe(readCoreAsset(manifest.assets.outcomeContinuationSkill));
    expect(createSaneContinueSkill()).toBe(readCoreAsset(manifest.assets.continueSkill));
    expect(createCoreSkills()).toEqual([
      {
        name: SANE_ROUTER_SKILL_NAME,
        content: createSaneRouterSkill(createDefaultGuidancePacks(), roleGuidance()),
        resources: []
      },
      {
        name: SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
        content: readCoreAsset(manifest.assets.bootstrapResearchSkill),
        resources: []
      },
      {
        name: SANE_AGENT_LANES_SKILL_NAME,
        content: readCoreAsset(manifest.assets.agentLanesSkill),
        resources: []
      },
      {
        name: SANE_OUTCOME_CONTINUATION_SKILL_NAME,
        content: readCoreAsset(manifest.assets.outcomeContinuationSkill),
        resources: []
      },
      {
        name: SANE_CONTINUE_SKILL_NAME,
        content: readCoreAsset(manifest.assets.continueSkill),
        resources: []
      }
    ]);
    expect(createSaneBootstrapResearchSkill()).toContain("name: sane-bootstrap-research");
    expect(createSaneBootstrapResearchSkill()).toContain("Choose a current, defensible project stack");
    expect(createSaneAgentLanesSkill()).toContain("name: sane-agent-lanes");
    expect(createSaneAgentLanesSkill()).toContain("owned lanes");
    expect(createSaneAgentLanesSkill()).toContain("Begin broad edits only after an implementation lane owns a disjoint write scope.");
    expect(createSaneAgentLanesSkill()).toContain("After research/planning, require a fresh implementation or read-only reviewer handoff");
    expect(createSaneAgentLanesSkill()).toContain("earlier research or planning lanes are context only");
    expect(createSaneAgentLanesSkill()).toContain("Use reviewer lanes for broad, whole-codebase, release, or architecture review");
    expect(createSaneAgentLanesSkill()).toContain("Attempt handoff for broad work before asking about subagents");
    expect(createSaneAgentLanesSkill()).toContain("keep broad work in the lane flow");
    expect(createSaneOutcomeContinuationSkill()).toContain("name: sane-outcome-continuation");
    expect(createSaneOutcomeContinuationSkill()).toContain("plain-language outcome");
    expect(createSaneOutcomeContinuationSkill()).toContain("Broad reviews use explorer/reviewer lanes");
    expect(createSaneOutcomeContinuationSkill()).toContain("ask once, and wait for user input");
    expect(createSaneOutcomeContinuationSkill()).toContain("before inspecting, verifying, patching, or continuing broad work locally");
    expect(createSaneOutcomeContinuationSkill()).not.toContain("smallest solo fallback");
    expect(createSaneOutcomeContinuationSkill()).not.toContain("advance_outcome");
    expect(createSaneContinueSkill()).toContain("name: continue");
    expect(createSaneContinueSkill()).toContain("Keep the current mainline moving");
    expect(createSaneContinueSkill()).toContain(`${COMMIT_STYLE_RULE}.`);
  });


  it("global overlay renders from the checked-in core template", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: false,
      rtk: false,
      frontendCraft: true,
      docsCraft: false
    };
    const manifest = readCoreManifest();
    const template = readCoreAsset(manifest.assets.globalOverlay);
    const body = createSaneGlobalAgentsOverlay(packs, roles);
    const expected = renderTemplate(template, {
      COORDINATOR_MODEL: roles.coordinatorModel,
      COORDINATOR_REASONING: roles.coordinatorReasoning,
      EXECUTION_MODEL: roles.executionModel,
      EXECUTION_REASONING: roles.executionReasoning,
      SIDECAR_MODEL: roles.sidecarModel,
      SIDECAR_REASONING: roles.sidecarReasoning,
      VERIFIER_MODEL: roles.verifierModel,
      VERIFIER_REASONING: roles.verifierReasoning,
      REALTIME_MODEL: roles.realtimeModel,
      REALTIME_REASONING: roles.realtimeReasoning,
      ENABLED_PACK_OVERLAY_NOTES: "",
      ENABLED_PACK_SKILL_SELECTIONS: FRONTEND_CRAFT_SELECTION_LINES.join("\n")
    });

    expect(body).toBe(expected);
    expect(body).toContain("Load `sane-router` for Sane routing or concrete skills by trigger");
    expect(body).toContain("Broad work, continuation, pack behavior, and verification detail live in their matching skills.");
    expect(body).not.toContain("Frontend-craft pack active");
    expect(body).not.toContain("task picks:");
    expect(body).not.toContain("Current coordinator default");
    expect(body).not.toContain("{{");
  });


  it("repo overlay renders from the checked-in repo template and stays distinct from the global overlay", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: false,
      rtk: true,
      frontendCraft: false,
      docsCraft: false
    };
    const manifest = readCoreManifest();
    const template = readCoreAsset(manifest.assets.repoOverlay);
    const body = createSaneRepoAgentsOverlay(packs, roles);
    const expected = renderTemplate(template, {
      COORDINATOR_MODEL: roles.coordinatorModel,
      COORDINATOR_REASONING: roles.coordinatorReasoning,
      EXECUTION_MODEL: roles.executionModel,
      EXECUTION_REASONING: roles.executionReasoning,
      SIDECAR_MODEL: roles.sidecarModel,
      SIDECAR_REASONING: roles.sidecarReasoning,
      VERIFIER_MODEL: roles.verifierModel,
      VERIFIER_REASONING: roles.verifierReasoning,
      REALTIME_MODEL: roles.realtimeModel,
      REALTIME_REASONING: roles.realtimeReasoning,
      ENABLED_PACK_OVERLAY_NOTES: "",
      ENABLED_PACK_SKILL_SELECTIONS: "- rtk task picks: shell, search, test, logs -> sane-rtk"
    });

    expect(body).toBe(expected);
    expect(body).toContain("Repo `AGENTS.md`, repo-local skills, current worktree, and runtime state are project truth.");
    expect(body).toContain("Use the repo's own verify commands");
    expect(body).toContain("Sane repo overlay");
    expect(body).toContain("Use `sane-router` for Sane routing");
    expect(body).toContain("enabled pack skills by trigger");
    expect(body).not.toContain("RTK pack active");
    expect(body).not.toContain("sane-rtk");
    expect(body).not.toContain("Current coordinator default");
    expect(body).not.toBe(createSaneGlobalAgentsOverlay(packs, roles));
    expect(body).not.toContain("{{");
  });


  it("derives router policy prose from one canonical manifest field while overlays keep only trigger pointers", () => {
    const roles = roleGuidance();
    const manifest = readCoreManifest();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: true,
      frontendCraft: true,
      docsCraft: true
    };
    const expectedNotes = Object.values(manifest.optionalPacks)
      .map((entry) => entry.policyNote)
      .filter((note): note is string => Boolean(note));
    const router = createSaneRouterSkill(packs, roles);
    const globalOverlay = createSaneGlobalAgentsOverlay(packs, roles);
    const repoOverlay = createSaneRepoAgentsOverlay(packs, roles);

    for (const note of expectedNotes) {
      expect(router).toContain(note);
      expect(globalOverlay).not.toContain(note);
      expect(repoOverlay).not.toContain(note);
    }
    expect(globalOverlay).toContain("concrete skills by trigger");
    expect(repoOverlay).toContain("enabled pack skills by trigger");
  });


  it("optional pack skills resolve directly from checked-in files", () => {
    const manifest = readCoreManifest();
    const cases: Array<[string, string]> = [
      ["caveman", SANE_CAVEMAN_PACK_SKILL_NAME],
      ["rtk", "sane-rtk"],
      ["frontend-craft", SANE_FRONTEND_CRAFT_PACK_SKILL_NAME],
      ["docs-craft", SANE_DOCS_WRITING_PACK_SKILL_NAME]
    ];

    for (const [pack, name] of cases) {
      expect(optionalPackSkillName(pack)).toBe(name);
      expect(createOptionalPackSkill(pack)).toBe(
        readCoreAsset(manifestSkills(manifest.optionalPacks[pack])[0]!.path)
      );
    }

    const frontendCraft = createOptionalPackSkill("frontend-craft");
    const rtk = createOptionalPackSkill("rtk");
    expect(optionalPackSkillNames("rtk")).toEqual(["sane-rtk"]);
    expect(rtk).toContain("name: sane-rtk");
    expect(rtk).toContain("prefer RTK subcommands over raw shell");
    expect(rtk).toContain("Use `rtk run '<command>'` only when no native RTK command fits");
    expect(optionalPackSkillNames("frontend-craft")).toEqual(FRONTEND_CRAFT_SKILL_NAMES);
    expect(createOptionalPackSkills("frontend-craft")).toEqual([
      {
        name: SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
        content: readCoreAsset(
          manifestSkillPath(manifest.optionalPacks["frontend-craft"], SANE_FRONTEND_CRAFT_PACK_SKILL_NAME)
        ),
        resources: []
      },
      {
        name: SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
        content: readCoreAsset(
          manifestSkillPath(manifest.optionalPacks["frontend-craft"], SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME)
        ),
        resources: []
      },
      {
        name: SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
        content: readCoreAsset(
          manifestSkillPath(manifest.optionalPacks["frontend-craft"], SANE_FRONTEND_REVIEW_PACK_SKILL_NAME)
        ),
        resources: []
      }
    ]);
    expect(frontendCraft).toContain("name: sane-frontend-craft");
    expect(frontendCraft).toContain("Build frontend work that fits the product");
    expect(frontendCraft).toContain("UI implementation subagents should run on `gpt-5.5` with `high` reasoning");
    expect(frontendCraft).toContain("Use visual assets deliberately");

    const frontendSkills = createOptionalPackSkills("frontend-craft");
    expect(frontendSkills.find((skill) => skill.name === "sane-frontend-visual-assets")?.content).toContain(
      "Choose, generate, or direct visual assets"
    );

    const frontendReview =
      createOptionalPackSkills("frontend-craft").find((skill) => skill.name === "sane-frontend-review")?.content ?? "";
    expect(frontendReview).toContain("name: sane-frontend-review");
    expect(frontendReview).toContain("Catch visual, interaction, responsive, and asset defects");
    expect(frontendReview).toContain("Frontend review/visual QA subagents should run on `gpt-5.5` with `high` reasoning");
    expect(frontendReview).toContain("Review Checklist");

    const docsWriting = createOptionalPackSkill("docs-craft");
    expect(optionalPackSkillNames("docs-craft")).toEqual([SANE_DOCS_WRITING_PACK_SKILL_NAME]);
    expect(docsWriting).toContain("name: sane-docs-writing");
    expect(docsWriting).toContain("Write docs that help readers act from current truth");
    expect(docsWriting).toContain("Do not present the TUI as the normal prompting interface");
  });


  it("custom agent templates render from checked-in files", () => {
    const roles = roleGuidance();
    const manifest = readCoreManifest();

    const agent = createSaneAgentTemplate(roles);
    const reviewer = createSaneReviewerAgentTemplate(roles);
    const explorer = createSaneExplorerAgentTemplate(roles);
    const implementation = createSaneImplementationAgentTemplate(roles);
    const realtime = createSaneRealtimeAgentTemplate(roles);
    const expectedAgent = renderTemplate(readCoreAsset(manifest.assets.agents.primary), {
      MODEL: roles.coordinatorModel,
      MODEL_REASONING: roles.coordinatorReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedReviewer = renderTemplate(readCoreAsset(manifest.assets.agents.reviewer), {
      MODEL: roles.verifierModel,
      MODEL_REASONING: roles.verifierReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedExplorer = renderTemplate(readCoreAsset(manifest.assets.agents.explorer), {
      MODEL: roles.sidecarModel,
      MODEL_REASONING: roles.sidecarReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedImplementation = renderTemplate(readCoreAsset(manifest.assets.agents.implementation), {
      MODEL: roles.executionModel,
      MODEL_REASONING: roles.executionReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedRealtime = renderTemplate(readCoreAsset(manifest.assets.agents.realtime), {
      MODEL: roles.realtimeModel,
      MODEL_REASONING: roles.realtimeReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });

    expect(agent).toBe(expectedAgent);
    expect(agent).toContain(`name = "${SANE_AGENT_NAME.replace("-", "_")}"`);
    expect(agent).toContain(`model = "${roles.coordinatorModel}"`);
    expect(agent).toContain("route with `sane-router`");
    expect(agent).toContain("follow-up implementation");
    expect(reviewer).toBe(expectedReviewer);
    expect(reviewer).toContain(`name = "${SANE_REVIEWER_AGENT_NAME.replace("-", "_")}"`);
    expect(reviewer).toContain(`model = "${roles.verifierModel}"`);
    expect(reviewer).toContain("dedicated review skills");
    expect(reviewer).toContain("missing validation");
    expect(explorer).toBe(expectedExplorer);
    expect(explorer).toContain(`name = "${SANE_EXPLORER_AGENT_NAME.replace("-", "_")}"`);
    expect(explorer).toContain(`model = "${roles.sidecarModel}"`);
    expect(implementation).toBe(expectedImplementation);
    expect(implementation).toContain(`name = "${SANE_IMPLEMENTATION_AGENT_NAME.replace("-", "_")}"`);
    expect(implementation).toContain(`model = "${roles.executionModel}"`);
    expect(realtime).toBe(expectedRealtime);
    expect(realtime).toContain(`name = "${SANE_REALTIME_AGENT_NAME.replace("-", "_")}"`);
    expect(realtime).toContain(`model = "${roles.realtimeModel}"`);
    expect(agent).not.toContain("{{");
    expect(reviewer).not.toContain("{{");
    expect(explorer).not.toContain("{{");
    expect(implementation).not.toContain("{{");
    expect(realtime).not.toContain("{{");
  });


  it("custom agent templates expose direct execution contracts", () => {
    const roles = roleGuidance();
    const agent = createSaneAgentTemplate(roles);
    const reviewer = createSaneReviewerAgentTemplate(roles);
    const explorer = createSaneExplorerAgentTemplate(roles);
    const implementation = createSaneImplementationAgentTemplate(roles);
    const realtime = createSaneRealtimeAgentTemplate(roles);

    expect(agent).toContain('sandbox_mode = "workspace-write"');
    expect(agent).toContain("use subagents for broad work");
    expect(agent).toContain("never revert other work");
    expect(agent).toContain("treat active hooks and guardrails as binding");
    expect(agent).toContain("verify meaningful changes before claiming success");
    expect(agent).toContain("coordinator owns final judgment");

    expect(reviewer).toContain('sandbox_mode = "read-only"');
    expect(reviewer).toContain("findings first");
    expect(reviewer).toContain("treat active hooks and guardrails as binding");
    expect(reviewer).toContain("do not propose speculative churn");
    expect(reviewer).toContain("call out missing validation");

    expect(explorer).toContain('sandbox_mode = "read-only"');
    expect(explorer).toContain("treat active hooks and guardrails as binding");
    expect(explorer).toContain("return exact file anchors");
    expect(explorer).toContain("do not edit files");

    expect(implementation).toContain('sandbox_mode = "workspace-write"');
    expect(implementation).toContain("own only the assigned files or responsibility");
    expect(implementation).toContain("inside the write boundary");
    expect(implementation).toContain("treat active hooks and guardrails as binding");
    expect(implementation).toContain("return changed paths, tests run, and any blockers");

    expect(realtime).toContain('sandbox_mode = "workspace-write"');
    expect(realtime).toContain("handle small, independent tasks quickly");
    expect(realtime).toContain("treat active hooks and guardrails as binding");
    expect(realtime).toContain("do not touch files outside the assigned scope");
    expect(realtime).toContain("return changed paths or exact findings");
  });


  it("custom agent templates enforce enabled caveman pack rules", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: false,
      frontendCraft: false,
      docsCraft: false
    };

    const agent = createSaneAgentTemplateWithPacks(roles, packs);
    const reviewer = createSaneReviewerAgentTemplateWithPacks(roles, packs);
    const explorer = createSaneExplorerAgentTemplateWithPacks(roles, packs);
    const implementation = createSaneImplementationAgentTemplateWithPacks(roles, packs);
    const realtime = createSaneRealtimeAgentTemplateWithPacks(roles, packs);

    for (const body of [agent, reviewer, explorer, implementation, realtime]) {
      expect(body).toContain(
        "Caveman pack active"
      );
      expect(body).toContain("enabled pack notes below are active behavior");
      expect(body).toContain("instruction hierarchy");
      expect(body).not.toContain("{{ENABLED_PACK_AGENT_NOTES}}");
    }
  });


});
