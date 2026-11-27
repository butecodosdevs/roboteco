import { and, asc, eq, like, sql } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema, userScope } from '@/db';

export type Tag = typeof schema.tags.$inferSelect;

const tags = schema.tags;
const byName = (guildId: string, name: string) =>
  and(eq(tags.guildId, guildId), eq(tags.name, name));
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class TagsService {
  async add(guildId: string, name: string, content: string, authorId: string): Promise<boolean> {
    const inserted = await db
      .insert(tags)
      .values({ guildId, name, content, authorId })
      .onConflictDoNothing()
      .returning({ name: tags.name });
    return inserted.length > 0;
  }

  async use(guildId: string, name: string): Promise<string | undefined> {
    const [tag] = await db
      .update(tags)
      .set({ uses: sql`${tags.uses} + 1` })
      .where(byName(guildId, name))
      .returning({ content: tags.content });
    return tag?.content;
  }

  async get(guildId: string, name: string): Promise<Tag | undefined> {
    const [tag] = await db.select().from(tags).where(byName(guildId, name));
    return tag;
  }

  async remove(guildId: string, name: string): Promise<void> {
    await db.delete(tags).where(byName(guildId, name));
  }

  async names(guildId: string): Promise<string[]> {
    const rows = await db
      .select({ name: tags.name })
      .from(tags)
      .where(eq(tags.guildId, guildId))
      .orderBy(asc(tags.name));
    return rows.map((row) => row.name);
  }

  async search(guildId: string, prefix: string, limit = 25): Promise<string[]> {
    const rows = await db
      .select({ name: tags.name })
      .from(tags)
      .where(
        and(eq(tags.guildId, guildId), like(tags.name, `${escapeLike(prefix.toLowerCase())}%`)),
      )
      .orderBy(asc(tags.name))
      .limit(limit);
    return rows.map((row) => row.name);
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(tags).where(eq(tags.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    await db.delete(tags).where(userScope(tags.authorId, userId, tags.guildId, guildId));
  }
}
