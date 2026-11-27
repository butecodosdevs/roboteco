import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { config } from '@/config';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, t } from '@/i18n';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'privacy.info'))
export class InfoSubcommand {
  async execute(interaction: GuildInteraction) {
    return interaction.reply({
      content: t(interaction.locale, 'privacy.infoText', { days: config.guildDataRetentionDays }),
      flags: MessageFlags.Ephemeral,
    });
  }
}
