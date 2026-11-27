import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { BirthdaysService } from '../../birthdays.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'birthdays.remove'))
export class RemoveSubcommand {
  private readonly birthdays = inject(BirthdaysService);

  async execute(interaction: GuildInteraction) {
    await this.birthdays.remove(interaction.guildId, interaction.user.id);
    return interaction.reply({
      content: t(interaction.locale, 'birthdays.replies.removed'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
