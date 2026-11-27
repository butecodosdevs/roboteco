import { GatewayIntentBits, Partials } from 'discord.js';
import { inject, Module, type OnGuildRemove, type OnReady, type OnUserErase } from '@/core';
import { LevelsModule } from '@/modules/levels/levels.module';
import { DropsCommand } from './commands/drops/drops.command';
import { DropsService } from './drops.service';
import { MessageCreateEvent } from './events/message-create.event';
import { MessageReactionAddEvent } from './events/message-reaction-add.event';
import { MessageReactionRemoveEvent } from './events/message-reaction-remove.event';
import { DrawDropJob } from './jobs/draw-drop.job';

@Module({
  imports: [LevelsModule],
  intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
  commands: [DropsCommand],
  events: [MessageCreateEvent, MessageReactionAddEvent, MessageReactionRemoveEvent],
  jobs: [DrawDropJob],
})
export class DropsModule implements OnReady, OnGuildRemove, OnUserErase {
  private readonly drops = inject(DropsService);

  onReady() {
    return this.drops.load();
  }

  onGuildRemove(guildId: string) {
    return this.drops.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.drops.eraseUser(userId, guildId);
  }
}
