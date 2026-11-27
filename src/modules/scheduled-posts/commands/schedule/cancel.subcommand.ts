import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { ScheduledPostsService } from '../../scheduled-posts.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'scheduledPosts.cancel').addIntegerOption((opt) =>
    localize(opt, 'scheduledPosts.options.id').setRequired(true).setMinValue(1),
  ),
)
export class CancelSubcommand {
  private readonly posts = inject(ScheduledPostsService);

  async execute(interaction: GuildInteraction) {
    const id = interaction.options.getInteger('id', true);
    const cancelled = await this.posts.cancel(interaction.guildId, id);
    return interaction.reply({
      content: t(
        interaction.locale,
        cancelled ? 'scheduledPosts.replies.cancelled' : 'scheduledPosts.replies.notFound',
        { id },
      ),
      flags: MessageFlags.Ephemeral,
    });
  }
}
