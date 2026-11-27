import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { DropsService, dropEmoji } from '../drops.service';

@On(Events.MessageReactionAdd)
export class MessageReactionAddEvent {
  private readonly drops = inject(DropsService);

  async execute(...[reaction, user]: ClientEvents[Events.MessageReactionAdd]) {
    if (user.bot || reaction.emoji.name !== dropEmoji) return;
    await this.drops.enter(reaction.message.id, user.id);
  }
}
