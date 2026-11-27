import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { Injectable, inject, isBuiltInCommand, registerPanelRoute } from '@/core';
import { disabledCommands, setCommandsEnabled } from '@/core/command-toggles';
import { usageReport } from '@/core/command-usage';
import { commandCatalog } from '@/core/lifecycle';
import type { PluginSource } from './plugin-build.service';
import { PluginBuildService } from './plugin-build.service';
import { PluginDeployService } from './plugin-deploy.service';
import type { LoadedPlugin, Permission } from './plugin-engine.service';
import { PluginEngineService, permissions } from './plugin-engine.service';
import { PluginManifestService } from './plugin-manifest.service';
import {
  type PluginDefinitionEntry,
  PluginRegistryService,
  registryPath,
} from './plugin-registry.service';

export interface PanelCommand {
  /** Internal name, which is what the toggle writes. */
  code: string;
  /** Name as Discord shows it, localized to pt-BR when the manifest has it. */
  name: string;
  description: string;
  options: string[];
  disabled: boolean;
  uses: number;
}

export interface PanelPlugin {
  id: string;
  wasm: string;
  enabled: boolean;
  present: boolean;
  loaded: boolean;
  version: string | null;
  permissions: string[];
  allowedHosts: string[];
  required: string[];
  autocompletes: boolean;
  failure: string | null;
  /** Source directory on disk, when there is one. Informational: the panel never builds. */
  source: PluginSource | null;
  commands: PanelCommand[];
  uses: number;
}

export interface PanelUsage {
  total: number;
  members: number;
  series: { day: string; total: number }[];
  commands: { command: string; total: number }[];
}

/**
 * Read-mostly: the panel shows what is on disk and flips commands on and off. Installing,
 * building and deleting stay in the repository, where a wrong click cannot break the bot.
 */
@Injectable()
export class PluginPanelService {
  private readonly registry = inject(PluginRegistryService);
  private readonly engine = inject(PluginEngineService);
  private readonly manifests = inject(PluginManifestService);
  private readonly deployer = inject(PluginDeployService);
  private readonly builder = inject(PluginBuildService);

  async list(guildId?: string): Promise<{ plugins: PanelPlugin[]; usage: PanelUsage | null }> {
    const usage = guildId ? await usageReport(guildId, 30) : null;
    const used = new Map((usage?.commands ?? []).map((row) => [row.command, row.total]));
    const definitions = await this.registry.definitions();
    const plugins = await Promise.all(
      definitions.map((definition) => this.describe(definition, used)),
    );
    return { plugins, usage };
  }

  private async describe(
    definition: PluginDefinitionEntry,
    used: Map<string, number>,
  ): Promise<PanelPlugin> {
    const loaded: LoadedPlugin | undefined = this.registry.get(definition.id);
    const path = resolve(registryPath, '../..', definition.wasm);
    const wasm = await readFile(path).catch(() => null);
    const disabled = new Set(disabledCommands());
    let required: string[] = [];
    let present = false;
    if (wasm) {
      present = true;
      try {
        required = this.engine.requiredPermissions(wasm);
      } catch {
        // A corrupt WASM throws here too; the card shows it as "não carregou" instead of a 500.
        required = [];
      }
    }
    const commands: PanelCommand[] = loaded
      ? loaded.commands.map((spec) => {
          const json = this.manifests.toCommandJSON(spec);
          return {
            code: json.name,
            name: json.name_localizations?.['pt-BR'] ?? json.name,
            description: json.description_localizations?.['pt-BR'] ?? json.description,
            options: (json.options ?? []).flatMap((option) =>
              'options' in option && option.options
                ? option.options.map((nested) => `${option.name} ${nested.name}`)
                : [`${option.name}${'required' in option && option.required ? '*' : ''}`],
            ),
            disabled: disabled.has(json.name),
            uses: used.get(json.name) ?? 0,
          };
        })
      : [];
    return {
      id: definition.id,
      wasm: definition.wasm,
      enabled: definition.enabled,
      present,
      loaded: loaded !== undefined,
      version: loaded?.version ?? null,
      permissions: definition.permissions,
      allowedHosts: definition.allowedHosts ?? [],
      required,
      autocompletes: loaded?.autocompletes ?? false,
      // A missing file is not a load bug: say which path is expected instead of an ENOENT.
      failure: present
        ? (this.registry.failure(definition.id) ?? null)
        : `falta ${definition.wasm} — compile com pnpm plugins:build`,
      source: await this.builder.source(definition.id),
      commands,
      uses: commands.reduce((sum, command) => sum + command.uses, 0),
    };
  }

  /** Turns commands on or off. Works for built-ins and plugins: the toggle list is shared. */
  async toggle(names: string[], enabled: boolean): Promise<string[]> {
    const unknown = names.filter((name) => !isBuiltInCommand(name) && !this.registry.command(name));
    if (unknown.length > 0) throw new Error(`comando desconhecido: ${unknown.join(', ')}`);
    return setCommandsEnabled(names, enabled);
  }

  /** Enables or disables the plugin as a whole, and edits its permissions/hosts. */
  async update(
    id: string,
    changes: { enabled?: boolean; permissions?: Permission[]; allowedHosts?: string[] },
  ): Promise<string[]> {
    const definitions = await this.registry.definitions();
    if (!definitions.some((definition) => definition.id === id)) {
      throw new Error(`plugin ${id} não está no registry`);
    }
    const next = definitions.map((definition) =>
      definition.id === id
        ? {
            ...definition,
            ...(changes.enabled !== undefined && { enabled: changes.enabled }),
            ...(changes.permissions && { permissions: changes.permissions }),
            ...(changes.allowedHosts && { allowedHosts: changes.allowedHosts }),
          }
        : definition,
    );
    await this.registry.save(next);
    await this.registry.reload();
    return disabledCommands();
  }

  async refresh(guildId?: string) {
    await this.registry.reload();
    return this.list(guildId);
  }

  /**
   * A deploy is a bulk PUT, so Discord replaces whatever is not in the body. Disabled commands are
   * left out on purpose: that is what makes the toggle reach Discord.
   */
  async deploy(id?: string): Promise<{ commands: number; guild: string; plugin: number | null }> {
    const disabled = new Set(disabledCommands());
    const body = [...commandCatalog()].filter((command) => !disabled.has(command.name));
    let plugin: number | null = null;
    for (const loaded of this.registry.all()) {
      const specs = loaded.commands.filter((spec) => !disabled.has(spec.name));
      body.push(...specs.map((spec) => this.manifests.toCommandJSON(spec)));
      if (loaded.id === id) plugin = specs.length;
    }
    if (id && plugin === null) throw new Error(`plugin ${id} não está carregado`);
    return { ...(await this.deployer.deploy(body)), plugin };
  }
}

const toggleSchema = z.object({
  commands: z.array(z.string().min(1)).min(1).max(200),
  enabled: z.boolean(),
});

const pluginSchema = z.object({
  enabled: z.boolean().optional(),
  permissions: z.array(z.enum(permissions)).optional(),
  allowedHosts: z.array(z.string().min(1).max(253)).optional(),
});

// One route for the whole segment: core stays unaware of plugin shapes.
export function registerPluginPanel(): void {
  const panel = inject(PluginPanelService);
  const registry = inject(PluginRegistryService);

  registerPanelRoute('plugins', async ({ segments: [first, second], query, method, body }) => {
    const guildId = query.get('guild') ?? undefined;
    const action = second ?? undefined;
    if (action === 'refresh' && method === 'POST') {
      return { body: await panel.refresh(guildId) };
    }
    if (action === 'deploy' && method === 'POST') {
      // `all` republishes everything; an id only reports how many came from that plugin.
      const result = await panel.deploy(first === 'all' ? undefined : first);
      return { body: { ...result, ...(await panel.list(guildId)) } };
    }
    if (action === 'commands' && (method === 'PUT' || method === 'POST')) {
      if (!first)
        return { status: 400, body: { error: 'informe o plugin em /plugins/<id>/commands' } };
      const { commands, enabled } = toggleSchema.parse(body ?? {});
      const own = new Set((registry.get(first)?.commands ?? []).map((spec) => spec.name));
      const foreign = commands.filter((name) => !own.has(name));
      if (foreign.length > 0) {
        return {
          status: 400,
          body: { error: `não pertence a ${first}: ${foreign.join(', ')}` },
        };
      }
      await panel.toggle(commands, enabled);
      return { body: await panel.list(guildId) };
    }
    if (!second && first && (method === 'PUT' || method === 'PATCH')) {
      await panel.update(first, pluginSchema.parse(body ?? {}));
      return { body: await panel.list(guildId) };
    }
    if (!second && first && method === 'DELETE') {
      return {
        status: 405,
        body: { error: 'remover plugin é no repositório: saia do registry.json' },
      };
    }
    if (method === 'GET') {
      return { body: { ...(await panel.list(guildId)), registry: await registry.definitions() } };
    }
    return {
      status: 405,
      body: { error: 'o painel só lista e liga/desliga; instalar é no repositório' },
    };
  });
}
