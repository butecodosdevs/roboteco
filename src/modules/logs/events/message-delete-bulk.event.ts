import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.MessageBulkDelete)
export class MessageBulkDeleteEvent {
  private readonly logs = inject(LogsService);

  async execute(...[messages, channel]: ClientEvents[Events.MessageBulkDelete]) {
    await this.logs.messagesBulkDeleted(channel.guild, channel.id, messages.size);
  }
}
