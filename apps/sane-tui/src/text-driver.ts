import { type OperationResult } from "@sane/core";
import {
  type CodexPaths,
  discoverCodexPaths,
  discoverProjectPaths,
  type HomeDirEnv,
  type ProjectPaths
} from "@sane/platform";

import { loadAppView } from "@/app-view.js";
import { type TuiInputKey, handleTuiInput } from "@/input-driver.js";
import { createSaneTuiApp, type SaneTuiApp } from "@/main.js";
import { renderTextAppView } from "@/text-renderer.js";

export interface TextTuiRuntime {
  app: SaneTuiApp;
  render: () => string;
  handleInput: (key: TuiInputKey) => OperationResult | null;
}

export function createTextTuiRuntime(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  input?: { launchShortcut?: "default" | "settings" }
): TextTuiRuntime {
  const app = createSaneTuiApp(paths, codexPaths, input);

  return {
    app,
    render: () => renderTextAppView(loadAppView(app.shell)),
    handleInput: (key) => handleTuiInput(app.shell, key)
  };
}

export function createTextTuiRuntimeFromDiscovery(
  startPath: string,
  env: HomeDirEnv = process.env,
  input?: { launchShortcut?: "default" | "settings" }
): TextTuiRuntime {
  return createTextTuiRuntime(
    discoverProjectPaths(startPath),
    discoverCodexPaths(env),
    input
  );
}
