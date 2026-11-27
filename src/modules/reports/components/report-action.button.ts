import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Guild,
  type MessageCreateOptions,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { Button, customId, type GuildButtonInteraction, inject } from '@/core';
import { t, translator } from '@/i18n';
import { type Report, ReportsService } from '../reports.service';

const colors = { open: 0xe67e22, resolved: 0x2ecc71, dismissed: 0x95a5a6 } as const;

export function renderReport(
  guild: Guild,
  report: Report,
): Pick<MessageCreateOptions, 'embeds' | 'components'> {
  const tr = translator(guild.preferredLocale);
  const embed = new EmbedBuilder()
    .setColor(colors[report.status])
    .setTitle(tr('reports.embed.title', { id: report.id }))
    .addFields(
      {
        name: tr('reports.embed.target'),
        value: `<@${report.targetId}> (${report.targetId})`,
        inline: true,
      },
      { name: tr('reports.embed.reporter'), value: `<@${report.reporterId}>`, inline: true },
      { name: tr('reports.embed.reason'), value: report.reason },
    )
    .setTimestamp(report.createdAt);
  if (report.messageId) {
    embed.addFields({
      name: tr('reports.embed.message'),
      value: report.excerpt || tr('reports.embed.noContent'),
    });
  }
  embed.addFields({
    name: tr('reports.embed.status'),
    value: report.handledBy
      ? tr('reports.embed.handledBy', {
          status: tr(`reports.status.${report.status}`),
          moderator: `<@${report.handledBy}>`,
        })
      : tr(`reports.status.${report.status}`),
  });

  const buttons: ButtonBuilder[] = [];
  if (report.status === 'open') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(customId(ReportActionButton, report.id, 'resolved'))
        .setStyle(ButtonStyle.Success)
        .setLabel(tr('reports.buttons.resolve')),
      new ButtonBuilder()
        .setCustomId(customId(ReportActionButton, report.id, 'dismissed'))
        .setStyle(ButtonStyle.Secondary)
        .setLabel(tr('reports.buttons.dismiss')),
    );
  }
  if (report.channelId && report.messageId) {
    buttons.push(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(tr('reports.embed.jump'))
        .setURL(`https://discord.com/channels/${guild.id}/${report.channelId}/${report.messageId}`),
    );
  }
  return {
    embeds: [embed],
    components:
      buttons.length > 0 ? [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)] : [],
  };
}

@Button('reports.action')
export class ReportActionButton {
  private readonly reports = inject(ReportsService);

  async execute(interaction: GuildButtonInteraction, [id, status]: string[]) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: t(interaction.locale, 'reports.replies.notAllowed'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const updated = await this.reports.setStatus(
      interaction.guildId,
      Number(id),
      status === 'resolved' ? 'resolved' : 'dismissed',
      interaction.user.id,
    );
    if (!updated) return interaction.deferUpdate();
    return interaction.update(renderReport(interaction.guild, updated));
  }
}
