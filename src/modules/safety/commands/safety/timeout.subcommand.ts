import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

// Discord caps timeouts at 28 days.
const maxMinutes = 28 * 24 * 60;

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'safety.timeout').addIntegerOption((opt) =>
    localize(opt, 'safety.options.minutes')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(maxMinutes),
  ),
)
export class TimeoutSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const minutes = interaction.options.getInteger('minutes', true);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      safetyTimeoutMinutes: minutes || null,
    });
    return interaction.reply({
      content: minutes
        ? tr('safety.replies.timeoutSet', { minutes })
        : tr('safety.replies.timeoutOff'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
