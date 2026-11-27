import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { InvitesService } from '../invites.service';

@On(Events.InviteCreate)
export class InviteCreateEvent {
  private readonly invites = inject(InvitesService);

  async execute(...[invite]: ClientEvents[Events.InviteCreate]) {
    if (invite.guild)
      this.invites.remember(invite.guild.id, invite.code, invite.inviterId, invite.uses ?? 0);
  }
}
