import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { type IssueRelayMode, type LocalConfig } from "@sane/config";
import { OperationKind, OperationResult } from "@sane/core";
import { type ProjectPaths } from "@sane/platform";

import { asPlainRecord, parseJsonValue } from "./config-object.js";
import { loadOrDefaultLocalConfig } from "./local-config.js";
import { recordTelemetryEvent } from "./telemetry.js";

export interface IssueRelayDraftInput {
  category: string;
  sourceCommand: string;
  summary: string;
  error?: string | null;
  saneVersion?: string | null;
  platform?: string | null;
  reproductionSteps?: string[];
}

export interface IssueRelayDraft {
  mode: IssueRelayMode;
  title: string;
  body: string;
  duplicateSearchTerms: string[];
  fingerprint: string;
}

export interface IssueRelayDuplicateCandidate {
  number: number;
  title: string;
  url: string;
}

export interface IssueRelaySubmitInput {
  draftPath: string;
  repo?: string | null;
}

type GhRunner = (args: string[]) => string;

let ghRunner: GhRunner = (args) => execFileSync("gh", args, {
  encoding: "utf8",
  timeout: 30_000,
  stdio: ["ignore", "pipe", "pipe"]
});

export function setIssueRelayGhRunnerForTest(runner: GhRunner | null): void {
  ghRunner = runner ?? ((args) => execFileSync("gh", args, {
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"]
  }));
}

export function buildIssueRelayDraft(
  paths: ProjectPaths,
  input: IssueRelayDraftInput,
  config: LocalConfig = loadOrDefaultLocalConfig(paths)
): IssueRelayDraft {
  const category = sanitizeToken(input.category) || "unknown";
  const sourceCommand = sanitizeToken(input.sourceCommand) || "unknown";
  const summary = sanitizeLine(input.summary, paths) || "Sane issue relay draft";
  const fingerprint = fingerprintFor([
    category,
    sourceCommand,
    sanitizeLine(input.error ?? "", paths)
  ]);
  const duplicateSearchTerms = [
    `sane ${category}`,
    `sane ${sourceCommand}`,
    fingerprint
  ];
  const lines = [
    "## Summary",
    summary,
    "",
    "## Sanitized context",
    `- category: ${category}`,
    `- source command: ${sourceCommand}`,
    `- sane version: ${sanitizeToken(input.saneVersion ?? "unknown") || "unknown"}`,
    `- platform: ${sanitizeToken(input.platform ?? "unknown") || "unknown"}`,
    `- fingerprint: ${fingerprint}`,
    "",
    "## Reproduction notes",
    ...sanitizeSteps(input.reproductionSteps ?? [], paths),
    "",
    "## Duplicate search terms",
    ...duplicateSearchTerms.map((term) => `- ${term}`),
    "",
    "## Privacy boundary",
    "- Generated from local Sane state for user review.",
    "- Prompts, responses, source code, repo paths, branch names, and secrets are intentionally omitted.",
    "- Submitting this draft requires a separate issue-relay action; telemetry consent alone is not permission."
  ];

  return {
    mode: config.issueRelay.mode,
    title: `[${category}] ${summary}`.slice(0, 120),
    body: `${lines.join("\n")}\n`,
    duplicateSearchTerms,
    fingerprint
  };
}

export function submitIssueRelayDraft(
  paths: ProjectPaths,
  input: IssueRelaySubmitInput,
  config: LocalConfig = loadOrDefaultLocalConfig(paths)
): OperationResult {
  const draftPath = isAbsolute(input.draftPath)
    ? resolve(input.draftPath)
    : resolve(paths.projectRoot, input.draftPath);
  const draftDir = resolve(paths.runtimeRoot, "issue-relay");
  const blocked = (summary: string, details: string[]) => {
    recordTelemetryEvent(paths, {
      category: "issue-relay",
      action: "submit",
      result: "blocked",
      surface: "control-plane"
    }, config);
    return new OperationResult({
      kind: OperationKind.SubmitIssueDraft,
      summary,
      status: "blocked",
      details,
      pathsTouched: [paths.configPath]
    });
  };

  if (config.issueRelay.mode !== "issue-review") {
    return blocked("issue relay: submit blocked", [
      `mode: ${config.issueRelay.mode}`,
      "issue submit requires issue-relay mode issue-review",
      "telemetry consent does not enable GitHub reporting"
    ]);
  }

  const draftRelativePath = relative(draftDir, draftPath);
  if (
    draftRelativePath.length === 0
    || draftRelativePath.startsWith("..")
    || isAbsolute(draftRelativePath)
    || !draftPath.endsWith(".md")
  ) {
    return blocked("issue relay: submit blocked", [
      "draft must be a markdown file under .sane/issue-relay",
      `draft: ${sanitizeLine(draftPath, paths)}`
    ]);
  }

  if (!existsSync(draftPath)) {
    return blocked("issue relay: submit blocked", [
      "draft file not found",
      `draft: ${sanitizeLine(draftPath, paths)}`
    ]);
  }

  if (lstatSync(draftPath).isSymbolicLink()) {
    return blocked("issue relay: submit blocked", [
      "draft file must not be a symlink",
      `draft: ${sanitizeLine(draftPath, paths)}`
    ]);
  }

  const realDraftDir = realpathSync(draftDir);
  const realDraftPath = realpathSync(draftPath);
  const realRelativePath = relative(realDraftDir, realDraftPath);
  if (realRelativePath.length === 0 || realRelativePath.startsWith("..") || isAbsolute(realRelativePath)) {
    return blocked("issue relay: submit blocked", [
      "draft file must resolve under .sane/issue-relay",
      `draft: ${sanitizeLine(draftPath, paths)}`
    ]);
  }

  const draftFile = readFileSync(draftPath, "utf8");
  const parsed = parseDraftMarkdown(draftFile);
  if (!parsed) {
    return blocked("issue relay: submit blocked", [
      "draft file is not a Sane issue relay draft",
      `draft: ${sanitizeLine(draftPath, paths)}`
    ]);
  }

  const repoArgs = input.repo ? ["--repo", input.repo] : [];
  const candidates = trySearchDuplicateIssues(parsed.duplicateSearchTerms, repoArgs);
  if (candidates === null) {
    return blocked("issue relay: duplicate search failed", [
      "GitHub issue creation was not run",
      "check `gh auth status` and repository permissions"
    ]);
  }
  if (candidates.length > 0) {
    recordTelemetryEvent(paths, {
      category: "issue-relay",
      action: "submit",
      result: "blocked",
      surface: "control-plane"
    }, config);
    return new OperationResult({
      kind: OperationKind.SubmitIssueDraft,
      summary: "issue relay: possible duplicate issues found",
      status: "blocked",
      details: [
        "review duplicates before creating a new issue",
        ...candidates.map((candidate) => `#${candidate.number}: ${candidate.title} ${candidate.url}`),
        "do not create a new issue until these have been reviewed"
      ],
      pathsTouched: [draftPath]
    });
  }

  try {
    const url = ghRunner([
      "issue",
      "create",
      ...repoArgs,
      "--title",
      parsed.title,
      "--body-file",
      realDraftPath
    ]).trim();
    recordTelemetryEvent(paths, {
      category: "issue-relay",
      action: "submit",
      result: "submitted",
      surface: "control-plane"
    }, config);
    return new OperationResult({
      kind: OperationKind.SubmitIssueDraft,
      summary: "issue relay: GitHub issue submitted",
      details: [
        `url: ${url || "<not returned by gh>"}`,
        "telemetry consent was not used as submit permission"
      ],
      pathsTouched: [draftPath]
    });
  } catch (error) {
    recordTelemetryEvent(paths, {
      category: "issue-relay",
      action: "submit",
      result: "blocked",
      surface: "control-plane"
    }, config);
    return new OperationResult({
      kind: OperationKind.SubmitIssueDraft,
      summary: "issue relay: GitHub submit failed",
      status: "failed",
      details: [
        sanitizeLine(error instanceof Error ? error.message : String(error), paths),
        "check `gh auth status` and repository permissions"
      ],
      pathsTouched: [draftPath]
    });
  }
}

export function submitLatestIssueRelayDraft(
  paths: ProjectPaths,
  input: Omit<IssueRelaySubmitInput, "draftPath"> = {},
  config: LocalConfig = loadOrDefaultLocalConfig(paths)
): OperationResult {
  const draftPath = latestIssueRelayDraftPath(paths);
  if (!draftPath) {
    return new OperationResult({
      kind: OperationKind.SubmitIssueDraft,
      summary: "issue relay: submit blocked",
      status: "blocked",
      details: [
        "no local issue draft found",
        "run `sane issue draft` first"
      ],
      pathsTouched: [join(paths.runtimeRoot, "issue-relay")]
    });
  }

  return submitIssueRelayDraft(paths, {
    ...input,
    draftPath
  }, config);
}

function latestIssueRelayDraftPath(paths: ProjectPaths): string | null {
  const draftDir = join(paths.runtimeRoot, "issue-relay");
  if (!existsSync(draftDir)) {
    return null;
  }

  const entries = readdirSync(draftDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => {
      const draftPath = join(draftDir, entry);
      return {
        path: draftPath,
        mtimeMs: statSync(draftPath).mtimeMs
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return entries[0]?.path ?? null;
}

export function writeIssueRelayDraft(
  paths: ProjectPaths,
  input: IssueRelayDraftInput,
  config: LocalConfig = loadOrDefaultLocalConfig(paths)
): OperationResult {
  const draft = buildIssueRelayDraft(paths, input, config);
  const draftDir = join(paths.runtimeRoot, "issue-relay");
  const draftPath = join(draftDir, `${Date.now()}-${draft.fingerprint}.md`);

  if (config.issueRelay.mode === "off") {
    recordTelemetryEvent(paths, {
      category: "issue-relay",
      action: "draft",
      result: "blocked",
      surface: "control-plane",
      errorFingerprint: draft.fingerprint
    }, config);
    return new OperationResult({
      kind: OperationKind.ReviewIssueDraft,
      summary: "issue relay: disabled",
      status: "blocked",
      details: [
        "mode: off",
        "telemetry consent does not enable GitHub reporting",
        "enable issue-relay mode before generating local drafts"
      ],
      pathsTouched: [paths.configPath]
    });
  }

  mkdirSync(draftDir, { recursive: true });
  writeFileSync(draftPath, renderDraftMarkdown(draft), "utf8");
  recordTelemetryEvent(paths, {
    category: "issue-relay",
    action: "draft",
    result: "drafted",
    surface: "control-plane",
    errorFingerprint: draft.fingerprint
  }, config);

  return new OperationResult({
    kind: OperationKind.ReviewIssueDraft,
    summary: `issue relay: draft written to ${draftPath}`,
    details: [
      `mode: ${draft.mode}`,
      `title: ${draft.title}`,
      `fingerprint: ${draft.fingerprint}`,
      "submit: not run; review required before GitHub issue submit; PR relay is separate"
    ],
    pathsTouched: [draftPath]
  });
}

function renderDraftMarkdown(draft: IssueRelayDraft): string {
  return [`# ${draft.title}`, "", draft.body].join("\n");
}

function parseDraftMarkdown(markdown: string): {
  title: string;
  duplicateSearchTerms: string[];
} | null {
  const lines = markdown.split(/\r?\n/);
  const heading = lines[0];
  if (!heading?.startsWith("# [")) {
    return null;
  }

  const duplicateHeaderIndex = lines.findIndex((line) => line.trim() === "## Duplicate search terms");
  if (duplicateHeaderIndex < 0) {
    return null;
  }
  const duplicateSearchTerms = parseDuplicateTerms(lines, duplicateHeaderIndex);
  if (duplicateSearchTerms.length === 0) {
    return null;
  }

  return {
    title: heading.replace(/^#\s+/, "").slice(0, 120),
    duplicateSearchTerms
  };
}

function parseDuplicateTerms(lines: string[], duplicateHeaderIndex: number): string[] {
  const terms: string[] = [];
  for (const line of lines.slice(duplicateHeaderIndex + 1)) {
    if (line.startsWith("## ")) {
      break;
    }
    if (line.startsWith("- ")) {
      terms.push(line.slice(2).trim());
    }
  }
  return terms.filter((term) => term.length > 0).slice(0, 3);
}

function trySearchDuplicateIssues(
  duplicateSearchTerms: string[],
  repoArgs: string[]
): IssueRelayDuplicateCandidate[] | null {
  const candidates = new Map<number, IssueRelayDuplicateCandidate>();
  try {
    for (const term of duplicateSearchTerms.slice(0, 3)) {
      const output = ghRunner([
        "issue",
        "list",
        ...repoArgs,
        "--state",
        "all",
        "--search",
        term,
        "--json",
        "number,title,url",
        "--limit",
        "5"
      ]);
      for (const candidate of parseDuplicateCandidates(output)) {
        candidates.set(candidate.number, candidate);
      }
    }
  } catch {
    return null;
  }
  return [...candidates.values()].slice(0, 5);
}

function parseDuplicateCandidates(output: string): IssueRelayDuplicateCandidate[] {
  const parsed = parseJsonValue(output);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry) => {
    const candidate = asPlainRecord(entry);
    const number = candidate?.number;
    if (
      !candidate
      || typeof number !== "number"
      || !Number.isInteger(number)
      || typeof candidate.title !== "string"
      || typeof candidate.url !== "string"
    ) {
      return [];
    }

    return [{
      number,
      title: candidate.title.slice(0, 120),
      url: candidate.url
    }];
  });
}

function sanitizeSteps(steps: string[], paths: ProjectPaths): string[] {
  const sanitized = steps
    .map((step) => sanitizeLine(step, paths))
    .filter((step) => step.length > 0)
    .slice(0, 8);

  if (sanitized.length === 0) {
    return ["- Not captured."];
  }

  return sanitized.map((step) => `- ${step}`);
}

function sanitizeLine(value: string, paths: ProjectPaths): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (oneLine.length === 0) {
    return "";
  }

  return stripSensitive(oneLine, paths).slice(0, 300);
}

function sanitizeToken(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripSensitive(value: string, paths: ProjectPaths): string {
  let sanitized = value;
  const forbiddenPaths = [
    paths.projectRoot,
    paths.runtimeRoot,
    paths.configPath,
    paths.currentRunPath,
    paths.summaryPath,
    paths.briefPath
  ].sort((left, right) => right.length - left.length);

  for (const path of forbiddenPaths) {
    sanitized = sanitized.split(path).join("<local-path>");
  }

  sanitized = sanitized.replace(/\/Users\/[^/\s]+/g, "<home>");
  sanitized = sanitized.replace(/[A-Z]:\\Users\\[^\\\s]+/g, "<home>");
  sanitized = sanitized.replace(/(sk-[a-zA-Z0-9_-]{8,})/g, "<secret>");
  sanitized = sanitized.replace(/\b(ghp|github_pat|glpat)_[a-zA-Z0-9_]{8,}/g, "<secret>");
  sanitized = sanitized.replace(/\b(token|password|secret)=\S+/gi, "$1=<redacted>");
  sanitized = sanitized.replace(/\b(prompt|response):\s*[^.;]+/gi, "$1: <omitted>");
  sanitized = sanitized.replace(/\b(branch|git branch):\s*[^.;]+/gi, "$1: <omitted>");
  sanitized = sanitized.replace(/\b(feature|bugfix|hotfix|release)\/[a-zA-Z0-9._/-]+/g, "<branch>");

  if (looksLikeCode(sanitized)) {
    return "[details omitted: code-like content]";
  }

  return sanitized;
}

function looksLikeCode(value: string): boolean {
  return /```|;\s*$|\bfunction\s+\w+\s*\(|=>\s*\{|class\s+\w+\s*\{|import\s+.+\s+from\s+/.test(value);
}

function fingerprintFor(parts: string[]): string {
  let hash = 2166136261;
  for (const part of parts.join("|")) {
    hash ^= part.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sane-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
