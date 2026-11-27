import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { RemindersService } from '../../reminders.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'reminders.cancel').addIntegerOption((opt) =>
    localize(opt, 'reminders.options.id').setRequired(true).setMinValue(1),
  ),
)
export class CancelSubcommand {
  private readonly reminders = inject(RemindersService);

  async execute(interaction: ChatInputCommandInteraction) {
    const id = interaction.options.getInteger('id', true);
    const cancelled = await this.reminders.cancel(interaction.user.id, id);
    return interaction.reply({
      content: t(
        interaction.locale,
        cancelled ? 'reminders.replies.cancelled' : 'reminders.replies.notFound',
        { id },
      ),
      flags: MessageFlags.Ephemeral,
    });
  }
}
