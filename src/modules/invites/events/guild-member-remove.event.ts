import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { InvitesService } from '../invites.service';

@On(Events.GuildMemberRemove)
export class GuildMemberRemoveEvent {
  private readonly invites = inject(InvitesService);

  async execute(...[member]: ClientEvents[Events.GuildMemberRemove]) {
    await this.invites.recordLeave(member);
  }
}
