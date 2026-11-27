import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { FeedsService } from '../../feeds.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'feeds.remove').addIntegerOption((opt) =>
    localize(opt, 'feeds.options.id').setRequired(true).setMinValue(1),
  ),
)
export class RemoveSubcommand {
  private readonly feeds = inject(FeedsService);

  async execute(interaction: GuildInteraction) {
    const id = interaction.options.getInteger('id', true);
    const removed = await this.feeds.remove(interaction.guildId, id);
    return interaction.reply({
      content: t(interaction.locale, removed ? 'feeds.replies.removed' : 'feeds.replies.notFound', {
        id,
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
}
