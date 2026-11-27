import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { DropsService, dropEmoji } from '../drops.service';

@On(Events.MessageReactionRemove)
export class MessageReactionRemoveEvent {
  private readonly drops = inject(DropsService);

  async execute(...[reaction, user]: ClientEvents[Events.MessageReactionRemove]) {
    if (user.bot || reaction.emoji.name !== dropEmoji) return;
    await this.drops.leave(reaction.message.id, user.id);
  }
}
