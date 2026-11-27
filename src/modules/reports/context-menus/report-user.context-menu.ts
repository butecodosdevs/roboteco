import { ContextMenuCommandBuilder, MessageFlags } from 'discord.js';
import { type GuildUserContextInteraction, UserContextMenu } from '@/core';
import { localizeName, t } from '@/i18n';
import { reportModal } from '../components/report.modal';

@UserContextMenu(localizeName(new ContextMenuCommandBuilder(), 'reports.menus.user'), {
  cooldown: 30,
})
export class ReportUserContextMenu {
  async execute(interaction: GuildUserContextInteraction) {
    if (interaction.targetId === interaction.user.id) {
      return interaction.reply({
        content: t(interaction.locale, 'reports.replies.self'),
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.showModal(reportModal(interaction.locale, 'user', interaction.targetId));
  }
}
