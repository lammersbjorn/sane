import {
  PICKER_MODELS,
  REASONING_EFFORTS,
  TELEMETRY_LEVELS,
  createDefaultPackConfig,
  type LocalConfig
} from "@sane/config";

export type ConfigFieldId =
  | "coordinator_model"
  | "coordinator_reasoning"
  | "sidecar_model"
  | "sidecar_reasoning"
  | "verifier_model"
  | "verifier_reasoning";

export type PackFieldId = "caveman" | "cavemem" | "rtk" | "frontend_craft";

export interface ConfigEditorState {
  kind: "config";
  initial: LocalConfig;
  config: LocalConfig;
  defaults: LocalConfig;
  selected: number;
  fields: ConfigFieldId[];
  canSave: boolean;
  canReset: boolean;
}

export interface PackEditorState {
  kind: "packs";
  initial: LocalConfig["packs"];
  config: LocalConfig;
  defaults: LocalConfig["packs"];
  selected: number;
  fields: PackFieldId[];
  canSave: boolean;
  canReset: boolean;
}

export interface PrivacyEditorState {
  kind: "privacy";
  initial: LocalConfig["privacy"];
  config: LocalConfig;
  defaults: LocalConfig["privacy"];
  canSave: boolean;
  canReset: boolean;
}

const CONFIG_FIELDS: ConfigFieldId[] = [
  "coordinator_model",
  "coordinator_reasoning",
  "sidecar_model",
  "sidecar_reasoning",
  "verifier_model",
  "verifier_reasoning"
];

const PACK_FIELDS: PackFieldId[] = ["caveman", "cavemem", "rtk", "frontend_craft"];

export function createConfigEditorState(
  config: LocalConfig,
  defaults: LocalConfig
): ConfigEditorState {
  return withConfigAffordances({
    kind: "config",
    initial: structuredClone(config),
    config: structuredClone(config),
    defaults: structuredClone(defaults),
    selected: 0,
    fields: CONFIG_FIELDS
  });
}

export function moveConfigFieldSelection(
  state: ConfigEditorState,
  step: 1 | -1
): ConfigEditorState {
  return withConfigAffordances({
    ...state,
    selected: wrapIndex(state.selected + step, state.fields.length)
  });
}

export function cycleSelectedConfigField(
  state: ConfigEditorState,
  step: 1 | -1
): ConfigEditorState {
  const next = structuredClone(state);
  const field = state.fields[state.selected]!;

  switch (field) {
    case "coordinator_model":
      next.config.models.coordinator.model = cycleValue(PICKER_MODELS, next.config.models.coordinator.model, step);
      break;
    case "coordinator_reasoning":
      next.config.models.coordinator.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        next.config.models.coordinator.reasoningEffort,
        step
      );
      break;
    case "sidecar_model":
      next.config.models.sidecar.model = cycleValue(PICKER_MODELS, next.config.models.sidecar.model, step);
      break;
    case "sidecar_reasoning":
      next.config.models.sidecar.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        next.config.models.sidecar.reasoningEffort,
        step
      );
      break;
    case "verifier_model":
      next.config.models.verifier.model = cycleValue(PICKER_MODELS, next.config.models.verifier.model, step);
      break;
    case "verifier_reasoning":
      next.config.models.verifier.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        next.config.models.verifier.reasoningEffort,
        step
      );
      break;
  }

  return withConfigAffordances(next);
}

export function resetConfigEditor(state: ConfigEditorState): ConfigEditorState {
  return withConfigAffordances({
    ...state,
    config: structuredClone(state.defaults)
  });
}

export function createPackEditorState(config: LocalConfig): PackEditorState {
  return withPackAffordances({
    kind: "packs",
    initial: structuredClone(config.packs),
    config: structuredClone(config),
    defaults: createDefaultPackConfig(),
    selected: 0,
    fields: PACK_FIELDS
  });
}

export function movePackSelection(state: PackEditorState, step: 1 | -1): PackEditorState {
  return withPackAffordances({
    ...state,
    selected: wrapIndex(state.selected + step, state.fields.length)
  });
}

export function toggleSelectedPack(state: PackEditorState): PackEditorState {
  const next = structuredClone(state);
  const field = state.fields[state.selected]!;

  switch (field) {
    case "caveman":
      next.config.packs.caveman = !next.config.packs.caveman;
      break;
    case "cavemem":
      next.config.packs.cavemem = !next.config.packs.cavemem;
      break;
    case "rtk":
      next.config.packs.rtk = !next.config.packs.rtk;
      break;
    case "frontend_craft":
      next.config.packs.frontendCraft = !next.config.packs.frontendCraft;
      break;
  }

  next.config.packs.core = true;
  return withPackAffordances(next);
}

export function resetPackEditor(state: PackEditorState): PackEditorState {
  return withPackAffordances({
    ...state,
    config: {
      ...structuredClone(state.config),
      packs: structuredClone(state.defaults)
    }
  });
}

export function createPrivacyEditorState(config: LocalConfig): PrivacyEditorState {
  return withPrivacyAffordances({
    kind: "privacy",
    initial: structuredClone(config.privacy),
    config: structuredClone(config),
    defaults: { telemetry: "off" }
  });
}

export function cycleTelemetryLevel(
  state: PrivacyEditorState,
  step: 1 | -1
): PrivacyEditorState {
  return withPrivacyAffordances({
    ...state,
    config: {
      ...structuredClone(state.config),
      privacy: {
        telemetry: cycleValue(TELEMETRY_LEVELS, state.config.privacy.telemetry, step)
      }
    }
  });
}

export function resetPrivacyEditor(state: PrivacyEditorState): PrivacyEditorState {
  return withPrivacyAffordances({
    ...state,
    config: {
      ...structuredClone(state.config),
      privacy: {
        telemetry: "off"
      }
    }
  });
}

function cycleValue<const T extends readonly string[]>(
  values: T,
  current: string,
  step: 1 | -1
): T[number] {
  const index = values.indexOf(current as T[number]);
  return values[wrapIndex((index === -1 ? 0 : index) + step, values.length)]!;
}

function wrapIndex(index: number, length: number): number {
  return (index + length) % length;
}

function withConfigAffordances(state: Omit<ConfigEditorState, "canSave" | "canReset">): ConfigEditorState {
  const canSave = JSON.stringify(state.config) !== JSON.stringify(state.initial);
  const canReset = JSON.stringify(state.config) !== JSON.stringify(state.defaults);
  return {
    ...state,
    canSave,
    canReset
  };
}

function withPackAffordances(state: Omit<PackEditorState, "canSave" | "canReset">): PackEditorState {
  const canSave = JSON.stringify(state.config.packs) !== JSON.stringify(state.initial);
  const canReset = JSON.stringify(state.config.packs) !== JSON.stringify(state.defaults);
  return {
    ...state,
    canSave,
    canReset
  };
}

function withPrivacyAffordances(
  state: Omit<PrivacyEditorState, "canSave" | "canReset">
): PrivacyEditorState {
  const canSave = JSON.stringify(state.config.privacy) !== JSON.stringify(state.initial);
  const canReset = JSON.stringify(state.config.privacy) !== JSON.stringify(state.defaults);
  return {
    ...state,
    canSave,
    canReset
  };
}
