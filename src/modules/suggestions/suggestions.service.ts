import { and, eq, inArray, sql } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema, userScope } from '@/db';

export type Suggestion = typeof schema.suggestions.$inferSelect;
export type SuggestionStatus = (typeof schema.suggestionStatuses)[number];
export interface Votes {
  up: number;
  down: number;
}

const suggestions = schema.suggestions;
const votes = schema.suggestionVotes;

@Injectable()
export class SuggestionsService {
  async create(guildId: string, authorId: string, content: string): Promise<Suggestion> {
    const [created] = await db
      .insert(suggestions)
      .values({ guildId, authorId, content })
      .returning();
    if (!created) throw new Error('Could not create suggestion');
    return created;
  }

  async get(guildId: string, id: number): Promise<Suggestion | undefined> {
    const [found] = await db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.guildId, guildId), eq(suggestions.id, id)));
    return found;
  }

  async setMessage(id: number, channelId: string, messageId: string): Promise<void> {
    await db.update(suggestions).set({ channelId, messageId }).where(eq(suggestions.id, id));
  }

  async remove(id: number): Promise<void> {
    await db.delete(suggestions).where(eq(suggestions.id, id));
  }

  async vote(id: number, userId: string, value: 1 | -1): Promise<Votes> {
    const [existing] = await db
      .select({ value: votes.value })
      .from(votes)
      .where(and(eq(votes.suggestionId, id), eq(votes.userId, userId)));
    if (existing?.value === value) {
      await db.delete(votes).where(and(eq(votes.suggestionId, id), eq(votes.userId, userId)));
    } else {
      await db
        .insert(votes)
        .values({ suggestionId: id, userId, value })
        .onConflictDoUpdate({ target: [votes.suggestionId, votes.userId], set: { value } });
    }
    return this.votes(id);
  }

  async votes(id: number): Promise<Votes> {
    const [totals] = await db
      .select({
        up: sql<number>`count(*) filter (where ${votes.value} > 0)`.mapWith(Number),
        down: sql<number>`count(*) filter (where ${votes.value} < 0)`.mapWith(Number),
      })
      .from(votes)
      .where(eq(votes.suggestionId, id));
    return totals ?? { up: 0, down: 0 };
  }

  async decide(
    id: number,
    status: Exclude<SuggestionStatus, 'pending'>,
    decidedBy: string,
    reason: string | null,
  ): Promise<Suggestion | undefined> {
    const [updated] = await db
      .update(suggestions)
      .set({ status, decidedBy, decisionReason: reason })
      .where(eq(suggestions.id, id))
      .returning();
    return updated;
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(suggestions).where(eq(suggestions.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    await db
      .delete(suggestions)
      .where(userScope(suggestions.authorId, userId, suggestions.guildId, guildId));
    const inGuild = guildId
      ? inArray(
          votes.suggestionId,
          db
            .select({ id: suggestions.id })
            .from(suggestions)
            .where(eq(suggestions.guildId, guildId)),
        )
      : undefined;
    await db.delete(votes).where(and(eq(votes.userId, userId), inGuild));
  }
}
