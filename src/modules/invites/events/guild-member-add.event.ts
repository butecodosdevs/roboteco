import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { InvitesService } from '../invites.service';

@On(Events.GuildMemberAdd)
export class GuildMemberAddEvent {
  private readonly invites = inject(InvitesService);

  async execute(...[member]: ClientEvents[Events.GuildMemberAdd]) {
    await this.invites.recordJoin(member);
  }
}
