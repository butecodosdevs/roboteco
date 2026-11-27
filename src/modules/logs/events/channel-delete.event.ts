import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.ChannelDelete)
export class ChannelDeleteEvent {
  private readonly logs = inject(LogsService);

  async execute(...[channel]: ClientEvents[Events.ChannelDelete]) {
    if (channel.isDMBased()) return;
    await this.logs.channelDeleted(channel);
  }
}
