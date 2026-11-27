import { Events, type Message } from 'discord.js';
import { inject, On } from '@/core';
import { CountingService } from '../counting.service';

@On(Events.MessageCreate)
export class MessageCreateEvent {
  private readonly counting = inject(CountingService);

  async execute(message: Message) {
    if (!message.inGuild() || message.author.bot || message.webhookId) return;
    await this.counting.handle(message);
  }
}
