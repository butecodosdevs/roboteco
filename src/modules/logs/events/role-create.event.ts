import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.GuildRoleCreate)
export class RoleCreateEvent {
  private readonly logs = inject(LogsService);

  async execute(...[role]: ClientEvents[Events.GuildRoleCreate]) {
    await this.logs.roleCreated(role);
  }
}
