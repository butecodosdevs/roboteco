import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import createPlugin, { type CallContext, type Plugin } from '@extism/extism';
import { z } from 'zod';
import { cache } from '@/cache';
import {
  allCapabilities,
  CapabilityError,
  CapabilityInputError,
  capability,
  Injectable,
  inject,
  invokeCapability,
  type PluginCaller,
  type PluginScope,
} from '@/core';
import { capMemory, wasmExports, wasmImports } from '@/lib/wasm';
import { logger } from '@/logger';
import type { ContextKind } from './discord-data.service';
import {
  choicesSchema,
  type EventInput,
  type Invocation,
  type JobInput,
  type PluginAction,
  type PluginChoice,
  type PluginCommandSpec,
  type PluginContextMenuSpec,
  type PluginEvent,
  PluginManifestService,
  pluginEvents,
  responseSchema,
} from './plugin-manifest.service';

export type { Invocation, PluginAction, PluginChoice } from './plugin-manifest.service';
export type Permission = string;

export const knownPermissions = (): Set<string> =>
  new Set<string>([
    'http',
    ...allCapabilities().flatMap((c) => (c.permission ? [c.permission] : [])),
    ...Object.values(pluginEvents),
  ]);

export interface PluginDefinition {
  id: string;
  wasm: string;
  permissions: Permission[];
  allowedHosts?: string[];
}

export interface PluginAccess {
  granted: Set<string>;
  uses: Set<string>;
}

export interface LoadedPlugin {
  id: string;
  version: string;
  commands: PluginCommandSpec[];
  contextMenus: PluginContextMenuSpec[];
  events: PluginEvent[];
  exports: Set<string>;
  autocompletes: boolean;
  permissions: Permission[];
  instance: Plugin;
  access: PluginAccess;
  context: ContextKind[];
  definition: PluginDefinition;
  wasm: Uint8Array;
}

export class PluginLoadError extends Error {}
export class PluginCallError extends Error {
  constructor(
    readonly reason: 'timeout' | 'crash' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

const limits = {
  timeoutMs: 2000,
  maxMemoryPages: 1024,
  callsPerWindow: 200,
  callWindowMs: 10_000,
  // Events queue behind commands for the same plugin; past this many, new events are dropped so
  // a busy server can't make the plugin's commands wait.
  queuedEvents: 20,
};

// Everything goes through `call`; Extism's built-in HTTP functions need the `http` permission.
const hostImports: Record<string, Record<string, Permission | null>> = {
  'extism:host/user': { call: null },
  'extism:host/env': { http_request: 'http', http_status_code: 'http', http_headers: 'http' },
};
const runtimeModules = new Set(['wasi_snapshot_preview1']);

const callRequest = z.object({ name: z.string(), input: z.unknown() });

@Injectable()
export class PluginEngineService {
  private readonly manifests = inject(PluginManifestService);
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly queuedEvents = new Map<string, number>();

  /**
   * The permissions the module's imports require. Public for the panel, which shows them before
   * a plugin has been loaded — a plugin that fails to load still gets a card with what to grant.
   * Capability permissions (from the manifest's `uses`) are only known after a load, and the
   * failure message of a refused plugin spells those out.
   */
  requiredPermissions(wasm: Uint8Array): Permission[] {
    const required = new Set<Permission>();
    for (const { module: namespace, name } of wasmImports(wasm)) {
      if (runtimeModules.has(namespace)) continue;
      const known = hostImports[namespace];
      if (!known) throw new PluginLoadError(`imports unknown module "${namespace}"`);
      if (!(name in known)) {
        if (namespace === 'extism:host/env') continue;
        throw new PluginLoadError(
          `imports "${namespace}::${name}", but the bot only provides "call" (use a roboteco SDK)`,
        );
      }
      const permission = known[name];
      if (permission) required.add(permission);
    }
    return [...required];
  }

  async load(definition: PluginDefinition): Promise<LoadedPlugin> {
    const unknown = definition.permissions.filter((p) => !knownPermissions().has(p));
    if (unknown.length > 0) {
      throw new PluginLoadError(
        `unknown permissions ${unknown.join(', ')}; known: ${[...knownPermissions()].sort().join(', ')}`,
      );
    }
    const wasm = capMemory(await readFile(definition.wasm), limits.maxMemoryPages);
    // Capabilities are only known after reading the manifest, so access starts closed.
    const access: PluginAccess = { granted: new Set(), uses: new Set() };
    const instance = await this.instantiate(definition, wasm, access);
    const manifest = this.manifests.parse((await instance.call('manifest'))?.json());

    const needed = new Map<string, string[]>();
    for (const permission of this.requiredPermissions(wasm)) needed.set(permission, ['(imports)']);
    for (const name of manifest.uses) {
      const cap = capability(name);
      if (!cap) {
        void instance.close();
        const names = allCapabilities()
          .map((c) => c.name)
          .sort()
          .join(', ');
        throw new PluginLoadError(`uses unknown capability "${name}"; available: ${names}`);
      }
      access.uses.add(name);
      if (cap.permission) needed.set(cap.permission, [...(needed.get(cap.permission) ?? []), name]);
    }
    for (const event of manifest.events) {
      const permission = pluginEvents[event];
      needed.set(permission, [...(needed.get(permission) ?? []), `the ${event} event`]);
    }
    const exports = new Set(wasmExports(wasm));
    const exportsNeeded: [boolean, string, string][] = [
      [manifest.commands.length + manifest.contextMenus.length > 0, 'handle_command', 'commands'],
      [manifest.events.length > 0, 'handle_event', 'events'],
      [access.uses.has('schedule.create'), 'handle_job', 'schedule.create'],
    ];
    const missingExport = exportsNeeded.find(([needs, name]) => needs && !exports.has(name));
    if (missingExport) {
      void instance.close();
      throw new PluginLoadError(
        `declares ${missingExport[2]} but does not export "${missingExport[1]}"`,
      );
    }
    const missing = [...needed].filter(
      ([permission]) => !definition.permissions.includes(permission),
    );
    if (missing.length > 0) {
      void instance.close();
      const detail = missing
        .map(([permission, by]) => `${permission} (for ${by.join(', ')})`)
        .join('; ');
      throw new PluginLoadError(
        `needs permissions not granted in plugins/registry.json: ${detail}`,
      );
    }
    for (const permission of needed.keys()) access.granted.add(permission);

    logger.info(
      { plugin: definition.id, version: manifest.version, permissions: [...access.granted] },
      'Plugin loaded',
    );
    return {
      id: definition.id,
      version: manifest.version,
      commands: manifest.commands,
      contextMenus: manifest.contextMenus,
      events: manifest.events,
      exports,
      autocompletes: exports.has('autocomplete'),
      permissions: [...access.granted],
      instance,
      access,
      context: manifest.context,
      definition,
      wasm,
    };
  }

  private instantiate(
    definition: PluginDefinition,
    wasm: Uint8Array,
    access: PluginAccess,
  ): Promise<Plugin> {
    const http =
      this.requiredPermissions(wasm).includes('http') && definition.permissions.includes('http');
    return createPlugin(
      { wasm: [{ data: wasm }] },
      {
        runInWorker: true,
        useWasi: wasmImports(wasm).some((i) => runtimeModules.has(i.module)),
        allowedPaths: {},
        allowedHosts: http ? (definition.allowedHosts ?? []) : [],
        timeoutMs: limits.timeoutMs,
        memory: { maxPages: limits.maxMemoryPages, maxHttpResponseBytes: 1 << 20 },
        functions: { 'extism:host/user': { call: this.callFunction(definition.id, access) } },
      },
    );
  }

  // The SDK's worker can be left unusable after a trap or a timeout, so a failed plugin is always
  // replaced by a fresh instance and the old worker is dropped.
  private async recycle(plugin: LoadedPlugin): Promise<void> {
    const old = plugin.instance;
    plugin.instance = await this.instantiate(plugin.definition, plugin.wasm, plugin.access);
    void Promise.race([old.close(), sleep(1000)]).catch(() => undefined);
  }

  async interact(
    plugin: LoadedPlugin,
    input: Invocation,
    caller: PluginCaller | null,
  ): Promise<PluginAction[]> {
    const component = input.kind === 'button' || input.kind === 'select' || input.kind === 'modal';
    const fn = component ? 'handle_component' : 'handle_command';
    if (!plugin.exports.has(fn)) {
      throw new PluginCallError('invalid', `the plugin does not export "${fn}"`);
    }
    const scope = this.scope(plugin, input.guildId, input.channelId, caller);
    const parsed = responseSchema.safeParse(await this.enqueue(plugin, fn, input, scope));
    if (!parsed.success) throw new PluginCallError('invalid', z.prettifyError(parsed.error));
    return parsed.data.actions;
  }

  async autocomplete(
    plugin: LoadedPlugin,
    input: Invocation,
    caller: PluginCaller | null,
  ): Promise<PluginChoice[]> {
    if (!plugin.autocompletes) return [];
    const scope = this.scope(plugin, input.guildId, input.channelId, caller);
    const parsed = choicesSchema.safeParse(
      await this.enqueue(plugin, 'autocomplete', input, scope),
    );
    if (!parsed.success) throw new PluginCallError('invalid', z.prettifyError(parsed.error));
    return parsed.data.choices;
  }

  /** Delivers an event. Returns false when the plugin's backlog is full and the event was dropped. */
  async event(plugin: LoadedPlugin, input: EventInput): Promise<boolean> {
    const queued = this.queuedEvents.get(plugin.id) ?? 0;
    if (queued >= limits.queuedEvents) return false;
    this.queuedEvents.set(plugin.id, queued + 1);
    try {
      const scope = this.scope(plugin, input.guildId, input.channelId, null);
      await this.enqueue(plugin, 'handle_event', input, scope);
      return true;
    } finally {
      this.queuedEvents.set(plugin.id, (this.queuedEvents.get(plugin.id) ?? 1) - 1);
    }
  }

  async job(plugin: LoadedPlugin, input: JobInput): Promise<void> {
    const scope = this.scope(plugin, input.guildId, input.channelId, null);
    await this.enqueue(plugin, 'handle_job', input, scope);
  }

  private scope(
    plugin: LoadedPlugin,
    guildId: string,
    channelId: string | null,
    caller: PluginCaller | null,
  ): PluginScope {
    return { pluginId: plugin.id, guildId, channelId, caller };
  }

  private enqueue(
    plugin: LoadedPlugin,
    fn: string,
    input: object,
    scope: PluginScope,
  ): Promise<unknown> {
    const previous = this.queues.get(plugin.id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.invoke(plugin, fn, input, scope));
    this.queues.set(plugin.id, next);
    return next;
  }

  private async invoke(
    plugin: LoadedPlugin,
    fn: string,
    input: object,
    scope: PluginScope,
  ): Promise<unknown> {
    try {
      const call = plugin.instance.call(fn, JSON.stringify(input), scope);
      const deadline = sleep(limits.timeoutMs + 1000).then(() => {
        throw new Error('timeout: no answer from the plugin worker');
      });
      return (await Promise.race([call, deadline]))?.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      const reason = /timeout/i.test(message) ? 'timeout' : 'crash';
      await this.recycle(plugin).catch((cause) =>
        logger.error({ plugin: plugin.id, err: cause }, 'Plugin could not be restarted'),
      );
      logger.warn({ plugin: plugin.id, fn, reason, error: message }, 'Plugin call failed');
      throw new PluginCallError(reason, message);
    }
  }

  private callFunction(pluginId: string, access: PluginAccess) {
    return async (ctx: CallContext, offset: bigint) => {
      const answer = (body: object) => ctx.store(JSON.stringify(body));
      const refuse = (code: string, message: string) =>
        answer({ ok: false, error: { code, message } });
      const scope = ctx.hostContext<PluginScope>();
      if (!scope || scope.pluginId !== pluginId)
        return refuse('no_scope', 'call() only works while handling a command');

      const request = callRequest.safeParse(ctx.read(offset)?.json());
      if (!request.success) return refuse('invalid_request', 'expected { name, input }');
      const { name, input } = request.data;
      const cap = capability(name);
      if (!cap) return refuse('unknown', `there is no capability "${name}"`);
      if (cap.permission && !access.uses.has(name)) {
        return refuse('not_declared', `add "${name}" to the manifest's "uses"`);
      }
      if (cap.permission && !access.granted.has(cap.permission)) {
        return refuse('forbidden', `needs the "${cap.permission}" permission`);
      }
      if (!(await this.withinRate(scope)))
        return refuse('rate_limited', 'too many calls, slow down');
      try {
        return answer({
          ok: true,
          value: await invokeCapability(cap, scope, input, (t) => inject(t)),
        });
      } catch (error) {
        if (error instanceof CapabilityInputError)
          return refuse('invalid_input', `${name}: ${error.message}`);
        if (error instanceof CapabilityError) return refuse(error.code, error.message);
        logger.warn({ plugin: pluginId, capability: name, err: error }, 'Capability failed');
        return refuse('failed', `${name} failed inside the bot`);
      }
    };
  }

  private async withinRate(scope: PluginScope): Promise<boolean> {
    const key = `plugins:rate:${scope.pluginId}:${scope.guildId}`;
    const [[, count]] = (await cache
      .multi()
      .incr(key)
      .pexpire(key, limits.callWindowMs, 'NX')
      .exec()) as [[null, number]];
    return count <= limits.callsPerWindow;
  }
}
