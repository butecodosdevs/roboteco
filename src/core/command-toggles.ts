import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Which commands are turned off. Built-ins and plugin commands share the list: the panel is the
 * only writer, and both the router and every deploy path read from here.
 */
export interface CommandToggles {
  disabled: string[];
}

export const togglesPath = resolve('panel/commands.json');

let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(readFileSync(togglesPath, 'utf8'));
    const disabled = (parsed as CommandToggles)?.disabled;
    cache = new Set(Array.isArray(disabled) ? disabled.filter((n) => typeof n === 'string') : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

export function disabledCommands(): string[] {
  return [...load()].sort();
}

export function isCommandDisabled(name: string): boolean {
  return load().has(name);
}

/** Returns the new list. Written with `0600` like the rest of `panel/`. */
export function setCommandsEnabled(names: readonly string[], enabled: boolean): string[] {
  const current = load();
  for (const name of names) {
    if (enabled) current.delete(name);
    else current.add(name);
  }
  const body = `${JSON.stringify({ disabled: [...current].sort() }, null, 2)}\n`;
  mkdirSync(dirname(togglesPath), { recursive: true });
  const temporary = `${togglesPath}.tmp`;
  writeFileSync(temporary, body, { mode: 0o600 });
  renameSync(temporary, togglesPath);
  return disabledCommands();
}
