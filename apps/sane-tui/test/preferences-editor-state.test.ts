import { describe, expect, it } from "vitest";

import { createDefaultLocalConfig } from "@sane/config";

import {
  CONFIG_FIELD_METADATA,
  createConfigEditorState,
  createPackEditorState,
  createPrivacyEditorState,
  cycleSelectedConfigField,
  cycleTelemetryLevel,
  moveConfigFieldSelection,
  movePackSelection,
  resetConfigEditor,
  resetPackEditor,
  resetPrivacyEditor,
  toggleSelectedPack
} from "@sane/sane-tui/preferences-editor-state.js";

function expectSaveResetAffordances(
  value: unknown,
  expected: { canSave: boolean; canReset: boolean }
): void {
  expect(value).toEqual(expect.objectContaining(expected));
}

function configFieldValue(field: keyof typeof CONFIG_FIELD_METADATA, config: ReturnType<typeof createDefaultLocalConfig>): string {
  return CONFIG_FIELD_METADATA[field].value(config);
}

function selectConfigField(
  editor: ReturnType<typeof createConfigEditorState>,
  index: number
): ReturnType<typeof createConfigEditorState> {
  let next = editor;
  for (let offset = 0; offset < index; offset += 1) {
    next = moveConfigFieldSelection(next, 1);
  }
  return next;
}

describe("preferences editor state", () => {
  it("keeps config editor field order and cycles editable routing defaults", () => {
    const config = createDefaultLocalConfig();
    const defaults = createDefaultLocalConfig();
    const editor = createConfigEditorState(config, defaults);

    expect(editor.fields).toEqual([
      "coordinator_model",
      "coordinator_reasoning",
      "sidecar_model",
      "sidecar_reasoning",
      "verifier_model",
      "verifier_reasoning"
    ]);

    const moved = moveConfigFieldSelection(editor, 1);
    expect(moved.selected).toBe(1);

    const cycled = cycleSelectedConfigField(editor, 1);
    expect(cycled.config.models.coordinator.model).not.toBe(config.models.coordinator.model);
    expect(cycleSelectedConfigField(editor, -1).config.models.coordinator.model).toBe(
      previousOption(CONFIG_FIELD_METADATA.coordinator_model.options, config.models.coordinator.model)
    );

    const coordinatorReasoning = cycleSelectedConfigField(moveConfigFieldSelection(editor, 1), 1);
    expect(coordinatorReasoning.config.models.coordinator.reasoningEffort).toBe("xhigh");

    const verifierReasoning = cycleSelectedConfigField(
      moveConfigFieldSelection(
        moveConfigFieldSelection(
          moveConfigFieldSelection(moveConfigFieldSelection(moveConfigFieldSelection(editor, 1), 1), 1),
          1
        ),
        1
      ),
      1
    );
    expect(verifierReasoning.config.models.verifier.reasoningEffort).toBe("xhigh");

    const reset = resetConfigEditor(cycled);
    expect(reset.config).toEqual(defaults);
  });

  it("cycles each config field through its declared values", () => {
    const defaults = createDefaultLocalConfig();
    const editor = createConfigEditorState(defaults, defaults);

    editor.fields.forEach((field, index) => {
      const selected = selectConfigField(editor, index);
      const next = cycleSelectedConfigField(selected, 1);

      expect(configFieldValue(field, next.config)).not.toBe(configFieldValue(field, defaults));
    });

    const reverseModel = cycleSelectedConfigField(editor, -1);
    expect(reverseModel.config.models.coordinator.model).toBe(
      previousOption(CONFIG_FIELD_METADATA.coordinator_model.options, defaults.models.coordinator.model)
    );

    const reasoningEditor = moveConfigFieldSelection(editor, 1);
    const reverseReasoning = cycleSelectedConfigField(reasoningEditor, -1);
    const reasoningOptions = [...CONFIG_FIELD_METADATA.coordinator_reasoning.options];
    const defaultReasoning = defaults.models.coordinator.reasoningEffort;
    expect(reverseReasoning.config.models.coordinator.reasoningEffort).toBe(
      reasoningOptions[
        (reasoningOptions.indexOf(defaultReasoning) + reasoningOptions.length - 1) % reasoningOptions.length
      ]
    );
  });

  it("toggles optional packs with core locked on and resets to defaults", () => {
    const editor = createPackEditorState(createDefaultLocalConfig());

    expect(editor.fields).toEqual(["caveman", "rtk", "frontend_craft"]);

    const toggled = toggleSelectedPack(editor);
    expect(toggled.config.packs.caveman).toBe(true);
    expect(toggled.config.packs.core).toBe(true);

    const moved = movePackSelection(toggled, 1);
    expect(moved.selected).toBe(1);
    expect(movePackSelection(editor, -1).selected).toBe(editor.fields.length - 1);

    const reset = resetPackEditor(moved);
    expect(reset.config.packs).toEqual(createDefaultLocalConfig().packs);
  });

  it("cycles privacy telemetry levels in both directions and resets to off", () => {
    const editor = createPrivacyEditorState(createDefaultLocalConfig());

    const once = cycleTelemetryLevel(editor, 1);
    const twice = cycleTelemetryLevel(once, 1);
    const wrapped = cycleTelemetryLevel(twice, 1);
    const reverseWrapped = cycleTelemetryLevel(editor, -1);

    expect(once.config.privacy.telemetry).toBe("local-only");
    expect(twice.config.privacy.telemetry).toBe("product-improvement");
    expect(wrapped.config.privacy.telemetry).toBe("off");
    expect(reverseWrapped.config.privacy.telemetry).toBe("product-improvement");
    expect(resetPrivacyEditor(twice).config.privacy.telemetry).toBe("off");
  });

  it("surfaces save/reset affordances for dirty editor state", () => {
    const defaults = createDefaultLocalConfig();

    const cleanConfig = createConfigEditorState(defaults, defaults);
    expectSaveResetAffordances(cleanConfig, { canSave: false, canReset: false });
    const dirtyConfig = cycleSelectedConfigField(cleanConfig, 1);
    expectSaveResetAffordances(dirtyConfig, { canSave: true, canReset: true });
    expectSaveResetAffordances(resetConfigEditor(dirtyConfig), { canSave: false, canReset: false });

    const cleanPacks = createPackEditorState(defaults);
    expectSaveResetAffordances(cleanPacks, { canSave: false, canReset: false });
    const dirtyPacks = toggleSelectedPack(cleanPacks);
    expectSaveResetAffordances(dirtyPacks, { canSave: true, canReset: true });
    expectSaveResetAffordances(resetPackEditor(dirtyPacks), { canSave: false, canReset: false });

    const cleanPrivacy = createPrivacyEditorState(defaults);
    expectSaveResetAffordances(cleanPrivacy, { canSave: false, canReset: false });
    const dirtyPrivacy = cycleTelemetryLevel(cleanPrivacy, 1);
    expectSaveResetAffordances(dirtyPrivacy, { canSave: true, canReset: true });
    expectSaveResetAffordances(resetPrivacyEditor(dirtyPrivacy), { canSave: false, canReset: false });
  });
});

function previousOption<T extends string>(options: readonly T[], value: T): T {
  return options[(options.indexOf(value) + options.length - 1) % options.length];
}
