import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { SafetyService } from '../safety.service';

@On(Events.MessageCreate)
export class MessageCreateEvent {
  private readonly safety = inject(SafetyService);

  async execute(...[message]: ClientEvents[Events.MessageCreate]) {
    if (!message.inGuild() || message.system || message.author.id === message.client.user.id) {
      return;
    }
    await this.safety.process(message);
  }
}
