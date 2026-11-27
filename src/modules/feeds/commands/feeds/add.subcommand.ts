import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { FeedParserService } from '../../feed-parser.service';
import { FeedsService, maxFeeds, seenLimit } from '../../feeds.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'feeds.add')
    .addStringOption((opt) =>
      localize(opt, 'feeds.options.url').setRequired(true).setMaxLength(500),
    )
    .addChannelOption((opt) =>
      localize(opt, 'feeds.options.channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    ),
  { cooldown: 10 },
)
export class AddSubcommand {
  private readonly feeds = inject(FeedsService);
  private readonly parser = inject(FeedParserService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if ((await this.feeds.count(interaction.guildId)) >= maxFeeds) {
      return interaction.editReply(tr('feeds.replies.tooMany', { max: maxFeeds }));
    }
    const url = interaction.options.getString('url', true);
    const parsed = await this.parser.fetch(url).catch(() => null);
    if (!parsed) return interaction.editReply(tr('feeds.replies.invalid'));

    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
    ]);
    await this.feeds.add({
      guildId: interaction.guildId,
      channelId: channel.id,
      url,
      title: parsed.title.slice(0, 100),
      seenIds: parsed.items.map((item) => item.id).slice(0, seenLimit),
    });
    return interaction.editReply(
      tr('feeds.replies.added', { title: parsed.title, channel: channel.toString() }),
    );
  }
}
