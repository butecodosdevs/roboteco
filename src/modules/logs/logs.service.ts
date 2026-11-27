import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type GuildBan,
  type GuildMember,
  type Message,
  type NonThreadGuildBasedChannel,
  type PartialGuildMember,
  type PartialMessage,
  type Role,
  type SendableChannels,
} from 'discord.js';
import { Injectable } from '@/core';
import { getGuildSettings } from '@/db';
import { translator } from '@/i18n';

/** The event categories the server log can report. Also the i18n keys under `logs.events`. */
export const logEvents = [
  'messageEdit',
  'messageDelete',
  'messageBulkDelete',
  'memberJoin',
  'memberLeave',
  'memberUpdate',
  'memberBan',
  'memberUnban',
  'channelCreate',
  'channelDelete',
  'channelUpdate',
  'roleCreate',
  'roleDelete',
  'roleUpdate',
] as const;

export type LogEvent = (typeof logEvents)[number];

const colors: Record<LogEvent, number> = {
  messageEdit: 0xf1c40f,
  messageDelete: 0xe74c3c,
  messageBulkDelete: 0x992d22,
  memberJoin: 0x2ecc71,
  memberLeave: 0xe67e22,
  memberUpdate: 0x3498db,
  memberBan: 0x992d22,
  memberUnban: 0x2ecc71,
  channelCreate: 0x2ecc71,
  channelDelete: 0xe74c3c,
  channelUpdate: 0x3498db,
  roleCreate: 0x2ecc71,
  roleDelete: 0xe74c3c,
  roleUpdate: 0x3498db,
};

// Discord caps an embed field value at 1024 characters; leave room for the ellipsis.
const fieldLimit = 1000;

function truncate(text: string, max = fieldLimit): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface Resolved {
  channel: SendableChannels;
  disabled: Set<string>;
  ignored: Set<string>;
}

@Injectable()
export class LogsService {
  private async resolve(guild: Guild): Promise<Resolved | null> {
    const settings = await getGuildSettings(guild.id);
    if (!settings?.serverLogChannelId) return null;
    const channel = await guild.channels.fetch(settings.serverLogChannelId).catch(() => null);
    if (!channel?.isSendable()) return null;
    return {
      channel,
      disabled: new Set(settings.serverLogDisabledEvents),
      ignored: new Set(settings.serverLogIgnoredChannels),
    };
  }

  /** Sends an embed to the log channel when the event is enabled and the source channel is logged. */
  private async post(
    guild: Guild,
    event: LogEvent,
    embed: EmbedBuilder,
    sourceChannelId?: string,
  ): Promise<void> {
    const resolved = await this.resolve(guild);
    if (!resolved) return;
    if (resolved.disabled.has(event)) return;
    // Never log the log channel itself, or channels the staff chose to ignore: both only add noise.
    if (
      sourceChannelId &&
      (sourceChannelId === resolved.channel.id || resolved.ignored.has(sourceChannelId))
    ) {
      return;
    }
    embed.setColor(colors[event]).setTimestamp(new Date());
    await resolved.channel
      .send({ embeds: [embed], allowedMentions: { parse: [] } })
      .catch(() => undefined);
  }

  async messageEdited(
    before: Message | PartialMessage,
    after: Message | PartialMessage,
  ): Promise<void> {
    const message = after.partial ? await after.fetch().catch(() => null) : after;
    if (!message?.inGuild() || message.author.bot || message.system) return;
    const oldContent = before.partial ? null : before.content;
    // Edits to embeds or attachments fire this event too; only report real text changes.
    if (oldContent !== null && oldContent === message.content) return;

    const tr = translator(message.guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.messageEditTitle'))
      .setDescription(
        tr('logs.log.messageEditWhere', {
          author: `<@${message.author.id}>`,
          channel: `<#${message.channelId}>`,
          link: message.url,
        }),
      )
      .addFields(
        {
          name: tr('logs.log.before'),
          value: oldContent ? truncate(oldContent) : tr('logs.log.unknown'),
        },
        { name: tr('logs.log.after'), value: truncate(message.content || tr('logs.log.empty')) },
      )
      .setFooter({ text: tr('logs.log.authorId', { id: message.author.id }) });
    await this.post(message.guild, 'messageEdit', embed, message.channelId);
  }

  async messageDeleted(message: Message | PartialMessage): Promise<void> {
    if (!message.guild) return;
    if (message.author?.bot || message.system) return;
    const tr = translator(message.guild.preferredLocale);
    const author = message.author ? `<@${message.author.id}>` : tr('logs.log.unknown');
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.messageDeleteTitle'))
      .setDescription(
        tr('logs.log.messageDeleteWhere', { author, channel: `<#${message.channelId}>` }),
      )
      .addFields({
        name: tr('logs.log.content'),
        value: message.content
          ? truncate(message.content)
          : message.partial
            ? tr('logs.log.uncached')
            : tr('logs.log.empty'),
      });
    if (message.author)
      embed.setFooter({ text: tr('logs.log.authorId', { id: message.author.id }) });
    await this.post(message.guild, 'messageDelete', embed, message.channelId);
  }

  async messagesBulkDeleted(guild: Guild, channelId: string, count: number): Promise<void> {
    const tr = translator(guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.messageBulkDeleteTitle'))
      .setDescription(tr('logs.log.messageBulkDeleteWhere', { count, channel: `<#${channelId}>` }));
    await this.post(guild, 'messageBulkDelete', embed, channelId);
  }

  async memberJoined(member: GuildMember): Promise<void> {
    const tr = translator(member.guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.memberJoinTitle'))
      .setDescription(tr('logs.log.member', { user: `<@${member.id}>`, tag: member.user.tag }))
      .setThumbnail(member.user.displayAvatarURL())
      .addFields({
        name: tr('logs.log.accountCreated'),
        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      })
      .setFooter({ text: tr('logs.log.userId', { id: member.id }) });
    await this.post(member.guild, 'memberJoin', embed);
  }

  async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {
    const tr = translator(member.guild.preferredLocale);
    const roles = member.roles.cache.filter((role) => role.id !== member.guild.id);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.memberLeaveTitle'))
      .setDescription(tr('logs.log.member', { user: `<@${member.id}>`, tag: member.user.tag }))
      .setFooter({ text: tr('logs.log.userId', { id: member.id }) });
    if (roles.size > 0) {
      embed.addFields({
        name: tr('logs.log.roles'),
        value: truncate(roles.map((role) => role.toString()).join(' ')),
      });
    }
    await this.post(member.guild, 'memberLeave', embed);
  }

  async memberUpdated(before: GuildMember | PartialGuildMember, after: GuildMember): Promise<void> {
    const tr = translator(after.guild.preferredLocale);
    const fields: { name: string; value: string }[] = [];

    if (before.nickname !== after.nickname) {
      fields.push({
        name: tr('logs.log.nickname'),
        value: tr('logs.log.change', {
          from: before.nickname ?? tr('logs.log.none'),
          to: after.nickname ?? tr('logs.log.none'),
        }),
      });
    }

    const beforeRoles = before.roles.cache;
    const added = after.roles.cache.filter((role) => !beforeRoles.has(role.id));
    const removed = beforeRoles.filter((role) => !after.roles.cache.has(role.id));
    if (added.size > 0) {
      fields.push({
        name: tr('logs.log.rolesAdded'),
        value: truncate(added.map((role) => role.toString()).join(' ')),
      });
    }
    if (removed.size > 0) {
      fields.push({
        name: tr('logs.log.rolesRemoved'),
        value: truncate(removed.map((role) => role.toString()).join(' ')),
      });
    }

    // Timeouts come through here too. Only compare when `before` is cached, to avoid a false change.
    if (!before.partial) {
      const beforeTimeout = before.communicationDisabledUntilTimestamp ?? null;
      const afterTimeout = after.communicationDisabledUntilTimestamp ?? null;
      if (beforeTimeout !== afterTimeout) {
        fields.push({
          name: tr('logs.log.timeout'),
          value:
            afterTimeout && afterTimeout > Date.now()
              ? tr('logs.log.timedOutUntil', { time: `<t:${Math.floor(afterTimeout / 1000)}:F>` })
              : tr('logs.log.timeoutRemoved'),
        });
      }
    }

    // guildMemberUpdate also fires for avatars and flags; skip when nothing we track moved.
    if (fields.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.memberUpdateTitle'))
      .setDescription(tr('logs.log.member', { user: `<@${after.id}>`, tag: after.user.tag }))
      .addFields(fields)
      .setFooter({ text: tr('logs.log.userId', { id: after.id }) });
    await this.post(after.guild, 'memberUpdate', embed);
  }

  async memberBanned(ban: GuildBan): Promise<void> {
    const tr = translator(ban.guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.memberBanTitle'))
      .setDescription(tr('logs.log.member', { user: `<@${ban.user.id}>`, tag: ban.user.tag }))
      .addFields({ name: tr('logs.log.reason'), value: ban.reason ?? tr('logs.log.noReason') })
      .setFooter({ text: tr('logs.log.userId', { id: ban.user.id }) });
    await this.post(ban.guild, 'memberBan', embed);
  }

  async memberUnbanned(ban: GuildBan): Promise<void> {
    const tr = translator(ban.guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.memberUnbanTitle'))
      .setDescription(tr('logs.log.member', { user: `<@${ban.user.id}>`, tag: ban.user.tag }))
      .setFooter({ text: tr('logs.log.userId', { id: ban.user.id }) });
    await this.post(ban.guild, 'memberUnban', embed);
  }

  async channelCreated(channel: NonThreadGuildBasedChannel): Promise<void> {
    const tr = translator(channel.guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.channelCreateTitle'))
      .addFields(
        { name: tr('logs.log.channel'), value: `${channel} (${channel.name})` },
        { name: tr('logs.log.type'), value: ChannelType[channel.type], inline: true },
      )
      .setFooter({ text: tr('logs.log.channelId', { id: channel.id }) });
    await this.post(channel.guild, 'channelCreate', embed);
  }

  async channelDeleted(channel: NonThreadGuildBasedChannel): Promise<void> {
    const tr = translator(channel.guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.channelDeleteTitle'))
      .addFields(
        { name: tr('logs.log.channel'), value: `#${channel.name}` },
        { name: tr('logs.log.type'), value: ChannelType[channel.type], inline: true },
      )
      .setFooter({ text: tr('logs.log.channelId', { id: channel.id }) });
    await this.post(channel.guild, 'channelDelete', embed);
  }

  async channelUpdated(
    before: NonThreadGuildBasedChannel,
    after: NonThreadGuildBasedChannel,
  ): Promise<void> {
    const tr = translator(after.guild.preferredLocale);
    const fields: { name: string; value: string }[] = [];

    if (before.name !== after.name) {
      fields.push({
        name: tr('logs.log.name'),
        value: tr('logs.log.change', { from: before.name, to: after.name }),
      });
    }
    const beforeTopic = 'topic' in before ? (before.topic ?? '') : '';
    const afterTopic = 'topic' in after ? (after.topic ?? '') : '';
    if (beforeTopic !== afterTopic) {
      fields.push({
        name: tr('logs.log.topic'),
        value: truncate(
          tr('logs.log.change', {
            from: beforeTopic || tr('logs.log.none'),
            to: afterTopic || tr('logs.log.none'),
          }),
        ),
      });
    }

    // Channel updates also fire for permission and position tweaks; skip when name and topic are unchanged.
    if (fields.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.channelUpdateTitle'))
      .setDescription(`${after} (${after.name})`)
      .addFields(fields)
      .setFooter({ text: tr('logs.log.channelId', { id: after.id }) });
    await this.post(after.guild, 'channelUpdate', embed);
  }

  async roleCreated(role: Role): Promise<void> {
    const tr = translator(role.guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.roleCreateTitle'))
      .addFields({ name: tr('logs.log.role'), value: `${role} (${role.name})` })
      .setFooter({ text: tr('logs.log.roleId', { id: role.id }) });
    await this.post(role.guild, 'roleCreate', embed);
  }

  async roleDeleted(role: Role): Promise<void> {
    const tr = translator(role.guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.roleDeleteTitle'))
      .addFields({ name: tr('logs.log.role'), value: `@${role.name}` })
      .setFooter({ text: tr('logs.log.roleId', { id: role.id }) });
    await this.post(role.guild, 'roleDelete', embed);
  }

  async roleUpdated(before: Role, after: Role): Promise<void> {
    const tr = translator(after.guild.preferredLocale);
    const fields: { name: string; value: string }[] = [];

    if (before.name !== after.name) {
      fields.push({
        name: tr('logs.log.name'),
        value: tr('logs.log.change', { from: before.name, to: after.name }),
      });
    }
    const added = after.permissions.toArray().filter((p) => !before.permissions.has(p));
    const removed = before.permissions.toArray().filter((p) => !after.permissions.has(p));
    if (added.length > 0) {
      fields.push({ name: tr('logs.log.permissionsAdded'), value: truncate(added.join(', ')) });
    }
    if (removed.length > 0) {
      fields.push({ name: tr('logs.log.permissionsRemoved'), value: truncate(removed.join(', ')) });
    }

    // Role updates also fire for colour, hoist and position; skip when name and permissions are unchanged.
    if (fields.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle(tr('logs.log.roleUpdateTitle'))
      .setDescription(`${after} (${after.name})`)
      .addFields(fields)
      .setFooter({ text: tr('logs.log.roleId', { id: after.id }) });
    await this.post(after.guild, 'roleUpdate', embed);
  }
}
