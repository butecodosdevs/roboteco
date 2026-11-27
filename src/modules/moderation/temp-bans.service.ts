import { and, eq } from 'drizzle-orm';
import { cancelJob, Injectable } from '@/core';
import { db, schema } from '@/db';

const tempBans = schema.tempBans;
const byUser = (guildId: string, userId: string) =>
  and(eq(tempBans.guildId, guildId), eq(tempBans.userId, userId));

@Injectable()
export class TempBansService {
  async add(guildId: string, userId: string, jobId: number, expiresAt: Date): Promise<void> {
    await db
      .insert(tempBans)
      .values({ guildId, userId, jobId, expiresAt })
      .onConflictDoUpdate({
        target: [tempBans.guildId, tempBans.userId],
        set: { jobId, expiresAt },
      });
  }

  async cancel(guildId: string, userId: string): Promise<void> {
    const [removed] = await db.delete(tempBans).where(byUser(guildId, userId)).returning();
    if (removed) await cancelJob(removed.jobId);
  }

  async complete(guildId: string, userId: string): Promise<void> {
    await db.delete(tempBans).where(byUser(guildId, userId));
  }

  async purgeGuild(guildId: string): Promise<void> {
    const removed = await db.delete(tempBans).where(eq(tempBans.guildId, guildId)).returning();
    for (const ban of removed) await cancelJob(ban.jobId);
  }
}
