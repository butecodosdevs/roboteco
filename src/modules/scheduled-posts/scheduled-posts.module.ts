import { inject, Module, type OnGuildRemove } from '@/core';
import { ScheduleCommand } from './commands/schedule/schedule.command';
import { ScheduledPostJob } from './jobs/scheduled-post.job';
import { ScheduledPostsService } from './scheduled-posts.service';

@Module({ commands: [ScheduleCommand], jobs: [ScheduledPostJob] })
export class ScheduledPostsModule implements OnGuildRemove {
  private readonly posts = inject(ScheduledPostsService);

  onGuildRemove(guildId: string) {
    return this.posts.purgeGuild(guildId);
  }
}
