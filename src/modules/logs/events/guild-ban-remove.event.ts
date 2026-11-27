import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.GuildBanRemove)
export class GuildBanRemoveEvent {
  private readonly logs = inject(LogsService);

  async execute(...[ban]: ClientEvents[Events.GuildBanRemove]) {
    await this.logs.memberUnbanned(ban);
  }
}
