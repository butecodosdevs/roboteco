import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { Injectable, inject, isBuiltInCommand } from '@/core';
import { reportError } from '@/logger';
import { type LoadedPlugin, PluginEngineService } from './plugin-engine.service';
import { PluginHostService } from './plugin-host.service';
import type { PluginCommandSpec } from './plugin-manifest.service';

export interface PluginCommandEntry {
  plugin: LoadedPlugin;
  spec: PluginCommandSpec;
}

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

export const registryPath = resolve('plugins/registry.json');

@Injectable()
export class PluginRegistryService {
  private readonly engine = inject(PluginEngineService);
  private readonly loaded = new Map<string, LoadedPlugin>();
  private readonly commands = new Map<string, PluginCommandEntry>();

  async loadAll(
    path = registryPath,
    reserved: (name: string) => boolean = isBuiltInCommand,
  ): Promise<void> {
    const raw = await readFile(path, 'utf8').catch(() => null);
    if (!raw) return;
    const { plugins } = registrySchema.parse(JSON.parse(raw));
    for (const definition of plugins) {
      try {
        const wasm = resolve(path, '../..', definition.wasm);
        this.add(await this.engine.load({ ...definition, wasm }), reserved);
      } catch (error) {
        reportError(error, { plugin: definition.id }, 'Plugin failed to load');
      }
    }
  }

  add(plugin: LoadedPlugin, reserved: (name: string) => boolean = isBuiltInCommand): void {
    const taken = plugin.commands
      .map((spec) => spec.name)
      .filter((name) => reserved(name) || this.commands.has(name));
    if (taken.length > 0) {
      void plugin.instance.close().catch(() => undefined);
      throw new Error(
        `Plugin ${plugin.id} declares commands that already exist: /${taken.join(', /')}`,
      );
    }
    this.loaded.set(plugin.id, plugin);
    for (const spec of plugin.commands) this.commands.set(spec.name, { plugin, spec });
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
  }

  async purgeGuild(guildId: string): Promise<void> {
    await inject(PluginHostService).purge([...this.loaded.keys()], guildId);
  }
}
