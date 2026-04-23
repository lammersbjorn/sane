import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

export type StateFile =
  | 'config'
  | 'summary'
  | 'currentRun'
  | 'brief'
  | 'events'
  | 'decisions'
  | 'artifacts';

export interface StateFileRef {
  file: StateFile;
  path: string;
}

export interface ProjectPaths {
  projectRoot: string;
  repoAgentsDir: string;
  repoSkillsDir: string;
  repoAgentsMd: string;
  runtimeRoot: string;
  configPath: string;
  stateDir: string;
  currentRunPath: string;
  summaryPath: string;
  eventsPath: string;
  decisionsPath: string;
  artifactsPath: string;
  briefPath: string;
  cacheDir: string;
  backupsDir: string;
  codexConfigBackupsDir: string;
  logsDir: string;
  sessionsDir: string;
  telemetryDir: string;
  telemetrySummaryPath: string;
  telemetryEventsPath: string;
  telemetryQueuePath: string;
}

export interface CodexPaths {
  homeDir: string;
  codexHome: string;
  configToml: string;
  modelsCacheJson: string;
  authJson: string;
  opencodeConfigDir: string;
  opencodeGlobalAgentsDir: string;
  userAgentsDir: string;
  userSkillsDir: string;
  customAgentsDir: string;
  globalAgentsMd: string;
  hooksJson: string;
}

export interface HomeDirEnv {
  HOME?: string;
  USERPROFILE?: string;
  HOMEDRIVE?: string;
  HOMEPATH?: string;
}

export type HostPlatform = 'macos' | 'linux' | 'windows';

export function createProjectPaths(projectRoot: string): ProjectPaths {
  const repoAgentsDir = join(projectRoot, '.agents');
  const runtimeRoot = join(projectRoot, '.sane');
  const stateDir = join(runtimeRoot, 'state');
  const cacheDir = join(runtimeRoot, 'cache');
  const backupsDir = join(runtimeRoot, 'backups');
  const telemetryDir = join(runtimeRoot, 'telemetry');

  return {
    projectRoot,
    repoAgentsDir,
    repoSkillsDir: join(repoAgentsDir, 'skills'),
    repoAgentsMd: join(projectRoot, 'AGENTS.md'),
    runtimeRoot,
    configPath: join(runtimeRoot, 'config.local.toml'),
    stateDir,
    currentRunPath: join(stateDir, 'current-run.json'),
    summaryPath: join(stateDir, 'summary.json'),
    eventsPath: join(stateDir, 'events.jsonl'),
    decisionsPath: join(stateDir, 'decisions.jsonl'),
    artifactsPath: join(stateDir, 'artifacts.jsonl'),
    briefPath: join(runtimeRoot, 'BRIEF.md'),
    cacheDir,
    backupsDir,
    codexConfigBackupsDir: join(backupsDir, 'codex-config'),
    logsDir: join(runtimeRoot, 'logs'),
    sessionsDir: join(runtimeRoot, 'sessions'),
    telemetryDir,
    telemetrySummaryPath: join(telemetryDir, 'summary.json'),
    telemetryEventsPath: join(telemetryDir, 'events.jsonl'),
    telemetryQueuePath: join(telemetryDir, 'queue.jsonl'),
  };
}

export function discoverProjectPaths(startPath: string): ProjectPaths {
  const startDir = startDirForDiscovery(startPath);
  let packageRoot: string | undefined;

  for (const candidate of ancestors(startDir)) {
    const marker = projectRootMarker(candidate);
    if (marker === 'workspace' || marker === 'git' || marker === 'runtime') {
      return createProjectPaths(candidate);
    }
    if (marker === 'package' && !packageRoot) {
      packageRoot = candidate;
    }
  }

  return createProjectPaths(packageRoot ?? startDir);
}

export function ensureRuntimeDirs(paths: ProjectPaths): void {
  for (const dir of [
    paths.runtimeRoot,
    paths.stateDir,
    paths.cacheDir,
    paths.backupsDir,
    paths.codexConfigBackupsDir,
    paths.logsDir,
    paths.sessionsDir,
    paths.telemetryDir,
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function stateFilePath(paths: ProjectPaths, file: StateFile): string {
  switch (file) {
    case 'config':
      return paths.configPath;
    case 'summary':
      return paths.summaryPath;
    case 'currentRun':
      return paths.currentRunPath;
    case 'brief':
      return paths.briefPath;
    case 'events':
      return paths.eventsPath;
    case 'decisions':
      return paths.decisionsPath;
    case 'artifacts':
      return paths.artifactsPath;
  }
}

export function canonicalStateLoadOrder(paths: ProjectPaths): StateFileRef[] {
  return [
    { file: 'config', path: stateFilePath(paths, 'config') },
    { file: 'summary', path: stateFilePath(paths, 'summary') },
    { file: 'currentRun', path: stateFilePath(paths, 'currentRun') },
    { file: 'brief', path: stateFilePath(paths, 'brief') },
  ];
}

export function rawStateHistoryFiles(paths: ProjectPaths): StateFileRef[] {
  return [
    { file: 'events', path: stateFilePath(paths, 'events') },
    { file: 'decisions', path: stateFilePath(paths, 'decisions') },
    { file: 'artifacts', path: stateFilePath(paths, 'artifacts') },
  ];
}

export function createCodexPaths(homeDir: string): CodexPaths {
  const codexHome = join(homeDir, '.codex');
  const userAgentsDir = join(homeDir, '.agents');
  const opencodeConfigDir = join(homeDir, ".config", "opencode");

  return {
    homeDir,
    codexHome,
    configToml: join(codexHome, 'config.toml'),
    modelsCacheJson: join(codexHome, 'models_cache.json'),
    authJson: join(codexHome, 'auth.json'),
    opencodeConfigDir,
    opencodeGlobalAgentsDir: join(opencodeConfigDir, "agents"),
    userAgentsDir,
    userSkillsDir: join(userAgentsDir, 'skills'),
    customAgentsDir: join(codexHome, 'agents'),
    globalAgentsMd: join(codexHome, 'AGENTS.md'),
    hooksJson: join(codexHome, 'hooks.json'),
  };
}

export function detectPlatform(nodePlatform: NodeJS.Platform = process.platform): HostPlatform {
  switch (nodePlatform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
}

export function discoverCodexPaths(env: HomeDirEnv = process.env): CodexPaths {
  const homeDir = resolveHomeDir(env);
  if (!homeDir) {
    throw new Error('could not resolve HOME, USERPROFILE, or HOMEDRIVE/HOMEPATH');
  }

  return createCodexPaths(homeDir);
}

export function resolveHomeDir(env: HomeDirEnv): string | undefined {
  const home = nonEmpty(env.HOME) ?? nonEmpty(env.USERPROFILE);
  if (home) {
    return home;
  }

  const drive = nonEmpty(env.HOMEDRIVE);
  const path = nonEmpty(env.HOMEPATH);
  if (drive && path) {
    return `${drive}${path}`;
  }

  return undefined;
}

export function isProjectRoot(candidate: string): boolean {
  return projectRootMarker(candidate) !== undefined;
}

export function startDirForDiscovery(startPath: string): string {
  try {
    if (statSync(startPath).isDirectory()) {
      return startPath;
    }
  } catch {
    // Missing paths fall back to the parent when possible.
  }

  const parent = dirname(startPath);
  if (parent === startPath) {
    return parse(startPath).root || '.';
  }

  return parent;
}

function ancestors(startPath: string): string[] {
  const chain: string[] = [];
  let current = startPath;

  for (;;) {
    chain.push(current);
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return chain;
}

type ProjectRootMarker = 'runtime' | 'git' | 'workspace' | 'package';

function projectRootMarker(candidate: string): ProjectRootMarker | undefined {
  if (existsSync(join(candidate, '.sane'))) {
    return 'runtime';
  }

  if (existsSync(join(candidate, '.git'))) {
    return 'git';
  }

  if (existsSync(join(candidate, 'pnpm-workspace.yaml'))) {
    return 'workspace';
  }

  if (existsSync(join(candidate, 'package.json'))) {
    return 'package';
  }

  return undefined;
}

function nonEmpty(value: string | undefined): string | undefined {
  if (value && value.length > 0) {
    return value;
  }
  return undefined;
}
