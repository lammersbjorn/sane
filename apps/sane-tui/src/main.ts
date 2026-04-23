import {
  createCodexPaths,
  createProjectPaths,
  discoverCodexPaths,
  discoverProjectPaths,
  type CodexPaths,
  type HomeDirEnv,
  type ProjectPaths
} from "@sane/platform";

import { type LaunchShortcut } from "@sane/sane-tui/command-registry.js";
import { loadDashboardView, type DashboardView } from "@sane/sane-tui/dashboard.js";
import { createTuiShell, type TuiShell } from "@sane/sane-tui/shell.js";

export interface SaneTuiApp {
  paths: ProjectPaths;
  codexPaths: CodexPaths;
  shell: TuiShell;
  dashboard: DashboardView;
}

export function createSaneTuiApp(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  input?: { launchShortcut?: LaunchShortcut }
): SaneTuiApp {
  const shell = createTuiShell(paths, codexPaths, input?.launchShortcut ?? "default");
  return {
    paths,
    codexPaths,
    shell,
    dashboard: loadDashboardView(shell)
  };
}

export function createSaneTuiAppFromRoots(
  projectRoot: string,
  homeDir: string,
  input?: { launchShortcut?: LaunchShortcut }
): SaneTuiApp {
  return createSaneTuiApp(
    createProjectPaths(projectRoot),
    createCodexPaths(homeDir),
    input
  );
}

export function createSaneTuiAppFromDiscovery(
  startPath: string,
  env: HomeDirEnv = process.env,
  input?: { launchShortcut?: LaunchShortcut }
): SaneTuiApp {
  return createSaneTuiApp(
    discoverProjectPaths(startPath),
    discoverCodexPaths(env),
    input
  );
}

export function refreshSaneTuiApp(app: SaneTuiApp): SaneTuiApp {
  return {
    ...app,
    dashboard: loadDashboardView(app.shell)
  };
}
