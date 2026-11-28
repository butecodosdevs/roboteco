import { ContextMenuCommandBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { type GuildUserContextInteraction, UserContextMenu } from '@/core';
import { localizeName, t } from '@/i18n';

@UserContextMenu(
  localizeName(new ContextMenuCommandBuilder(), 'dev.menus.user').setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator,
  ),
)
export class FidelityUserContextMenu {
  async execute(interaction: GuildUserContextInteraction) {
    return interaction.reply({
      content: t(interaction.locale, 'dev.replies.received'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
