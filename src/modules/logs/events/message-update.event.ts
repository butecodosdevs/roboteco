import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.MessageUpdate)
export class MessageUpdateEvent {
  private readonly logs = inject(LogsService);

  async execute(...[before, after]: ClientEvents[Events.MessageUpdate]) {
    await this.logs.messageEdited(before, after);
  }
}
