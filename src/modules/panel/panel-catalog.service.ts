import { Injectable } from '@/core';
import type { RegisteredCommand } from '@/core/lifecycle';

/**
 * What the bot publishes, as the panel needs it: the full catalog to list commands, the built-in
 * names to tell them from plugin ones, and which module decorated each one so the panel can group.
 *
 * `core` computes this at boot (it already resolves the module graph) and hands it over through the
 * gateway; the panel keeps no module-level copy.
 */
@Injectable()
export class PanelCatalogService {
  private catalog: RegisteredCommand[] = [];
  private builtIn = new Set<string>();
  private owners: Record<string, string> = {};

  describe(input: {
    catalog: RegisteredCommand[];
    builtIn: string[];
    owners: Record<string, string>;
  }): void {
    this.catalog = input.catalog;
    this.builtIn = new Set(input.builtIn);
    this.owners = input.owners;
  }

  commands(): RegisteredCommand[] {
    return this.catalog;
  }

  names(): string[] {
    return [...this.builtIn];
  }

  isBuiltIn(name: string): boolean {
    return this.builtIn.has(name);
  }

  ownerOf(name: string): string | undefined {
    return this.owners[name];
  }
}
