import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.ChannelCreate)
export class ChannelCreateEvent {
  private readonly logs = inject(LogsService);

  async execute(...[channel]: ClientEvents[Events.ChannelCreate]) {
    await this.logs.channelCreated(channel);
  }
}
