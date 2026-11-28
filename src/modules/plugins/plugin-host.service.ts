import { and, asc, count, eq, like, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CapabilityError, Expose, Injectable, type PluginScope } from '@/core';
import { db, schema } from '@/db';
import { logger } from '@/logger';

const limits = { keyBytes: 128, valueBytes: 4096, keysPerServer: 1000 };
const key = z
  .string()
  .min(1)
  .refine((k) => Buffer.byteLength(k) <= limits.keyBytes, 'key is longer than 128 bytes');
const value = z
  .string()
  .refine((v) => Buffer.byteLength(v) <= limits.valueBytes, 'value is larger than 4 KB');

const kv = schema.pluginKv;
const spaceOf = (scope: PluginScope) =>
  and(eq(kv.pluginId, scope.pluginId), eq(kv.guildId, scope.guildId));
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

@Injectable()
export class PluginHostService {
  @Expose('kv.get', {
    permission: 'kv',
    description: 'Read a value; null when the key is not set',
    input: z.object({ key }),
    output: z.object({ value: z.string().nullable() }),
  })
  async get(scope: PluginScope, input: { key: string }) {
    const [row] = await db
      .select({ value: kv.value })
      .from(kv)
      .where(and(spaceOf(scope), eq(kv.key, input.key)));
    return { value: row?.value ?? null };
  }

  @Expose('kv.set', {
    permission: 'kv',
    description: 'Write a value (up to 4 KB, 1000 keys per server)',
    input: z.object({ key, value }),
    output: z.object({}),
  })
  async set(scope: PluginScope, input: { key: string; value: string }) {
    await this.withRoom(scope, input.key, (tx) =>
      tx
        .insert(kv)
        .values({ pluginId: scope.pluginId, guildId: scope.guildId, ...input })
        .onConflictDoUpdate({
          target: [kv.pluginId, kv.guildId, kv.key],
          set: { value: input.value, updatedAt: new Date() },
        }),
    );
    return {};
  }

  @Expose('kv.delete', {
    permission: 'kv',
    description: 'Remove a key; reports whether it existed',
    input: z.object({ key }),
    output: z.object({ deleted: z.boolean() }),
  })
  async delete(scope: PluginScope, input: { key: string }) {
    const removed = await db
      .delete(kv)
      .where(and(spaceOf(scope), eq(kv.key, input.key)))
      .returning({ key: kv.key });
    return { deleted: removed.length > 0 };
  }

  @Expose('kv.increment', {
    permission: 'kv',
    description: 'Atomically add to a counter (missing keys start at 0) and return the new value',
    input: z.object({ key, by: z.number().int().safe().default(1) }),
    output: z.object({ value: z.number() }),
  })
  async increment(scope: PluginScope, input: { key: string; by: number }) {
    const [row] = await this.withRoom(scope, input.key, (tx) =>
      tx
        .insert(kv)
        .values({
          pluginId: scope.pluginId,
          guildId: scope.guildId,
          key: input.key,
          value: String(input.by),
        })
        .onConflictDoUpdate({
          target: [kv.pluginId, kv.guildId, kv.key],
          set: {
            value: sql`(case when ${kv.value} ~ '^-?[0-9]{1,18}$' then ${kv.value}::bigint + ${input.by} end)::text`,
            updatedAt: new Date(),
          },
        })
        .returning({ value: kv.value }),
    ).catch((error: unknown) => {
      // The case above yields null for values that aren't whole numbers; the column refuses it.
      if (String((error as { cause?: unknown })?.cause ?? error).includes('not-null')) {
        throw new CapabilityError(
          'not_a_number',
          `"${input.key}" holds a value that is not a number`,
        );
      }
      throw error;
    });
    return { value: Number(row?.value ?? input.by) };
  }

  @Expose('kv.list', {
    permission: 'kv',
    description: 'Keys that start with a prefix, sorted, at most 100',
    input: z.object({ prefix: z.string().max(limits.keyBytes).default('') }),
    output: z.object({ keys: z.array(z.string()) }),
  })
  async list(scope: PluginScope, input: { prefix: string }) {
    const escaped = input.prefix.replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await db
      .select({ key: kv.key })
      .from(kv)
      .where(and(spaceOf(scope), like(kv.key, `${escaped}%`)))
      .orderBy(asc(kv.key))
      .limit(100);
    return { keys: rows.map((r) => r.key) };
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

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(kv).where(eq(kv.guildId, guildId));
    await db.delete(schema.pluginMessages).where(eq(schema.pluginMessages.guildId, guildId));
  }

  /** Keys are free-form, so a member's data is found by their ID appearing in the key. */
  async eraseUser(userId: string, guildId?: string): Promise<void> {
    const mentions = sql`strpos(${kv.key}, ${userId}) > 0`;
    await db.delete(kv).where(guildId ? and(eq(kv.guildId, guildId), mentions) : mentions);
  }

  /**
   * Runs a write that may add a key, holding a per-space lock so concurrent writes can't push
   * the space past its key limit.
   */
  private withRoom<T>(scope: PluginScope, field: string, write: (tx: Tx) => Promise<T>) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`plugins:kv:${scope.pluginId}:${scope.guildId}`}))`,
      );
      const [existing] = await tx
        .select({ key: kv.key })
        .from(kv)
        .where(and(spaceOf(scope), eq(kv.key, field)));
      if (!existing) {
        const [row] = await tx.select({ n: count() }).from(kv).where(spaceOf(scope));
        if ((row?.n ?? 0) >= limits.keysPerServer) {
          throw new CapabilityError('storage_full', 'storage is full: 1000 keys per server');
        }
      }
      return write(tx);
    });
  }
}
