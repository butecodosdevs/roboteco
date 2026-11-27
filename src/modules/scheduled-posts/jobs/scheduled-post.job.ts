import type { Client } from 'discord.js';
import { inject, Job, schedule } from '@/core';
import { logger } from '@/logger';
import { repeatMs, ScheduledPostsService } from '../scheduled-posts.service';

export interface ScheduledPostPayload {
  postId: number;
}

@Job('scheduled-posts.post')
export class ScheduledPostJob {
  async execute({ postId }: ScheduledPostPayload, client: Client<true>) {
    const posts = inject(ScheduledPostsService);
    const post = await posts.get(postId);
    if (!post) return;

    const channel = await client.channels.fetch(post.channelId).catch(() => null);
    if (channel?.isSendable()) {
      await channel
        .send({ content: post.content, allowedMentions: { parse: [] } })
        .catch((error) => logger.warn({ err: error, post: post.id }, 'Scheduled post failed'));
    }

    if (post.repeat === 'none') return posts.complete(post.id);
    let next = post.nextRunAt.getTime() + repeatMs[post.repeat];
    while (next <= Date.now()) next += repeatMs[post.repeat];
    const nextRunAt = new Date(next);
    const jobId = await schedule(ScheduledPostJob, nextRunAt, { postId: post.id });
    await posts.update(post.id, { nextRunAt, jobId });
  }
}
