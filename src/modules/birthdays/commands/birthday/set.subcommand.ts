import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { BirthdaysService, isValidDate } from '../../birthdays.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'birthdays.set')
    .addIntegerOption((opt) =>
      localize(opt, 'birthdays.options.month').setRequired(true).setMinValue(1).setMaxValue(12),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'birthdays.options.day').setRequired(true).setMinValue(1).setMaxValue(31),
    ),
)
export class SetSubcommand {
  private readonly birthdays = inject(BirthdaysService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const month = interaction.options.getInteger('month', true);
    const day = interaction.options.getInteger('day', true);
    if (!isValidDate(month, day)) {
      return interaction.reply({
        content: tr('birthdays.replies.invalidDate'),
        flags: MessageFlags.Ephemeral,
      });
    }
    await this.birthdays.set(interaction.guildId, interaction.user.id, month, day);
    return interaction.reply({
      content: tr('birthdays.replies.saved', {
        day: String(day).padStart(2, '0'),
        month: String(month).padStart(2, '0'),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
}
