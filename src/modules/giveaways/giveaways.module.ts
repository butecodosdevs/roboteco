import { inject, Module, type OnGuildRemove, type OnUserErase } from '@/core';
import { GiveawayCommand } from './commands/giveaway/giveaway.command';
import { EnterButton } from './components/enter.button';
import { GiveawaysService } from './giveaways.service';
import { EndGiveawayJob } from './jobs/end-giveaway.job';

@Module({ commands: [GiveawayCommand], components: [EnterButton], jobs: [EndGiveawayJob] })
export class GiveawaysModule implements OnGuildRemove, OnUserErase {
  private readonly giveaways = inject(GiveawaysService);

  onGuildRemove(guildId: string) {
    return this.giveaways.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.giveaways.eraseUser(userId, guildId);
  }
}
