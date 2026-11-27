import { GatewayIntentBits, Partials } from 'discord.js';
import { inject, Module, type OnGuildRemove } from '@/core';
import { StarboardCommand } from './commands/starboard/starboard.command';
import { MessageReactionAddEvent } from './events/message-reaction-add.event';
import { MessageReactionRemoveEvent } from './events/message-reaction-remove.event';
import { StarboardService } from './starboard.service';

@Module({
  intents: [GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
  commands: [StarboardCommand],
  events: [MessageReactionAddEvent, MessageReactionRemoveEvent],
})
export class StarboardModule implements OnGuildRemove {
  private readonly starboard = inject(StarboardService);

  onGuildRemove(guildId: string) {
    return this.starboard.purgeGuild(guildId);
  }
}
