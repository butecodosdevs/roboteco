import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { config } from '@/config';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'antiraid.config')
    .addIntegerOption((opt) =>
      localize(opt, 'antiraid.options.joins').setRequired(true).setMinValue(0).setMaxValue(100),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'antiraid.options.seconds').setMinValue(2).setMaxValue(300),
    ),
)
export class ConfigSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const joins = interaction.options.getInteger('joins', true);
    const seconds = interaction.options.getInteger('seconds') ?? 10;
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      antiraidJoins: joins || null,
      antiraidSeconds: seconds,
    });
    const lines = [
      joins
        ? tr('antiraid.replies.configured', { joins, seconds })
        : tr('antiraid.replies.disabled'),
    ];
    if (joins && !config.privilegedIntents) lines.push(tr('antiraid.replies.intentDisabled'));
    return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
  }
}
