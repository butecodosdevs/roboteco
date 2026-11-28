import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.GuildMemberAdd)
export class GuildMemberAddEvent {
  private readonly logs = inject(LogsService);

  async execute(...[member]: ClientEvents[Events.GuildMemberAdd]) {
    if (member.user.bot) return;
    await this.logs.memberJoined(member);
  }
}
