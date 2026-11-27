import { randomInt } from 'node:crypto';
import { and, count, eq, inArray } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';

export type Giveaway = typeof schema.giveaways.$inferSelect;
export type NewGiveaway = Pick<
  Giveaway,
  'guildId' | 'channelId' | 'hostId' | 'prize' | 'winnersCount' | 'endsAt'
>;

const giveaways = schema.giveaways;
const entries = schema.giveawayEntries;

@Injectable()
export class GiveawaysService {
  async create(input: NewGiveaway): Promise<Giveaway> {
    const [created] = await db.insert(giveaways).values(input).returning();
    if (!created) throw new Error('Could not create giveaway');
    return created;
  }

  async get(guildId: string, id: number): Promise<Giveaway | undefined> {
    const [found] = await db
      .select()
      .from(giveaways)
      .where(and(eq(giveaways.guildId, guildId), eq(giveaways.id, id)));
    return found;
  }

  async getById(id: number): Promise<Giveaway | undefined> {
    const [found] = await db.select().from(giveaways).where(eq(giveaways.id, id));
    return found;
  }

  async update(id: number, changes: Partial<Giveaway>): Promise<void> {
    await db.update(giveaways).set(changes).where(eq(giveaways.id, id));
  }

  async remove(id: number): Promise<void> {
    await db.delete(giveaways).where(eq(giveaways.id, id));
  }

  async toggleEntry(id: number, userId: string): Promise<boolean> {
    const removed = await db
      .delete(entries)
      .where(and(eq(entries.giveawayId, id), eq(entries.userId, userId)))
      .returning();
    if (removed.length > 0) return false;
    await db.insert(entries).values({ giveawayId: id, userId }).onConflictDoNothing();
    return true;
  }

  async entryCount(id: number): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(entries)
      .where(eq(entries.giveawayId, id));
    return row?.total ?? 0;
  }

  async drawWinners(id: number, amount: number, exclude: string[] = []): Promise<string[]> {
    const pool = (
      await db.select({ userId: entries.userId }).from(entries).where(eq(entries.giveawayId, id))
    )
      .map((e) => e.userId)
      .filter((userId) => !exclude.includes(userId));
    const winners: string[] = [];
    while (winners.length < amount && pool.length > 0) {
      winners.push(...pool.splice(randomInt(pool.length), 1));
    }
    return winners;
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(giveaways).where(eq(giveaways.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    const inGuild = guildId
      ? inArray(
          entries.giveawayId,
          db.select({ id: giveaways.id }).from(giveaways).where(eq(giveaways.guildId, guildId)),
        )
      : undefined;
    await db.delete(entries).where(and(eq(entries.userId, userId), inGuild));
  }
}
