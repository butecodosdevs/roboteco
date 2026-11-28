import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { refuseWithoutManageGuild } from './require-manage-guild';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'embeds.toggle').addBooleanOption((opt) =>
    localize(opt, 'embeds.options.enabled').setRequired(true),
  ),
)
export class ToggleSubcommand {
  async execute(interaction: GuildInteraction) {
    if (await refuseWithoutManageGuild(interaction)) return;
    const tr = translator(interaction.locale);
    const enabled = interaction.options.getBoolean('enabled', true);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      embedsEnabled: enabled,
    });
    return interaction.reply({
      content: tr(enabled ? 'embeds.replies.enabled' : 'embeds.replies.disabled'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
