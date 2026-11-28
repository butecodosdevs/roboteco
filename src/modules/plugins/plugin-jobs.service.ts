import { and, asc, count, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CapabilityError, Expose, Injectable, type PluginScope, schedule } from '@/core';
import { db, schema } from '@/db';
import { RunPluginJob, type RunPluginPayload } from './jobs/run-plugin.job';

const jobs = schema.scheduledJobs;
const limits = { pending: 100, minSeconds: 10, maxSeconds: 365 * 86_400, dataBytes: 2048 };
const jobKey = z.string().regex(/^[\w:.-]{1,64}$/, 'letters, numbers, _ : . or -, up to 64');

const ofPlugin = (scope: PluginScope) =>
  and(
    eq(jobs.name, 'plugins.run'),
    sql`${jobs.payload}->>'pluginId' = ${scope.pluginId}`,
    sql`${jobs.payload}->>'guildId' = ${scope.guildId}`,
  );
const withKey = (scope: PluginScope, key: string) =>
  and(ofPlugin(scope), sql`${jobs.payload}->>'key' = ${key}`);

@Injectable()
export class PluginJobsService {
  @Expose('schedule.create', {
    permission: 'schedule',
    description:
      'Run handle_job later (10 seconds to a year), with data. A key replaces any run with the same key',
    input: z
      .object({
        key: jobKey.optional(),
        seconds: z.number().int().min(limits.minSeconds).max(limits.maxSeconds).optional(),
        at: z.iso.datetime({ offset: true }).optional(),
        data: z.unknown().optional(),
      })
      .refine((i) => (i.seconds === undefined) !== (i.at === undefined), 'pass seconds or at')
      .refine(
        (i) => Buffer.byteLength(JSON.stringify(i.data ?? null)) <= limits.dataBytes,
        'data is larger than 2 KB',
      ),
    output: z.object({ runAt: z.string() }),
  })
  async create(
    scope: PluginScope,
    input: { key?: string; seconds?: number; at?: string; data?: unknown },
  ) {
    const runAt = input.at
      ? new Date(input.at)
      : new Date(Date.now() + (input.seconds ?? 0) * 1000);
    const ahead = (runAt.getTime() - Date.now()) / 1000;
    if (ahead < limits.minSeconds || ahead > limits.maxSeconds) {
      throw new CapabilityError('invalid_time', 'runs must be 10 seconds to a year from now');
    }
    if (input.key) await db.delete(jobs).where(withKey(scope, input.key));
    const [row] = await db.select({ n: count() }).from(jobs).where(ofPlugin(scope));
    if ((row?.n ?? 0) >= limits.pending) {
      throw new CapabilityError(
        'schedule_full',
        `at most ${limits.pending} pending runs per server`,
      );
    }
    const payload: RunPluginPayload = {
      pluginId: scope.pluginId,
      guildId: scope.guildId,
      channelId: scope.channelId,
      key: input.key ?? null,
      data: input.data ?? null,
    };
    await schedule(RunPluginJob, runAt, payload);
    return { runAt: runAt.toISOString() };
  }

  @Expose('schedule.cancel', {
    permission: 'schedule',
    description: 'Cancel the pending run with this key',
    input: z.object({ key: jobKey }),
    output: z.object({ cancelled: z.boolean() }),
  })
  async cancel(scope: PluginScope, input: { key: string }) {
    const removed = await db.delete(jobs).where(withKey(scope, input.key)).returning();
    return { cancelled: removed.length > 0 };
  }

  @Expose('schedule.list', {
    permission: 'schedule',
    description: 'Pending runs in this server, soonest first',
    input: z.object({}),
    output: z.object({
      runs: z.array(z.object({ key: z.string().nullable(), runAt: z.string() })),
    }),
  })
  async list(scope: PluginScope) {
    const rows = await db
      .select({ payload: jobs.payload, runAt: jobs.runAt })
      .from(jobs)
      .where(ofPlugin(scope))
      .orderBy(asc(jobs.runAt))
      .limit(limits.pending);
    return {
      runs: rows.map((r) => ({
        key: (r.payload as RunPluginPayload).key,
        runAt: r.runAt.toISOString(),
      })),
    };
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db
      .delete(jobs)
      .where(and(eq(jobs.name, 'plugins.run'), sql`${jobs.payload}->>'guildId' = ${guildId}`));
  }
}
