import type { Guild, Role } from 'discord.js';
import { and, asc, eq } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';

export type SelfRole = typeof schema.selfRoles.$inferSelect;
export const maxSelfRoles = 25;

const selfRoles = schema.selfRoles;

@Injectable()
export class RolesService {
  async list(guildId: string): Promise<SelfRole[]> {
    return db
      .select()
      .from(selfRoles)
      .where(eq(selfRoles.guildId, guildId))
      .orderBy(asc(selfRoles.createdAt));
  }

  async add(guildId: string, roleId: string, description: string | null): Promise<void> {
    await db
      .insert(selfRoles)
      .values({ guildId, roleId, description })
      .onConflictDoUpdate({ target: [selfRoles.guildId, selfRoles.roleId], set: { description } });
  }

  async remove(guildId: string, roleId: string): Promise<boolean> {
    const removed = await db
      .delete(selfRoles)
      .where(and(eq(selfRoles.guildId, guildId), eq(selfRoles.roleId, roleId)))
      .returning({ roleId: selfRoles.roleId });
    return removed.length > 0;
  }

  canAssign(guild: Guild, role: Role): boolean {
    const me = guild.members.me;
    return (
      !role.managed && role.id !== guild.id && !!me && me.roles.highest.comparePositionTo(role) > 0
    );
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(selfRoles).where(eq(selfRoles.guildId, guildId));
  }
}
