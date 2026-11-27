import {
  ChannelType,
  type Guild,
  type GuildMember,
  PermissionFlagsBits,
  type VoiceChannel,
} from 'discord.js';
import { and, eq } from 'drizzle-orm';
import { cache } from '@/cache';
import { Injectable } from '@/core';
import { db, schema } from '@/db';
import { t } from '@/i18n';
import { logger } from '@/logger';

export type TempVoiceChannel = typeof schema.tempVoiceChannels.$inferSelect;
export type TempVoiceHub = typeof schema.tempVoiceHubs.$inferSelect;

export type CloseReason = 'empty' | 'idle';
export type RoomState = CloseReason | 'active';

// Bots (music bots, recorders) don't keep a channel alive; muted or deafened people count as idle.
export function roomState(channel: VoiceChannel): RoomState {
  const people = channel.members.filter((member) => !member.user.bot);
  if (people.size === 0) return 'empty';
  return people.every((member) => member.voice.mute || member.voice.deaf) ? 'idle' : 'active';
}

const hubs = schema.tempVoiceHubs;
const rooms = schema.tempVoiceChannels;
const createCooldownMs = 10_000;

// The owner administers their channel with Discord's own tools: edit channel (name, limit,
// permissions), right-click to disconnect, move, mute or deafen, and manage the chat.
export const ownerPermissions = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.Stream,
  PermissionFlagsBits.PrioritySpeaker,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.ManageMessages,
];

// Discord only lets the bot grant permissions it has itself.
const requiredBotPermissions = [
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.ManageMessages,
];

@Injectable()
export class TempVoiceService {
  canManage(guild: Guild): boolean {
    return guild.members.me?.permissions.has(requiredBotPermissions) ?? false;
  }

  async setHub(
    hub: Pick<
      TempVoiceHub,
      | 'guildId'
      | 'channelId'
      | 'categoryId'
      | 'userLimit'
      | 'emptyTimeoutSeconds'
      | 'idleTimeoutSeconds'
    >,
  ): Promise<void> {
    const { categoryId, userLimit, emptyTimeoutSeconds, idleTimeoutSeconds } = hub;
    await db.insert(hubs).values(hub).onConflictDoUpdate({
      target: hubs.channelId,
      set: { categoryId, userLimit, emptyTimeoutSeconds, idleTimeoutSeconds },
    });
  }

  async setCloseTimer(
    channelId: string,
    jobId: number | null,
    reason: CloseReason | null,
  ): Promise<void> {
    await db
      .update(rooms)
      .set({ closeJobId: jobId, closeReason: reason })
      .where(eq(rooms.channelId, channelId));
  }

  async removeHub(guildId: string, channelId: string): Promise<boolean> {
    const removed = await db
      .delete(hubs)
      .where(and(eq(hubs.guildId, guildId), eq(hubs.channelId, channelId)))
      .returning();
    return removed.length > 0;
  }

  async hub(channelId: string): Promise<TempVoiceHub | undefined> {
    const [found] = await db.select().from(hubs).where(eq(hubs.channelId, channelId));
    return found;
  }

  async hubsOf(guildId: string): Promise<TempVoiceHub[]> {
    return db.select().from(hubs).where(eq(hubs.guildId, guildId));
  }

  async room(channelId: string): Promise<TempVoiceChannel | undefined> {
    const [found] = await db.select().from(rooms).where(eq(rooms.channelId, channelId));
    return found;
  }

  async ownedBy(guildId: string, ownerId: string): Promise<TempVoiceChannel | undefined> {
    const [found] = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.guildId, guildId), eq(rooms.ownerId, ownerId)));
    return found;
  }

  async joinedHub(member: GuildMember, hub: TempVoiceHub): Promise<void> {
    const { guild } = member;
    if (!this.canManage(guild)) return;

    const existing = await this.ownedBy(guild.id, member.id);
    const existingChannel = existing ? guild.channels.cache.get(existing.channelId) : undefined;
    if (existingChannel?.type === ChannelType.GuildVoice) {
      await member.voice.setChannel(existingChannel).catch(() => undefined);
      return;
    }
    if (existing) await this.forget(existing.channelId);

    const fresh = await cache.set(
      `tempvoice:create:${guild.id}:${member.id}`,
      '1',
      'PX',
      createCooldownMs,
      'NX',
    );
    if (!fresh) {
      await member.voice.disconnect('Creating voice channels too fast').catch(() => undefined);
      return;
    }

    const hubChannel = guild.channels.cache.get(hub.channelId);
    const locale = guild.preferredLocale;
    const channel = await guild.channels.create({
      name: t(locale, 'tempVoice.channelName', { user: member.displayName }).slice(0, 100),
      type: ChannelType.GuildVoice,
      parent: hub.categoryId ?? hubChannel?.parentId ?? null,
      userLimit: hub.userLimit,
      permissionOverwrites: [
        ...(hubChannel && 'permissionOverwrites' in hubChannel
          ? hubChannel.permissionOverwrites.cache.map((o) => ({
              id: o.id,
              allow: o.allow,
              deny: o.deny,
              type: o.type,
            }))
          : []),
        { id: member.id, allow: ownerPermissions },
        {
          id: guild.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            ...requiredBotPermissions,
          ],
        },
      ],
      reason: `Temporary voice channel for ${member.user.tag}`,
    });
    await db.insert(rooms).values({
      channelId: channel.id,
      guildId: guild.id,
      hubId: hub.channelId,
      ownerId: member.id,
    });

    const moved = await member.voice
      .setChannel(channel)
      .then(() => true)
      .catch(() => false);
    if (!moved) {
      await this.close(channel);
      return;
    }
    await channel
      .send({
        content: t(locale, 'tempVoice.welcome', { user: member.toString() }),
        allowedMentions: { users: [member.id] },
      })
      .catch(() => undefined);
    logger.info(
      { guild: guild.id, channel: channel.id, owner: member.id },
      'Temporary voice channel created',
    );
  }

  async close(channel: VoiceChannel, reason: CloseReason = 'empty'): Promise<void> {
    await this.forget(channel.id);
    const why = reason === 'idle' ? 'everyone was muted or deafened' : 'nobody was in it';
    await channel.delete(`Temporary voice channel closed: ${why}`).catch(() => undefined);
    logger.info(
      { guild: channel.guildId, channel: channel.id, reason },
      'Temporary voice channel closed',
    );
  }

  async rooms(guildId: string): Promise<TempVoiceChannel[]> {
    return db.select().from(rooms).where(eq(rooms.guildId, guildId));
  }

  async forget(channelId: string): Promise<void> {
    await db.delete(rooms).where(eq(rooms.channelId, channelId));
  }

  async setOwner(
    channel: VoiceChannel,
    previousOwnerId: string,
    member: GuildMember,
  ): Promise<void> {
    await db.update(rooms).set({ ownerId: member.id }).where(eq(rooms.channelId, channel.id));
    await channel.permissionOverwrites.delete(previousOwnerId).catch(() => undefined);
    await channel.permissionOverwrites.edit(
      member.id,
      Object.fromEntries(ownerPermissions.map((p) => [permissionName(p), true])),
    );
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(rooms).where(eq(rooms.guildId, guildId));
    await db.delete(hubs).where(eq(hubs.guildId, guildId));
  }
}

const flagNames = Object.entries(PermissionFlagsBits) as [
  keyof typeof PermissionFlagsBits,
  bigint,
][];
export function permissionName(flag: bigint): keyof typeof PermissionFlagsBits {
  const entry = flagNames.find(([, value]) => value === flag);
  if (!entry) throw new Error(`Unknown permission ${flag}`);
  return entry[0];
}
