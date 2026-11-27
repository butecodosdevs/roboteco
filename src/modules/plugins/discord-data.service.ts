import type { APIRole, Channel, Client, Guild, GuildMember, Role } from 'discord.js';
import { z } from 'zod';
import { Expose, Injectable, type PluginScope, snowflake } from '@/core';

export const memberSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string(),
  bot: z.boolean(),
  owner: z.boolean(),
  roles: z.array(z.string()),
  joinedAt: z.string().nullable(),
});
export const guildSchema = z.object({
  id: z.string(),
  name: z.string(),
  memberCount: z.number(),
  locale: z.string(),
  iconUrl: z.string().nullable(),
});
export const channelSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  type: z.number(),
});

export type MemberData = z.infer<typeof memberSchema>;
export type ChannelData = z.infer<typeof channelSchema>;
export const contextKinds = ['member', 'guild', 'channel'] as const;
export type ContextKind = (typeof contextKinds)[number];

// One shape for every way a plugin sees Discord data: pushed context and pulled capabilities.
export const memberData = (member: GuildMember): MemberData => ({
  id: member.id,
  username: member.user.username,
  displayName: member.displayName,
  avatarUrl: member.displayAvatarURL(),
  bot: member.user.bot,
  owner: member.id === member.guild.ownerId,
  roles: member.roles.cache.filter((role) => role.id !== member.guild.id).map((role) => role.id),
  joinedAt: member.joinedAt?.toISOString() ?? null,
});
export const guildData = (guild: Guild) => ({
  id: guild.id,
  name: guild.name,
  memberCount: guild.memberCount,
  locale: guild.preferredLocale,
  iconUrl: guild.iconURL(),
});
export const channelData = (channel: Channel) => ({
  id: channel.id,
  name: 'name' in channel ? channel.name : null,
  type: channel.type,
});

export const roleData = (role: Role | APIRole) => ({
  id: role.id,
  name: role.name,
  color: role.color,
  position: role.position,
});

@Injectable()
export class DiscordDataService {
  private client: Client<true> | undefined;

  attach(client: Client<true>): void {
    this.client = client;
  }

  @Expose('discord.member.get', {
    permission: 'discord.read',
    description: 'A member of this server, or null when they are not in it',
    input: z.object({ userId: snowflake }),
    output: z.object({ member: memberSchema.nullable() }),
  })
  async member(scope: PluginScope, { userId }: { userId: string }) {
    const guild = this.client?.guilds.cache.get(scope.guildId);
    // fetch() serves from the gateway cache first, so most calls never reach Discord's API.
    const member = await guild?.members.fetch(userId).catch(() => null);
    return { member: member ? memberData(member) : null };
  }
}
