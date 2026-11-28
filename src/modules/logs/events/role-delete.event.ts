import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.GuildRoleDelete)
export class RoleDeleteEvent {
  private readonly logs = inject(LogsService);

  async execute(...[role]: ClientEvents[Events.GuildRoleDelete]) {
    await this.logs.roleDeleted(role);
  }
}
