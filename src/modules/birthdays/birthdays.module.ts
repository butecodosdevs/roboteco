import {
  ensureScheduled,
  inject,
  Module,
  type OnGuildRemove,
  type OnReady,
  type OnUserErase,
} from '@/core';
import { BirthdaysService, nextMidnightUtc } from './birthdays.service';
import { BirthdayCommand } from './commands/birthday/birthday.command';
import { BirthdaysJob } from './jobs/birthdays.job';

@Module({ commands: [BirthdayCommand], jobs: [BirthdaysJob] })
export class BirthdaysModule implements OnReady, OnGuildRemove, OnUserErase {
  private readonly birthdays = inject(BirthdaysService);

  onReady() {
    return ensureScheduled(BirthdaysJob, nextMidnightUtc(), {});
  }

  onGuildRemove(guildId: string) {
    return this.birthdays.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.birthdays.eraseUser(userId, guildId);
  }
}
