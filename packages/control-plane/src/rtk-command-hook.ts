const MANAGED_RTK_COMMAND_HOOK_COMMAND_SUFFIX = "hook rtk-command";

export const MANAGED_RTK_COMMAND_STATUS_MESSAGE = "Checking RTK command route";

export function buildManagedRtkCommandHookCommand(): string {
  const script = [
    "const { spawnSync } = require('node:child_process');",
    "let raw = '';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (chunk) => { raw += chunk; });",
    "process.stdin.on('end', () => {",
    "  let data = {};",
    "  try { data = JSON.parse(raw); } catch {}",
    "  if (data.tool_name !== 'Bash') process.exit(0);",
    "  const command = String(data.tool_input?.command || '').trim();",
    "  if (!command || /^rtk\\b/.test(command)) process.exit(0);",
    "  const deny = (reason) => {",
    "    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }) + '\\n');",
    "  };",
    "  const cwd = data.cwd || process.cwd();",
    "  const result = spawnSync('rtk', ['rewrite', command], { cwd, env: process.env, encoding: 'utf8', timeout: 3000, shell: process.platform === 'win32' });",
    "  const rewritten = (result.stdout || '').trim();",
    "  if (result.status === 0 && rewritten && rewritten !== command) {",
    "    deny(`RTK is required. Use: ${rewritten}`);",
    "    process.exit(0);",
    "  }",
    "  deny('RTK is required. Command rejected because RTK route could not be validated.');",
    "});",
    "process.stdin.resume();"
  ].join(" ");
  return buildInlineNodeCommand(script, MANAGED_RTK_COMMAND_HOOK_COMMAND_SUFFIX);
}

export function isManagedRtkCommandHookCommand(command: string): boolean {
  return command.includes(MANAGED_RTK_COMMAND_HOOK_COMMAND_SUFFIX);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function buildInlineNodeCommand(script: string, managedMarker: string): string {
  return `${shellQuote(process.execPath)} -e ${shellQuote(script)} # ${managedMarker}`;
}
