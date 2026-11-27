import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand, schedule } from '@/core';
import { defaultLocale, localizations, localize, t, translator } from '@/i18n';
import { parseDuration, relativeTime } from '@/lib/duration';
import { ScheduledPostJob } from '../../jobs/scheduled-post.job';
import {
  maxScheduledPosts,
  type PostRepeat,
  ScheduledPostsService,
} from '../../scheduled-posts.service';

const repeats: PostRepeat[] = ['none', 'daily', 'weekly'];

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'scheduledPosts.post')
    .addChannelOption((opt) =>
      localize(opt, 'scheduledPosts.options.channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addStringOption((opt) =>
      localize(opt, 'scheduledPosts.options.in').setRequired(true).setMaxLength(20),
    )
    .addStringOption((opt) =>
      localize(opt, 'scheduledPosts.options.message').setRequired(true).setMaxLength(2000),
    )
    .addStringOption((opt) =>
      localize(opt, 'scheduledPosts.options.repeat').addChoices(
        ...repeats.map((repeat) => ({
          name: t(defaultLocale, `scheduledPosts.repeats.${repeat}`),
          name_localizations: localizations(`scheduledPosts.repeats.${repeat}`),
          value: repeat,
        })),
      ),
    ),
)
export class PostSubcommand {
  private readonly posts = inject(ScheduledPostsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const seconds = parseDuration(interaction.options.getString('in', true));
    if (!seconds) return reply(tr('scheduledPosts.replies.invalidTime'));
    if ((await this.posts.count(interaction.guildId)) >= maxScheduledPosts) {
      return reply(tr('scheduledPosts.replies.tooMany', { max: maxScheduledPosts }));
    }
    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
    ]);
    const nextRunAt = new Date(Date.now() + seconds * 1000);
    const post = await this.posts.create({
      guildId: interaction.guildId,
      channelId: channel.id,
      content: interaction.options.getString('message', true),
      repeat: (interaction.options.getString('repeat') ?? 'none') as PostRepeat,
      nextRunAt,
      createdBy: interaction.user.id,
    });
    const jobId = await schedule(ScheduledPostJob, nextRunAt, { postId: post.id });
    await this.posts.update(post.id, { jobId });
    return reply(
      tr('scheduledPosts.replies.scheduled', {
        id: post.id,
        channel: channel.toString(),
        when: relativeTime(nextRunAt),
      }),
    );
  }
}
