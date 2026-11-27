import { and, eq } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema, userScope } from '@/db';

export type Report = typeof schema.reports.$inferSelect;
export type NewReport = Omit<
  typeof schema.reports.$inferInsert,
  'id' | 'status' | 'handledBy' | 'createdAt'
>;
export type ReportStatus = (typeof schema.reportStatuses)[number];

const reports = schema.reports;

@Injectable()
export class ReportsService {
  async create(input: NewReport): Promise<Report> {
    const [created] = await db.insert(reports).values(input).returning();
    if (!created) throw new Error('Could not create report');
    return created;
  }

  async setStatus(
    guildId: string,
    id: number,
    status: Exclude<ReportStatus, 'open'>,
    handledBy: string,
  ): Promise<Report | undefined> {
    const [updated] = await db
      .update(reports)
      .set({ status, handledBy })
      .where(and(eq(reports.guildId, guildId), eq(reports.id, id)))
      .returning();
    return updated;
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(reports).where(eq(reports.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    await db.delete(reports).where(userScope(reports.reporterId, userId, reports.guildId, guildId));
  }
}
