import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { StarboardService, starEmoji } from '../starboard.service';

@On(Events.MessageReactionRemove)
export class MessageReactionRemoveEvent {
  private readonly starboard = inject(StarboardService);

  async execute(...[reaction]: ClientEvents[Events.MessageReactionRemove]) {
    if (reaction.emoji.name !== starEmoji) return;
    const full = reaction.partial ? await reaction.fetch() : reaction;
    const message = full.message.partial ? await full.message.fetch() : full.message;
    if (!message.inGuild()) return;
    await this.starboard.sync(message, full.count ?? 0);
  }
}
