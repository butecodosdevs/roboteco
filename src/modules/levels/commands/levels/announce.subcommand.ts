import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, t } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'levels.announce').addBooleanOption((opt) =>
    localize(opt, 'levels.options.enabled').setRequired(true),
  ),
)
export class AnnounceSubcommand {
  async execute(interaction: GuildInteraction) {
    const enabled = interaction.options.getBoolean('enabled', true);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      levelUpAnnounce: enabled,
    });
    return interaction.reply({
      content: t(
        interaction.locale,
        enabled ? 'levels.replies.announceOn' : 'levels.replies.announceOff',
      ),
      flags: MessageFlags.Ephemeral,
    });
  }
}
