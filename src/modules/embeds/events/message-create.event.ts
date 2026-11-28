import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { EmbedsService } from '../embeds.service';

@On(Events.MessageCreate)
export class MessageCreateEvent {
  private readonly embeds = inject(EmbedsService);

  async execute(...[message]: ClientEvents[Events.MessageCreate]) {
    if (message.author.bot || message.webhookId || message.system || !message.inGuild()) return;
    await this.embeds.process(message);
  }
}
