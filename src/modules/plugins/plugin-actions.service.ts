import {
  ChannelType,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  PermissionFlagsBits,
  PermissionsBitField,
} from 'discord.js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { cache } from '@/cache';
import { CapabilityError, Expose, Injectable, inject, type PluginScope, snowflake } from '@/core';
import { db, schema } from '@/db';
import { elevatedPermissions } from '@/lib/permissions';
import { DiscordDataService } from './discord-data.service';
import { messageBodySchema } from './plugin-manifest.service';
import { PluginRenderService } from './plugin-render.service';

const messages = schema.pluginMessages;
const reason = z.string().max(400).optional();
const sent = z.object({ messageId: z.string(), channelId: z.string() });
// DMs come from the bot's own account, so one plugin may only DM a member a few times an hour.
const dmBudget = { messages: 5, windowSeconds: 3600 };

const names = (flags: bigint[]) => new PermissionsBitField(flags).toArray().join(', ');

/**
 * What plugins can do on Discord. Every action checks the bot's own permissions, and when a member
 * triggered it, that the member could have done it themselves.
 */
@Injectable()
export class PluginActionsService {
  private readonly discord = inject(DiscordDataService);
  private readonly render = inject(PluginRenderService);

  @Expose('discord.messages.send', {
    permission: 'messages.send',
    description:
      'Post a message (text, embeds, buttons, selects) in a channel of this server; default: the channel of the command, click or event (memberJoin, memberLeave, levelUp and caseCreated have none, so pass channelId)',
    input: messageBodySchema.safeExtend({ channelId: snowflake.optional() }),
    output: sent,
  })
  async send(
    scope: PluginScope,
    input: z.infer<typeof messageBodySchema> & { channelId?: string },
  ) {
    const guild = this.discord.guild(scope);
    const channel = await this.textChannel(guild, input.channelId ?? scope.channelId);
    const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
    if (input.embeds?.length) needed.push(PermissionFlagsBits.EmbedLinks);
    await this.allow(scope, guild, channel, needed);
    const message = await channel.send(this.render.message(scope.pluginId, input));
    await this.remember(scope, channel.id, message.id);
    return { messageId: message.id, channelId: channel.id };
  }

  @Expose('discord.messages.edit', {
    permission: 'messages.send',
    description: 'Edit a message this plugin posted',
    input: messageBodySchema.safeExtend({ channelId: snowflake, messageId: snowflake }),
    output: sent,
  })
  async edit(
    scope: PluginScope,
    input: z.infer<typeof messageBodySchema> & { channelId: string; messageId: string },
  ) {
    const guild = this.discord.guild(scope);
    await this.ownMessage(scope, input.messageId);
    const channel = await this.textChannel(guild, input.channelId);
    const message = await channel.messages.fetch(input.messageId).catch(() => null);
    if (!message) throw new CapabilityError('not_found', 'that message no longer exists');
    await message.edit(this.render.message(scope.pluginId, input));
    return { messageId: message.id, channelId: channel.id };
  }

  @Expose('discord.messages.delete', {
    permission: 'messages.send',
    description: 'Delete a message this plugin posted',
    input: z.object({ channelId: snowflake, messageId: snowflake }),
    output: z.object({ deleted: z.boolean() }),
  })
  async deleteOwn(scope: PluginScope, input: { channelId: string; messageId: string }) {
    const guild = this.discord.guild(scope);
    await this.ownMessage(scope, input.messageId);
    const channel = await this.textChannel(guild, input.channelId);
    const deleted = await channel.messages
      .delete(input.messageId)
      .then(() => true)
      .catch(() => false);
    await db.delete(messages).where(eq(messages.messageId, input.messageId));
    return { deleted };
  }

  @Expose('discord.messages.remove', {
    permission: 'messages.manage',
    caller: PermissionFlagsBits.ManageMessages,
    description: "Delete anyone's message, with a reason for the audit log",
    input: z.object({ channelId: snowflake, messageId: snowflake, reason }),
    output: z.object({ deleted: z.boolean() }),
  })
  async remove(
    scope: PluginScope,
    input: { channelId: string; messageId: string; reason?: string },
  ) {
    const guild = this.discord.guild(scope);
    const channel = await this.textChannel(guild, input.channelId);
    await this.allow(scope, guild, channel, [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ManageMessages,
    ]);
    const deleted = await guild.client.rest
      .delete(`/channels/${channel.id}/messages/${input.messageId}`, {
        reason: this.auditReason(scope, input.reason),
      })
      .then(() => true)
      .catch(() => false);
    return { deleted };
  }

  @Expose('discord.reactions.add', {
    permission: 'reactions',
    description: 'React to a message with a unicode emoji or a custom emoji ID',
    input: z.object({
      channelId: snowflake,
      messageId: snowflake,
      emoji: z.string().min(1).max(64),
    }),
    output: z.object({}),
  })
  async react(scope: PluginScope, input: { channelId: string; messageId: string; emoji: string }) {
    const guild = this.discord.guild(scope);
    const channel = await this.textChannel(guild, input.channelId);
    await this.allow(scope, guild, channel, [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ReadMessageHistory,
    ]);
    const message = await channel.messages.fetch(input.messageId).catch(() => null);
    if (!message) throw new CapabilityError('not_found', 'that message no longer exists');
    await message.react(input.emoji).catch(() => {
      throw new CapabilityError(
        'invalid_emoji',
        `"${input.emoji}" is not an emoji the bot can use`,
      );
    });
    return {};
  }

  @Expose('discord.dm.send', {
    permission: 'dm.send',
    description: `Send a member of this server a direct message (${dmBudget.messages} per member per hour)`,
    input: messageBodySchema.safeExtend({ userId: snowflake }),
    output: z.object({ delivered: z.boolean() }),
  })
  async dm(scope: PluginScope, input: z.infer<typeof messageBodySchema> & { userId: string }) {
    const guild = this.discord.guild(scope);
    const member = await guild.members.fetch(input.userId).catch(() => null);
    if (!member || member.user.bot) {
      throw new CapabilityError('not_found', 'that user is not a member of this server');
    }
    const key = `plugins:dm:${scope.pluginId}:${guild.id}:${member.id}`;
    const [[, count]] = (await cache
      .multi()
      .incr(key)
      .expire(key, dmBudget.windowSeconds, 'NX')
      .exec()) as [[null, number]];
    if (count > dmBudget.messages) {
      throw new CapabilityError('dm_limit', `${dmBudget.messages} DMs per member per hour`);
    }
    const delivered = await member
      .send(this.render.message(scope.pluginId, input))
      .then(() => true)
      .catch(() => false);
    return { delivered };
  }

  @Expose('discord.threads.create', {
    permission: 'threads.create',
    description: 'Start a thread in a channel, or from a message',
    input: z.object({
      channelId: snowflake.optional(),
      messageId: snowflake.optional(),
      name: z.string().min(1).max(100),
      private: z.boolean().default(false),
    }),
    output: z.object({ threadId: z.string() }),
  })
  async thread(
    scope: PluginScope,
    input: { channelId?: string; messageId?: string; name: string; private: boolean },
  ) {
    const guild = this.discord.guild(scope);
    const channel = await this.textChannel(guild, input.channelId ?? scope.channelId);
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      throw new CapabilityError('wrong_channel', 'threads can only start in text channels');
    }
    const flag = input.private
      ? PermissionFlagsBits.CreatePrivateThreads
      : PermissionFlagsBits.CreatePublicThreads;
    await this.allow(scope, guild, channel, [PermissionFlagsBits.ViewChannel, flag]);
    const reasonText = this.auditReason(scope);
    if (input.messageId) {
      const message = await channel.messages.fetch(input.messageId).catch(() => null);
      if (!message) throw new CapabilityError('not_found', 'that message no longer exists');
      const thread = await message.startThread({ name: input.name, reason: reasonText });
      return { threadId: thread.id };
    }
    const thread =
      channel.type === ChannelType.GuildText
        ? await channel.threads.create({
            name: input.name,
            reason: reasonText,
            type: input.private ? ChannelType.PrivateThread : ChannelType.PublicThread,
          })
        : await channel.threads.create({ name: input.name, reason: reasonText });
    return { threadId: thread.id };
  }

  @Expose('discord.roles.add', {
    permission: 'roles.manage',
    description:
      'Give a member a role. Roles with staff permissions need a caller with Manage Roles',
    input: z.object({ userId: snowflake, roleId: snowflake, reason }),
    output: z.object({ changed: z.boolean() }),
  })
  addRole(scope: PluginScope, input: { userId: string; roleId: string; reason?: string }) {
    return this.changeRole(scope, input, 'add');
  }

  @Expose('discord.roles.remove', {
    permission: 'roles.manage',
    description:
      'Take a role from a member. Roles with staff permissions need a caller with Manage Roles',
    input: z.object({ userId: snowflake, roleId: snowflake, reason }),
    output: z.object({ changed: z.boolean() }),
  })
  removeRole(scope: PluginScope, input: { userId: string; roleId: string; reason?: string }) {
    return this.changeRole(scope, input, 'remove');
  }

  /** Records a message an interaction reply posted, so the plugin can edit it later. */
  async remember(scope: PluginScope, channelId: string, messageId: string): Promise<void> {
    await db
      .insert(messages)
      .values({ messageId, channelId, pluginId: scope.pluginId, guildId: scope.guildId })
      .onConflictDoNothing();
  }

  private async changeRole(
    scope: PluginScope,
    input: { userId: string; roleId: string; reason?: string },
    change: 'add' | 'remove',
  ) {
    const guild = this.discord.guild(scope);
    const role = guild.roles.cache.get(input.roleId);
    if (!role || role.id === guild.id) throw new CapabilityError('not_found', 'no such role');
    if (role.managed) {
      throw new CapabilityError('managed_role', 'that role belongs to an integration');
    }
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new CapabilityError('bot_forbidden', 'the bot needs Manage Roles');
    }
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      throw new CapabilityError('bot_hierarchy', 'that role is above the bot’s highest role');
    }

    const caller =
      scope.caller && (await guild.members.fetch(scope.caller.userId).catch(() => null));
    const staff =
      !!caller &&
      caller.permissions.has(PermissionFlagsBits.ManageRoles) &&
      (caller.id === guild.ownerId || caller.roles.highest.comparePositionTo(role) > 0);
    // Without a staff caller (a member's own command, an event, a scheduled run), only plain
    // roles: otherwise a plugin command would let anyone hand out moderator roles.
    if (!staff && role.permissions.any(elevatedPermissions)) {
      throw new CapabilityError(
        'caller_forbidden',
        `the role grants staff permissions, so it needs a caller with Manage Roles above it (${names(elevatedPermissions.filter((f) => role.permissions.has(f)))})`,
      );
    }

    const member = await guild.members.fetch(input.userId).catch(() => null);
    if (!member) throw new CapabilityError('not_found', 'that user is not a member of this server');
    const has = member.roles.cache.has(role.id);
    if ((change === 'add') === has) return { changed: false };
    const reasonText = this.auditReason(scope, input.reason);
    if (change === 'add') await member.roles.add(role, reasonText);
    else await member.roles.remove(role, reasonText);
    return { changed: true };
  }

  private async ownMessage(scope: PluginScope, messageId: string): Promise<void> {
    const [row] = await db
      .select({ id: messages.messageId })
      .from(messages)
      .where(
        and(
          eq(messages.messageId, messageId),
          eq(messages.pluginId, scope.pluginId),
          eq(messages.guildId, scope.guildId),
        ),
      );
    if (!row) throw new CapabilityError('not_owner', 'this plugin did not post that message');
  }

  private async textChannel(
    guild: Guild,
    channelId: string | null | undefined,
  ): Promise<GuildTextBasedChannel> {
    if (!channelId) throw new CapabilityError('no_channel', 'pass channelId');
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      throw new CapabilityError('not_found', 'no text channel with that ID in this server');
    }
    return channel;
  }

  /** The bot needs `flags` in the channel, and so does the member who triggered the call. */
  private async allow(
    scope: PluginScope,
    guild: Guild,
    channel: GuildTextBasedChannel,
    flags: bigint[],
  ): Promise<void> {
    const me = guild.members.me;
    const missing = flags.filter((f) => !me || !channel.permissionsFor(me).has(f));
    if (missing.length > 0) {
      throw new CapabilityError('bot_forbidden', `the bot needs ${names(missing)} in that channel`);
    }
    if (!scope.caller) return;
    const caller: GuildMember | null = await guild.members
      .fetch(scope.caller.userId)
      .catch(() => null);
    const theirs = caller ? channel.permissionsFor(caller) : null;
    const lacking = flags.filter((f) => !theirs?.has(f));
    if (lacking.length > 0) {
      throw new CapabilityError(
        'caller_forbidden',
        `the member who ran this needs ${names(lacking)} in that channel`,
      );
    }
  }

  private auditReason(scope: PluginScope, reasonText?: string): string {
    const who = scope.caller ? ` for ${scope.caller.userId}` : '';
    return `Plugin ${scope.pluginId}${who}${reasonText ? `: ${reasonText}` : ''}`.slice(0, 512);
  }
}
