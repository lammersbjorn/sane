import type { ProjectPaths } from "@sane/platform";
import {
  evaluatePolicyFixtures,
  outcomeRunnerPreflightFixtures
} from "@sane/policy";
import type { LayeredStateLayerStatus } from "@sane/state";
import { isRealBlockingQuestion } from "./runtime-state-outcome.js";
import { outcomeRescueSignalChecks } from "./runtime-state-rescue-signals.js";
import type {
  OutcomeReadinessCheck,
  OutcomeReadinessStatus,
  RuntimeInspectSnapshot,
  SelfHostingShadowCheck
} from "./runtime-state.js";

export function buildSelfHostingShadowChecks(
  paths: ProjectPaths,
  runtime: RuntimeInspectSnapshot
): SelfHostingShadowCheck[] {
  return [
    runtimeLayerCheck("current-run", runtime.layerStatus.currentRun, paths.currentRunPath),
    runtimeLayerCheck("summary", runtime.layerStatus.summary, paths.summaryPath),
    runtimeLayerCheck("brief", runtime.layerStatus.brief, paths.briefPath),
    currentRunPayloadCheck(runtime.current),
    summaryPayloadCheck(runtime.summary),
    briefPayloadCheck(runtime.brief),
    blockingQuestionsCheck(runtime.current),
    verificationCheck(runtime.current),
    latestPolicyPreviewCheck(runtime.latestPolicyPreview),
    {
      id: "codex-native-memories",
      status: "pass",
      summary: "shadow inspection uses .sane handoff state and does not depend on Codex native memories",
      path: null
    },
    {
      id: "runner",
      status: "pass",
      summary: "self-hosting runner is disabled; this surface is read-only inspection only",
      path: null
    }
  ];
}

export function buildOutcomeReadinessChecks(
  paths: ProjectPaths,
  runtime: RuntimeInspectSnapshot
): OutcomeReadinessCheck[] {
  return [
    runtimeLayerCheck("current-run", runtime.layerStatus.currentRun, paths.currentRunPath),
    runtimeLayerCheck("summary", runtime.layerStatus.summary, paths.summaryPath),
    runtimeLayerCheck("brief", runtime.layerStatus.brief, paths.briefPath),
    currentRunPayloadCheck(runtime.current),
    summaryPayloadCheck(runtime.summary),
    briefPayloadCheck(runtime.brief),
    blockingQuestionsCheck(runtime.current),
    outcomeVerificationCheck(runtime.current),
    ...outcomeRescueSignalChecks(runtime),
    latestPolicyPreviewCheck(runtime.latestPolicyPreview),
    outcomePolicyPreflightCheck()
  ];
}

export function outcomeStatus(checks: OutcomeReadinessCheck[]): OutcomeReadinessStatus {
  const blockingIds = checks
    .filter((check) => check.status === "block")
    .map((check) => check.id);

  if (blockingIds.length === 0) {
    return "ready";
  }

  return blockingIds.includes("blocking-questions") ? "needs_input" : "blocked";
}

function runtimeLayerCheck(
  id: "current-run" | "summary" | "brief",
  layerStatus: LayeredStateLayerStatus,
  path: string
): SelfHostingShadowCheck {
  if (layerStatus === "present") {
    return {
      id,
      status: "pass",
      summary: `${id} layer is readable`,
      path
    };
  }

  return {
    id,
    status: "block",
    summary:
      layerStatus === "invalid"
        ? `${id} layer exists but cannot be parsed`
        : `${id} layer is missing`,
    path
  };
}

function currentRunPayloadCheck(current: RuntimeInspectSnapshot["current"]): SelfHostingShadowCheck {
  if (!current) {
    return {
      id: "current-run-payload",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const hasObjective = current.objective.trim().length > 0;
  const hasPhase = current.phase.trim().length > 0;
  const hasTasks = current.activeTasks.some((task) => task.trim().length > 0);

  if (hasObjective && hasPhase && hasTasks) {
    return {
      id: "current-run-payload",
      status: "pass",
      summary: "current-run has objective, phase, and active task context",
      path: null
    };
  }

  return {
    id: "current-run-payload",
    status: "block",
    summary: "current-run must include objective, phase, and at least one active task",
    path: null
  };
}

function summaryPayloadCheck(summary: RuntimeInspectSnapshot["summary"]): SelfHostingShadowCheck {
  if (!summary) {
    return {
      id: "summary-payload",
      status: "block",
      summary: "summary payload is unavailable",
      path: null
    };
  }

  return {
    id: "summary-payload",
    status: "pass",
    summary: "summary payload is readable",
    path: null
  };
}

function briefPayloadCheck(brief: RuntimeInspectSnapshot["brief"]): SelfHostingShadowCheck {
  if (brief && brief.trim().length > 0) {
    return {
      id: "brief-payload",
      status: "pass",
      summary: "brief payload is readable",
      path: null
    };
  }

  return {
    id: "brief-payload",
    status: "block",
    summary: "brief payload is missing or empty",
    path: null
  };
}

function blockingQuestionsCheck(current: RuntimeInspectSnapshot["current"]): SelfHostingShadowCheck {
  const blockers = current?.blockingQuestions.filter(isRealBlockingQuestion) ?? [];

  if (blockers.length === 0) {
    return {
      id: "blocking-questions",
      status: "pass",
      summary: "no unresolved blocking questions in current-run",
      path: null
    };
  }

  return {
    id: "blocking-questions",
    status: "block",
    summary: `${blockers.length} unresolved blocking question(s) must be answered before shadow work`,
    path: null
  };
}

function verificationCheck(current: RuntimeInspectSnapshot["current"]): SelfHostingShadowCheck {
  const status = current?.verification.status.trim().toLowerCase() ?? "";

  if (status.length === 0 || status === "unknown" || status === "pending") {
    return {
      id: "verification",
      status: "block",
      summary: "verification must pass before shadow readiness",
      path: null
    };
  }

  if (status === "failed" || status === "failing" || status === "blocked") {
    return {
      id: "verification",
      status: "block",
      summary: `verification status is ${current?.verification.status}`,
      path: null
    };
  }

  if (status !== "passed" && status !== "verified") {
    return {
      id: "verification",
      status: "block",
      summary: `verification status is ${current?.verification.status}`,
      path: null
    };
  }

  return {
    id: "verification",
    status: "pass",
    summary: `verification status is ${current?.verification.status}`,
    path: null
  };
}

function latestPolicyPreviewCheck(
  latestPolicyPreview: RuntimeInspectSnapshot["latestPolicyPreview"]
): SelfHostingShadowCheck {
  if (latestPolicyPreview.status === "present") {
    return {
      id: "latest-policy-preview",
      status: "pass",
      summary: `latest policy preview has ${latestPolicyPreview.scenarioCount} scenario(s)`,
      path: null
    };
  }

  return {
    id: "latest-policy-preview",
    status: "warn",
    summary: "latest policy preview is missing; current-run inspection can still proceed",
    path: null
  };
}

function outcomeVerificationCheck(current: RuntimeInspectSnapshot["current"]): OutcomeReadinessCheck {
  const status = current?.verification.status.trim().toLowerCase() ?? "";

  if (status === "failed" || status === "failing" || status === "blocked") {
    return {
      id: "verification",
      status: "block",
      summary: `verification status is ${current?.verification.status}`,
      path: null
    };
  }

  if (status === "passed" || status === "verified") {
    return {
      id: "verification",
      status: "pass",
      summary: `verification status is ${current?.verification.status}`,
      path: null
    };
  }

  return {
    id: "verification",
    status: "warn",
    summary: "verification is not complete yet; outcome work must verify before closing",
    path: null
  };
}

function outcomePolicyPreflightCheck(): OutcomeReadinessCheck {
  const result = evaluatePolicyFixtures(outcomeRunnerPreflightFixtures());

  if (result.passed) {
    return {
      id: "policy-preflight",
      status: "pass",
      summary: `B8 policy preflight passed (${result.caseCount} case(s))`,
      path: null
    };
  }

  return {
    id: "policy-preflight",
    status: "block",
    summary: `B8 policy preflight failed (${result.failureCount} failure(s) across ${result.caseCount} case(s))`,
    path: null
  };
}
