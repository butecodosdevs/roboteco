import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { Injectable, inject, isBuiltInCommand, registerPanelRoute } from '@/core';
import { commandCatalog } from '@/core/lifecycle';
import { PluginBuildService, type PluginSource } from './plugin-build.service';
import { PluginDeployService } from './plugin-deploy.service';
import {
  type LoadedPlugin,
  PluginEngineService,
  PluginLoadError,
  permissions,
} from './plugin-engine.service';
import { PluginManifestService } from './plugin-manifest.service';
import {
  type PluginDefinitionEntry,
  PluginRegistryService,
  registryPath,
} from './plugin-registry.service';

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
  /** Source directory that can rebuild the WASM, when there is one. */
  source: PluginSource | null;
  commands: { name: string; description: string; options: string[] }[];
}

@Injectable()
export class PluginPanelService {
  private readonly registry = inject(PluginRegistryService);
  private readonly engine = inject(PluginEngineService);
  private readonly manifests = inject(PluginManifestService);
  private readonly deployer = inject(PluginDeployService);
  private readonly builder = inject(PluginBuildService);

  list(): Promise<PanelPlugin[]> {
    return this.registry
      .definitions()
      .then((definitions) =>
        Promise.all(definitions.map((definition) => this.describe(definition))),
      );
  }

  private async describe(definition: PluginDefinitionEntry): Promise<PanelPlugin> {
    const loaded: LoadedPlugin | undefined = this.registry.get(definition.id);
    const path = resolve(registryPath, '../..', definition.wasm);
    const wasm = await readFile(path).catch(() => null);
    let required: string[] = [];
    let present = false;
    if (wasm) {
      present = true;
      try {
        required = this.engine.requiredPermissions(wasm);
      } catch (error) {
        if (!(error instanceof PluginLoadError)) throw error;
        required = [];
      }
    }
    const commands = loaded
      ? loaded.commands.flatMap((spec) => {
          const json = this.manifests.toCommandJSON(spec);
          const options = (json.options ?? []).flatMap((option) =>
            'options' in option && option.options
              ? option.options.map((nested) => `${option.name} ${nested.name}`)
              : [`${option.name}${'required' in option && option.required ? '*' : ''}`],
          );
          return [{ name: json.name, description: json.description, options }];
        })
      : [];
    return {
      id: definition.id,
      wasm: definition.wasm,
      enabled: this.registry.get(definition.id) !== undefined,
      present,
      loaded: loaded !== undefined,
      version: loaded?.version ?? null,
      permissions: definition.permissions,
      allowedHosts: definition.allowedHosts ?? [],
      required,
      autocompletes: loaded?.autocompletes ?? false,
      failure: this.registry.failure(definition.id) ?? null,
      source: await this.builder.source(definition.id),
      commands,
    };
  }

  private async write(next: PluginDefinitionEntry[]): Promise<PanelPlugin[]> {
    const taken = new Map<string, string>();
    const conflicts: string[] = [];
    for (const definition of next) {
      const loaded = this.registry.get(definition.id);
      for (const spec of loaded?.commands ?? []) {
        const owner = taken.get(spec.name);
        if (owner && owner !== definition.id)
          conflicts.push(`/${spec.name} (${owner}, ${definition.id})`);
        taken.set(spec.name, definition.id);
        if (isBuiltInCommand(spec.name)) conflicts.push(`/${spec.name} já é comando embutido`);
      }
    }
    if (conflicts.length > 0) throw new Error(`comandos duplicados: ${conflicts.join(', ')}`);
    await this.registry.save(next);
    await this.registry.reload();
    return this.list();
  }

  async update(id: string, changes: Partial<PluginDefinitionEntry>): Promise<PanelPlugin[]> {
    const definitions = await this.registry.definitions();
    const current = definitions.find((definition) => definition.id === id);
    if (!current) throw new Error(`plugin ${id} não está no registry`);
    if (changes.permissions) {
      const unknown = changes.permissions.filter((p) => !permissions.includes(p as never));
      if (unknown.length > 0) throw new Error(`permissão desconhecida: ${unknown.join(', ')}`);
    }
    const next = definitions.map((definition) =>
      definition.id === id
        ? {
            ...definition,
            ...(changes.permissions && { permissions: changes.permissions }),
            ...(changes.allowedHosts && { allowedHosts: changes.allowedHosts }),
          }
        : definition,
    );
    return this.write(next as PluginDefinitionEntry[]);
  }

  async remove(id: string): Promise<PanelPlugin[]> {
    const definitions = await this.registry.definitions();
    return this.write(definitions.filter((definition) => definition.id !== id));
  }

  async add(definition: PluginDefinitionEntry): Promise<PanelPlugin[]> {
    const definitions = await this.registry.definitions();
    if (definitions.some((entry) => entry.id === definition.id)) {
      throw new Error(`plugin ${definition.id} já está instalado`);
    }
    return this.write([...definitions, definition]);
  }

  /** Rebuilds the WASM from its source, then reloads so the panel shows the fresh version. */
  async build(id: string): Promise<{ log: string; plugins: PanelPlugin[] }> {
    const { log } = await this.builder.build(id);
    return { log, plugins: await this.refresh() };
  }

  async refresh(): Promise<PanelPlugin[]> {
    await this.registry.reload();
    return this.list();
  }

  async deploy(): Promise<{ commands: number; guild: string }> {
    const body = [...commandCatalog()];
    for (const plugin of this.registry.all()) {
      body.push(...plugin.commands.map((spec) => this.manifests.toCommandJSON(spec)));
    }
    return this.deployer.deploy(body);
  }
}

const updateSchema = z.object({
  permissions: z.array(z.enum(permissions)).optional(),
  allowedHosts: z.array(z.string().min(1).max(253)).optional(),
});

const addSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  wasm: z.string().min(1),
  permissions: z.array(z.enum(permissions)).default([]),
  allowedHosts: z.array(z.string().min(1).max(253)).optional(),
});

const actions = new Set(['refresh', 'deploy']);

// One route for the whole segment: core stays unaware of plugin shapes.
export function registerPluginPanel(): void {
  const panel = inject(PluginPanelService);
  const registry = inject(PluginRegistryService);

  registerPanelRoute('plugins', async ({ segments: [first, second], method, body }) => {
    const definitions = await registry.definitions();
    const action = second ?? (actions.has(first ?? '') ? first : undefined);
    const id = second ? first : actions.has(first ?? '') ? undefined : first;
    let next: Awaited<ReturnType<PluginPanelService['list']>>;
    if (!id && !action) {
      if (method === 'GET') return { body: { plugins: await panel.list(), registry: definitions } };
      if (method === 'POST') next = await panel.add(addSchema.parse(body));
      else return { status: 405, body: { error: 'use POST /api/panel/plugins' } };
    } else if (action === 'refresh' && method === 'POST') {
      next = await panel.refresh();
    } else if (action === 'build' && method === 'POST') {
      if (!id) return { status: 400, body: { error: 'informe o plugin em /plugins/<id>/build' } };
      const { log, plugins } = await panel.build(id);
      return { body: { log, plugins, registry: await registry.definitions() } };
    } else if (action === 'deploy' && method === 'POST') {
      const result = await panel.deploy();
      return { body: { ...result, plugins: await panel.list() } };
    } else if (id && method === 'DELETE') {
      next = await panel.remove(id);
    } else if (id && (method === 'PUT' || method === 'PATCH')) {
      next = await panel.update(id, updateSchema.parse(body));
    } else {
      return { status: 405, body: { error: `método ${method} não suportado` } };
    }
    return { body: { plugins: next, registry: await registry.definitions() } };
  });
}
