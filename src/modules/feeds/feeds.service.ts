import { and, count, eq } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';

export type Feed = typeof schema.feeds.$inferSelect;
export const maxFeeds = 10;
export const seenLimit = 100;

const feeds = schema.feeds;

@Injectable()
export class FeedsService {
  async add(
    input: Pick<Feed, 'guildId' | 'channelId' | 'url' | 'title' | 'seenIds'>,
  ): Promise<Feed> {
    const [created] = await db.insert(feeds).values(input).returning();
    if (!created) throw new Error('Could not add feed');
    return created;
  }

  async count(guildId: string): Promise<number> {
    const [row] = await db.select({ total: count() }).from(feeds).where(eq(feeds.guildId, guildId));
    return row?.total ?? 0;
  }

  async list(guildId: string): Promise<Feed[]> {
    return db.select().from(feeds).where(eq(feeds.guildId, guildId));
  }

  async all(): Promise<Feed[]> {
    return db.select().from(feeds);
  }

  async remove(guildId: string, id: number): Promise<boolean> {
    const removed = await db
      .delete(feeds)
      .where(and(eq(feeds.guildId, guildId), eq(feeds.id, id)))
      .returning({ id: feeds.id });
    return removed.length > 0;
  }

  async update(id: number, changes: Partial<Feed>): Promise<void> {
    await db.update(feeds).set(changes).where(eq(feeds.id, id));
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(feeds).where(eq(feeds.guildId, guildId));
  }
}
