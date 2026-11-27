import { inject, Module, type OnGuildRemove, type OnUserErase } from '@/core';
import { RemindCommand } from './commands/remind/remind.command';
import { RemindersCommand } from './commands/reminders/reminders.command';
import { ReminderJob } from './jobs/reminder.job';
import { RemindersService } from './reminders.service';

@Module({ commands: [RemindCommand, RemindersCommand], jobs: [ReminderJob] })
export class RemindersModule implements OnGuildRemove, OnUserErase {
  private readonly reminders = inject(RemindersService);

  onGuildRemove(guildId: string) {
    return this.reminders.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.reminders.eraseUser(userId, guildId);
  }
}
