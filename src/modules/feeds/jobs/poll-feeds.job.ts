import type { Client } from 'discord.js';
import { inject, Job, schedule } from '@/core';
import { t } from '@/i18n';
import { logger } from '@/logger';
import { FeedParserService } from '../feed-parser.service';
import { FeedsService, seenLimit } from '../feeds.service';

export const pollIntervalMs = 10 * 60_000;
const maxPostsPerPoll = 5;

@Job('feeds.poll')
export class PollFeedsJob {
  async execute(_payload: Record<string, never>, client: Client<true>) {
    await schedule(PollFeedsJob, new Date(Date.now() + pollIntervalMs), {});
    const feeds = inject(FeedsService);
    const parser = inject(FeedParserService);

    for (const feed of await feeds.all()) {
      const guild = client.guilds.cache.get(feed.guildId);
      if (!guild) continue;
      try {
        const parsed = await parser.fetch(feed.url);
        const seen = new Set(feed.seenIds);
        const fresh = parsed.items.filter((item) => item.id && !seen.has(item.id));
        const channel = await guild.channels.fetch(feed.channelId).catch(() => null);
        if (channel?.isSendable()) {
          for (const item of fresh.slice(0, maxPostsPerPoll).reverse()) {
            await channel.send({
              content: t(guild.preferredLocale, 'feeds.post', {
                feed: feed.title,
                title: item.title,
                link: item.link,
              }),
              allowedMentions: { parse: [] },
            });
          }
        }
        const seenIds = [...fresh.map((i) => i.id), ...feed.seenIds].slice(0, seenLimit);
        await feeds.update(feed.id, { seenIds, failures: 0, lastCheckedAt: new Date() });
      } catch (error) {
        logger.warn({ err: error, feed: feed.id, url: feed.url }, 'Feed poll failed');
        await feeds.update(feed.id, { failures: feed.failures + 1, lastCheckedAt: new Date() });
      }
    }
  }
}
