import { ContextMenuCommandBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { type GuildMessageContextInteraction, MessageContextMenu } from '@/core';
import { localizeName, t } from '@/i18n';

@MessageContextMenu(
  localizeName(new ContextMenuCommandBuilder(), 'dev.menus.message').setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator,
  ),
)
export class FidelityMessageContextMenu {
  async execute(interaction: GuildMessageContextInteraction) {
    return interaction.reply({
      content: t(interaction.locale, 'dev.replies.received'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
