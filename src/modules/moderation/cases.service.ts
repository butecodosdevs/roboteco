import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';
import { t } from '@/i18n';

export type CaseAction = (typeof schema.moderationActions)[number];
export type ModerationCase = typeof schema.moderationCases.$inferSelect;
export type NewCase = Pick<
  typeof schema.moderationCases.$inferInsert,
  'guildId' | 'action' | 'targetId' | 'moderatorId' | 'reason' | 'durationSeconds'
>;

export const timeoutDurations = {
  m1: 60,
  m5: 300,
  m10: 600,
  h1: 3600,
  d1: 86_400,
  w1: 604_800,
} as const;
export type TimeoutDuration = keyof typeof timeoutDurations;
export const timeoutDurationKeys = Object.keys(timeoutDurations) as TimeoutDuration[];

export const banDurations = {
  h1: 3600,
  d1: 86_400,
  d3: 259_200,
  w1: 604_800,
  d30: 2_592_000,
} as const;
export type BanDuration = keyof typeof banDurations;
export const banDurationKeys = Object.keys(banDurations) as BanDuration[];

export function formatDuration(locale: string, seconds: number): string {
  const key = timeoutDurationKeys.find((k) => timeoutDurations[k] === seconds);
  if (key) return t(locale, `moderation.durations.${key}`);
  const banKey = banDurationKeys.find((k) => banDurations[k] === seconds);
  if (banKey) return t(locale, `moderation.banDurations.${banKey}`);
  const units: [number, string][] = [
    [86_400, 'd'],
    [3600, 'h'],
    [60, 'm'],
  ];
  let rest = seconds;
  const parts: string[] = [];
  for (const [size, unit] of units) {
    const amount = Math.floor(rest / size);
    if (amount > 0) {
      parts.push(`${amount}${unit}`);
      rest -= amount * size;
    }
  }
  return parts.join(' ') || `${seconds}s`;
}

@Injectable()
export class CasesService {
  async create(input: NewCase, locale: string): Promise<ModerationCase> {
    return db.transaction(async (tx) => {
      const [counter] = await tx
        .insert(schema.guilds)
        .values({ id: input.guildId, locale, moderationCaseCount: 1 })
        .onConflictDoUpdate({
          target: schema.guilds.id,
          set: { moderationCaseCount: sql`${schema.guilds.moderationCaseCount} + 1` },
        })
        .returning({ number: schema.guilds.moderationCaseCount });
      if (!counter) throw new Error(`Could not allocate a case number for guild ${input.guildId}`);

      const [created] = await tx
        .insert(schema.moderationCases)
        .values({ ...input, number: counter.number })
        .returning();
      if (!created) throw new Error(`Could not create case for guild ${input.guildId}`);
      return created;
    });
  }

  async get(guildId: string, number: number): Promise<ModerationCase | undefined> {
    const [found] = await db
      .select()
      .from(schema.moderationCases)
      .where(
        and(eq(schema.moderationCases.guildId, guildId), eq(schema.moderationCases.number, number)),
      );
    return found;
  }

  async forUser(
    guildId: string,
    userId: string,
    limit: number,
  ): Promise<{ cases: ModerationCase[]; total: number }> {
    const where = and(
      eq(schema.moderationCases.guildId, guildId),
      eq(schema.moderationCases.targetId, userId),
    );
    const [cases, [totals]] = await Promise.all([
      db
        .select()
        .from(schema.moderationCases)
        .where(where)
        .orderBy(desc(schema.moderationCases.number))
        .limit(limit),
      db.select({ total: count() }).from(schema.moderationCases).where(where),
    ]);
    return { cases, total: totals?.total ?? 0 };
  }

  async setReason(
    guildId: string,
    number: number,
    reason: string,
  ): Promise<ModerationCase | undefined> {
    const [updated] = await db
      .update(schema.moderationCases)
      .set({ reason })
      .where(
        and(eq(schema.moderationCases.guildId, guildId), eq(schema.moderationCases.number, number)),
      )
      .returning();
    return updated;
  }

  async setLogMessage(id: number, channelId: string, messageId: string): Promise<void> {
    await db
      .update(schema.moderationCases)
      .set({ logChannelId: channelId, logMessageId: messageId })
      .where(eq(schema.moderationCases.id, id));
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(schema.moderationCases).where(eq(schema.moderationCases.guildId, guildId));
  }

  async countWarnings(guildId: string, userId: string, since: Date): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(schema.moderationCases)
      .where(
        and(
          eq(schema.moderationCases.guildId, guildId),
          eq(schema.moderationCases.targetId, userId),
          eq(schema.moderationCases.action, 'warn'),
          gt(schema.moderationCases.createdAt, since),
        ),
      );
    return row?.total ?? 0;
  }
}
