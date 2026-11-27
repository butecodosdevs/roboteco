import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { ReactionRolesService } from '../reaction-roles.service';

@On(Events.MessageDelete)
export class MessageDeleteEvent {
  private readonly reactionRoles = inject(ReactionRolesService);

  async execute(...[message]: ClientEvents[Events.MessageDelete]) {
    await this.reactionRoles.forget(message.id);
  }
}
