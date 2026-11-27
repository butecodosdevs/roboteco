import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { InvitesService } from '../invites.service';

@On(Events.InviteDelete)
export class InviteDeleteEvent {
  private readonly invites = inject(InvitesService);

  async execute(...[invite]: ClientEvents[Events.InviteDelete]) {
    if (invite.guild) this.invites.forget(invite.guild.id, invite.code);
  }
}
