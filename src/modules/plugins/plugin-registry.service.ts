import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { config } from '@/config';
import { Injectable, inject, isBuiltInCommand } from '@/core';
import { logger, reportError } from '@/logger';
import { type LoadedPlugin, PluginEngineService } from './plugin-engine.service';
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
      permissions: z.array(z.string()).default([]),
      allowedHosts: z.array(z.string()).optional(),
    }),
  ),
});

export const registryPath = resolve(config.pluginRegistry);

@Injectable()
export class PluginRegistryService {
  private readonly engine = inject(PluginEngineService);
  private readonly loaded = new Map<string, LoadedPlugin>();
  private readonly commands = new Map<string, PluginCommandEntry>();
  private readonly menus = new Map<string, PluginMenuEntry>();

  async loadAll(
    path = registryPath,
    reserved: (name: string) => boolean = isBuiltInCommand,
  ): Promise<void> {
    const raw = await readFile(path, 'utf8').catch(() => null);
    if (raw === null) {
      logger.warn({ registry: path }, 'Plugin registry not found; check PLUGIN_REGISTRY');
      return;
    }
    const { plugins } = registrySchema.parse(JSON.parse(raw));
    // An empty registry is the default, so say so: otherwise plugin commands just never appear.
    if (plugins.length === 0) {
      logger.info(
        { registry: path },
        'No plugins installed. To try the example, set PLUGIN_REGISTRY=plugins/registry.example.json and run pnpm plugins:build',
      );
      return;
    }
    for (const definition of plugins) {
      const wasm = resolve(path, '../..', definition.wasm);
      try {
        this.add(await this.engine.load({ ...definition, wasm }), reserved);
      } catch (error) {
        // A missing build is a setup step, not a bug: point at the fix instead of reporting a stack.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          logger.warn(
            { plugin: definition.id, wasm },
            'Plugin not built yet; run pnpm plugins:build',
          );
          continue;
        }
        reportError(error, { plugin: definition.id }, 'Plugin failed to load');
      }
    }
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
}
