import { GatewayIntentBits } from 'discord.js';
import { inject, Module, type OnGuildRemove } from '@/core';
import { CountingCommand } from './commands/counting/counting.command';
import { CountingService } from './counting.service';
import { MessageCreateEvent } from './events/message-create.event';

@Module({
  intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  commands: [CountingCommand],
  events: [MessageCreateEvent],
})
export class CountingModule implements OnGuildRemove {
  private readonly counting = inject(CountingService);

  onGuildRemove(guildId: string) {
    return this.counting.purgeGuild(guildId);
  }
}
