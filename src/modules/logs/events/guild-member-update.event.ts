import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.GuildMemberUpdate)
export class GuildMemberUpdateEvent {
  private readonly logs = inject(LogsService);

  async execute(...[before, after]: ClientEvents[Events.GuildMemberUpdate]) {
    if (after.user.bot) return;
    await this.logs.memberUpdated(before, after);
  }
}
