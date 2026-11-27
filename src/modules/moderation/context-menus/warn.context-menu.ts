import { ContextMenuCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { type GuildUserContextInteraction, UserContextMenu } from '@/core';
import { localizeName } from '@/i18n';
import { warnModal } from '../components/warn.modal';

@UserContextMenu(
  localizeName(
    new ContextMenuCommandBuilder(),
    'moderation.menus.warn',
  ).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
)
export class WarnContextMenu {
  async execute(interaction: GuildUserContextInteraction) {
    return interaction.showModal(warnModal(interaction.locale, interaction.targetUser));
  }
}
