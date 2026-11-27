import { ContextMenuCommandBuilder, MessageFlags } from 'discord.js';
import { type GuildMessageContextInteraction, MessageContextMenu } from '@/core';
import { localizeName, t } from '@/i18n';
import { reportModal } from '../components/report.modal';

@MessageContextMenu(localizeName(new ContextMenuCommandBuilder(), 'reports.menus.message'), {
  cooldown: 30,
})
export class ReportMessageContextMenu {
  async execute(interaction: GuildMessageContextInteraction) {
    const message = interaction.targetMessage;
    if (message.author.id === interaction.user.id) {
      return interaction.reply({
        content: t(interaction.locale, 'reports.replies.self'),
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.showModal(
      reportModal(interaction.locale, 'message', message.channelId, message.id),
    );
  }
}
