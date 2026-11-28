import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.MessageDelete)
export class MessageDeleteEvent {
  private readonly logs = inject(LogsService);

  async execute(...[message]: ClientEvents[Events.MessageDelete]) {
    await this.logs.messageDeleted(message);
  }
}
