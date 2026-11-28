import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Injectable } from '@/core';

/**
 * Which commands are turned off.
 *
 * Built-ins and plugin commands share the list: the panel is the only writer, and both the router
 * and every deploy path read from here. The state is an instance field, not a module-level `let`,
 * so nothing outside this service can change it behind a test's back.
 */
@Injectable()
export class PanelTogglesService {
  private cache: Set<string> | null = null;

  constructor(private readonly path: string = 'panel/commands.json') {}

  disabled(): string[] {
    return [...this.load()].sort();
  }

  isDisabled(name: string): boolean {
    return this.load().has(name);
  }

  /** Returns the new list. Written with `0600` like the rest of `panel/`. */
  setEnabled(names: readonly string[], enabled: boolean): string[] {
    const current = this.load();
    for (const name of names) {
      if (enabled) current.delete(name);
      else current.add(name);
    }
    const body = `${JSON.stringify({ disabled: [...current].sort() }, null, 2)}\n`;
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, body, { mode: 0o600 });
    renameSync(temporary, this.path);
    return this.disabled();
  }

  private load(): Set<string> {
    if (this.cache) return this.cache;
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
      const disabled = (parsed as { disabled?: unknown })?.disabled;
      this.cache = new Set(
        Array.isArray(disabled) ? disabled.filter((n) => typeof n === 'string') : [],
      );
    } catch {
      this.cache = new Set();
    }
    return this.cache;
  }
}
