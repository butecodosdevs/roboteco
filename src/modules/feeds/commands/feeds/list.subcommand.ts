import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { FeedsService } from '../../feeds.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'feeds.list'))
export class ListSubcommand {
  private readonly feeds = inject(FeedsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const feeds = await this.feeds.list(interaction.guildId);
    if (feeds.length === 0) {
      return interaction.reply({
        content: tr('feeds.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const embed = new EmbedBuilder().setTitle(tr('feeds.replies.listTitle')).setDescription(
      feeds
        .map((feed) =>
          tr('feeds.replies.line', {
            id: feed.id,
            title: feed.title,
            channel: `<#${feed.channelId}>`,
          }),
        )
        .join('\n'),
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
