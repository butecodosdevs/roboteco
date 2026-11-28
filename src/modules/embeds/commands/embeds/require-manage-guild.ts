import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { GuildInteraction } from '@/core';
import { t } from '@/i18n';

/**
 * Server admins can open a command to anyone in Server Settings > Integrations, so the default
 * permission on /embeds is not enough: refuse members without Manage Server here.
 * Returns true when the member was refused.
 */
export async function refuseWithoutManageGuild(interaction: GuildInteraction): Promise<boolean> {
  if (interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return false;
  await interaction.reply({
    content: t(interaction.locale, 'embeds.replies.noPermission'),
    flags: MessageFlags.Ephemeral,
  });
  return true;
}
