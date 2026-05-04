const MANAGED_COMMAND_SAFETY_GUARD_SUFFIX = "hook command-safety-guard";
const MANAGED_GENERATED_SURFACE_GUARD_SUFFIX = "hook generated-surface-guard";
const MANAGED_BLOCKED_RESPONSE_GUARD_SUFFIX = "hook blocked-response-guard";

export const MANAGED_COMMAND_SAFETY_GUARD_STATUS_MESSAGE = "Checking destructive, secret, and git safety";
export const MANAGED_GENERATED_SURFACE_GUARD_STATUS_MESSAGE = "Checking generated Sane surface ownership";
export const MANAGED_BLOCKED_RESPONSE_GUARD_STATUS_MESSAGE = "Checking BLOCKED response evidence";

export function buildManagedCommandSafetyGuardHookCommand(): string {
  const script = [
    "let raw='';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data',(c)=>{raw+=c;});",
    "process.stdin.on('end',()=>{",
    "let data={};",
    "try{data=JSON.parse(raw);}catch{}",
    "if(data.tool_name!=='Bash')process.exit(0);",
    "const command=String(data.tool_input?.command||'').trim();",
    "const deny=(reason)=>process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:reason}})+'\\n');",
    "if(!command)process.exit(0);",
    "const destructive=[/\\brm\\s+-[^\\n;&|]*[rf][^\\n;&|]*\\s+(?:\\/|~|\\$HOME)(?:\\s|$)/,/\\bsudo\\s+rm\\b/,/\\bmkfs(?:\\.|\\s|$)/,/\\bdd\\s+if=\\/dev\\//,/\\bchmod\\s+-R\\s+777\\b/,/:\\(\\)\\s*\\{\\s*:\\|:\\s*&\\s*\\}\\s*;/];",
    "if(destructive.some((r)=>r.test(command))){deny('Sane safety guard: destructive command blocked. Explain need and ask before retrying.');return;}",
    "const secret=[/\\bcat\\s+[^\\n;&|]*(?:\\.env|id_rsa|id_ed25519|auth\\.json|credentials|secrets?)(?:\\s|$)/i,/\\b(?:env|printenv)\\b/,/\\bsecurity\\s+find-/,/\\b[A-Za-z_]*(?:TOKEN|SECRET|PASSWORD|KEY)\\s*=/i,/\\bsk-[A-Za-z0-9_-]{8,}/,/\\b(?:ghp|github_pat|glpat)_[A-Za-z0-9_]{8,}/];",
    "if(secret.some((r)=>r.test(command))){deny('Sane safety guard: secret or credential exposure blocked. Use scoped inspection or redacted output.');return;}",
    "const unsafeGit=[/\\bgit\\s+reset\\s+--hard\\b/,/\\bgit\\s+clean\\s+-[^\\n;&|]*[fd]/,/\\bgit\\s+push\\b[^\\n;&|]*--force/,/\\bgit\\s+checkout\\s+--\\s+(?:\\.|\\/|\\*)/,/\\bgit\\s+restore\\s+(?:\\.|:\\/|\\*)/];",
    "if(unsafeGit.some((r)=>r.test(command))){deny('Sane safety guard: unsafe git operation blocked. Preserve user changes unless explicitly approved.');return;}",
    "});",
    "process.stdin.resume();"
  ].join("");
  return buildInlineNodeCommand(script, MANAGED_COMMAND_SAFETY_GUARD_SUFFIX);
}

export function buildManagedGeneratedSurfaceGuardHookCommand(): string {
  const script = [
    "let raw='';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data',(c)=>{raw+=c;});",
    "process.stdin.on('end',()=>{",
    "let data={};",
    "try{data=JSON.parse(raw);}catch{}",
    "const tool=String(data.tool_name||'');",
    "if(!/^(Write|Edit|MultiEdit|apply_patch)$/.test(tool))process.exit(0);",
    "const text=JSON.stringify(data.tool_input||{});",
    "const generated=/(?:^|[\\/])(?:\\.codex[\\/]agents|\\.agents[\\/]skills)[\\/][^\\\"]+/;",
    "const marker=/(managed-by: sane|sane:(?:global|repo)-agents:start|sourceId=codex:)/;",
    "const agentsManaged=/(?:^|[\\/])AGENTS\\.md/.test(text)&&marker.test(text);",
    "if((generated.test(text)&&!marker.test(text))||agentsManaged){",
    "process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Sane generated-surface guard: edit managed surfaces through source records or Sane export paths, preserving user-owned content.'}})+'\\n');",
    "}",
    "});",
    "process.stdin.resume();"
  ].join("");
  return buildInlineNodeCommand(script, MANAGED_GENERATED_SURFACE_GUARD_SUFFIX);
}

export function buildManagedBlockedResponseGuardHookCommand(): string {
  const script = [
    "let raw='';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data',(c)=>{raw+=c;});",
    "process.stdin.on('end',()=>{",
    "let data={};",
    "try{data=JSON.parse(raw);}catch{}",
    "const response=String(data.final_response||data.response||data.output||'');",
    "if(!/\\bBLOCKED\\b/i.test(response))process.exit(0);",
    "const hasAttempt=/attempt(?:ed|s)?|tried|verified|ran|checked/i.test(response);",
    "const hasEvidence=/evidence|command|error|output|result|because/i.test(response);",
    "const hasNeed=/need|requires?|missing|credential|decision|permission|approval/i.test(response);",
    "if(!(hasAttempt&&hasEvidence&&hasNeed)){",
    "process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'Stop',additionalContext:'Sane BLOCKED guard: include attempted action, evidence, and exact needed user input.'}})+'\\n');",
    "}",
    "});",
    "process.stdin.resume();"
  ].join("");
  return buildInlineNodeCommand(script, MANAGED_BLOCKED_RESPONSE_GUARD_SUFFIX);
}

export function isManagedCommandSafetyGuardHookCommand(command: string): boolean {
  return command.includes(MANAGED_COMMAND_SAFETY_GUARD_SUFFIX);
}

export function isManagedGeneratedSurfaceGuardHookCommand(command: string): boolean {
  return command.includes(MANAGED_GENERATED_SURFACE_GUARD_SUFFIX);
}

export function isManagedBlockedResponseGuardHookCommand(command: string): boolean {
  return command.includes(MANAGED_BLOCKED_RESPONSE_GUARD_SUFFIX);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function buildInlineNodeCommand(script: string, managedMarker: string): string {
  return `${shellQuote(process.execPath)} -e ${shellQuote(script)} # ${managedMarker}`;
}
