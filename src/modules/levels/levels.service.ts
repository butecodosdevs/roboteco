import type { GuildMember, Message, SendableChannels } from 'discord.js';
import { and, asc, count, desc, eq, gt, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { cache } from '@/cache';
import { CapabilityError, Expose, Injectable, inject, type PluginScope, snowflake } from '@/core';
import { db, getGuildSettings, schema, userScope } from '@/db';
import { t } from '@/i18n';
import { DomainEventsService } from '@/modules/domain-events/domain-events.service';

export type MemberLevel = typeof schema.memberLevels.$inferSelect;

const levels = schema.memberLevels;
const rewards = schema.levelRewards;
const cooldownMs = 60_000;
const minXp = 15;
const maxXp = 25;

export const xpToNext = (level: number) => 5 * level ** 2 + 50 * level + 100;

export function levelFor(xp: number): { level: number; current: number; needed: number } {
  let level = 0;
  let remaining = xp;
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level += 1;
  }
  return { level, current: remaining, needed: xpToNext(level) };
}

/** XP a plugin may give one member, per window. */
const pluginXpBudget = { amount: 100, windowSeconds: 600 };

@Injectable()
export class LevelsService {
  private readonly events = inject(DomainEventsService);

  async award(message: Message<true>): Promise<void> {
    const key = `levels:cooldown:${message.guildId}:${message.author.id}`;
    const fresh = await cache.set(key, '1', 'PX', cooldownMs, 'NX');
    if (!fresh) return;
    const gained = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));
    await this.grant(message.member, message.guildId, message.author.id, gained, {
      channel: message.channel,
      locale: message.guild.preferredLocale,
    });
  }

  async grant(
    member: GuildMember | null,
    guildId: string,
    userId: string,
    gained: number,
    announce?: { channel: SendableChannels; locale: string },
  ): Promise<void> {
    const [row] = await db
      .insert(levels)
      .values({ guildId, userId, xp: gained })
      .onConflictDoUpdate({
        target: [levels.guildId, levels.userId],
        set: { xp: sql`${levels.xp} + ${gained}`, updatedAt: new Date() },
      })
      .returning();
    if (!row) return;

    const { level } = levelFor(row.xp);
    if (level <= row.level) return;
    await db
      .update(levels)
      .set({ level })
      .where(and(eq(levels.guildId, row.guildId), eq(levels.userId, row.userId)));

    this.events.emit('levels.levelUp', { guildId, userId, level, xp: row.xp });
    if (member) await this.applyRewards(member, level);
    const settings = await getGuildSettings(guildId);
    if (announce && (settings?.levelUpAnnounce ?? true)) {
      await announce.channel
        .send({
          content: t(announce.locale, 'levels.levelUp', { user: `<@${userId}>`, level }),
          allowedMentions: { users: [userId] },
        })
        .catch(() => undefined);
    }
  }

  async applyRewards(member: GuildMember, level: number): Promise<void> {
    const earned = await db
      .select({ roleId: rewards.roleId })
      .from(rewards)
      .where(and(eq(rewards.guildId, member.guild.id), lte(rewards.level, level)));
    const missing = earned
      .map((r) => r.roleId)
      .filter((id) => member.guild.roles.cache.has(id) && !member.roles.cache.has(id));
    if (missing.length > 0)
      await member.roles.add(missing, `Level ${level} reward`).catch(() => undefined);
  }

  async get(guildId: string, userId: string): Promise<MemberLevel | undefined> {
    const [row] = await db
      .select()
      .from(levels)
      .where(and(eq(levels.guildId, guildId), eq(levels.userId, userId)));
    return row;
  }

  async position(guildId: string, xp: number): Promise<number> {
    const [ahead] = await db
      .select({ total: count() })
      .from(levels)
      .where(and(eq(levels.guildId, guildId), gt(levels.xp, xp)));
    return (ahead?.total ?? 0) + 1;
  }

  async top(guildId: string, limit = 10): Promise<MemberLevel[]> {
    return db
      .select()
      .from(levels)
      .where(eq(levels.guildId, guildId))
      .orderBy(desc(levels.xp), asc(levels.userId))
      .limit(limit);
  }

  async setReward(guildId: string, level: number, roleId: string): Promise<void> {
    await db
      .insert(rewards)
      .values({ guildId, level, roleId })
      .onConflictDoUpdate({ target: [rewards.guildId, rewards.level], set: { roleId } });
  }

  async removeReward(guildId: string, level: number): Promise<boolean> {
    const removed = await db
      .delete(rewards)
      .where(and(eq(rewards.guildId, guildId), eq(rewards.level, level)))
      .returning({ level: rewards.level });
    return removed.length > 0;
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(levels).where(eq(levels.guildId, guildId));
    await db.delete(rewards).where(eq(rewards.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    await db.delete(levels).where(userScope(levels.userId, userId, levels.guildId, guildId));
  }

  @Expose('levels.get', {
    permission: 'levels.read',
    description: "A member's XP, level and leaderboard position in this server",
    input: z.object({ userId: snowflake }),
    output: z.object({ xp: z.number(), level: z.number(), rank: z.number().nullable() }),
  })
  async levelOf(scope: PluginScope, { userId }: { userId: string }) {
    const row = await this.get(scope.guildId, userId);
    if (!row) return { xp: 0, level: 0, rank: null };
    return {
      xp: row.xp,
      level: levelFor(row.xp).level,
      rank: await this.position(scope.guildId, row.xp),
    };
  }

  @Expose('levels.top', {
    permission: 'levels.read',
    description: 'The leaderboard of this server',
    input: z.object({ limit: z.number().int().min(1).max(25).default(10) }),
    output: z.object({
      entries: z.array(z.object({ userId: z.string(), xp: z.number(), level: z.number() })),
    }),
  })
  async leaderboard(scope: PluginScope, { limit }: { limit: number }) {
    const rows = await this.top(scope.guildId, limit);
    return {
      entries: rows.map((row) => ({
        userId: row.userId,
        xp: row.xp,
        level: levelFor(row.xp).level,
      })),
    };
  }

  @Expose('xp.grant', {
    permission: 'xp.grant',
    description: `Give XP to a member (default: who ran the command). Each plugin can give a member at most ${pluginXpBudget.amount} XP every ${pluginXpBudget.windowSeconds / 60} minutes`,
    input: z.object({
      userId: snowflake.optional(),
      amount: z.number().int().min(1).max(pluginXpBudget.amount),
    }),
    output: z.object({ xp: z.number(), level: z.number(), remaining: z.number() }),
  })
  async grantFromPlugin(scope: PluginScope, input: { userId?: string; amount: number }) {
    const userId = input.userId ?? scope.caller?.userId;
    if (!userId) throw new CapabilityError('no_member', 'pass userId: nobody ran a command here');
    // A plugin can call this in a loop, so the cap is per member over time, not per call.
    const key = `plugins:xp:${scope.pluginId}:${scope.guildId}:${userId}`;
    const [[, used]] = (await cache
      .multi()
      .incrby(key, input.amount)
      .expire(key, pluginXpBudget.windowSeconds, 'NX')
      .exec()) as [[null, number]];
    if (used > pluginXpBudget.amount) {
      await cache.decrby(key, input.amount);
      const left = Math.max(0, pluginXpBudget.amount - (used - input.amount));
      throw new CapabilityError(
        'xp_limit',
        `this plugin can give this member ${left} more XP for now (${pluginXpBudget.amount} every ${pluginXpBudget.windowSeconds / 60} minutes)`,
      );
    }
    await this.grant(null, scope.guildId, userId, input.amount);
    const xp = (await this.get(scope.guildId, userId))?.xp ?? input.amount;
    return { xp, level: levelFor(xp).level, remaining: pluginXpBudget.amount - used };
  }
}
