import {
  SANE_AGENT_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  enabledOptionalPackContinuityLines,
  enabledOptionalPackNames,
  optionalPackPolicyLine,
  type GuidancePacks,
  type ModelRoutingGuidance
} from "@sane/framework-assets";

import { SESSION_START_BASE_GUIDANCE } from "./session-start-hook.js";

export const OPENCODE_SESSION_START_PLUGIN_MARKER = "managed-by: sane opencode session-start plugin";
export const OPENCODE_AGENT_OWNERSHIP_MARKER = "<!-- managed-by: sane opencode-agent -->";

export const OPENCODE_AGENT_NAMES = [
  SANE_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_REALTIME_AGENT_NAME
] as const;

export function expectedOpencodeAgentBodies(
  packs: GuidancePacks,
  roles: ModelRoutingGuidance
): Array<[string, string]> {
  const packNotes = opencodePackNotes(packs);
  return [
    [
      SANE_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Primary Sane subagent for OpenCode execution lane.",
        model: roles.coordinatorModel,
        readOnly: false,
        body: [
          "Coordinate Sane work:",
          "- start from repo-local instructions and current evidence",
          "- route broad work into lanes with disjoint write boundaries",
          "- keep context tight; load only task-relevant files",
          "- verify changed behavior before done",
          ...packNotes
        ]
      })
    ],
    [
      SANE_REVIEWER_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Read-only reviewer for Sane in OpenCode.",
        model: roles.verifierModel,
        readOnly: true,
        body: [
          "Review Sane work:",
          "- findings first: bugs, regressions, risk, missing tests",
          "- cite concrete file anchors and behavior",
          "- avoid broad summaries and speculative churn",
          ...packNotes
        ]
      })
    ],
    [
      SANE_EXPLORER_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Read-only explorer for Sane in OpenCode.",
        model: roles.sidecarModel,
        readOnly: true,
        body: [
          "Explore for Sane:",
          "- map only relevant files and validators",
          "- return concrete evidence and open questions",
          "- skip generated repo overviews",
          ...packNotes
        ]
      })
    ],
    [
      SANE_IMPLEMENTATION_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Implementation lane for Sane in OpenCode.",
        model: roles.executionModel,
        readOnly: false,
        body: [
          "Implement Sane work:",
          "- own assigned write scope and avoid collateral edits",
          "- read local patterns before patching",
          "- verify focused behavior after edits",
          ...packNotes
        ]
      })
    ],
    [
      SANE_REALTIME_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Realtime helper lane for Sane in OpenCode.",
        model: roles.realtimeModel,
        readOnly: false,
        body: [
          "Run realtime Sane support:",
          "- handle small independent checks with tight context",
          "- escalate to coordinator lane when risk or scope grows",
          ...packNotes
        ]
      })
    ]
  ];
}

export function createOpencodeSessionStartPluginBody(packs: GuidancePacks): string {
  const guidance = [
    SESSION_START_BASE_GUIDANCE,
    "OpenCode-specific: for broad review, release audit, migration, multi-file repair, or architecture work, load required skills and call the `task` tool with a `sane-*` subagent before deep inspection.",
    "OpenCode-specific: when RTK pack is active, use RTK-native commands (`rtk grep`, `rtk read`, `rtk ls`, `rtk git`, `rtk pnpm`, `rtk vitest`) or wrap exact shell with `rtk run`.",
    ...enabledOptionalPackContinuityLines(packs)
  ].join(" ");
  return [
    `// ${OPENCODE_SESSION_START_PLUGIN_MARKER}`,
    "const SANE_SESSION_START_CONTEXT = " + JSON.stringify(guidance) + ";",
    "const SANE_RTK_ACTIVE = " + JSON.stringify(packs.rtk) + ";",
    "const broadSessions = new Set();",
    "const subagentSessions = new Set();",
    "",
    "function textFromParts(parts) {",
    "  return parts",
    "    .filter((part) => part && part.type === \"text\" && typeof part.text === \"string\")",
    "    .map((part) => part.text)",
    "    .join(\"\\n\");",
    "}",
    "",
    "function looksBroad(text) {",
    "  return /\\b(full|complete|entire|whole|broad|public|release|v1|audit|review|migration|refactor|architecture|codebase)\\b/i.test(text) &&",
    "    /\\b(codebase|repo|review|release|v1|audit|migration|refactor|architecture)\\b/i.test(text);",
    "}",
    "",
    "function isRtkCommand(command) {",
    "  const trimmed = command.trim();",
    "  return trimmed === \"rtk\" || trimmed.startsWith(\"rtk \");",
    "}",
    "",
    "function shellQuote(value) {",
    "  return \"'\" + value.replaceAll(\"'\", \"'\\\"'\\\"'\") + \"'\";",
    "}",
    "",
    "function blockedRtkCommand(command) {",
    "  return \"printf %s\\\\n \" + shellQuote(",
    "    \"Sane RTK guard: raw bash blocked. Use an RTK-native command (`rtk grep`, `rtk read`, `rtk ls`, `rtk git`, `rtk pnpm`, `rtk vitest`) or `rtk run '...` for exact shell. Original: \" + command",
    "  ) + \" >&2; exit 2\";",
    "}",
    "",
    "export const SaneSessionStartPlugin = async () => ({",
    "  \"chat.message\": async (input, output) => {",
    "    if (looksBroad(textFromParts(output.parts))) {",
    "      broadSessions.add(input.sessionID);",
    "    }",
    "  },",
    "  \"experimental.chat.system.transform\": async (_input, output) => {",
    "    output.system.push(SANE_SESSION_START_CONTEXT);",
    "  },",
    "  \"tool.definition\": async (input, output) => {",
    "    if ([\"bash\", \"read\", \"glob\", \"grep\", \"list\"].includes(input.toolID)) {",
    "      output.description = `${output.description}\\n\\nSane: if RTK is active, prefer RTK-native commands. For broad review/release work, call the task tool with a sane-* subagent before deep solo inspection.`;",
    "    }",
    "    if (input.toolID === \"task\") {",
    "      output.description = `${output.description}\\n\\nSane: broad codebase reviews, release audits, migrations, and multi-file work must start with a sane-* subagent handoff after required skills are loaded.`;",
    "    }",
    "  },",
    "  \"tool.execute.before\": async (input, output) => {",
    "    if (input.tool === \"task\") {",
    "      subagentSessions.add(input.sessionID);",
    "      return;",
    "    }",
    "    if (input.tool !== \"bash\" || !SANE_RTK_ACTIVE) {",
    "      return;",
    "    }",
    "    const command = typeof output.args?.command === \"string\" ? output.args.command : \"\";",
    "    if (command.trim().length > 0 && !isRtkCommand(command)) {",
    "      output.args = {",
    "        ...output.args,",
    "        command: blockedRtkCommand(command),",
    "        description: \"Sane RTK guard\"",
    "      };",
    "    }",
    "  }",
    "});",
    ""
  ].join("\n");
}

export function isManagedOpencodeAgentBody(current: string, expected: string): boolean {
  return (
    current === expected ||
    current === markOpencodeAgentBody(expected) ||
    isLegacySaneOpencodeAgentBody(current)
  );
}

export function markOpencodeAgentBody(body: string): string {
  const closingFrontmatter = body.indexOf("\n---\n", 4);
  if (body.startsWith("---\n") && closingFrontmatter >= 0) {
    const insertAt = closingFrontmatter + "\n---\n".length;
    return `${body.slice(0, insertAt)}${OPENCODE_AGENT_OWNERSHIP_MARKER}\n${body.slice(insertAt)}`;
  }
  return `${OPENCODE_AGENT_OWNERSHIP_MARKER}\n${body}`;
}

function createOpencodeAgentTemplate(input: {
  description: string;
  model: string;
  readOnly: boolean;
  body: string[];
}): string {
  const permissionBlock = input.readOnly
    ? [
        "permission:",
        "  edit: deny",
        "  bash: deny"
      ]
    : [];
  return [
    "---",
    `description: ${input.description}`,
    "mode: subagent",
    `model: ${input.model}`,
    "temperature: 0.1",
    ...permissionBlock,
    "---",
    "",
    ...input.body
  ].join("\n");
}

function opencodePackNotes(packs: GuidancePacks): string[] {
  return enabledOptionalPackNames(packs)
    .map((pack) => optionalPackPolicyLine(pack))
    .filter((line): line is string => Boolean(line))
    .map((line) => `- ${line}`);
}

function isLegacySaneOpencodeAgentBody(current: string): boolean {
  return (
    current.startsWith("---\n") &&
    current.includes("mode: subagent") &&
    (current.includes("Work with Sane philosophy:") ||
      current.includes("Review with Sane philosophy:") ||
      current.includes("Explore with Sane philosophy:") ||
      current.includes("Implement with Sane philosophy:") ||
      current.includes("Run realtime Sane support:")) &&
    current.includes("RTK-first shell/search/test route")
  );
}
