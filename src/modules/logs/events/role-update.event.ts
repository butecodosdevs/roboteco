import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.GuildRoleUpdate)
export class RoleUpdateEvent {
  private readonly logs = inject(LogsService);

  async execute(...[before, after]: ClientEvents[Events.GuildRoleUpdate]) {
    await this.logs.roleUpdated(before, after);
  }
}
