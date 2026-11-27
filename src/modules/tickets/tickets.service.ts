import { and, eq, isNull } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema, userScope } from '@/db';

export type Ticket = typeof schema.tickets.$inferSelect;

const tickets = schema.tickets;

@Injectable()
export class TicketsService {
  async openFor(guildId: string, userId: string): Promise<Ticket | undefined> {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(
        and(eq(tickets.guildId, guildId), eq(tickets.userId, userId), isNull(tickets.closedAt)),
      );
    return ticket;
  }

  async create(guildId: string, userId: string, threadId: string): Promise<Ticket> {
    const [created] = await db.insert(tickets).values({ guildId, userId, threadId }).returning();
    if (!created) throw new Error('Could not create ticket');
    return created;
  }

  async get(guildId: string, id: number): Promise<Ticket | undefined> {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.guildId, guildId), eq(tickets.id, id)));
    return ticket;
  }

  async close(id: number): Promise<void> {
    await db.update(tickets).set({ closedAt: new Date() }).where(eq(tickets.id, id));
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(tickets).where(eq(tickets.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    await db.delete(tickets).where(userScope(tickets.userId, userId, tickets.guildId, guildId));
  }
}
