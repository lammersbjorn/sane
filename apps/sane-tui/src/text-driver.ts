import { type OperationResult } from "@sane/core";
import {
  type CodexPaths,
  discoverCodexPaths,
  discoverProjectPaths,
  type HomeDirEnv,
  type ProjectPaths
} from "@sane/platform";

import { type LaunchShortcut } from "@sane/sane-tui/command-registry.js";
import { loadAppView } from "@sane/sane-tui/app-view.js";
import { type TuiInputKey, handleTuiInput } from "@sane/sane-tui/input-driver.js";
import { createSaneTuiApp, type SaneTuiApp } from "@sane/sane-tui/main.js";
import { renderTextAppView, type TextViewport } from "@sane/sane-tui/text-renderer.js";

export interface TextTuiRuntime {
  app: SaneTuiApp;
  render: (viewport?: TextViewport) => string;
  handleInput: (key: TuiInputKey) => OperationResult | null;
}

export function createTextTuiRuntime(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  input?: { launchShortcut?: LaunchShortcut }
): TextTuiRuntime {
  const app = createSaneTuiApp(paths, codexPaths, input);

  return {
    app,
    render: (viewport) => renderTextAppView(loadAppView(app.shell), viewport),
    handleInput: (key) => handleTuiInput(app.shell, key)
  };
}

export function createTextTuiRuntimeFromDiscovery(
  startPath: string,
  env: HomeDirEnv = process.env,
  input?: { launchShortcut?: LaunchShortcut }
): TextTuiRuntime {
  return createTextTuiRuntime(
    discoverProjectPaths(startPath),
    discoverCodexPaths(env),
    input
  );
}
