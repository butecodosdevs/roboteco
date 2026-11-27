import { desc, eq, sql } from 'drizzle-orm';
import { cache } from '@/cache';
import { Injectable } from '@/core';
import { db, schema, userScope } from '@/db';

export type DropChannel = typeof schema.dropChannels.$inferSelect;

export interface ActiveDrop {
  guildId: string;
  channelId: string;
  xp: number;
  winners: number;
}

export interface DrawResult {
  drop: ActiveDrop;
  winnerIds: string[];
  entrants: number;
}

export const dropEmoji = '🎁';

const channels = schema.dropChannels;
const claims = schema.dropClaims;
const spamWindowMs = 5_000;

const countKey = (channelId: string) => `drops:count:${channelId}`;
const seenKey = (channelId: string, userId: string) => `drops:seen:${channelId}:${userId}`;
const dropKey = (messageId: string) => `drops:active:${messageId}`;
const entrantsKey = (messageId: string) => `drops:entrants:${messageId}`;
// Keys outlive the draw time so a delayed job run still finds them.
const gracePeriodSeconds = 600;

@Injectable()
export class DropsService {
  private readonly configured = new Map<string, DropChannel>();

  async load(): Promise<void> {
    this.configured.clear();
    for (const row of await db.select().from(channels)) this.configured.set(row.channelId, row);
  }

  get(channelId: string): DropChannel | undefined {
    return this.configured.get(channelId);
  }

  list(guildId: string): DropChannel[] {
    return [...this.configured.values()].filter((row) => row.guildId === guildId);
  }

  async configure(
    input: Pick<
      DropChannel,
      'guildId' | 'channelId' | 'every' | 'xp' | 'lifetimeSeconds' | 'winners'
    >,
  ) {
    const [row] = await db
      .insert(channels)
      .values(input)
      .onConflictDoUpdate({
        target: channels.channelId,
        set: {
          every: input.every,
          xp: input.xp,
          lifetimeSeconds: input.lifetimeSeconds,
          winners: input.winners,
        },
      })
      .returning();
    if (row) this.configured.set(row.channelId, row);
    await cache.del(countKey(input.channelId));
  }

  async disable(channelId: string): Promise<boolean> {
    const removed = await db.delete(channels).where(eq(channels.channelId, channelId)).returning();
    this.configured.delete(channelId);
    await cache.del(countKey(channelId));
    return removed.length > 0;
  }

  async countMessage(channelId: string, userId: string): Promise<DropChannel | undefined> {
    const config = this.configured.get(channelId);
    if (!config) return undefined;
    // A member counts at most once per window, so flooding the channel doesn't summon drops.
    const counted = await cache.set(seenKey(channelId, userId), '1', 'PX', spamWindowMs, 'NX');
    if (!counted) return undefined;
    const count = await cache.incr(countKey(channelId));
    return count % config.every === 0 ? config : undefined;
  }

  async progress(channelId: string): Promise<number> {
    const config = this.configured.get(channelId);
    const count = Number((await cache.get(countKey(channelId))) ?? 0);
    return config ? count % config.every : 0;
  }

  async open(messageId: string, drop: ActiveDrop, lifetimeSeconds: number): Promise<void> {
    await cache.set(
      dropKey(messageId),
      JSON.stringify(drop),
      'EX',
      lifetimeSeconds + gracePeriodSeconds,
    );
  }

  async enter(messageId: string, userId: string): Promise<boolean> {
    if (!(await cache.exists(dropKey(messageId)))) return false;
    await cache
      .multi()
      .sadd(entrantsKey(messageId), userId)
      .expire(entrantsKey(messageId), gracePeriodSeconds * 2)
      .exec();
    return true;
  }

  async leave(messageId: string, userId: string): Promise<void> {
    await cache.srem(entrantsKey(messageId), userId);
  }

  async draw(messageId: string): Promise<DrawResult | undefined> {
    const raw = await cache.getdel(dropKey(messageId));
    if (!raw) return undefined;
    const drop = JSON.parse(raw) as ActiveDrop;
    const [entrants, winnerIds] = await Promise.all([
      cache.scard(entrantsKey(messageId)),
      cache.srandmember(entrantsKey(messageId), drop.winners),
    ]);
    await cache.del(entrantsKey(messageId));
    for (const userId of winnerIds) {
      await db
        .insert(claims)
        .values({ guildId: drop.guildId, userId, claims: 1, xp: drop.xp })
        .onConflictDoUpdate({
          target: [claims.guildId, claims.userId],
          set: { claims: sql`${claims.claims} + 1`, xp: sql`${claims.xp} + ${drop.xp}` },
        });
    }
    return { drop, winnerIds, entrants };
  }

  async top(guildId: string, limit = 10) {
    return db
      .select()
      .from(claims)
      .where(eq(claims.guildId, guildId))
      .orderBy(desc(claims.claims), desc(claims.xp))
      .limit(limit);
  }

  async purgeGuild(guildId: string): Promise<void> {
    for (const row of this.list(guildId)) await this.disable(row.channelId);
    await db.delete(channels).where(eq(channels.guildId, guildId));
    await db.delete(claims).where(eq(claims.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    await db.delete(claims).where(userScope(claims.userId, userId, claims.guildId, guildId));
  }
}
