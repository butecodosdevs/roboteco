import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import createPlugin, { type CallContext, type Plugin } from '@extism/extism';
import { z } from 'zod';
import { cache } from '@/cache';
import { Injectable, inject } from '@/core';
import { capMemory, wasmExports, wasmImports } from '@/lib/wasm';
import { logger } from '@/logger';
import { LevelsService } from '@/modules/levels/levels.service';
import { type PluginCommandSpec, PluginManifestService } from './plugin-manifest.service';

export const permissions = ['kv', 'xp.grant', 'http'] as const;
export type Permission = (typeof permissions)[number];

export interface PluginDefinition {
  id: string;
  wasm: string;
  permissions: Permission[];
  allowedHosts?: string[];
}

export interface LoadedPlugin {
  id: string;
  version: string;
  commands: PluginCommandSpec[];
  autocompletes: boolean;
  permissions: Permission[];
  instance: Plugin;
  definition: PluginDefinition;
  wasm: Uint8Array;
}

export type OptionValue = string | number | boolean;

export interface CommandContext {
  command: string;
  subcommand: string | null;
  options: Record<string, OptionValue>;
  userId: string;
  guildId: string;
  channelId: string;
  locale: string;
}

export interface AutocompleteContext extends CommandContext {
  focused: { name: string; value: string };
}

interface CallScope {
  pluginId: string;
  guildId: string;
  userId: string;
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
  kvKeyBytes: 128,
  kvValueBytes: 4096,
  kvKeysPerGuild: 1000,
  xpPerCall: 100,
};

// Host functions a plugin can import, and the permission each one needs. Anything else is refused.
const hostImports: Record<string, Record<string, Permission | null>> = {
  'extism:host/user': { kv_get: 'kv', kv_set: 'kv', kv_del: 'kv', xp_grant: 'xp.grant', log: null },
  'extism:host/env': { http_request: 'http', http_status_code: 'http', http_headers: 'http' },
};
const runtimeModules = new Set(['wasi_snapshot_preview1']);

const outputSchema = z.object({
  actions: z
    .array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('reply'),
          content: z.string().min(1).max(2000),
          ephemeral: z.boolean().optional(),
        }),
      ]),
    )
    .max(5),
});
export type PluginAction = z.infer<typeof outputSchema>['actions'][number];

const choicesSchema = z.object({
  choices: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        value: z.union([z.string().max(100), z.number()]),
      }),
    )
    .max(25),
});
export type PluginChoice = z.infer<typeof choicesSchema>['choices'][number];

const kvKey = (scope: CallScope) => `plugins:kv:${scope.pluginId}:${scope.guildId}`;

@Injectable()
export class PluginEngineService {
  private readonly levels = inject(LevelsService);
  private readonly manifests = inject(PluginManifestService);
  private readonly queues = new Map<string, Promise<unknown>>();

  requiredPermissions(wasm: Uint8Array): Permission[] {
    const required = new Set<Permission>();
    for (const { module: namespace, name } of wasmImports(wasm)) {
      if (runtimeModules.has(namespace)) continue;
      const known = hostImports[namespace];
      if (!known) throw new PluginLoadError(`imports unknown module "${namespace}"`);
      if (!(name in known)) {
        if (namespace === 'extism:host/env') continue;
        throw new PluginLoadError(`imports unknown host function "${namespace}::${name}"`);
      }
      const permission = known[name];
      if (permission) required.add(permission);
    }
    return [...required];
  }

  async load(definition: PluginDefinition): Promise<LoadedPlugin> {
    const wasm = capMemory(await readFile(definition.wasm), limits.maxMemoryPages);
    const required = this.requiredPermissions(wasm);
    const missing = required.filter((p) => !definition.permissions.includes(p));
    if (missing.length > 0) {
      throw new PluginLoadError(`needs permissions that were not granted: ${missing.join(', ')}`);
    }

    const instance = await this.instantiate(definition, wasm, required);
    const manifest = this.manifests.parse((await instance.call('manifest'))?.json());
    logger.info(
      { plugin: definition.id, version: manifest.version, permissions: required },
      'Plugin loaded',
    );
    return {
      id: definition.id,
      version: manifest.version,
      commands: manifest.commands,
      autocompletes: wasmExports(wasm).includes('autocomplete'),
      permissions: required,
      instance,
      definition,
      wasm,
    };
  }

  private instantiate(
    definition: PluginDefinition,
    wasm: Uint8Array,
    granted: Permission[],
  ): Promise<Plugin> {
    return createPlugin(
      { wasm: [{ data: wasm }] },
      {
        runInWorker: true,
        useWasi: wasmImports(wasm).some((i) => runtimeModules.has(i.module)),
        allowedPaths: {},
        allowedHosts: granted.includes('http') ? (definition.allowedHosts ?? []) : [],
        timeoutMs: limits.timeoutMs,
        memory: { maxPages: limits.maxMemoryPages, maxHttpResponseBytes: 1 << 20 },
        functions: { 'extism:host/user': this.hostFunctions(definition.id, granted) },
      },
    );
  }

  // The SDK's worker can be left unusable after a trap or a timeout, so a failed plugin is always
  // replaced by a fresh instance and the old worker is dropped.
  private async recycle(plugin: LoadedPlugin): Promise<void> {
    const old = plugin.instance;
    plugin.instance = await this.instantiate(plugin.definition, plugin.wasm, plugin.permissions);
    void Promise.race([old.close(), sleep(1000)]).catch(() => undefined);
  }

  async run(plugin: LoadedPlugin, context: CommandContext): Promise<PluginAction[]> {
    const output = await this.enqueue(plugin, 'handle_command', context);
    const parsed = outputSchema.safeParse(output);
    if (!parsed.success) throw new PluginCallError('invalid', parsed.error.message);
    return parsed.data.actions;
  }

  async autocomplete(plugin: LoadedPlugin, context: AutocompleteContext): Promise<PluginChoice[]> {
    if (!plugin.autocompletes) return [];
    const parsed = choicesSchema.safeParse(await this.enqueue(plugin, 'autocomplete', context));
    if (!parsed.success) throw new PluginCallError('invalid', parsed.error.message);
    return parsed.data.choices;
  }

  private enqueue(plugin: LoadedPlugin, fn: string, context: CommandContext): Promise<unknown> {
    const previous = this.queues.get(plugin.id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.call(plugin, fn, context));
    this.queues.set(plugin.id, next);
    return next;
  }

  private async call(plugin: LoadedPlugin, fn: string, context: CommandContext): Promise<unknown> {
    const scope: CallScope = {
      pluginId: plugin.id,
      guildId: context.guildId,
      userId: context.userId,
    };
    let output: unknown;
    try {
      const call = plugin.instance.call(fn, JSON.stringify(context), scope);
      const deadline = sleep(limits.timeoutMs + 1000).then(() => {
        throw new Error('timeout: no answer from the plugin worker');
      });
      output = (await Promise.race([call, deadline]))?.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      const reason = /timeout/i.test(message) ? 'timeout' : 'crash';
      await this.recycle(plugin).catch((cause) =>
        logger.error({ plugin: plugin.id, err: cause }, 'Plugin could not be restarted'),
      );
      logger.warn(
        { plugin: plugin.id, command: context.command, reason, error: message },
        'Plugin call failed',
      );
      throw new PluginCallError(reason, message);
    }
    return output;
  }

  private hostFunctions(pluginId: string, granted: Permission[]) {
    const scopeOf = (ctx: CallContext) => {
      const scope = ctx.hostContext<CallScope>();
      if (!scope || scope.pluginId !== pluginId)
        throw new Error('Host function called outside a command');
      return scope;
    };
    const fail = (message: string) => {
      throw new Error(message);
    };
    const functions: Record<string, (ctx: CallContext, offset: bigint) => unknown> = {
      log: (ctx, offset) => {
        logger.info({ plugin: pluginId }, (ctx.read(offset)?.text() ?? '').slice(0, 500));
        return 0n;
      },
    };
    if (granted.includes('kv')) {
      functions.kv_get = async (ctx, offset) => {
        const key = ctx.read(offset)?.text() ?? '';
        return ctx.store((await cache.hget(kvKey(scopeOf(ctx)), key)) ?? '');
      };
      functions.kv_set = async (ctx, offset) => {
        const scope = scopeOf(ctx);
        const { key, value } = z
          .object({ key: z.string(), value: z.string() })
          .parse(ctx.read(offset)?.json());
        if (Buffer.byteLength(key) > limits.kvKeyBytes) fail('kv key too long');
        if (Buffer.byteLength(value) > limits.kvValueBytes) fail('kv value too large');
        const exists = await cache.hexists(kvKey(scope), key);
        if (!exists && (await cache.hlen(kvKey(scope))) >= limits.kvKeysPerGuild)
          fail('kv is full');
        await cache.hset(kvKey(scope), key, value);
        return 0n;
      };
      functions.kv_del = async (ctx, offset) => {
        await cache.hdel(kvKey(scopeOf(ctx)), ctx.read(offset)?.text() ?? '');
        return 0n;
      };
    }
    if (granted.includes('xp.grant')) {
      functions.xp_grant = async (ctx, offset) => {
        const scope = scopeOf(ctx);
        const amount = Math.min(
          Math.max(Number(ctx.read(offset)?.text()) || 0, 0),
          limits.xpPerCall,
        );
        await this.levels.grant(null, scope.guildId, scope.userId, amount);
        return ctx.store(String(amount));
      };
    }
    return functions;
  }
}
