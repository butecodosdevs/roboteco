import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { decideSuggestion } from './decide';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'suggestions.approve')
    .addIntegerOption((opt) =>
      localize(opt, 'suggestions.options.id').setRequired(true).setMinValue(1),
    )
    .addStringOption((opt) => localize(opt, 'suggestions.options.reason').setMaxLength(1000)),
)
export class ApproveSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const id = interaction.options.getInteger('id', true);
    const decided = await decideSuggestion(interaction, id, 'approved');
    return interaction.reply({
      content: decided
        ? tr('suggestions.replies.decided', { id, status: tr('suggestions.status.approved') })
        : tr('suggestions.replies.notFound', { id }),
      flags: MessageFlags.Ephemeral,
    });
  }
}
