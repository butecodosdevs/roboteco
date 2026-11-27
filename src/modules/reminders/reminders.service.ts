import { and, asc, count, eq, inArray, type SQL } from 'drizzle-orm';
import { cancelJob, Injectable } from '@/core';
import { db, schema, userScope } from '@/db';

export type Reminder = typeof schema.reminders.$inferSelect;
export type NewReminder = Pick<Reminder, 'userId' | 'guildId' | 'channelId' | 'text' | 'remindAt'>;
export const maxReminders = 25;

const reminders = schema.reminders;

export { parseDuration } from '@/lib/duration';

@Injectable()
export class RemindersService {
  async create(input: NewReminder): Promise<Reminder> {
    const [created] = await db.insert(reminders).values(input).returning();
    if (!created) throw new Error('Could not create reminder');
    return created;
  }

  async setJob(id: number, jobId: number): Promise<void> {
    await db.update(reminders).set({ jobId }).where(eq(reminders.id, id));
  }

  async count(userId: string): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(reminders)
      .where(eq(reminders.userId, userId));
    return row?.total ?? 0;
  }

  async list(userId: string): Promise<Reminder[]> {
    return db
      .select()
      .from(reminders)
      .where(eq(reminders.userId, userId))
      .orderBy(asc(reminders.remindAt));
  }

  async get(id: number): Promise<Reminder | undefined> {
    const [found] = await db.select().from(reminders).where(eq(reminders.id, id));
    return found;
  }

  async cancel(userId: string, id: number): Promise<boolean> {
    const [removed] = await db
      .delete(reminders)
      .where(and(eq(reminders.userId, userId), eq(reminders.id, id)))
      .returning();
    if (removed?.jobId) await cancelJob(removed.jobId);
    return removed !== undefined;
  }

  async complete(id: number): Promise<void> {
    await db.delete(reminders).where(eq(reminders.id, id));
  }

  async purgeGuild(guildId: string): Promise<void> {
    await this.removeWhere(eq(reminders.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    const scope = userScope(reminders.userId, userId, reminders.guildId, guildId);
    if (scope) await this.removeWhere(scope);
  }

  private async removeWhere(where: SQL): Promise<void> {
    const removed = await db.delete(reminders).where(where).returning({ jobId: reminders.jobId });
    const jobIds = removed.map((r) => r.jobId).filter((id) => id !== null);
    if (jobIds.length > 0)
      await db.delete(schema.scheduledJobs).where(inArray(schema.scheduledJobs.id, jobIds));
  }
}
