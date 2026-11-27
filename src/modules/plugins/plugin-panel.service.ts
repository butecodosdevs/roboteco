import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { Injectable, inject, isBuiltInCommand, registerPanelRoute } from '@/core';
import { commandCatalog } from '@/core/lifecycle';
import { readWasmUpload, type ZipUpload } from '@/core/zip';
import { PluginBuildService, type PluginSource } from './plugin-build.service';
import { PluginDeployService } from './plugin-deploy.service';
import { type LoadedPlugin, PluginEngineService, permissions } from './plugin-engine.service';
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
      } catch {
        // A corrupt WASM throws here too; the card shows it as "não carregou" instead of a 500.
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
      // A missing file is not a load bug: say which path is expected instead of an ENOENT.
      failure: present
        ? (this.registry.failure(definition.id) ?? null)
        : `falta ${definition.wasm} — envie o .wasm ou compile com pnpm plugins:build`,
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

  /** Rebuilds the WASM from its source, then reloads so the panel shows the fresh version. */
  async build(id: string): Promise<{ log: string; plugins: PanelPlugin[] }> {
    const { log } = await this.builder.build(id);
    return { log, plugins: await this.refresh() };
  }

  /**
   * Takes a `.wasm` or a zip with one inside: reads it in memory, writes
   * `plugins/dist/<id>.wasm` — never any other path from the archive — and registers it.
   */
  async upload(
    id: string,
    body: unknown,
    query: URLSearchParams,
  ): Promise<{ plugin: PanelPlugin; bytes: number; entry: string | null; plugins: PanelPlugin[] }> {
    if (!(body instanceof Uint8Array)) {
      throw new Error('envie o .wasm ou o .zip no corpo da requisição');
    }
    const picked: ZipUpload = await readWasmUpload(id, body);
    const split = (value: string | null) =>
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    const definitions = await this.registry.definitions();
    const current = definitions.find((item) => item.id === id);
    const wasm = `plugins/dist/${id}.wasm`;
    const definition: PluginDefinitionEntry = {
      id,
      wasm,
      // A re-upload without the query flags keeps what is already granted.
      permissions: (query.get('permissions')
        ? split(query.get('permissions'))
        : (current?.permissions ?? [])) as never,
      ...(query.get('hosts')
        ? { allowedHosts: split(query.get('hosts')) }
        : current?.allowedHosts && { allowedHosts: current.allowedHosts }),
    };
    const previous = await readFile(join(process.cwd(), wasm)).catch(() => null);
    await this.builder.write(wasm, picked.wasm);
    // Uploading again replaces the file, which is how you ship a new version.
    let plugins: PanelPlugin[];
    try {
      plugins = await this.write(
        current
          ? definitions.map((item) => (item.id === id ? definition : item))
          : [...definitions, definition],
      );
    } catch (error) {
      // Registry refused it (duplicate command, unreadable WASM): undo the file write.
      await this.builder.restore(wasm, previous);
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} (o arquivo anterior foi restaurado)`,
      );
    }
    const plugin = plugins.find((entry) => entry.id === id);
    if (!plugin) throw new Error(`plugin ${id} não apareceu na lista`);
    // Missing permissions is normal for a fresh upload: the card shows what to tick. Any other
    // failure (unreadable WASM, duplicate command) must not replace the working file.
    const onlyPermissions = plugin.failure?.startsWith('needs permissions') ?? false;
    if (plugin.failure && !onlyPermissions) {
      await this.builder.restore(wasm, previous);
      await this.registry.save(definitions);
      await this.registry.reload();
      throw new Error(`${plugin.failure} (o arquivo anterior foi restaurado)`);
    }
    return { plugin, bytes: picked.wasm.length, entry: picked.entry, plugins };
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

const actions = new Set(['refresh', 'deploy', 'build', 'upload']);

// One route for the whole segment: core stays unaware of plugin shapes.
export function registerPluginPanel(): void {
  const panel = inject(PluginPanelService);
  const registry = inject(PluginRegistryService);

  registerPanelRoute('plugins', async ({ segments: [first, second], method, body, query }) => {
    const definitions = await registry.definitions();
    const action = second ?? (actions.has(first ?? '') ? first : undefined);
    const id = second ? first : actions.has(first ?? '') ? undefined : first;
    let next: Awaited<ReturnType<PluginPanelService['list']>>;
    if (!id && !action) {
      if (method !== 'GET') {
        return { status: 405, body: { error: 'plugins are installed from an upload' } };
      }
      return { body: { plugins: await panel.list(), registry: definitions } };
    } else if (action === 'refresh' && method === 'POST') {
      next = await panel.refresh();
    } else if (action === 'upload' && method === 'POST') {
      if (!id) return { status: 400, body: { error: 'informe o plugin em /plugins/<id>/upload' } };
      const result = await panel.upload(id, body, query);
      return {
        status: 201,
        body: { ...result, registry: await registry.definitions() },
      };
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
