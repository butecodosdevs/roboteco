import { z } from 'zod';
import { cache } from '@/cache';
import { CapabilityError, Expose, Injectable, type PluginScope } from '@/core';
import { logger } from '@/logger';

const limits = { keyBytes: 128, valueBytes: 4096, keysPerServer: 1000 };
const key = z
  .string()
  .min(1)
  .refine((k) => Buffer.byteLength(k) <= limits.keyBytes, 'key is longer than 128 bytes');
const value = z
  .string()
  .refine((v) => Buffer.byteLength(v) <= limits.valueBytes, 'value is larger than 4 KB');

const storeOf = (scope: PluginScope) => `plugins:kv:${scope.pluginId}:${scope.guildId}`;

/** Storage and logging every plugin gets, one Valkey hash per plugin and server. */
@Injectable()
export class PluginHostService {
  @Expose('kv.get', {
    permission: 'kv',
    description: 'Read a value; null when the key is not set',
    input: z.object({ key }),
    output: z.object({ value: z.string().nullable() }),
  })
  async get(scope: PluginScope, input: { key: string }) {
    return { value: await cache.hget(storeOf(scope), input.key) };
  }

  @Expose('kv.set', {
    permission: 'kv',
    description: 'Write a value (up to 4 KB, 1000 keys per server)',
    input: z.object({ key, value }),
    output: z.object({}),
  })
  async set(scope: PluginScope, input: { key: string; value: string }) {
    await this.ensureRoom(scope, input.key);
    await cache.hset(storeOf(scope), input.key, input.value);
    return {};
  }

  @Expose('kv.delete', {
    permission: 'kv',
    description: 'Remove a key; reports whether it existed',
    input: z.object({ key }),
    output: z.object({ deleted: z.boolean() }),
  })
  async delete(scope: PluginScope, input: { key: string }) {
    return { deleted: (await cache.hdel(storeOf(scope), input.key)) > 0 };
  }

  @Expose('kv.increment', {
    permission: 'kv',
    description: 'Atomically add to a counter (missing keys start at 0) and return the new value',
    input: z.object({ key, by: z.number().int().default(1) }),
    output: z.object({ value: z.number() }),
  })
  async increment(scope: PluginScope, input: { key: string; by: number }) {
    await this.ensureRoom(scope, input.key);
    return { value: await cache.hincrby(storeOf(scope), input.key, input.by) };
  }

  @Expose('kv.list', {
    permission: 'kv',
    description: 'Keys that start with a prefix, sorted, at most 100',
    input: z.object({ prefix: z.string().default('') }),
    output: z.object({ keys: z.array(z.string()) }),
  })
  async list(scope: PluginScope, input: { prefix: string }) {
    const keys = (await cache.hkeys(storeOf(scope))).filter((k) => k.startsWith(input.prefix));
    return { keys: keys.sort().slice(0, 100) };
  }

  @Expose('log', {
    description: "Write to the bot's logs",
    input: z.object({
      message: z.string(),
      level: z.enum(['info', 'warn', 'error']).default('info'),
    }),
    output: z.object({}),
  })
  log(scope: PluginScope, input: { message: string; level: 'info' | 'warn' | 'error' }) {
    logger[input.level](
      { plugin: scope.pluginId, guild: scope.guildId },
      input.message.slice(0, 500),
    );
    return {};
  }

  async purge(pluginIds: string[], guildId: string): Promise<void> {
    for (const pluginId of pluginIds) await cache.del(`plugins:kv:${pluginId}:${guildId}`);
  }

  private async ensureRoom(scope: PluginScope, field: string): Promise<void> {
    const store = storeOf(scope);
    if (!(await cache.hexists(store, field)) && (await cache.hlen(store)) >= limits.keysPerServer) {
      throw new CapabilityError('storage_full', 'storage is full: 1000 keys per server');
    }
  }
}
