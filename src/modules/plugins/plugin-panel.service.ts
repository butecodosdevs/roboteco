import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, inject, isBuiltInCommand } from '@/core';
import { commandCatalog, type RegisteredCommand } from '@/core/lifecycle';
import { PanelTogglesService } from '@/modules/panel/panel-toggles.service';
import { PanelUsageService } from '@/modules/panel/panel-usage.service';
import type { PluginSource } from './plugin-build.service';
import { PluginBuildService } from './plugin-build.service';
import { PluginDeployService } from './plugin-deploy.service';
import type { LoadedPlugin } from './plugin-engine.service';
import { PluginEngineService } from './plugin-engine.service';
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
 * Read-mostly: the panel shows what is on disk and flips a plugin on and off. Installing, building,
 * deleting, and — since a granted permission is the security boundary — the permission list itself
 * stay in the reviewed `plugins/registry.json`, where a change gets a diff and a review. A typo in
 * a permission name saved from the browser used to leave the plugin unloaded until someone fixed
 * the file by hand.
 */
@Injectable()
export class PluginPanelService {
  private readonly registry = inject(PluginRegistryService);
  private readonly engine = inject(PluginEngineService);
  private readonly manifests = inject(PluginManifestService);
  private readonly deployer = inject(PluginDeployService);
  private readonly builder = inject(PluginBuildService);
  private readonly toggles = inject(PanelTogglesService);
  private readonly usage = inject(PanelUsageService);

  async list(
    guildId?: string,
    locale?: string | null,
  ): Promise<{ plugins: PanelPlugin[]; usage: PanelUsage | null }> {
    const report = guildId ? await this.usage.report(guildId, 30) : null;
    const used = new Map((report?.commands ?? []).map((row) => [row.command, row.total]));
    const definitions = await this.registry.definitions();
    const plugins = await Promise.all(
      definitions.map((definition) => this.describe(definition, used, locale)),
    );
    return {
      plugins,
      usage: report && {
        total: report.total,
        members: report.members,
        series: report.series,
        commands: report.commands,
      },
    };
  }

  private async describe(
    definition: PluginDefinitionEntry,
    used: Map<string, number>,
    locale?: string | null,
  ): Promise<PanelPlugin> {
    const loaded: LoadedPlugin | undefined = this.registry.get(definition.id);
    const path = resolve(registryPath, '../..', definition.wasm);
    const wasm = await readFile(path).catch(() => null);
    const disabled = new Set(this.toggles.disabled());
    let required: string[] = [];
    let present = false;
    if (wasm) {
      present = true;
      try {
        required = this.engine.requiredPermissions(wasm);
      } catch {
        // A corrupt WASM throws here too; the card shows it as unloaded instead of a 500.
        required = [];
      }
    }
    // Manifests ship pt-BR translations; English is the base name, so only pt asks for a key.
    const want = locale === 'pt' ? 'pt-BR' : 'en-US';
    const commands: PanelCommand[] = loaded
      ? loaded.commands.map((spec) => {
          const json = this.manifests.toCommandJSON(spec);
          return {
            code: json.name,
            name: json.name_localizations?.[want] ?? json.name,
            description: json.description_localizations?.[want] ?? json.description,
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
      // A missing file is not a load bug: name the build step instead of an ENOENT path.
      failure: present ? (this.registry.failure(definition.id) ?? null) : 'wasm_missing',
      source: await this.builder.source(definition.id),
      commands,
      uses: commands.reduce((sum, command) => sum + command.uses, 0),
    };
  }

  /** Turns commands on or off. Works for built-ins and plugins: the toggle list is shared. */
  async toggle(names: string[], enabled: boolean): Promise<string[]> {
    const unknown = names.filter((name) => !isBuiltInCommand(name) && !this.registry.command(name));
    if (unknown.length > 0) throw new Error(`unknown_command: ${unknown.join(', ')}`);
    return this.toggles.setEnabled(names, enabled);
  }

  /**
   * Enabling or disabling the plugin as a whole. Permission and host changes are refused here on
   * purpose: they live in the reviewed registry, and the panel has no route that writes them.
   */
  async update(id: string, changes: { enabled?: boolean }): Promise<string[]> {
    const definitions = await this.registry.definitions();
    if (!definitions.some((definition) => definition.id === id)) {
      throw new Error(`not_in_registry: ${id}`);
    }
    const next = definitions.map((definition) =>
      definition.id === id
        ? { ...definition, enabled: changes.enabled ?? definition.enabled }
        : definition,
    );
    await this.registry.save(next);
    await this.registry.reload();
    return this.toggles.disabled();
  }

  async refresh(guildId?: string, locale?: string | null) {
    await this.registry.reload();
    return this.list(guildId, locale);
  }

  /**
   * A deploy is a bulk PUT, so Discord replaces whatever is not in the body. Disabled commands are
   * left out on purpose: that is what makes the toggle reach Discord. Context menus go in too: a
   * deploy that only sent slash commands deleted every plugin menu, and the bot's own.
   */
  async deploy(id?: string): Promise<{ commands: number; guild: string; plugin: number | null }> {
    const disabled = new Set(this.toggles.disabled());
    const body: RegisteredCommand[] = [...commandCatalog()].filter(
      (command) => !disabled.has(command.name),
    );
    let plugin: number | null = null;
    for (const loaded of this.registry.all()) {
      const specs: RegisteredCommand[] = [
        ...loaded.commands
          .filter((spec) => !disabled.has(spec.name))
          .map((spec): RegisteredCommand => this.manifests.toCommandJSON(spec)),
        ...loaded.contextMenus
          .filter((spec) => !disabled.has(spec.name))
          .map((spec): RegisteredCommand => this.manifests.toContextMenuJSON(spec)),
      ];
      body.push(...specs);
      if (loaded.id === id) plugin = specs.length;
    }
    if (id && plugin === null) throw new Error(`not_loaded: ${id}`);
    return { ...(await this.deployer.deploy(body)), plugin };
  }
}
