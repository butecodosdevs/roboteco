import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { ModerationSettingsService } from '../../moderation-settings.service';

@Subcommand(
  localize(
    new SlashCommandSubcommandBuilder(),
    'moderation.commands.settingsWarnExpiry',
  ).addIntegerOption((opt) =>
    localize(opt, 'moderation.options.expiryDays')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(3650),
  ),
)
export class WarnExpirySubcommand {
  private readonly settings = inject(ModerationSettingsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const days = interaction.options.getInteger('days', true);
    await this.settings.update(interaction.guildId, interaction.guild.preferredLocale, {
      warnExpiryDays: days,
    });
    return interaction.reply({
      content: days
        ? tr('moderation.replies.expirySet', { days })
        : tr('moderation.replies.expiryForever'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
