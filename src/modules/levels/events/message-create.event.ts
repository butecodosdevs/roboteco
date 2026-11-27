import { Events, type Message } from 'discord.js';
import { inject, On } from '@/core';
import { LevelsService } from '../levels.service';

@On(Events.MessageCreate)
export class MessageCreateEvent {
  private readonly levels = inject(LevelsService);

  async execute(message: Message) {
    if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
    await this.levels.award(message);
  }
}
