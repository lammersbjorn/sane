import { asPlainRecord, type PlainRecord } from "./config-object.js";
import { isManagedRtkCommandHookCommand } from "./rtk-command-hook.js";
import {
  isManagedLifecycleHookCommand,
  isManagedSessionEndHookCommand,
  isManagedSessionStartHookCommand
} from "./session-start-hook.js";
import { isManagedTokscaleSubmitHookCommand } from "./tokscale-submit-hook.js";

type JsonObject = PlainRecord;

export function containsManagedSessionStartHook(entry: unknown): boolean {
  return hookEntries(entry).some((hook: unknown) => {
    const command = asPlainRecord(hook)?.command;
    return typeof command === "string" && isManagedSessionStartHookCommand(command);
  });
}

export function containsManagedSessionEndHook(entry: unknown): boolean {
  return hookEntries(entry).some((hook: unknown) => {
    const command = asPlainRecord(hook)?.command;
    return typeof command === "string" && isManagedSessionEndHookCommand(command);
  });
}

export function containsManagedTokscaleHook(entry: unknown): boolean {
  return hookEntries(entry).some((hook: unknown) => {
    const command = asPlainRecord(hook)?.command;
    return typeof command === "string"
      && isManagedTokscaleSubmitHookCommand(command)
      && (command.includes("--event stop") || command.includes("--event session-end"));
  });
}

export function containsManagedRtkCommandHook(entry: unknown): boolean {
  return hookEntries(entry).some((hook: unknown) => {
    const command = asPlainRecord(hook)?.command;
    return typeof command === "string" && isManagedRtkCommandHookCommand(command);
  });
}

export function containsManagedLifecycleHook(entry: unknown): boolean {
  return hookEntries(entry).some((hook: unknown) => {
    const command = asPlainRecord(hook)?.command;
    return typeof command === "string"
      && (
        isManagedLifecycleHookCommand(command)
        || isManagedTokscaleSubmitHookCommand(command)
        || isManagedRtkCommandHookCommand(command)
      );
  });
}

export function containsExpectedHookCommand(entry: unknown, expectedCommand: string): boolean {
  return hookCommands(entry).includes(expectedCommand);
}

export function pushHookEntry(target: unknown[], entry: JsonObject): void {
  const expectedCommands = hookCommands(entry);
  const alreadyPresent = target.some((candidate) => {
    const candidateCommands = hookCommands(candidate);
    return expectedCommands.every((command) => candidateCommands.includes(command));
  });
  if (!alreadyPresent) {
    target.push(entry);
  }
}

export function upsertHookEntry(
  target: unknown[],
  isManagedEntry: (entry: unknown) => boolean,
  entry: JsonObject
): void {
  const existingIndex = target.findIndex(isManagedEntry);
  if (existingIndex >= 0) {
    target[existingIndex] = entry;
    return;
  }
  target.push(entry);
}

export function removeMatchingHookEntries(target: unknown[], shouldRemove: (entry: unknown) => boolean): void {
  const retained = target.filter((entry) => !shouldRemove(entry));
  target.splice(0, target.length, ...retained);
}

function hookCommands(entry: unknown): string[] {
  return hookEntries(entry).flatMap((hook: unknown) => {
    const command = asPlainRecord(hook)?.command;
    return typeof command === "string" ? [command] : [];
  });
}

function hookEntries(entry: unknown): unknown[] {
  const hooks = asPlainRecord(entry)?.hooks;
  return Array.isArray(hooks) ? hooks : [];
}
