import { type Guild, type GuildMember, PermissionFlagsBits } from 'discord.js';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema, userScope } from '@/db';
import { logger } from '@/logger';

const joins = schema.inviteJoins;

@Injectable()
export class InvitesService {
  private readonly uses = new Map<
    string,
    Map<string, { uses: number; inviterId: string | null }>
  >();

  async snapshot(guild: Guild): Promise<void> {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return;
    this.uses.set(
      guild.id,
      new Map(
        invites.map((invite) => [
          invite.code,
          { uses: invite.uses ?? 0, inviterId: invite.inviterId },
        ]),
      ),
    );
  }

  remember(guildId: string, code: string, inviterId: string | null, uses = 0): void {
    this.uses.get(guildId)?.set(code, { uses, inviterId });
  }

  forget(guildId: string, code: string): void {
    this.uses.get(guildId)?.delete(code);
  }

  async recordJoin(member: GuildMember): Promise<void> {
    const before = this.uses.get(member.guild.id) ?? new Map();
    await this.snapshot(member.guild);
    const after = this.uses.get(member.guild.id) ?? new Map();
    let used: { code: string; inviterId: string | null } | undefined;
    for (const [code, now] of after) {
      if (now.uses > (before.get(code)?.uses ?? 0)) used = { code, inviterId: now.inviterId };
    }
    await db
      .insert(joins)
      .values({
        guildId: member.guild.id,
        memberId: member.id,
        inviterId: used?.inviterId ?? null,
        code: used?.code ?? null,
      })
      .onConflictDoUpdate({
        target: [joins.guildId, joins.memberId],
        set: {
          inviterId: used?.inviterId ?? null,
          code: used?.code ?? null,
          joinedAt: new Date(),
          leftAt: null,
        },
      });
    logger.debug(
      { guild: member.guild.id, member: member.id, invite: used?.code },
      'Member join recorded',
    );
  }

  async recordLeave(member: { guild: Guild; id: string }): Promise<void> {
    await db
      .update(joins)
      .set({ leftAt: new Date() })
      .where(and(eq(joins.guildId, member.guild.id), eq(joins.memberId, member.id)));
  }

  async countFor(guildId: string, inviterId: string): Promise<{ active: number; total: number }> {
    const [row] = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${joins.leftAt} is null)`.mapWith(Number),
      })
      .from(joins)
      .where(and(eq(joins.guildId, guildId), eq(joins.inviterId, inviterId)));
    return { active: row?.active ?? 0, total: row?.total ?? 0 };
  }

  async top(guildId: string, limit = 10) {
    const active = sql<number>`count(*) filter (where ${joins.leftAt} is null)`.mapWith(Number);
    return db
      .select({ inviterId: joins.inviterId, total: count(), active })
      .from(joins)
      .where(and(eq(joins.guildId, guildId), sql`${joins.inviterId} is not null`))
      .groupBy(joins.inviterId)
      .orderBy(desc(active))
      .limit(limit);
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(joins).where(eq(joins.guildId, guildId));
    this.uses.delete(guildId);
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    await db.delete(joins).where(userScope(joins.memberId, userId, joins.guildId, guildId));
    await db
      .update(joins)
      .set({ inviterId: null })
      .where(
        guildId
          ? and(eq(joins.inviterId, userId), eq(joins.guildId, guildId))
          : eq(joins.inviterId, userId),
      );
  }
}
