import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.ChannelUpdate)
export class ChannelUpdateEvent {
  private readonly logs = inject(LogsService);

  async execute(...[before, after]: ClientEvents[Events.ChannelUpdate]) {
    if (before.isDMBased() || after.isDMBased()) return;
    await this.logs.channelUpdated(before, after);
  }
}
