import { ensureScheduled, inject, Module, type OnGuildRemove, type OnReady } from '@/core';
import { FeedsCommand } from './commands/feeds/feeds.command';
import { FeedsService } from './feeds.service';
import { PollFeedsJob, pollIntervalMs } from './jobs/poll-feeds.job';

@Module({ commands: [FeedsCommand], jobs: [PollFeedsJob] })
export class FeedsModule implements OnReady, OnGuildRemove {
  private readonly feeds = inject(FeedsService);

  onReady() {
    return ensureScheduled(PollFeedsJob, new Date(Date.now() + pollIntervalMs), {});
  }

  onGuildRemove(guildId: string) {
    return this.feeds.purgeGuild(guildId);
  }
}
