import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.GuildMemberRemove)
export class GuildMemberRemoveEvent {
  private readonly logs = inject(LogsService);

  async execute(...[member]: ClientEvents[Events.GuildMemberRemove]) {
    if (member.user.bot) return;
    await this.logs.memberLeft(member);
  }
}
