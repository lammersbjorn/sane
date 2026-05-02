export const FRONTEND_CRAFT_WIRE_KEY = 'frontend-craft';
export const ISSUE_RELAY_WIRE_KEY = 'issue-relay';
export const LIFECYCLE_HOOKS_WIRE_KEY = 'lifecycle-hooks';
export const TOKSCALE_SUBMIT_WIRE_KEY = 'tokscale-submit';
export const TOKSCALE_DRY_RUN_WIRE_KEY = 'tokscale-dry-run';
export const RATE_LIMIT_RESUME_WIRE_KEY = 'rate-limit-resume';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string');
}

export function normalizeModelPreset(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    model: value.model,
    reasoningEffort: value.reasoning_effort ?? value.reasoningEffort,
  };
}

export function normalizeLocalConfigInput(
  value: unknown,
  optionalPackNames: readonly string[],
  optionalPackConfigKey: (pack: string) => string,
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const models = isRecord(value.models)
    ? {
        coordinator: normalizeModelPreset(value.models.coordinator),
        sidecar: normalizeModelPreset(value.models.sidecar),
        verifier: normalizeModelPreset(value.models.verifier),
      }
    : undefined;

  const privacy = isRecord(value.privacy)
    ? {
        telemetry: value.privacy.telemetry,
      }
    : undefined;

  const rawIssueRelay = isRecord(value[ISSUE_RELAY_WIRE_KEY])
    ? value[ISSUE_RELAY_WIRE_KEY]
    : isRecord(value.issueRelay)
      ? value.issueRelay
      : undefined;
  const issueRelay = rawIssueRelay
    ? {
        mode: rawIssueRelay.mode,
      }
    : undefined;

  const subagents = isRecord(value.subagents)
    ? {
        explorer: normalizeModelPreset(value.subagents.explorer),
        implementation: normalizeModelPreset(value.subagents.implementation),
        verifier: normalizeModelPreset(value.subagents.verifier),
        realtime: normalizeModelPreset(value.subagents.realtime),
        frontendCraft: normalizeModelPreset(
          value.subagents[FRONTEND_CRAFT_WIRE_KEY] ?? value.subagents.frontendCraft,
        ),
      }
    : undefined;

  const rawPacks = isRecord(value.packs) ? value.packs : undefined;
  const packs = rawPacks
    ? {
        core: rawPacks.core,
        ...Object.fromEntries(
          optionalPackNames.map((pack) => [
            optionalPackConfigKey(pack),
            rawPacks[pack] ?? rawPacks[optionalPackConfigKey(pack)],
          ]),
        ),
      }
    : undefined;

  const rawLifecycleHooks = isRecord(value[LIFECYCLE_HOOKS_WIRE_KEY])
    ? value[LIFECYCLE_HOOKS_WIRE_KEY]
    : isRecord(value.lifecycleHooks)
      ? value.lifecycleHooks
      : undefined;
  const lifecycleHooks = rawLifecycleHooks
    ? {
        tokscaleSubmit: rawLifecycleHooks[TOKSCALE_SUBMIT_WIRE_KEY] ?? rawLifecycleHooks.tokscaleSubmit,
        tokscaleDryRun: rawLifecycleHooks[TOKSCALE_DRY_RUN_WIRE_KEY] ?? rawLifecycleHooks.tokscaleDryRun,
        rateLimitResume: rawLifecycleHooks[RATE_LIMIT_RESUME_WIRE_KEY] ?? rawLifecycleHooks.rateLimitResume,
      }
    : undefined;

  const updates = isRecord(value.updates)
    ? {
        auto: value.updates.auto,
      }
    : undefined;

  return {
    version: value.version,
    models,
    subagents,
    privacy,
    issueRelay,
    packs,
    lifecycleHooks,
    updates,
  };
}
