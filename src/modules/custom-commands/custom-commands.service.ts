import type { Guild } from 'discord.js';
import { and, asc, count, eq } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';

export type CustomCommand = typeof schema.customCommands.$inferSelect;
export const maxCustomCommands = 50;
export const namePattern = /^[a-z0-9_-]{1,32}$/;

const commands = schema.customCommands;
const byName = (guildId: string, name: string) =>
  and(eq(commands.guildId, guildId), eq(commands.name, name));

@Injectable()
export class CustomCommandsService {
  async save(guild: Guild, name: string, response: string, description: string, createdBy: string) {
    const existing = await this.get(guild.id, name);
    const registered = existing?.commandId
      ? await guild.commands.edit(existing.commandId, { name, description })
      : await guild.commands.create({ name, description });
    await db
      .insert(commands)
      .values({
        guildId: guild.id,
        name,
        response,
        description,
        commandId: registered.id,
        createdBy,
      })
      .onConflictDoUpdate({
        target: [commands.guildId, commands.name],
        set: { response, description, commandId: registered.id },
      });
  }

  async get(guildId: string, name: string): Promise<CustomCommand | undefined> {
    const [found] = await db.select().from(commands).where(byName(guildId, name));
    return found;
  }

  async list(guildId: string): Promise<CustomCommand[]> {
    return db
      .select()
      .from(commands)
      .where(eq(commands.guildId, guildId))
      .orderBy(asc(commands.name));
  }

  async count(guildId: string): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(commands)
      .where(eq(commands.guildId, guildId));
    return row?.total ?? 0;
  }

  async remove(guild: Guild, name: string): Promise<boolean> {
    const [removed] = await db.delete(commands).where(byName(guild.id, name)).returning();
    if (removed?.commandId) await guild.commands.delete(removed.commandId).catch(() => undefined);
    return removed !== undefined;
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(commands).where(eq(commands.guildId, guildId));
  }
}
