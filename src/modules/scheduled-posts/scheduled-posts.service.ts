import { and, asc, count, eq } from 'drizzle-orm';
import { cancelJob, Injectable } from '@/core';
import { db, schema } from '@/db';

export type ScheduledPost = typeof schema.scheduledPosts.$inferSelect;
export type PostRepeat = (typeof schema.postRepeats)[number];
export const maxScheduledPosts = 25;
export const repeatMs: Record<PostRepeat, number> = {
  none: 0,
  daily: 86_400_000,
  weekly: 604_800_000,
};

const posts = schema.scheduledPosts;

@Injectable()
export class ScheduledPostsService {
  async create(
    input: Pick<
      ScheduledPost,
      'guildId' | 'channelId' | 'content' | 'repeat' | 'nextRunAt' | 'createdBy'
    >,
  ): Promise<ScheduledPost> {
    const [created] = await db.insert(posts).values(input).returning();
    if (!created) throw new Error('Could not schedule post');
    return created;
  }

  async get(id: number): Promise<ScheduledPost | undefined> {
    const [found] = await db.select().from(posts).where(eq(posts.id, id));
    return found;
  }

  async update(id: number, changes: Partial<ScheduledPost>): Promise<void> {
    await db.update(posts).set(changes).where(eq(posts.id, id));
  }

  async count(guildId: string): Promise<number> {
    const [row] = await db.select({ total: count() }).from(posts).where(eq(posts.guildId, guildId));
    return row?.total ?? 0;
  }

  async list(guildId: string): Promise<ScheduledPost[]> {
    return db.select().from(posts).where(eq(posts.guildId, guildId)).orderBy(asc(posts.nextRunAt));
  }

  async cancel(guildId: string, id: number): Promise<boolean> {
    const [removed] = await db
      .delete(posts)
      .where(and(eq(posts.guildId, guildId), eq(posts.id, id)))
      .returning();
    if (removed?.jobId) await cancelJob(removed.jobId);
    return removed !== undefined;
  }

  async complete(id: number): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  async purgeGuild(guildId: string): Promise<void> {
    const removed = await db.delete(posts).where(eq(posts.guildId, guildId)).returning();
    for (const post of removed) if (post.jobId) await cancelJob(post.jobId);
  }
}
