import {
  ActionRowBuilder,
  type Guild,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { customId, type GuildModalInteraction, inject, Modal } from '@/core';
import { getGuildSettings } from '@/db';
import { t, translator } from '@/i18n';
import { ReportsService } from '../reports.service';
import { renderReport } from './report-action.button';

const reasonField = 'reason';

export function reportModal(locale: string, ...target: string[]): ModalBuilder {
  const tr = translator(locale);
  return new ModalBuilder()
    .setCustomId(customId(ReportModal, ...target))
    .setTitle(tr('reports.modal.title'))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(reasonField)
          .setLabel(tr('reports.modal.reason'))
          .setPlaceholder(tr('reports.modal.placeholder'))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000),
      ),
    );
}

async function reportsChannel(guild: Guild) {
  const channelId = (await getGuildSettings(guild.id))?.reportsChannelId;
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
  return channel?.isSendable() ? channel : null;
}

@Modal('reports.submit')
export class ReportModal {
  private readonly reports = inject(ReportsService);

  async execute(interaction: GuildModalInteraction, [kind, ...ids]: string[]) {
    const reply = (
      key: 'reports.replies.sent' | 'reports.replies.notConfigured' | 'reports.replies.messageGone',
    ) => interaction.reply({ content: t(interaction.locale, key), flags: MessageFlags.Ephemeral });
    const { guild } = interaction;

    const channel = await reportsChannel(guild);
    if (!channel) return reply('reports.replies.notConfigured');

    const reason = interaction.fields.getTextInputValue(reasonField);
    let target: { targetId: string; channelId?: string; messageId?: string; excerpt?: string };
    if (kind === 'message') {
      const [channelId = '', messageId = ''] = ids;
      const source = await guild.channels.fetch(channelId).catch(() => null);
      const message = source?.isTextBased()
        ? await source.messages.fetch(messageId).catch(() => null)
        : null;
      if (!message) return reply('reports.replies.messageGone');
      target = {
        targetId: message.author.id,
        channelId,
        messageId,
        excerpt: message.content.slice(0, 1000),
      };
    } else {
      target = { targetId: ids[0] ?? '' };
    }

    const report = await this.reports.create({
      guildId: guild.id,
      reporterId: interaction.user.id,
      reason,
      ...target,
    });
    await channel.send({ ...renderReport(guild, report), allowedMentions: { parse: [] } });
    return reply('reports.replies.sent');
  }
}
