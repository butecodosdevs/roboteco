import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { cache } from '@/cache';
import { config } from '@/config';
import { Injectable, inject, isBuiltInCommand } from '@/core';
import { reportError } from '@/logger';
import { type LoadedPlugin, PluginEngineService, permissions } from './plugin-engine.service';
import type {
  PluginCommandSpec,
  PluginContextMenuSpec,
  PluginEvent,
} from './plugin-manifest.service';

export interface PluginCommandEntry {
  plugin: LoadedPlugin;
  spec: PluginCommandSpec;
}

export interface PluginMenuEntry {
  plugin: LoadedPlugin;
  spec: PluginContextMenuSpec;
}

const menuKey = (type: 'user' | 'message', name: string) => `${type}:${name}`;

const registrySchema = z.object({
  plugins: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]{1,32}$/),
      wasm: z.string(),
      permissions: z.array(z.enum(permissions)).default([]),
      allowedHosts: z.array(z.string()).optional(),
    }),
  ),
});

export const registryPath = resolve(config.pluginRegistry);
export type PluginDefinitionEntry = z.infer<typeof registrySchema>['plugins'][number];

@Injectable()
export class PluginRegistryService {
  private readonly engine = inject(PluginEngineService);
  private readonly loaded = new Map<string, LoadedPlugin>();
  private readonly commands = new Map<string, PluginCommandEntry>();
  private readonly menus = new Map<string, PluginMenuEntry>();
  private readonly failed = new Map<string, string>();

  async definitions(path = registryPath): Promise<PluginDefinitionEntry[]> {
    const raw = await readFile(path, 'utf8').catch(() => null);
    if (!raw) return [];
    return registrySchema.parse(JSON.parse(raw)).plugins;
  }

  /** Rewrites the registry atomically, so a crash never leaves half a JSON file. */
  async save(definitions: PluginDefinitionEntry[], path = registryPath): Promise<void> {
    const body = `${JSON.stringify({ plugins: definitions }, null, 2)}\n`;
    const temporary = `${path}.tmp`;
    await writeFile(temporary, body, 'utf8');
    await rename(temporary, path);
  }

  async loadAll(
    path = registryPath,
    reserved: (name: string) => boolean = isBuiltInCommand,
  ): Promise<void> {
    this.failed.clear();
    for (const definition of await this.definitions(path)) {
      try {
        const wasm = resolve(path, '../..', definition.wasm);
        this.add(await this.engine.load({ ...definition, wasm }), reserved);
      } catch (error) {
        this.failed.set(definition.id, error instanceof Error ? error.message : String(error));
        // A WASM that was never built is a missing file, not a crash: the panel says so on the card.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          reportError(error, { plugin: definition.id }, 'Plugin failed to load');
        }
      }
    }
  }

  async reload(
    path = registryPath,
    reserved: (name: string) => boolean = isBuiltInCommand,
  ): Promise<void> {
    await this.unloadAll();
    await this.loadAll(path, reserved);
  }

  failure(id: string): string | undefined {
    return this.failed.get(id);
  }

  add(plugin: LoadedPlugin, reserved: (name: string) => boolean = isBuiltInCommand): void {
    const taken = [
      ...plugin.commands
        .map((spec) => spec.name)
        .filter((name) => reserved(name) || this.commands.has(name))
        .map((name) => `/${name}`),
      ...plugin.contextMenus
        .filter((m) => reserved(m.name) || this.menus.has(menuKey(m.type, m.name)))
        .map((m) => `${m.type} menu "${m.name}"`),
    ];
    if (taken.length > 0) {
      void plugin.instance.close().catch(() => undefined);
      throw new Error(`Plugin ${plugin.id} declares names that already exist: ${taken.join(', ')}`);
    }
    this.loaded.set(plugin.id, plugin);
    for (const spec of plugin.commands) this.commands.set(spec.name, { plugin, spec });
    for (const spec of plugin.contextMenus)
      this.menus.set(menuKey(spec.type, spec.name), { plugin, spec });
  }

  menu(type: 'user' | 'message', name: string): PluginMenuEntry | undefined {
    return this.menus.get(menuKey(type, name));
  }

  subscribers(event: PluginEvent): LoadedPlugin[] {
    return this.all().filter((plugin) => plugin.events.includes(event));
  }

  command(name: string): PluginCommandEntry | undefined {
    return this.commands.get(name);
  }

  get(id: string): LoadedPlugin | undefined {
    return this.loaded.get(id);
  }

  all(): LoadedPlugin[] {
    return [...this.loaded.values()];
  }

  async unloadAll(): Promise<void> {
    for (const plugin of this.loaded.values()) await plugin.instance.close().catch(() => undefined);
    this.loaded.clear();
    this.commands.clear();
    this.menus.clear();
  }

  async purgeGuild(guildId: string): Promise<void> {
    for (const plugin of this.loaded.values())
      await cache.del(`plugins:kv:${plugin.id}:${guildId}`);
  }
}
