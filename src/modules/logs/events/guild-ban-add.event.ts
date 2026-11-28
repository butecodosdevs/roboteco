import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.GuildBanAdd)
export class GuildBanAddEvent {
  private readonly logs = inject(LogsService);

  async execute(...[ban]: ClientEvents[Events.GuildBanAdd]) {
    await this.logs.memberBanned(ban);
  }
}
