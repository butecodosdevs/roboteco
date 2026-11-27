import { EmbedBuilder, type Guild, type SendableChannels } from 'discord.js';
import { Injectable, inject } from '@/core';
import { translator } from '@/i18n';
import {
  type CaseAction,
  CasesService,
  formatDuration,
  type ModerationCase,
} from './cases.service';
import { ModerationSettingsService } from './moderation-settings.service';

const colors: Record<CaseAction, number> = {
  warn: 0xf1c40f,
  timeout: 0xe67e22,
  untimeout: 0x2ecc71,
  kick: 0xe74c3c,
  ban: 0x992d22,
  unban: 0x2ecc71,
};

export interface PurgeEntry {
  moderatorId: string;
  channelId: string;
  count: number;
  userId?: string;
}

@Injectable()
export class ModLogService {
  private readonly settings = inject(ModerationSettingsService);
  private readonly cases = inject(CasesService);

  caseEmbed(locale: string, entry: ModerationCase): EmbedBuilder {
    const tr = translator(locale);
    const embed = new EmbedBuilder()
      .setColor(colors[entry.action])
      .setTitle(
        tr('moderation.log.caseTitle', {
          case: entry.number,
          action: tr(`moderation.actions.${entry.action}`),
        }),
      )
      .addFields(
        {
          name: tr('moderation.log.user'),
          value: `<@${entry.targetId}> (${entry.targetId})`,
          inline: true,
        },
        { name: tr('moderation.log.moderator'), value: `<@${entry.moderatorId}>`, inline: true },
      )
      .setTimestamp(entry.createdAt);
    if (entry.durationSeconds) {
      embed.addFields({
        name: tr('moderation.log.duration'),
        value: formatDuration(locale, entry.durationSeconds),
        inline: true,
      });
    }
    return embed.addFields({
      name: tr('moderation.log.reason'),
      value: entry.reason ?? tr('moderation.log.noReason'),
    });
  }

  async postCase(guild: Guild, entry: ModerationCase): Promise<void> {
    const channel = await this.channel(guild);
    if (!channel) return;
    const message = await channel
      .send({
        embeds: [this.caseEmbed(guild.preferredLocale, entry)],
        allowedMentions: { parse: [] },
      })
      .catch(() => null);
    if (message) await this.cases.setLogMessage(entry.id, channel.id, message.id);
  }

  async updateCase(guild: Guild, entry: ModerationCase): Promise<void> {
    if (!entry.logChannelId || !entry.logMessageId) return;
    const channel = await guild.channels.fetch(entry.logChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(entry.logMessageId).catch(() => null);
    await message
      ?.edit({ embeds: [this.caseEmbed(guild.preferredLocale, entry)] })
      .catch(() => undefined);
  }

  async postPurge(guild: Guild, entry: PurgeEntry): Promise<void> {
    const channel = await this.channel(guild);
    if (!channel) return;
    const tr = translator(guild.preferredLocale);
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle(tr('moderation.log.purgeTitle'))
      .addFields(
        { name: tr('moderation.log.channel'), value: `<#${entry.channelId}>`, inline: true },
        { name: tr('moderation.log.count'), value: String(entry.count), inline: true },
        { name: tr('moderation.log.moderator'), value: `<@${entry.moderatorId}>`, inline: true },
      )
      .setTimestamp(new Date());
    if (entry.userId) {
      embed.addFields({
        name: tr('moderation.log.user'),
        value: `<@${entry.userId}> (${entry.userId})`,
      });
    }
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => undefined);
  }

  async postAlert(guild: Guild, title: string, description: string): Promise<void> {
    const channel = await this.channel(guild);
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp(new Date());
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => undefined);
  }

  private async channel(guild: Guild): Promise<SendableChannels | null> {
    const { logChannelId } = await this.settings.get(guild.id);
    if (!logChannelId) return null;
    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    return channel?.isSendable() ? channel : null;
  }
}
