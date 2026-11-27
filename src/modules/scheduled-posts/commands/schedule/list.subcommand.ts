import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { relativeTime } from '@/lib/duration';
import { ScheduledPostsService } from '../../scheduled-posts.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'scheduledPosts.list'))
export class ListSubcommand {
  private readonly posts = inject(ScheduledPostsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const posts = await this.posts.list(interaction.guildId);
    if (posts.length === 0) {
      return interaction.reply({
        content: tr('scheduledPosts.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const lines = posts.map((post) =>
      tr('scheduledPosts.replies.line', {
        id: post.id,
        channel: `<#${post.channelId}>`,
        when: relativeTime(post.nextRunAt),
        repeat: tr(`scheduledPosts.repeats.${post.repeat}`),
        preview: post.content.slice(0, 60),
      }),
    );
    const embed = new EmbedBuilder()
      .setTitle(tr('scheduledPosts.replies.listTitle'))
      .setDescription(lines.join('\n').slice(0, 4096));
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
