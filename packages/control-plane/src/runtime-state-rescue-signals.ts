import {
  OUTCOME_REPEATED_PHASE_THRESHOLD,
  OUTCOME_REPEATED_TOOL_ERROR_THRESHOLD,
  currentOutcomeLastAdvanceTsUnix,
  currentOutcomeMetadata,
  isRealBlockingQuestion
} from "./runtime-state-outcome.js";
import type {
  OutcomeReadinessCheck,
  OutcomeRescueSignalSnapshot,
  RuntimeInspectSnapshot
} from "./runtime-state.js";

const OUTCOME_STALL_WINDOW_SECONDS = 30 * 60;

export function outcomeRescueSignalChecks(
  runtime: RuntimeInspectSnapshot
): OutcomeReadinessCheck[] {
  return [
    outcomeLongSilenceSignalCheck(runtime),
    outcomeRepeatedPhaseSignalCheck(runtime),
    outcomeFileDeltaSignalCheck(runtime),
    outcomeRepeatedToolErrorSignalCheck(runtime)
  ];
}

export function inspectOutcomeRescueSignalFromRuntimeStateSnapshot(
  runtime: RuntimeInspectSnapshot
): OutcomeRescueSignalSnapshot {
  const signals = outcomeRescueSignalChecks(runtime);
  const blockSignals = signals.filter((signal) => signal.status === "block");
  const warnSignals = signals.filter((signal) => signal.status === "warn");
  const activeSignals = blockSignals.length > 0 ? blockSignals : warnSignals;

  if (activeSignals.length === 0) {
    return {
      status: "pass",
      summary: "no rescue signals detected",
      reasons: signals.map((signal) => signal.summary)
    };
  }

  return {
    status: blockSignals.length > 0 ? "block" : "warn",
    summary: activeSignals.map((signal) => signal.summary).join("; "),
    reasons: activeSignals.map((signal) => signal.summary)
  };
}

function outcomeLongSilenceSignalCheck(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck {
  const current = runtime.current;

  if (!current) {
    return {
      id: "long-silence",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const activeTasks = current.activeTasks.map((task) => task.trim()).filter((task) => task.length > 0);
  const blockers = current.blockingQuestions.filter(isRealBlockingQuestion);
  const verificationStatus = current.verification.status.trim().toLowerCase();

  if (activeTasks.length === 0 || blockers.length > 0) {
    return {
      id: "long-silence",
      status: "pass",
      summary: "no active unblocked work needs a stall check",
      path: null
    };
  }

  if (verificationStatus === "passed" || verificationStatus === "verified") {
    return {
      id: "long-silence",
      status: "pass",
      summary: "verification is already complete",
      path: null
    };
  }

  const latestProgressTs = latestPersistedOutcomeProgressTs(current, runtime.historyPreview);
  if (latestProgressTs === null) {
    return {
      id: "long-silence",
      status: "pass",
      summary: "no persisted progress signal exists yet",
      path: null
    };
  }

  const ageSeconds = nowSeconds() - latestProgressTs;
  if (ageSeconds >= OUTCOME_STALL_WINDOW_SECONDS) {
    return {
      id: "long-silence",
      status: "warn",
      summary: `long silence: no persisted progress for ${Math.floor(ageSeconds / 60)}m while ${activeTasks.length} task(s) remain open`,
      path: null
    };
  }

  return {
    id: "long-silence",
    status: "pass",
    summary: `recent persisted progress seen ${Math.floor(ageSeconds / 60)}m ago`,
    path: null
  };
}

function outcomeRepeatedPhaseSignalCheck(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck {
  const current = runtime.current;
  if (!current) {
    return {
      id: "repeated-phase",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const outcome = currentOutcomeMetadata(current);
  const phaseRepeatCount = outcome.phaseRepeatCount ?? 0;
  if (phaseRepeatCount >= OUTCOME_REPEATED_PHASE_THRESHOLD) {
    return {
      id: "repeated-phase",
      status: "warn",
      summary: `repeated phase: ${current.phase} seen ${phaseRepeatCount} time(s) without closing`,
      path: null
    };
  }

  return {
    id: "repeated-phase",
    status: "pass",
    summary: "no repeated phase signal detected",
    path: null
  };
}

function outcomeFileDeltaSignalCheck(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck {
  const current = runtime.current;
  if (!current) {
    return {
      id: "file-delta",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const activeTasks = current.activeTasks.map((task) => task.trim()).filter((task) => task.length > 0);
  const verificationStatus = current.verification.status.trim().toLowerCase();
  const filesTouched = runtime.summary?.filesTouched.length ?? 0;

  if (current.phase.trim().toLowerCase() === "setup") {
    return {
      id: "file-delta",
      status: "pass",
      summary: "setup phase does not need a file-delta check",
      path: null
    };
  }

  if (activeTasks.length === 0 || verificationStatus === "passed" || verificationStatus === "verified") {
    return {
      id: "file-delta",
      status: "pass",
      summary: "no active unverified work needs a file-delta check",
      path: null
    };
  }

  if (filesTouched === 0) {
    return {
      id: "file-delta",
      status: "warn",
      summary: "no file delta recorded while active unverified work remains",
      path: null
    };
  }

  return {
    id: "file-delta",
    status: "pass",
    summary: `file delta recorded (${filesTouched} file(s))`,
    path: null
  };
}

function outcomeRepeatedToolErrorSignalCheck(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck {
  const current = runtime.current;
  if (!current) {
    return {
      id: "repeated-tool-errors",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const outcome = currentOutcomeMetadata(current);
  const count = outcome.repeatedToolErrorCount ?? 0;
  if (count >= OUTCOME_REPEATED_TOOL_ERROR_THRESHOLD) {
    const suffix = outcome.lastToolError ? ` (${outcome.lastToolError})` : "";
    return {
      id: "repeated-tool-errors",
      status: "warn",
      summary: `repeated tool errors: ${count} recent failure(s)${suffix}`,
      path: null
    };
  }

  return {
    id: "repeated-tool-errors",
    status: "pass",
    summary: "no repeated tool error signal detected",
    path: null
  };
}

function latestPersistedOutcomeProgressTs(
  current: RuntimeInspectSnapshot["current"],
  historyPreview: RuntimeInspectSnapshot["historyPreview"]
): number | null {
  if (!current) {
    return null;
  }

  const values = [
    currentOutcomeLastAdvanceTsUnix(current),
    historyPreview.latestEvent?.tsUnix ?? null,
    historyPreview.latestDecision?.tsUnix ?? null,
    historyPreview.latestArtifact?.tsUnix ?? null
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
