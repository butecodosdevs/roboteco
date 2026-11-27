import { ContextMenuCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { type GuildUserContextInteraction, UserContextMenu } from '@/core';
import { localizeName } from '@/i18n';
import { timeoutModal } from '../components/timeout.modal';

@UserContextMenu(
  localizeName(
    new ContextMenuCommandBuilder(),
    'moderation.menus.timeout',
  ).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
)
export class TimeoutContextMenu {
  async execute(interaction: GuildUserContextInteraction) {
    return interaction.showModal(timeoutModal(interaction.locale, interaction.targetUser));
  }
}
