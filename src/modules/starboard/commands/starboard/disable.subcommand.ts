import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, t } from '@/i18n';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'starboard.disable'))
export class DisableSubcommand {
  async execute(interaction: GuildInteraction) {
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      starboardChannelId: null,
    });
    return interaction.reply({
      content: t(interaction.locale, 'starboard.replies.disabled'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
