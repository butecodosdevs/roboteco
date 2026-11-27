import { GatewayIntentBits } from 'discord.js';
import { inject, Module, type OnGuildRemove, type OnUserErase } from '@/core';
import { LeaderboardCommand } from './commands/leaderboard/leaderboard.command';
import { LevelsCommand } from './commands/levels/levels.command';
import { RankCommand } from './commands/rank/rank.command';
import { MessageCreateEvent } from './events/message-create.event';
import { LevelsService } from './levels.service';

@Module({
  intents: [GatewayIntentBits.GuildMessages],
  commands: [RankCommand, LeaderboardCommand, LevelsCommand],
  events: [MessageCreateEvent],
})
export class LevelsModule implements OnGuildRemove, OnUserErase {
  private readonly levels = inject(LevelsService);

  onGuildRemove(guildId: string) {
    return this.levels.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.levels.eraseUser(userId, guildId);
  }
}
