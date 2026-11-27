import type { Client } from 'discord.js';
import { eq, inArray, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { logger, reportError } from '@/logger';
import type { Type } from './types';

type JobTarget<P> = Type<{ execute: (payload: P, client: Client<true>) => Promise<unknown> }>;
type JobInstance = { execute: (payload: unknown, client: Client<true>) => Promise<unknown> };

const jobMeta = new WeakMap<Type, string>();
const jobs = schema.scheduledJobs;
const maxAttempts = 5;
const batchSize = 20;

export function Job(name: string) {
  return (target: JobTarget<never>, _context: ClassDecoratorContext) => {
    jobMeta.set(target, name);
  };
}

export async function schedule<P>(job: JobTarget<P>, runAt: Date, payload: P): Promise<number> {
  const name = jobMeta.get(job);
  if (!name) throw new Error(`${job.name} is not decorated with @Job()`);
  const [row] = await db.insert(jobs).values({ name, runAt, payload }).returning({ id: jobs.id });
  if (!row) throw new Error(`Could not schedule ${name}`);
  return row.id;
}

export async function ensureScheduled<P>(
  job: JobTarget<P>,
  runAt: Date,
  payload: P,
): Promise<void> {
  const name = jobMeta.get(job);
  if (!name) throw new Error(`${job.name} is not decorated with @Job()`);
  const [existing] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.name, name))
    .limit(1);
  if (!existing) await schedule(job, runAt, payload);
}

export async function cancelJob(id: number): Promise<void> {
  await db.delete(jobs).where(eq(jobs.id, id));
}

export class JobRunner {
  private readonly handlers = new Map<string, JobInstance>();
  private timer: NodeJS.Timeout | undefined;

  register(target: Type): void {
    const name = jobMeta.get(target);
    if (!name) throw new Error(`${target.name} is not decorated with @Job()`);
    if (this.handlers.has(name)) throw new Error(`Duplicate job "${name}"`);
    this.handlers.set(name, new target() as JobInstance);
  }

  get size(): number {
    return this.handlers.size;
  }

  start(client: Client<true>, intervalMs = 10_000): void {
    if (this.handlers.size === 0 || this.timer) return;
    const tick = () => {
      this.runDue(client).catch((error) => reportError(error, {}, 'Job runner failed'));
    };
    this.timer = setInterval(tick, intervalMs);
    tick();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async runDue(client: Client<true>): Promise<void> {
    const due = db
      .select({ id: jobs.id })
      .from(jobs)
      .where(lte(jobs.runAt, sql`now()`))
      .orderBy(jobs.runAt)
      .limit(batchSize)
      .for('update', { skipLocked: true });
    // Leasing pushes runAt forward, so a crash mid-job retries it later instead of losing it.
    const claimed = await db
      .update(jobs)
      .set({ runAt: sql`now() + interval '5 minutes'`, attempts: sql`${jobs.attempts} + 1` })
      .where(inArray(jobs.id, due))
      .returning();

    for (const job of claimed) {
      const handler = this.handlers.get(job.name);
      if (!handler) {
        logger.warn({ job: job.name, id: job.id }, 'No handler registered for job');
        continue;
      }
      try {
        await handler.execute(job.payload, client);
        await db.delete(jobs).where(eq(jobs.id, job.id));
      } catch (error) {
        reportError(error, { job: job.name, id: job.id, attempt: job.attempts }, 'Job failed');
        if (job.attempts >= maxAttempts) {
          await db.delete(jobs).where(eq(jobs.id, job.id));
        } else {
          const retryAt = new Date(Date.now() + 2 ** job.attempts * 60_000);
          await db
            .update(jobs)
            .set({ runAt: retryAt, lastError: String(error) })
            .where(eq(jobs.id, job.id));
        }
      }
    }
  }
}
